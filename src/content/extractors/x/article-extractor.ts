import type { Article } from '../../../shared/article.js';
import { validateArticle } from '../../../shared/article-validator.js';
import type { ArticleExtractor } from '../../../shared/extractor-types.js';
import type { CapturedXVideo } from '../../../shared/messages.js';
import { normalizeText } from '../../../shared/text.js';
import {
  X_CANONICAL_ORIGIN,
  getXArticleAuthorHandleFromUrl,
  getXArticleIdFromUrl,
  isXArticleUrl
} from '../../../shared/url.js';
import { loadSettingsFromLocalStorage } from '../../../shared/settings.js';
import { xArticleAdapter } from '../../adapters/x-article-adapter.js';
import {
  extractConfigurableArticleWithDiagnostics,
  locateConfigurableArticleRoots,
  waitUntilConfigurableArticleReady
} from '../configurable/index.js';
import { extractXArticleCoverImage, extractXArticleLegacyBlocks } from './article-legacy-blocks.js';
import { extractXArticleMetadata } from './article-metadata.js';

export { extractXArticleLegacyBlocksForDebug } from './article-legacy-blocks.js';

export const xArticleExtractor: ArticleExtractor = {
  id: 'x.article',
  platform: 'x',
  contentType: 'article',

  match(context) {
    if (!isXArticleUrl(context.url)) {
      return null;
    }

    return {
      extractorId: this.id,
      confidence: 1,
      reason: 'x_article_url'
    };
  },

  async waitUntilReady(context) {
    return waitUntilConfigurableArticleReady(xArticleAdapter, context);
  },

  async extract(context) {
    const roots = locateConfigurableArticleRoots(xArticleAdapter, context);
    if (!roots.root) {
      throw new Error('missing_document');
    }

    const readView = roots.articleRoot;
    const longform = roots.contentRoot;
    const title = normalizeText(roots.titleElement?.textContent ?? '');
    const articleId = getXArticleIdFromUrl(context.url);

    if (!readView || !longform || !title || !articleId) {
      throw new Error('article_not_ready');
    }

    const adapter = loadSettingsFromLocalStorage().platformAdapters[xArticleAdapter.id] ?? xArticleAdapter;
    const capturedVideos = await getCapturedVideos();
    const legacyBlocks = await extractXArticleLegacyBlocks({
      longform,
      articleId,
      capturedVideos
    });
    const canonicalUrl = `${X_CANONICAL_ORIGIN}/${getXArticleAuthorHandleFromUrl(context.url) ?? 'i'}/article/${articleId}`;
    const configurableResult = await extractConfigurableArticleWithDiagnostics(adapter, context, {
      id: articleId,
      source: 'x-article',
      canonicalUrl,
      debugId: `x.article:${articleId}`,
      legacyBlocks
    });
    const blocks = configurableResult.article.blocks;
    const coverImage = extractXArticleCoverImage(readView, articleId);
    const articleMeta = extractXArticleMetadata(readView, longform);
    const article: Article = {
      id: articleId,
      source: 'x-article',
      sourceKind: 'platform',
      sourceProvider: 'x',
      adapterId: xArticleAdapter.id,
      platform: xArticleAdapter.platform,
      contentType: xArticleAdapter.contentType,
      sourceUrl: context.url.toString(),
      canonicalUrl,
      authorHandle: getXArticleAuthorHandleFromUrl(context.url),
      ...articleMeta,
      title,
      coverImage,
      extractedAt: context.now?.() ?? Date.now(),
      blocks
    };

    const validation = validateArticle(article);
    if (!validation.valid) {
      throw new Error(validation.reason);
    }

    return article;
  },

  validate: validateArticle
};

async function getCapturedVideos(): Promise<CapturedXVideo[]> {
  const response = (await chrome.runtime.sendMessage({
    type: 'GET_CAPTURED_X_VIDEOS'
  }).catch(() => null)) as GetCapturedXVideosResponse | null;
  return response?.videos ?? [];
}
