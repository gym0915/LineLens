import type { Article, ArticleBlock, ImageBlock, TextAnnotation } from '../../../shared/article.js';
import { validateArticle } from '../../../shared/article-validator.js';
import type { ArticleExtractor, ExtractorContext } from '../../../shared/extractor-types.js';
import { normalizeText } from '../../../shared/text.js';
import {
  X_CANONICAL_ORIGIN,
  getXArticleAuthorHandleFromUrl,
  getXArticleIdFromUrl,
  isXArticleUrl
} from '../../../shared/url.js';
import { detectXArticleDom } from './article-detector.js';
import { X_ARTICLE_SELECTORS } from './article-selectors.js';

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
    const root = getRoot(context);
    return root ? detectXArticleDom(root) : { ready: false, reason: 'missing_document' };
  },

  async extract(context) {
    const root = getRoot(context);
    if (!root) {
      throw new Error('missing_document');
    }

    const readView = root.querySelector(X_ARTICLE_SELECTORS.readView);
    const longform = readView?.querySelector(X_ARTICLE_SELECTORS.longform);
    const title = normalizeText(readView?.querySelector(X_ARTICLE_SELECTORS.title)?.textContent ?? '');
    const articleId = getXArticleIdFromUrl(context.url);

    if (!readView || !longform || !title || !articleId) {
      throw new Error('article_not_ready');
    }

    const blocks = extractBlocks(longform, articleId);
    const coverImage = extractCoverImage(readView, articleId);
    const article: Article = {
      id: articleId,
      source: 'x-article',
      sourceUrl: context.url.toString(),
      canonicalUrl: `${X_CANONICAL_ORIGIN}/${getXArticleAuthorHandleFromUrl(context.url) ?? 'i'}/article/${articleId}`,
      authorHandle: getXArticleAuthorHandleFromUrl(context.url),
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

function getRoot(context: ExtractorContext): ParentNode | null {
  return context.root ?? context.document ?? null;
}

function extractBlocks(longform: Element, articleId: string): ArticleBlock[] {
  const blocks: ArticleBlock[] = [];
  let pendingListItems: string[] = [];
  let pendingListItemAnnotations: TextAnnotation[][] = [];
  let pendingListKind: 'ordered' | 'unordered' = 'unordered';

  function flushPendingList() {
    if (pendingListItems.length === 0) {
      return;
    }

    const listBlock: ArticleBlock = {
      id: blockId(articleId, blocks.length + 1),
      type: 'list',
      kind: pendingListKind,
      items: pendingListItems
    };
    if (pendingListItemAnnotations.some((annotations) => annotations.length > 0)) {
      listBlock.itemAnnotations = pendingListItemAnnotations;
    }

    blocks.push(listBlock);
    pendingListItems = [];
    pendingListItemAnnotations = [];
    pendingListKind = 'unordered';
  }

  longform.querySelectorAll(X_ARTICLE_SELECTORS.block).forEach((block) => {
    const listKind = getListKind(block);
    if (listKind) {
      const extracted = extractTextWithAnnotations(block);
      if (extracted.text) {
        if (pendingListItems.length === 0) {
          pendingListKind = listKind;
        } else if (pendingListKind !== listKind) {
          flushPendingList();
          pendingListKind = listKind;
        }
        pendingListItems.push(extracted.text);
        pendingListItemAnnotations.push(extracted.annotations);
      }
      return;
    }

    flushPendingList();
    const articleBlock = extractBlock(block, articleId, blocks.length + 1);
    if (articleBlock) {
      blocks.push(articleBlock);
    }
  });

  flushPendingList();

  return blocks;
}

function getListKind(block: Element): 'ordered' | 'unordered' | null {
  if (
    block.closest('ol') ||
    block.classList.contains('public-DraftStyleDefault-orderedListItem') ||
    block.classList.contains('longform-ordered-list-item')
  ) {
    return 'ordered';
  }

  if (
    block.closest('ul') ||
    block.classList.contains('public-DraftStyleDefault-unorderedListItem') ||
    block.classList.contains('longform-unordered-list-item')
  ) {
    return 'unordered';
  }

  return null;
}

function extractBlock(block: Element, articleId: string, index: number): ArticleBlock | null {
  if (block.matches(X_ARTICLE_SELECTORS.quoteBlock)) {
    const extracted = extractTextWithAnnotations(block);
    return extracted.text
      ? {
          id: blockId(articleId, index),
          type: 'quote',
          text: extracted.text,
          ...(extracted.annotations.length > 0 ? { annotations: extracted.annotations } : {})
        }
      : null;
  }

  const nonTextBlock = extractNonTextBlock(block, articleId, index);
  if (nonTextBlock) {
    return nonTextBlock;
  }

  const extracted = extractTextWithAnnotations(block);
  if (!extracted.text) {
    return null;
  }

  if (isHeadingBlock(block)) {
    return {
      id: blockId(articleId, index),
      type: 'heading',
      text: extracted.text,
      level: getHeadingLevel(block)
    };
  }

  const textBlock: ArticleBlock = {
    id: blockId(articleId, index),
    type: 'paragraph',
    text: extracted.text
  };
  if (textBlock.type === 'paragraph' && extracted.annotations.length > 0) {
    textBlock.annotations = extracted.annotations;
  }

  return textBlock;
}

function extractNonTextBlock(block: Element, articleId: string, index: number): ArticleBlock | null {
  const tweetRef = extractTweetRefBlock(block, blockId(articleId, index));
  if (tweetRef) {
    return tweetRef;
  }

  const image = extractImageFromElement(block, blockId(articleId, index));
  if (image) {
    return image;
  }

  const simpleTweet = extractSimpleTweetBlock(block, blockId(articleId, index));
  if (simpleTweet) {
    return simpleTweet;
  }

  const link = extractLinkBlock(block, blockId(articleId, index));
  if (link) {
    return link;
  }

  return null;
}

function extractTweetRefBlock(block: Element, id: string): ArticleBlock | null {
  const tweet = block.querySelector(X_ARTICLE_SELECTORS.tweetBlock);
  if (!tweet) {
    return null;
  }

  const articleCard = extractSimpleTweetBlock(block, id) ?? extractSimpleTweetBlock(tweet, id);
  if (articleCard) {
    return articleCard;
  }

  return extractTweetSummaryBlock(tweet, id, block);
}

function extractTweetSummaryBlock(tweet: Element, id: string, fallbackBlock?: Element): ArticleBlock {
  const profile = extractTweetProfile(tweet);
  const metrics = extractTweetMetrics(tweet);
  const authorLine = buildTweetAuthorLine(profile);
  const body = extractTweetBodyText(tweet);
  const fallbackText = normalizeText(tweet.querySelector('[data-testid="User-Name"]') ? '' : (tweet.textContent ?? fallbackBlock?.textContent ?? ''));
  const title = authorLine || (body ? 'X Tweet' : fallbackText || 'X Tweet');
  const excerpt = body || (authorLine ? '' : fallbackText);
  const href = getSimpleTweetHref(tweet) ?? (fallbackBlock ? getSimpleTweetHref(fallbackBlock) : undefined);

  return {
    id,
    type: 'simple-tweet',
    coverUrl: '',
    source: 'X Tweet',
    title,
    excerpt,
    href,
    ...profile,
    ...(hasTweetMetrics(metrics) ? { metrics } : {})
  };
}

function extractTweetProfile(tweet: Element): {
  authorName?: string;
  authorHandle?: string;
  authorAvatarUrl?: string;
  authorVerified?: boolean;
  publishedAt?: string;
  publishedAtText?: string;
} {
  const authorRoot = tweet.querySelector('[data-testid="User-Name"]');
  const authorTexts = Array.from(authorRoot?.querySelectorAll('span') ?? [])
    .map((element) => normalizeText(element.textContent ?? ''))
    .filter(Boolean);
  const authorName = authorTexts.find((text) => text !== '·' && !text.startsWith('@') && !isTweetDateText(text));
  const authorHandle =
    authorTexts.find((text) => text.startsWith('@')) ??
    Array.from(tweet.querySelectorAll('span'))
      .map((element) => normalizeText(element.textContent ?? ''))
      .find((text) => /^@[\w_]+$/.test(text));
  const time = tweet.querySelector<HTMLTimeElement>('time');
  const authorAvatar = tweet.querySelector<HTMLImageElement>('[data-testid="Tweet-User-Avatar"] img');

  return {
    ...(authorName ? { authorName } : {}),
    ...(authorHandle ? { authorHandle } : {}),
    ...(authorAvatar?.src ? { authorAvatarUrl: authorAvatar.currentSrc || authorAvatar.src } : {}),
    ...(tweet.querySelector('[data-testid="icon-verified"], [aria-label="Verified account"]') ? { authorVerified: true } : {}),
    ...(time?.dateTime ? { publishedAt: time.dateTime } : {}),
    ...(time?.textContent ? { publishedAtText: normalizeText(time.textContent) } : {})
  };
}

function buildTweetAuthorLine(profile: ReturnType<typeof extractTweetProfile>): string {
  return [profile.authorName, profile.authorHandle, profile.publishedAtText ? `· ${profile.publishedAtText}` : '']
    .filter(Boolean)
    .join(' ');
}

function extractTweetMetrics(tweet: Element): {
  replies?: string;
  reposts?: string;
  likes?: string;
  views?: string;
  bookmarks?: string;
} {
  return {
    ...extractTweetMetric(tweet, 'reply', 'replies'),
    ...extractTweetMetric(tweet, 'retweet', 'reposts'),
    ...extractTweetMetric(tweet, 'like', 'likes'),
    ...extractTweetMetric(tweet, 'bookmark', 'bookmarks'),
    ...extractTweetViewsMetric(tweet)
  };
}

function extractTweetMetric(tweet: Element, testId: string, key: 'replies' | 'reposts' | 'likes' | 'bookmarks'): Record<string, string> {
  const root = tweet.querySelector(`[data-testid="${testId}"]`);
  const value = normalizeText(root?.textContent ?? '') || parseTweetMetricLabel(root?.getAttribute('aria-label') ?? '');
  return value ? { [key]: value } : {};
}

function extractTweetViewsMetric(tweet: Element): { views?: string } {
  const analytics = tweet.querySelector('a[href*="/analytics"]');
  const value = normalizeText(analytics?.textContent ?? '') || parseTweetMetricLabel(analytics?.getAttribute('aria-label') ?? '');
  return value ? { views: value } : {};
}

function parseTweetMetricLabel(label: string): string {
  const value = normalizeText(label).match(/\d+(?:\.\d+)?[KMB]?/)?.[0] ?? '';
  return value;
}

function hasTweetMetrics(metrics: ReturnType<typeof extractTweetMetrics>): boolean {
  return Object.values(metrics).some(Boolean);
}

function extractTweetBodyText(tweet: Element): string {
  const explicitTweetText = normalizeText(tweet.querySelector('[data-testid="tweetText"]')?.textContent ?? '');
  if (explicitTweetText) {
    return explicitTweetText;
  }

  const authorRoot = tweet.querySelector('[data-testid="User-Name"]');
  const candidates = Array.from(tweet.querySelectorAll<HTMLElement>('div[dir="auto"]'))
    .filter((element) => !authorRoot?.contains(element))
    .map((element) => normalizeText(element.textContent ?? ''))
    .filter((text) => text && !isTweetMetricText(text) && !isTweetDateText(text));

  return candidates[0] ?? '';
}

function isTweetDateText(text: string): boolean {
  return /^(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}$/i.test(text);
}

function isTweetMetricText(text: string): boolean {
  return /^(?:\d+(?:\.\d+)?[KMB]?|\d+\s+(?:replies|reposts|likes|bookmarks|views))$/i.test(text);
}

function extractLinkBlock(block: Element, id: string): ArticleBlock | null {
  const anchor = block.querySelector<HTMLAnchorElement>('a[href][role="link"], a[href]');
  if (!anchor) {
    return null;
  }

  const href = anchor.getAttribute('href');
  const text = normalizeText(anchor.textContent ?? '');
  const blockText = normalizeText(block.textContent ?? '');
  if (!href || !text || text !== blockText) {
    return null;
  }

  const target = anchor.getAttribute('target') ?? undefined;
  return {
    id,
    type: 'link',
    text,
    href,
    ...(target ? { target } : {})
  };
}

function extractSimpleTweetBlock(block: Element, id: string): ArticleBlock | null {
  if (isSimpleTweetArticleCard(block)) {
    return extractSimpleTweetArticleCard(block, id);
  }

  if (!isSimpleTweetCard(block)) {
    return null;
  }

  return extractSimpleTweetImageCard(block, id);
}

function isSimpleTweetCard(block: Element): boolean {
  return block.matches('[data-testid="simpleTweet"]') || Boolean(block.querySelector('[data-testid="simpleTweet"]'));
}

function isSimpleTweetArticleCard(block: Element): boolean {
  return Boolean(block.querySelector('[data-testid="article-cover-image"]'));
}

function extractSimpleTweetArticleCard(block: Element, id: string): ArticleBlock | null {
  const coverRoot = block.querySelector('[data-testid="article-cover-image"]');
  if (!coverRoot) {
    return null;
  }

  const coverImage = coverRoot.querySelector<HTMLImageElement>('img');
  const coverUrl = coverImage?.currentSrc || coverImage?.src || '';
  if (!coverUrl) {
    return null;
  }

  const href = getSimpleTweetHref(block);
  const title = normalizeText(getTextAfterCover(coverRoot, 0));
  const excerpt = normalizeText(getTextAfterCover(coverRoot, 1));
  const profile = extractTweetProfile(block);
  const metrics = extractTweetMetrics(block);

  return {
    id,
    type: 'simple-tweet',
    coverUrl,
    coverAlt: coverImage?.alt || undefined,
    source: 'X Article',
    title: title || 'X Article',
    excerpt,
    href,
    ...profile,
    ...(hasTweetMetrics(metrics) ? { metrics } : {})
  };
}

function extractSimpleTweetImageCard(block: Element, id: string): ArticleBlock | null {
  const photos = Array.from(block.querySelectorAll<HTMLElement>(X_ARTICLE_SELECTORS.tweetPhoto))
    .map(tweetPhotoElementToPhoto)
    .filter((photo): photo is NonNullable<ReturnType<typeof tweetPhotoElementToPhoto>> => Boolean(photo));

  if (photos.length === 0) {
    return null;
  }

  const tweet = block.querySelector(X_ARTICLE_SELECTORS.tweetBlock) ?? block;
  const body = extractTweetBodyText(tweet);
  const profile = extractTweetProfile(tweet);
  const metrics = extractTweetMetrics(tweet);

  return {
    id,
    type: 'simple-tweet',
    coverUrl: '',
    source: 'X Tweet',
    title: buildTweetAuthorLine(profile) || 'X Tweet',
    excerpt: body,
    href: getSimpleTweetHref(block),
    photos,
    ...profile,
    ...(hasTweetMetrics(metrics) ? { metrics } : {})
  };
}

function tweetPhotoElementToPhoto(element: HTMLElement): { src: string; alt?: string; href?: string } | null {
  const image = element.querySelector<HTMLImageElement>('img');
  const src = image?.currentSrc || image?.src || getTweetPhotoBackgroundUrl(element);
  if (!src) {
    return null;
  }

  const href = element.closest('a[href]')?.getAttribute('href') ?? undefined;
  return {
    src,
    alt: image?.alt || undefined,
    ...(href ? { href: new URL(href, X_CANONICAL_ORIGIN).toString() } : {})
  };
}

function getTweetPhotoBackgroundUrl(element: Element): string {
  const backgroundLayer = element.querySelector<HTMLElement>('[style*="background-image"]');
  const style = backgroundLayer?.style.backgroundImage || backgroundLayer?.getAttribute('style') || '';
  const match = /url\((?:"|&quot;)?([^")]+)(?:"|&quot;)?\)/.exec(style);
  return match?.[1]?.replace(/&amp;/g, '&') ?? '';
}

function getSimpleTweetHref(block: Element): string | undefined {
  const statusHref = Array.from(block.querySelectorAll<HTMLAnchorElement>('a[href*="/status/"]'))
    .map((anchor) => anchor.getAttribute('href') ?? '')
    .find((href) => /\/status\/(?!.*analytics)/.test(href));

  const href = statusHref || block.querySelector('a[href]')?.getAttribute('href');
  return href ? new URL(href, X_CANONICAL_ORIGIN).toString() : undefined;
}

function getTextAfterCover(coverRoot: Element, offset: number): string {
  const textBlocks = Array.from(coverRoot.parentElement?.querySelectorAll<HTMLElement>('div[dir="auto"]') ?? []);
  const coverIndex = textBlocks.findIndex((element) => coverRoot.contains(element));
  const candidates = coverIndex >= 0 ? textBlocks.slice(coverIndex + 1) : textBlocks;
  return candidates[offset]?.textContent ?? '';
}

function extractCoverImage(readView: Element, articleId: string): ImageBlock | undefined {
  const title = readView.querySelector(X_ARTICLE_SELECTORS.title);
  const image = title ? findImageBeforeTitle(readView, title) : null;
  return image ? (imageElementToBlock(image, `${articleId}-cover`) ?? undefined) : undefined;
}

function extractImageFromElement(element: Element, id: string): ImageBlock | null {
  const image = element.querySelector<HTMLImageElement>(X_ARTICLE_SELECTORS.tweetPhotoImage);
  if (!image) {
    return null;
  }

  return imageElementToBlock(image, id);
}

function findImageBeforeTitle(readView: Element, title: Element): HTMLImageElement | null {
  return (
    Array.from(readView.querySelectorAll<HTMLImageElement>(X_ARTICLE_SELECTORS.tweetPhotoImage)).find((image) =>
      isBefore(image, title)
    ) ?? null
  );
}

function isBefore(element: Element, target: Element): boolean {
  return Boolean(element.compareDocumentPosition(target) & Node.DOCUMENT_POSITION_FOLLOWING);
}

function imageElementToBlock(image: HTMLImageElement, id: string): ImageBlock | null {
  const src = image.currentSrc || image.src;
  if (!src) {
    return null;
  }

  const href = image.closest('a[href]')?.getAttribute('href') ?? undefined;
  const aspectRatio = getImageAspectRatio(image);
  return {
    id,
    type: 'image',
    src,
    alt: image.alt || undefined,
    href,
    ...(aspectRatio ? { aspectRatio } : {})
  };
}

function getImageAspectRatio(image: HTMLImageElement): number | undefined {
  const intrinsicRatio = toValidAspectRatio(image.naturalWidth, image.naturalHeight);
  if (intrinsicRatio) {
    return intrinsicRatio;
  }

  for (let element: Element | null = image.parentElement; element; element = element.parentElement) {
    const paddingRatio = getPaddingBottomAspectRatio(element);
    if (paddingRatio) {
      return paddingRatio;
    }
  }

  return undefined;
}

function getPaddingBottomAspectRatio(element: Element): number | undefined {
  for (const child of Array.from(element.children)) {
    const paddingBottom = getInlinePaddingBottomPercent(child);
    if (paddingBottom) {
      return roundAspectRatio(100 / paddingBottom);
    }
  }

  return undefined;
}

function getInlinePaddingBottomPercent(element: Element): number | undefined {
  const paddingBottom = (element as HTMLElement).style?.paddingBottom || element.getAttribute('style') || '';
  const match = /(?:padding-bottom:\s*)?([0-9.]+)%/i.exec(paddingBottom);
  if (!match) {
    return undefined;
  }

  const value = Number(match[1]);
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

function toValidAspectRatio(width: number, height: number): number | undefined {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return undefined;
  }

  return roundAspectRatio(width / height);
}

function roundAspectRatio(value: number): number {
  return Math.round(value * 10000) / 10000;
}

function isHeadingBlock(block: Element): boolean {
  return getHeadingLevel(block) !== undefined;
}

function getHeadingLevel(block: Element): 1 | 2 | 3 | 4 | 5 | 6 | undefined {
  const tagMatch = /^H([1-6])$/i.exec(block.tagName);
  if (tagMatch) {
    return Number(tagMatch[1]) as 1 | 2 | 3 | 4 | 5 | 6;
  }

  if (block.classList.contains('longform-header-one')) {
    return 1;
  }

  if (block.classList.contains('longform-header-two')) {
    return 2;
  }

  return undefined;
}

function isBoldTextElement(textElement: HTMLElement): boolean {
  const styledElement = textElement.closest<HTMLElement>('[style*="font-weight"]');
  const fontWeight = styledElement?.style.fontWeight;
  return fontWeight === 'bold' || fontWeight === '700';
}

function isEmojiTextElement(textElement: HTMLElement): boolean {
  return Boolean(textElement.closest<HTMLElement>('[style*="clip-path: circle"]'));
}

function extractTextWithAnnotations(element: Element): { text: string; annotations: TextAnnotation[] } {
  const textElements = Array.from(element.querySelectorAll<HTMLElement>('[data-text="true"]'));
  if (textElements.length === 0) {
    return { text: normalizeText(element.textContent ?? ''), annotations: [] };
  }

  let text = '';
  const annotations: TextAnnotation[] = [];
  const linkAnnotations: TextAnnotation[] = [];
  for (const textElement of textElements) {
    const segment = textElement.textContent ?? '';
    const startOffset = text.length;
    text += segment;
    const endOffset = text.length;

    if (endOffset > startOffset && isBoldTextElement(textElement)) {
      annotations.push({ startOffset, endOffset, bold: true });
    }
    const anchor = textElement.closest<HTMLAnchorElement>('a[href][role="link"], a[href]');
    if (endOffset > startOffset && anchor) {
      const href = anchor.getAttribute('href');
      if (href) {
        linkAnnotations.push({
          startOffset,
          endOffset,
          href,
          target: anchor.getAttribute('target') ?? undefined
        });
      }
    }
    if (isEmojiTextElement(textElement)) {
      // X renders emoji through a background image and hides the real glyph with
      // `clip-path: circle(...)`; keep the underlying text so sentence units
      // include the emoji instead of dropping it from the reading flow.
    }
  }

  return { text: normalizeText(text), annotations: [...annotations, ...linkAnnotations] };
}

function blockId(articleId: string, index: number): string {
  return `${articleId}-b${index}`;
}
