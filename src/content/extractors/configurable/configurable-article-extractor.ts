import type { Article, ArticleBlock, ArticleSource } from '../../../shared/article.js';
import { validateArticle, type ValidationResult } from '../../../shared/article-validator.js';
import type { ArticleExtractor, ExtractorContext, ExtractorMatch, ReadyResult } from '../../../shared/extractor-types.js';
import { normalizeText } from '../../../shared/text.js';
import type { PlatformAdapter, ValidationConfig } from '../../adapters/index.js';
import { buildCleanTreePrimaryBlocks, type CleanTreePrimaryBlocksResult } from '../../preprocess/clean-tree-main-path.js';
import { waitForStableDom } from './dom-readiness.js';

export type ConfigurableArticleExtractionOptions = {
  id?: string;
  source?: ArticleSource;
  canonicalUrl?: string;
  debugId?: string;
  legacyBlocks?: ArticleBlock[];
};

export type ConfigurableArticleExtractionDiagnostics = Pick<
  CleanTreePrimaryBlocksResult,
  'fallbackBlockCount' | 'highRiskBlockCount' | 'replacedBlockCount'
> & {
  adapterId: string;
  platform: PlatformAdapter['platform'];
};

export type ConfigurableArticleExtractionResult = {
  article: Article;
  cleanTreeBlocks: ArticleBlock[];
  diagnostics: ConfigurableArticleExtractionDiagnostics;
};

export type AdapterDrivenArticleExtractorOptions = {
  excludeAdapterIds?: string[];
};

export function createAdapterDrivenArticleExtractor(
  adapters: PlatformAdapter[],
  options: AdapterDrivenArticleExtractorOptions = {}
): ArticleExtractor {
  const excluded = new Set(options.excludeAdapterIds ?? []);
  const activeAdapters = () => adapters.filter((adapter) => !excluded.has(adapter.id));

  return {
    id: 'adapter.article',
    platform: 'adapter',
    contentType: 'article',
    match(context) {
      return resolveAdapterMatch(activeAdapters(), context.url)?.match ?? null;
    },
    async waitUntilReady(context) {
      const resolved = resolveAdapterMatch(activeAdapters(), context.url);
      if (!resolved) {
        return { ready: false, reason: 'unsupported_url' };
      }
      return waitUntilConfigurableArticleReady(resolved.adapter, context);
    },
    async extract(context) {
      const resolved = resolveAdapterMatch(activeAdapters(), context.url);
      if (!resolved) {
        throw new Error('unsupported_url');
      }
      return extractConfigurableArticle(resolved.adapter, context);
    },
    validate: validateArticle
  };
}

export function matchConfigurableArticle(adapter: PlatformAdapter, url: URL): ExtractorMatch | null {
  if (!adapter.enabled) {
    return null;
  }

  if (!hostMatches(url.hostname, adapter.hosts)) {
    return null;
  }

  if (adapter.urlPatterns && !adapter.urlPatterns.some((pattern) => pattern.test(url.pathname + url.search))) {
    return null;
  }

  return {
    extractorId: adapter.id,
    confidence: 0.8,
    reason: 'platform_adapter_match'
  };
}

export async function waitUntilConfigurableArticleReady(
  adapter: PlatformAdapter,
  context: ExtractorContext
): Promise<ReadyResult> {
  const roots = locateConfigurableArticleRoots(adapter, context);
  if (!roots.root) {
    return { ready: false, reason: 'missing_document' };
  }

  if (!roots.articleRoot) {
    return { ready: false, reason: 'missing_article_root' };
  }

  if (!resolveConfigurableTitle(adapter, roots.articleRoot, roots.titleElement)) {
    return { ready: false, reason: 'missing_title' };
  }

  if (!roots.contentRoot) {
    return { ready: false, reason: 'missing_content_root' };
  }

  for (const selector of adapter.readiness?.requiredSelectors ?? []) {
    if (!roots.root.querySelector(selector)) {
      return { ready: false, reason: 'missing_required_selector' };
    }
  }

  const blockSelector = adapter.semanticMap?.blockSelector ?? '[data-block="true"]';
  const blockCount = roots.contentRoot.querySelectorAll(blockSelector).length;
  const textLength = normalizeText(roots.contentRoot.textContent ?? '').length;

  if (adapter.readiness?.minBlockCount && blockCount < adapter.readiness.minBlockCount) {
    return { ready: false, reason: 'content_not_stable' };
  }

  if (adapter.readiness?.minTextLength && textLength < adapter.readiness.minTextLength) {
    return { ready: false, reason: 'content_not_stable' };
  }

  if (adapter.readiness?.stableDomMs) {
    const stable = await waitForStableDom(roots.contentRoot, adapter.readiness.stableDomMs);
    if (!stable) {
      return { ready: false, reason: 'content_not_stable' };
    }
  }

  return { ready: true };
}

export async function extractConfigurableArticle(
  adapter: PlatformAdapter,
  context: ExtractorContext
): Promise<Article> {
  return (await extractConfigurableArticleWithDiagnostics(adapter, context)).article;
}

export async function extractConfigurableArticleWithDiagnostics(
  adapter: PlatformAdapter,
  context: ExtractorContext,
  options: ConfigurableArticleExtractionOptions = {}
): Promise<ConfigurableArticleExtractionResult> {
  const ready = await waitUntilConfigurableArticleReady(adapter, context);
  if (!ready.ready) {
    throw new Error(ready.reason);
  }

  const roots = locateConfigurableArticleRoots(adapter, context);
  if (!roots.articleRoot || !roots.contentRoot) {
    throw new Error('article_not_ready');
  }
  const title = resolveConfigurableTitle(adapter, roots.articleRoot, roots.titleElement);
  if (!title && adapter.validation?.titleStrategy !== 'optional') {
    throw new Error('missing_title');
  }

  const sourceUrl = context.url.toString();
  const blockResult = buildCleanTreePrimaryBlocks({
    sourceRoot: roots.contentRoot,
    adapter,
    sourceUrl,
    debugId: options.debugId ?? adapter.id,
    legacyBlocks: options.legacyBlocks
  });
  const article: Article = {
    id: options.id ?? configurableArticleId(adapter, context.url),
    source: options.source ?? configurableArticleSource(adapter),
    sourceKind: adapter.id === 'fixture.article' ? 'fixture' : 'platform',
    sourceProvider: adapter.platform,
    adapterId: adapter.id,
    platform: adapter.platform,
    contentType: adapter.contentType,
    sourceUrl,
    canonicalUrl: options.canonicalUrl ?? sourceUrl,
    title,
    extractedAt: context.now?.() ?? Date.now(),
    blocks: blockResult.blocks
  };

  const validation = validateConfigurableArticle(article, adapter.validation);
  if (!validation.valid) {
    throw new Error(validation.reason);
  }

  return {
    article,
    cleanTreeBlocks: blockResult.cleanTreeBlocks,
    diagnostics: {
      adapterId: adapter.id,
      platform: adapter.platform,
      fallbackBlockCount: blockResult.fallbackBlockCount,
      highRiskBlockCount: blockResult.highRiskBlockCount,
      replacedBlockCount: blockResult.replacedBlockCount
    }
  };
}

export function locateConfigurableArticleRoots(adapter: PlatformAdapter, context: ExtractorContext): {
  root: ParentNode | null;
  articleRoot: Element | null;
  titleElement: Element | null;
  contentRoot: Element | null;
} {
  const root = context.root ?? context.document ?? null;
  const articleRoot = root?.querySelector(adapter.rootSelector) ?? null;
  const titleElement =
    articleRoot && adapter.titleSelector
      ? articleRoot.querySelector(adapter.titleSelector) ?? root?.querySelector(adapter.titleSelector) ?? null
      : null;
  const contentRoot = articleRoot && adapter.contentSelector ? articleRoot.querySelector(adapter.contentSelector) : articleRoot;

  return {
    root,
    articleRoot,
    titleElement,
    contentRoot
  };
}

function resolveConfigurableTitle(adapter: PlatformAdapter, articleRoot: Element, titleElement: Element | null): string {
  const selectedTitle = normalizeText(titleElement?.textContent ?? '');
  if (selectedTitle) {
    return selectedTitle;
  }

  if (adapter.validation?.titleStrategy === 'fallback-from-h1') {
    return normalizeText(articleRoot.querySelector('h1')?.textContent ?? '');
  }

  if (adapter.validation?.titleStrategy === 'optional') {
    return '';
  }

  return '';
}

function validateConfigurableArticle(article: Article, config: ValidationConfig | undefined): ValidationResult {
  if (!config) {
    return validateArticle(article);
  }

  if (!normalizeText(article.id)) {
    return { valid: false, reason: 'missing_id' };
  }

  if (config.titleStrategy !== 'optional' && !normalizeText(article.title)) {
    return { valid: false, reason: 'missing_title' };
  }

  if (config.minBlockCount && article.blocks.length < config.minBlockCount) {
    return { valid: false, reason: 'insufficient_blocks' };
  }

  const textLength = article.blocks.reduce((total, block) => total + getBlockTextLength(block), 0);
  const hasMediaBlock = article.blocks.some((block) => isMediaBlock(block));
  if (config.minTextLength && textLength <= config.minTextLength) {
    if (config.emptyContentStrategy === 'allow-media-only' && hasMediaBlock) {
      return { valid: true };
    }
    return { valid: false, reason: 'insufficient_content' };
  }

  return { valid: true };
}

function configurableArticleId(adapter: PlatformAdapter, url: URL): string {
  return adapter.id + ':' + url.toString();
}

function configurableArticleSource(adapter: PlatformAdapter): ArticleSource {
  if (adapter.articleSource) {
    return adapter.articleSource;
  }

  if (adapter.id === 'fixture.article') {
    return 'fixture';
  }
  if (adapter.platform === 'x') {
    return 'x-article';
  }
  return adapter.id;
}

function resolveAdapterMatch(adapters: PlatformAdapter[], url: URL): { adapter: PlatformAdapter; match: ExtractorMatch } | null {
  const matches = adapters
    .map((adapter) => {
      const match = matchConfigurableArticle(adapter, url);
      return match ? { adapter, match } : null;
    })
    .filter((candidate): candidate is { adapter: PlatformAdapter; match: ExtractorMatch } => candidate !== null)
    .sort((a, b) => b.match.confidence - a.match.confidence);

  return matches[0] ?? null;
}

function hostMatches(hostname: string, hosts: string[]): boolean {
  return hosts.some((host) => hostname === host || hostname.endsWith('.' + host));
}

function getBlockTextLength(block: ArticleBlock): number {
  switch (block.type) {
    case 'heading':
    case 'paragraph':
    case 'quote':
    case 'link':
    case 'code':
      return normalizeText(block.text).length;
    case 'list':
      return block.items.reduce((total, item) => total + normalizeText(item).length, 0);
    case 'table':
      return block.rows.reduce((total, row) => total + row.cells.reduce((cellTotal, cell) => cellTotal + normalizeText(cell.text).length, 0), 0);
    case 'simple-tweet':
      return normalizeText(block.title + ' ' + block.excerpt).length;
    case 'embed':
      return normalizeText(block.label + ' ' + (block.text ?? '')).length;
    default:
      return 0;
  }
}

function isMediaBlock(block: ArticleBlock): boolean {
  return (
    block.type === 'image' ||
    block.type === 'image-gallery' ||
    block.type === 'gif' ||
    block.type === 'video' ||
    block.type === 'embed' ||
    block.type === 'simple-tweet'
  );
}
