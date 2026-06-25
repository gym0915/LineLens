import type {
  Article,
  ArticleBlock
} from '../shared/article-schema.js';
import { renderCodeBlock } from './renderers/code-block-renderer.js';
import { renderImageGalleryBlock } from './renderers/gallery-renderer.js';
import { renderCoverImageBlock, renderImageBlock } from './renderers/image-renderer.js';
import { renderBookmarkIcon, renderGrokIcon, renderLikeIcon, renderReplyIcon, renderRetweetIcon, renderShareIcon, renderVerifiedIcon, renderViewsIcon } from './renderers/icons.js';
import { renderListBlock } from './renderers/list-block-renderer.js';
import { renderSimpleTweetBlock } from './renderers/simple-tweet-renderer.js';
import { renderEmbedBlock } from './renderers/social-embed-renderer.js';
import { renderTableBlock } from './renderers/table-block-renderer.js';
import { renderHeadingBlock, renderLinkBlock, renderParagraphBlock, renderQuoteBlock } from './renderers/text-block-renderer.js';
import { renderGifBlock, renderVideoBlock } from './renderers/video-renderer.js';

export { cleanupRenderedMedia } from './renderers/video-renderer.js';

export function renderArticleShell(article: Article): HTMLElement {
  const articleElement = document.createElement('article');
  articleElement.className = 'reader-article';
  articleElement.dataset.articleId = article.id;

  const header = document.createElement('header');
  header.className = 'article-header';

  const kicker = document.createElement('p');
  kicker.className = 'reader-kicker';
  kicker.textContent = 'LineLens';

  const title = document.createElement('h1');
  title.className = 'article-title';
  title.dataset.blockId = 'title';
  title.dataset.blockType = 'title';
  title.textContent = article.title;

  header.append(kicker);

  if (article.coverImage) {
    header.append(renderCoverImageBlock(article.coverImage));
  }

  header.append(title);
  const authorMeta = renderArticleHeaderAuthorMeta(article);
  if (authorMeta) {
    header.append(authorMeta);
  }
  const metrics = renderArticleHeaderMetrics(article);
  if (metrics) {
    header.append(metrics);
  }

  const body = document.createElement('section');
  body.className = 'article-body';

  for (const block of article.blocks) {
    body.append(renderBlock(block));
  }

  articleElement.append(header, body);
  return articleElement;
}

function renderArticleHeaderAuthorMeta(article: Article): HTMLElement | null {
  if (!article.authorName && !article.authorAvatarUrl && !article.publishedAtText) {
    return null;
  }

  const row = document.createElement('a');
  row.className = 'article-meta article-meta-author';
  row.href = article.canonicalUrl;
  row.setAttribute('aria-label', [article.authorName, article.authorHandle, article.publishedAtText].filter(Boolean).join(' '));

  if (article.authorAvatarUrl) {
    const avatar = document.createElement('img');
    avatar.className = 'article-meta-avatar';
    avatar.src = article.authorAvatarUrl;
    avatar.alt = '';
    avatar.loading = 'lazy';
    row.append(avatar);
  }

  const text = document.createElement('span');
  text.className = 'article-meta-author-text';

  const primary = document.createElement('span');
  primary.className = 'article-meta-author-primary';
  if (article.authorName) {
    const name = document.createElement('span');
    name.className = 'article-meta-author-name';
    name.textContent = article.authorName;
    primary.append(name);
  }
  if (article.authorVerified) {
    const verified = renderVerifiedIcon();
    verified.classList.add('article-meta-verified-icon');
    primary.append(verified);
  }

  const secondary = document.createElement('span');
  secondary.className = 'article-meta-author-secondary';
  if (article.authorHandle) {
    const handle = document.createElement('span');
    handle.textContent = article.authorHandle;
    secondary.append(handle);
  }
  if (article.publishedAtText) {
    if (article.authorHandle) {
      const divider = document.createElement('span');
      divider.textContent = '·';
      secondary.append(divider);
    }
    const date = document.createElement('span');
    date.textContent = article.publishedAtText;
    secondary.append(date);
  }

  if (primary.childNodes.length > 0) {
    text.append(primary);
  }
  if (secondary.childNodes.length > 0) {
    text.append(secondary);
  }
  row.append(text, renderGrokIcon());
  return row;
}

function renderArticleHeaderMetrics(article: Article): HTMLElement | null {
  if (!article.metrics || !Object.values(article.metrics).some(Boolean)) {
    return null;
  }

  const row = document.createElement('a');
  row.className = 'article-meta article-meta-metrics';
  row.href = article.canonicalUrl;
  row.setAttribute('aria-label', 'Article interactions');

  const primary = document.createElement('span');
  primary.className = 'article-meta-metric-primary';
  primary.append(
    renderArticleHeaderMetric(renderReplyIcon(), article.metrics.replies),
    renderArticleHeaderMetric(renderRetweetIcon(), article.metrics.reposts),
    renderArticleHeaderMetric(renderLikeIcon(), article.metrics.likes),
    renderArticleHeaderMetric(renderViewsIcon(), article.metrics.views)
  );

  const trailing = document.createElement('span');
  trailing.className = 'article-meta-metric-trailing';
  trailing.append(renderArticleHeaderMetric(renderBookmarkIcon()), renderArticleHeaderMetric(renderShareIcon()));
  row.append(primary, trailing);
  return row;
}

function renderArticleHeaderMetric(icon: SVGSVGElement, value?: string): HTMLElement {
  const metric = document.createElement('span');
  metric.className = 'article-meta-metric';
  icon.classList.add('article-meta-metric-icon');
  metric.append(icon);
  if (value) {
    const text = document.createElement('span');
    text.textContent = value;
    metric.append(text);
  }
  return metric;
}

function renderBlock(block: ArticleBlock): HTMLElement {
  switch (block.type) {
    case 'heading':
      return renderHeadingBlock(block.id, block.level, block.text, block.annotations, block.textStyle);
    case 'paragraph':
      return renderParagraphBlock(block.id, block.text, block.annotations, block.textStyle, block.role);
    case 'quote':
      return renderQuoteBlock(block.id, block.text, block.annotations, block.textStyle);
    case 'image':
      return renderImageBlock(block);
    case 'image-gallery':
      return renderImageGalleryBlock(block);
    case 'list':
      return renderListBlock(block.id, block.items, block.kind, block.itemAnnotations, block.itemTextStyles);
    case 'link':
      return renderLinkBlock(block.id, block.text, block.href, block.target);
    case 'code':
      return renderCodeBlock(block);
    case 'table':
      return renderTableBlock(block);
    case 'gif':
      return renderGifBlock(block);
    case 'video':
      return renderVideoBlock(block);
    case 'simple-tweet':
      return renderSimpleTweetBlock(block);
    case 'embed':
      return renderEmbedBlock(block);
  }
}
