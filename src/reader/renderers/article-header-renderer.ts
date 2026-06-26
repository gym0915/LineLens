import type { Article, TweetMetrics } from '../../shared/article-schema.js';
import { renderBookmarkIcon, renderGrokIcon, renderLikeIcon, renderReplyIcon, renderRetweetIcon, renderShareIcon, renderVerifiedIcon, renderViewsIcon } from './icons.js';
import { renderCoverImageBlock } from './image-renderer.js';

export function renderArticleHeader(article: Article): HTMLElement {
  const header = document.createElement('header');
  header.className = 'article-header';

  const kicker = document.createElement('p');
  kicker.className = 'reader-kicker';
  kicker.textContent = 'LineLens';
  header.append(kicker);

  if (article.coverImage) {
    header.append(renderCoverImageBlock(article.coverImage));
  }

  const title = document.createElement('h1');
  title.className = 'article-title';
  title.dataset.blockId = 'title';
  title.dataset.blockType = 'title';
  title.textContent = article.title;
  header.append(title);

  const authorMeta = renderArticleHeaderAuthorMeta(article);
  if (authorMeta) {
    header.append(authorMeta);
  }
  const metrics = renderArticleHeaderMetrics(article);
  if (metrics) {
    header.append(metrics);
  }

  return header;
}

function renderArticleHeaderAuthorMeta(article: Article): HTMLElement | null {
  const authorName = article.author?.name ?? article.authorName;
  const authorHandle = article.author?.handle ?? article.authorHandle;
  const authorAvatarUrl = article.author?.avatarUrl ?? article.authorAvatarUrl;
  const authorVerified = article.author?.verified ?? article.authorVerified;
  const sourceLabel = getArticleSourceLabel(article);
  const publishedAtText = article.publishedAtText;

  if (!authorName && !authorAvatarUrl && !publishedAtText && !sourceLabel) {
    return null;
  }

  const row = document.createElement('a');
  row.className = 'article-meta article-meta-author';
  row.href = article.canonicalUrl;
  row.setAttribute('aria-label', [authorName, authorHandle, publishedAtText, sourceLabel].filter(Boolean).join(' '));

  if (authorAvatarUrl) {
    const avatar = document.createElement('img');
    avatar.className = 'article-meta-avatar';
    avatar.src = authorAvatarUrl;
    avatar.alt = '';
    avatar.loading = 'lazy';
    row.append(avatar);
  }

  const text = document.createElement('span');
  text.className = 'article-meta-author-text';

  const primary = document.createElement('span');
  primary.className = 'article-meta-author-primary';
  if (authorName) {
    const name = document.createElement('span');
    name.className = 'article-meta-author-name';
    name.textContent = authorName;
    primary.append(name);
  }
  if (authorVerified) {
    const verified = renderVerifiedIcon();
    verified.classList.add('article-meta-verified-icon');
    primary.append(verified);
  }

  const secondary = document.createElement('span');
  secondary.className = 'article-meta-author-secondary';
  appendMetaText(secondary, sourceLabel, 'article-meta-source');
  appendMetaText(secondary, authorHandle);
  appendMetaText(secondary, publishedAtText);

  if (primary.childNodes.length > 0) {
    text.append(primary);
  }
  if (secondary.childNodes.length > 0) {
    text.append(secondary);
  }
  row.append(text);
  if (isXArticle(article)) {
    row.append(renderGrokIcon());
  }
  return row;
}

function renderArticleHeaderMetrics(article: Article): HTMLElement | null {
  const metrics = article.engagement ?? article.metrics;
  if (!metrics || !Object.values(metrics).some(Boolean)) {
    return null;
  }

  const row = document.createElement('a');
  row.className = 'article-meta article-meta-metrics';
  row.href = article.canonicalUrl;
  row.setAttribute('aria-label', isXArticle(article) ? 'Article interactions' : 'Article engagement');

  if (!isXArticle(article)) {
    for (const value of Object.values(metrics).filter(Boolean)) {
      const metric = document.createElement('span');
      metric.className = 'article-meta-metric';
      metric.textContent = value;
      row.append(metric);
    }
    return row;
  }

  const primary = document.createElement('span');
  primary.className = 'article-meta-metric-primary';
  primary.append(
    renderArticleHeaderMetric(renderReplyIcon(), metrics.replies),
    renderArticleHeaderMetric(renderRetweetIcon(), metrics.reposts),
    renderArticleHeaderMetric(renderLikeIcon(), metrics.likes),
    renderArticleHeaderMetric(renderViewsIcon(), metrics.views)
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

function appendMetaText(parent: HTMLElement, value: string | undefined, className?: string): void {
  if (!value) {
    return;
  }
  if (parent.childNodes.length > 0) {
    const divider = document.createElement('span');
    divider.textContent = '·';
    parent.append(divider);
  }
  const element = document.createElement('span');
  if (className) {
    element.className = className;
  }
  element.textContent = value;
  parent.append(element);
}

function getArticleSourceLabel(article: Article): string | undefined {
  return article.sourceMeta?.label ?? article.sourceMeta?.provider ?? formatProvider(article.sourceProvider ?? article.platform);
}

function formatProvider(provider: string | undefined): string | undefined {
  if (!provider) {
    return undefined;
  }
  if (provider.toLowerCase() === 'x') {
    return 'X';
  }
  return provider
    .split(/[-_.\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function isXArticle(article: Article): boolean {
  return article.platform === 'x' || article.sourceProvider === 'x' || article.source === 'x-article';
}
