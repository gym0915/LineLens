import type { Article, ArticleAuthorMeta, ArticleBlock, ArticleSource, ArticleSourceMeta } from '../../../shared/article.js';
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
  'fallbackBlockCount' | 'highRiskBlockCount' | 'legacyOnlyBlockCount' | 'replacedBlockCount'
> & {
  adapterId: string;
  platform: PlatformAdapter['platform'];
};

export type ConfigurableArticleExtractionResult = {
  article: Article;
  cleanTreeBlocks: ArticleBlock[];
  diagnostics: ConfigurableArticleExtractionDiagnostics;
};

const ARTICLE_HEADER_TITLE_SELECTORS = [
  'header h1',
  'header [data-title]',
  '[data-article-header] h1',
  '[data-post-header] h1',
  '.post-header h1',
  '.post-title',
  '.post-title a[href]',
  ':scope > div:first-child a[href*="/p/"]'
];

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

  if (!resolveConfigurableTitle(adapter, roots.root, roots.articleRoot, roots.titleElement)) {
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
  const title = resolveConfigurableTitle(adapter, roots.root, roots.articleRoot, roots.titleElement);
  if (!title && adapter.validation?.titleStrategy !== 'optional') {
    throw new Error('missing_title');
  }
  const headerMeta = resolveConfigurableArticleHeaderMeta(adapter, roots.articleRoot, roots.titleElement, context.url);

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
    ...headerMeta,
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
      legacyOnlyBlockCount: blockResult.legacyOnlyBlockCount,
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

function resolveConfigurableTitle(adapter: PlatformAdapter, root: ParentNode | null, articleRoot: Element, titleElement: Element | null): string {
  const selectedTitle = extractTitleText(titleElement);
  if (selectedTitle) {
    return selectedTitle;
  }

  const articleHeaderTitle = resolveArticleHeaderTitle(articleRoot);
  if (articleHeaderTitle) {
    return articleHeaderTitle;
  }

  if (adapter.validation?.titleStrategy === 'fallback-from-h1') {
    return normalizeText(articleRoot.querySelector('h1')?.textContent ?? '');
  }

  const documentFallbackTitle = resolveDocumentFallbackTitle(root);
  if (documentFallbackTitle) {
    return documentFallbackTitle;
  }

  if (adapter.validation?.titleStrategy === 'optional') {
    return '';
  }

  return '';
}

function resolveArticleHeaderTitle(articleRoot: Element): string {
  for (const selector of ARTICLE_HEADER_TITLE_SELECTORS) {
    const title = extractTitleText(articleRoot.querySelector(selector));
    if (title) {
      return title;
    }
  }

  return '';
}

function resolveDocumentFallbackTitle(root: ParentNode | null): string {
  const documentTitle = extractTitleText(root?.querySelector('title') ?? null);
  if (documentTitle) {
    return documentTitle;
  }

  return extractTitleText(root?.querySelector('meta[property="og:title"], meta[name="og:title"]') ?? null);
}

function extractTitleText(element: Element | null | undefined): string {
  return normalizeText(element?.getAttribute('content') ?? element?.textContent ?? '');
}

function resolveConfigurableArticleHeaderMeta(
  adapter: PlatformAdapter,
  articleRoot: Element,
  titleElement: Element | null,
  sourceUrl: URL
): Partial<Article> {
  const selectors = adapter.headerSelectors;
  if (!selectors) {
    return {};
  }

  const sourceElement = queryScopedSelector(articleRoot, selectors.sourceLabelSelector);
  const sourceLabel = extractTitleText(sourceElement);
  const sourceHref = resolveElementHref(sourceElement, sourceUrl);
  const sourceMeta = resolveSourceMeta(sourceLabel, sourceHref);

  const titleLinkElement = queryScopedSelector(articleRoot, selectors.titleLinkSelector) ?? titleElement;
  const titleHref = resolveElementHref(titleLinkElement, sourceUrl);
  const subtitle = extractTitleText(queryScopedSelector(articleRoot, selectors.subtitleSelector));

  const authorNameElement = queryScopedSelector(articleRoot, selectors.authorNameSelector);
  const authorName = extractTitleText(authorNameElement);
  const authorProfileUrl = resolveElementHref(authorNameElement, sourceUrl);
  const authorAvatarElement = queryScopedSelector(articleRoot, selectors.authorAvatarSelector);
  const authorAvatarUrl = resolveImageSource(authorAvatarElement, sourceUrl);
  const author = resolveArticleAuthorMeta(authorName, authorProfileUrl, authorAvatarUrl);

  const publishedAtText = extractTitleText(queryScopedSelector(articleRoot, selectors.publishedAtSelector));

  return {
    ...(sourceMeta ? { sourceMeta } : {}),
    ...(titleHref ? { titleHref } : {}),
    ...(subtitle ? { subtitle } : {}),
    ...(author ? { author } : {}),
    ...(publishedAtText ? { publishedAtText } : {})
  };
}

function queryScopedSelector(root: Element, selector: string | undefined): Element | null {
  if (!selector) {
    return null;
  }

  try {
    return root.querySelector(selector);
  } catch {
    return null;
  }
}

function resolveSourceMeta(label: string, href: string | undefined): ArticleSourceMeta | null {
  if (!label && !href) {
    return null;
  }

  return {
    ...(label ? { label } : {}),
    ...(href ? { href } : {})
  };
}

function resolveArticleAuthorMeta(
  name: string,
  profileUrl: string | undefined,
  avatarUrl: string | undefined
): ArticleAuthorMeta | null {
  if (!name && !profileUrl && !avatarUrl) {
    return null;
  }

  return {
    ...(name ? { name } : {}),
    ...(profileUrl ? { profileUrl } : {}),
    ...(avatarUrl ? { avatarUrl } : {})
  };
}

function resolveElementHref(element: Element | null | undefined, sourceUrl: URL): string | undefined {
  const href = element?.getAttribute('href') ?? element?.closest('a[href]')?.getAttribute('href') ?? '';
  return resolveAbsoluteUrl(href, sourceUrl);
}

function resolveImageSource(element: Element | null | undefined, sourceUrl: URL): string | undefined {
  const src = element?.getAttribute('src') ?? element?.getAttribute('data-src') ?? '';
  return resolveAbsoluteUrl(src, sourceUrl);
}

function resolveAbsoluteUrl(value: string, sourceUrl: URL): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  try {
    return new URL(trimmed, sourceUrl).toString();
  } catch {
    return undefined;
  }
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
