type Article = {
  id: string;
  source: 'x-article';
  sourceUrl: string;
  canonicalUrl: string;
  authorHandle?: string;
  title: string;
  coverImage?: ImageBlock;
  extractedAt: number;
  blocks: ArticleBlock[];
};

type ArticleBlock =
  | {
      id: string;
      type: 'heading' | 'paragraph' | 'quote';
      text: string;
      annotations?: TextAnnotation[];
      level?: 1 | 2 | 3 | 4 | 5 | 6;
    }
  | ImageBlock
  | {
      id: string;
      type: 'list';
      kind?: 'ordered' | 'unordered';
      items: string[];
      itemAnnotations?: TextAnnotation[][];
    }
  | {
      id: string;
      type: 'link';
      text: string;
      href: string;
      target?: string;
    }
  | {
      id: string;
      type: 'simple-tweet';
      coverUrl: string;
      coverAlt?: string;
      source: string;
      title: string;
      excerpt: string;
      href?: string;
      photos?: TweetPhoto[];
      authorName?: string;
      authorHandle?: string;
      authorAvatarUrl?: string;
      authorVerified?: boolean;
      publishedAt?: string;
      publishedAtText?: string;
      metrics?: TweetMetrics;
    }
  | {
      id: string;
      type: 'embed';
      label: string;
      text?: string;
      href?: string;
    };

type ImageBlock = {
  id: string;
  type: 'image';
  src: string;
  alt?: string;
  href?: string;
};

type TweetPhoto = {
  src: string;
  alt?: string;
  href?: string;
};

type TweetMetrics = {
  replies?: string;
  reposts?: string;
  likes?: string;
  views?: string;
  bookmarks?: string;
};

type TextAnnotation = {
  startOffset: number;
  endOffset: number;
  bold?: boolean;
  href?: string;
  target?: string;
};

type ExtensionMessage =
  | {
      type: 'ARTICLE_READY';
      extractorId: string;
    }
  | {
      type: 'ARTICLE_NOT_READY';
      reason: string;
    }
  | {
      type: 'EXTRACT_CURRENT_ARTICLE';
    }
  | {
      type: 'LINELENS_ROUTE_CHANGED';
      url: string;
    }
  | {
      type: 'ARTICLE_EXTRACTED';
      article: Article;
    }
  | {
      type: 'ARTICLE_EXTRACT_FAILED';
      reason: string;
    };

type ReadyResult =
  | {
      ready: true;
    }
  | {
      ready: false;
      reason: string;
    };

const X_ARTICLE_SELECTORS = {
  readView: '[data-testid="twitterArticleReadView"]',
  title: '[data-testid="twitter-article-title"]',
  richTextView: '[data-testid="twitterArticleRichTextView"]',
  longform: '[data-testid="longformRichTextComponent"]',
  block: '[data-block="true"]',
  quoteBlock: 'blockquote.longform-blockquote[data-block="true"]',
  tweetBlock: '[data-testid="tweet"]',
  tweetPhoto: '[data-testid="tweetPhoto"]',
  tweetPhotoImage: '[data-testid="tweetPhoto"] img'
} as const;

const X_CANONICAL_ORIGIN = 'https://x.com';
const X_ARTICLE_HOSTS = new Set(['x.com', 'twitter.com']);
const X_ARTICLE_PATH_PATTERN = /^\/([^/]+)\/(?:article|status)\/(\d+)\/?$/;
const MIN_READY_BLOCKS = 3;
const MIN_READY_TEXT_LENGTH = 200;
const MAX_READY_CHECKS = 40;
const READY_CHECK_INTERVAL_MS = 250;
const LOG_PREFIX = '[LineLens Content]';
let activeReadinessCleanup: (() => void) | undefined;

void monitorArticleState();

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'EXTRACT_CURRENT_ARTICLE') {
    void extractCurrentArticle().then(sendResponse);
    return true;
  }

  if (message.type === 'LINELENS_ROUTE_CHANGED') {
    console.info(LOG_PREFIX, 'route changed; restarting article monitor', {
      url: message.url
    });
    void monitorArticleState().then(() => sendResponse({ ok: true }));
    return true;
  }
});

async function monitorArticleState() {
  stopActiveReadinessMonitor();

  if (!isXArticleUrl(location.href)) {
    console.info(LOG_PREFIX, 'unsupported URL', {
      url: location.href
    });
    await sendArticleState({
      type: 'ARTICLE_NOT_READY',
      reason: 'unsupported_url'
    });
    return;
  }

  await reportWhenReady();
}

async function reportWhenReady() {
  let checks = 0;
  let lastReason = 'content_not_stable';
  console.info(LOG_PREFIX, 'monitoring article DOM readiness', {
    extractorId: 'x.article',
    url: location.href
  });

  const observer = new MutationObserver(() => {
    void check();
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  });

  const timer = window.setInterval(() => {
    void check();
  }, READY_CHECK_INTERVAL_MS);

  activeReadinessCleanup = cleanup;
  await check();

  async function check() {
    checks += 1;
    const ready = detectXArticleDom(document);

    if (ready.ready) {
      cleanup();
      console.info(LOG_PREFIX, 'article ready', {
        checks,
        extractorId: 'x.article'
      });
      await sendArticleState({
        type: 'ARTICLE_READY',
        extractorId: 'x.article'
      });
      return;
    }

    lastReason = ready.reason;

    if (checks >= MAX_READY_CHECKS) {
      cleanup();
      console.info(LOG_PREFIX, 'article not ready after retries', {
        checks,
        reason: lastReason
      });
      await sendArticleState({
        type: 'ARTICLE_NOT_READY',
        reason: lastReason
      });
    }
  }

  function cleanup() {
    if (activeReadinessCleanup === cleanup) {
      activeReadinessCleanup = undefined;
    }
    observer.disconnect();
    window.clearInterval(timer);
  }
}

function stopActiveReadinessMonitor() {
  activeReadinessCleanup?.();
  activeReadinessCleanup = undefined;
}

async function sendArticleState(message: ExtensionMessage) {
  console.info(LOG_PREFIX, 'sending article state', {
    type: message.type,
    reason: message.type === 'ARTICLE_NOT_READY' ? message.reason : undefined
  });
  await chrome.runtime.sendMessage(message).catch(() => {
    // The page can outlive the extension context during reloads.
  });
}

async function extractCurrentArticle(): Promise<ExtensionMessage> {
  console.info(LOG_PREFIX, 'extract request received', {
    url: location.href
  });

  if (!isXArticleUrl(location.href)) {
    console.info(LOG_PREFIX, 'extract failed: unsupported URL');
    return {
      type: 'ARTICLE_EXTRACT_FAILED',
      reason: 'unsupported_url'
    };
  }

  const ready = detectXArticleDom(document);
  if (!ready.ready) {
    console.info(LOG_PREFIX, 'extract failed: article not ready', {
      reason: ready.reason
    });
    return {
      type: 'ARTICLE_EXTRACT_FAILED',
      reason: ready.reason
    };
  }

  try {
    const article = extractXArticle(new URL(location.href), document);
    console.info(LOG_PREFIX, 'extract succeeded', {
      articleId: article.id,
      title: article.title,
      blocks: article.blocks.length
    });
    return {
      type: 'ARTICLE_EXTRACTED',
      article
    };
  } catch (error) {
    console.warn(LOG_PREFIX, 'extract threw', {
      error: error instanceof Error ? error.message : String(error)
    });
    return {
      type: 'ARTICLE_EXTRACT_FAILED',
      reason: error instanceof Error ? error.message : 'extract_failed'
    };
  }
}

function detectXArticleDom(root: ParentNode): ReadyResult {
  const readView = root.querySelector(X_ARTICLE_SELECTORS.readView);
  if (!readView) {
    return { ready: false, reason: 'missing_article_root' };
  }

  const title = readView.querySelector(X_ARTICLE_SELECTORS.title);
  if (!title || !hasMeaningfulText(title.textContent ?? '')) {
    return { ready: false, reason: 'missing_title' };
  }

  const richTextView = readView.querySelector(X_ARTICLE_SELECTORS.richTextView);
  if (!richTextView) {
    return { ready: false, reason: 'missing_rich_text_view' };
  }

  const longform = readView.querySelector(X_ARTICLE_SELECTORS.longform);
  if (!longform) {
    return { ready: false, reason: 'missing_longform_content' };
  }

  const blocks = Array.from(longform.querySelectorAll(X_ARTICLE_SELECTORS.block));
  const textLength = normalizeText(longform.textContent ?? '').length;

  if (blocks.length < MIN_READY_BLOCKS || textLength < MIN_READY_TEXT_LENGTH) {
    return { ready: false, reason: 'content_not_stable' };
  }

  return { ready: true };
}

function extractXArticle(url: URL, root: ParentNode): Article {
  const readView = root.querySelector(X_ARTICLE_SELECTORS.readView);
  const longform = readView?.querySelector(X_ARTICLE_SELECTORS.longform);
  const title = normalizeText(readView?.querySelector(X_ARTICLE_SELECTORS.title)?.textContent ?? '');
  const articleId = getXArticleIdFromUrl(url);

  if (!readView || !longform || !title || !articleId) {
    throw new Error('article_not_ready');
  }

  const blocks = extractBlocks(longform, articleId);
  const coverImage = extractCoverImage(readView, articleId);
  const article: Article = {
    id: articleId,
    source: 'x-article',
    sourceUrl: url.toString(),
    canonicalUrl: `${X_CANONICAL_ORIGIN}/${getXArticleAuthorHandleFromUrl(url) ?? 'i'}/article/${articleId}`,
    authorHandle: getXArticleAuthorHandleFromUrl(url),
    title,
    coverImage,
    extractedAt: Date.now(),
    blocks
  };

  const validation = validateArticle(article);
  if (!validation.valid) {
    throw new Error(validation.reason);
  }

  return article;
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

function extractTweetMetrics(tweet: Element): TweetMetrics {
  return {
    ...extractTweetMetric(tweet, 'reply', 'replies'),
    ...extractTweetMetric(tweet, 'retweet', 'reposts'),
    ...extractTweetMetric(tweet, 'like', 'likes'),
    ...extractTweetMetric(tweet, 'bookmark', 'bookmarks'),
    ...extractTweetViewsMetric(tweet)
  };
}

function extractTweetMetric(tweet: Element, testId: string, key: keyof TweetMetrics): TweetMetrics {
  const root = tweet.querySelector(`[data-testid="${testId}"]`);
  const value = normalizeText(root?.textContent ?? '') || parseTweetMetricLabel(root?.getAttribute('aria-label') ?? '');
  return value ? { [key]: value } : {};
}

function extractTweetViewsMetric(tweet: Element): TweetMetrics {
  const analytics = tweet.querySelector('a[href*="/analytics"]');
  const value = normalizeText(analytics?.textContent ?? '') || parseTweetMetricLabel(analytics?.getAttribute('aria-label') ?? '');
  return value ? { views: value } : {};
}

function parseTweetMetricLabel(label: string): string {
  return normalizeText(label).match(/\d+(?:\.\d+)?[KMB]?/)?.[0] ?? '';
}

function hasTweetMetrics(metrics: TweetMetrics): boolean {
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

function isBoldTextElement(textElement: HTMLElement): boolean {
  const styledElement = textElement.closest<HTMLElement>('[style*="font-weight"]');
  const fontWeight = styledElement?.style.fontWeight;
  return fontWeight === 'bold' || fontWeight === '700';
}

function isEmojiTextElement(textElement: HTMLElement): boolean {
  return Boolean(textElement.closest<HTMLElement>('[style*="clip-path: circle"]'));
}

function validateArticle(article: Article) {
  if (!normalizeText(article.id)) {
    return { valid: false, reason: 'missing_id' };
  }

  if (!normalizeText(article.title)) {
    return { valid: false, reason: 'missing_title' };
  }

  if (!Array.isArray(article.blocks) || article.blocks.length < 3) {
    return { valid: false, reason: 'insufficient_blocks' };
  }

  const textLength = article.blocks.reduce((total, block) => total + getBlockTextLength(block), 0);
  const hasTextBlock = article.blocks.some((block) => isTextBlock(block));
  const hasMediaBlock = article.blocks.some(
    (block) => block.type === 'image' || block.type === 'embed' || block.type === 'simple-tweet' || block.type === 'link'
  );

  if (textLength <= 200 && !(hasTextBlock && hasMediaBlock)) {
    return { valid: false, reason: 'insufficient_content' };
  }

  return { valid: true };
}

function getBlockTextLength(block: ArticleBlock): number {
  if (block.type === 'paragraph' || block.type === 'heading' || block.type === 'quote') {
    return normalizeText(block.text).length;
  }

  if (block.type === 'list') {
    return block.items.reduce((total, item) => total + normalizeText(item).length, 0);
  }

  if (block.type === 'embed') {
    return normalizeText(`${block.label} ${block.text ?? ''}`).length;
  }

  if (block.type === 'simple-tweet') {
    return normalizeText(`${block.source} ${block.title} ${block.excerpt}`).length;
  }
  if (block.type === 'link') {
    return normalizeText(block.text).length;
  }

  return 0;
}

function isTextBlock(block: ArticleBlock): boolean {
  return block.type === 'paragraph' || block.type === 'heading' || block.type === 'quote' || block.type === 'list' || block.type === 'link';
}

function isXArticleUrl(value: string | URL): boolean {
  const url = toUrl(value);
  return url !== null && X_ARTICLE_HOSTS.has(url.hostname) && X_ARTICLE_PATH_PATTERN.test(url.pathname);
}

function getXArticleIdFromUrl(value: string | URL): string | null {
  const url = toUrl(value);
  if (!url || !X_ARTICLE_HOSTS.has(url.hostname)) {
    return null;
  }

  return X_ARTICLE_PATH_PATTERN.exec(url.pathname)?.[2] ?? null;
}

function getXArticleAuthorHandleFromUrl(value: string | URL): string | undefined {
  const url = toUrl(value);
  if (!url || !X_ARTICLE_HOSTS.has(url.hostname)) {
    return undefined;
  }

  return X_ARTICLE_PATH_PATTERN.exec(url.pathname)?.[1];
}

function toUrl(value: string | URL): URL | null {
  if (value instanceof URL) {
    return value;
  }

  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function hasMeaningfulText(value: string): boolean {
  return normalizeText(value).length > 0;
}

function blockId(articleId: string, index: number): string {
  return `${articleId}-b${index}`;
}
