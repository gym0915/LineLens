import type { Article, TweetMetrics } from '../../../shared/article.js';
import { normalizeText } from '../../../shared/text.js';
import { X_ARTICLE_SELECTORS } from './article-selectors.js';

export function extractXArticleMetadata(readView: Element, longform: Element): Partial<Article> {
  const titleElement = readView.querySelector(X_ARTICLE_SELECTORS.title);
  const authorRoot = findHeaderElementAfterTitle(readView, longform, '[itemprop="author"]', titleElement);
  const metricsGroup = findHeaderElementAfterTitle(readView, longform, '[role="group"][aria-label]', titleElement);
  const additionalName = normalizeText(authorRoot?.querySelector('meta[itemprop="additionalName"]')?.getAttribute('content') ?? '');
  const authorHandle = additionalName ? `@${additionalName.replace(/^@/, '')}` : undefined;
  const authorName = normalizeText(authorRoot?.querySelector('meta[itemprop="name"]')?.getAttribute('content') ?? '');
  const authorAvatar =
    authorRoot?.querySelector<HTMLImageElement>('img')?.currentSrc ||
    authorRoot?.querySelector<HTMLImageElement>('img')?.src ||
    authorRoot?.querySelector('meta[itemprop="image"]')?.getAttribute('content') ||
    '';
  const time = authorRoot?.parentElement?.querySelector<HTMLTimeElement>('time');
  const metrics = extractMetricsFromGroup(metricsGroup);

  return {
    ...(authorName ? { authorName } : {}),
    ...(authorHandle ? { authorHandle } : {}),
    ...(authorAvatar ? { authorAvatarUrl: authorAvatar } : {}),
    ...(authorRoot?.querySelector('[data-testid="icon-verified"], [aria-label="认证账号"], [aria-label="Verified account"]')
      ? { authorVerified: true }
      : {}),
    ...(time?.dateTime ? { publishedAt: time.dateTime } : {}),
    ...(time?.textContent ? { publishedAtText: normalizeText(time.textContent) } : {}),
    ...(hasArticleMetrics(metrics) ? { metrics } : {})
  };
}

function findHeaderElementAfterTitle(readView: Element, longform: Element, selector: string, titleElement: Element | null): Element | null {
  const candidates = Array.from(readView.querySelectorAll(selector)).filter((candidate) => !longform.contains(candidate));
  if (!titleElement) {
    return candidates[0] ?? null;
  }
  return candidates.find((candidate) => Boolean(titleElement.compareDocumentPosition(candidate) & Node.DOCUMENT_POSITION_FOLLOWING)) ?? null;
}

function extractMetricsFromGroup(group: Element | null): TweetMetrics {
  if (!group) {
    return {};
  }

  return {
    replies: extractMetricValueFromGroup(group, 'reply'),
    reposts: extractMetricValueFromGroup(group, 'retweet'),
    likes: extractMetricValueFromGroup(group, 'like'),
    views:
      normalizeText(group.querySelector('a[href*="/analytics"]')?.textContent ?? '') ||
      parseXMetricLabel(group.getAttribute('aria-label') ?? '', /(?:查看|观看|view)/i),
    bookmarks: extractMetricValueFromGroup(group, 'bookmark')
  };
}

function extractMetricValueFromGroup(group: Element, testId: string): string | undefined {
  const action = group.querySelector(`[data-testid="${testId}"]`);
  const value = normalizeText(action?.textContent ?? '') || parseXMetricLabel(action?.getAttribute('aria-label') ?? '');
  return value || undefined;
}

function parseXMetricLabel(label: string, hint?: RegExp): string {
  const text = normalizeText(label);
  if (hint && !hint.test(text)) {
    return '';
  }
  return text.match(/[\d,.]+(?:\.\d+)?(?:万|[KMB])?/i)?.[0] ?? '';
}

function hasArticleMetrics(metrics: TweetMetrics): boolean {
  return Object.values(metrics).some(Boolean);
}
