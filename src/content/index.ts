type Article = {
  id: string;
  source: 'x-article';
  sourceUrl: string;
  canonicalUrl: string;
  authorName?: string;
  authorHandle?: string;
  authorAvatarUrl?: string;
  authorVerified?: boolean;
  publishedAt?: string;
  publishedAtText?: string;
  metrics?: TweetMetrics;
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
      textStyle?: TextStyle;
    }
  | ImageBlock
  | ImageGalleryBlock
  | {
      id: string;
      type: 'list';
      kind?: 'ordered' | 'unordered';
      items: string[];
      itemAnnotations?: TextAnnotation[][];
      itemTextStyles?: TextStyle[];
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
      type: 'code';
      language?: string;
      text: string;
      codeStyle?: CodeBlockStyle;
      tokens?: CodeToken[];
    }
  | TableBlock
  | GifBlock
  | VideoBlock
  | (SimpleTweetCardData & {
      id: string;
      type: 'simple-tweet';
      metrics?: TweetMetrics;
    })
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
  aspectRatio?: number;
};

type ImageGalleryItem = {
  src: string;
  alt?: string;
  href?: string;
  aspectRatio?: number;
};

type ImageGalleryBlock = {
  id: string;
  type: 'image-gallery';
  items: ImageGalleryItem[];
  aspectRatio?: number;
};

type GifBlock = {
  id: string;
  type: 'gif';
  src: string;
  poster?: string;
  aspectRatio?: number;
  backgroundColor?: string;
  top?: string;
  left?: string;
  transform?: string;
  paused?: boolean;
};

type VideoBlock = {
  id: string;
  type: 'video';
  src: string;
  sourceType?: string;
  transport?: 'hls' | 'direct';
  hls?: {
    masterPlaylistUrl?: string;
    audioPlaylistUrl?: string;
    videoPlaylists?: Array<{
      resolution: string;
      width?: number;
      height?: number;
      url: string;
    }>;
  };
  poster?: string;
  aspectRatio?: number;
  backgroundColor?: string;
  top?: string;
  left?: string;
  transform?: string;
  preload?: 'auto' | 'metadata' | 'none' | '';
  playsInline?: boolean;
  tabIndex?: number;
  ariaLabel?: string;
  paused?: boolean;
};

type SimpleTweetTextItem = {
  type: 'text';
  text: string;
};

type SimpleTweetVideoItem = {
  type: 'video';
  video: VideoBlock;
};

type SimpleTweetVideoPreviewItem = {
  type: 'video-preview';
  src: string;
  alt?: string;
  href?: string;
  durationText?: string;
  aspectRatio?: number;
  layout?: 'condensed';
  shape?: 'rounded-square';
};

type SimpleTweetPhotoItem = {
  type: 'photo';
  photo: TweetPhoto;
};

type SimpleTweetPhotoLayout =
  | {
      kind: 'photo';
      photo: TweetPhoto;
      widthRatio?: number;
      heightRatio?: number;
    }
  | {
      kind: 'row' | 'column';
      children: SimpleTweetPhotoLayout[];
      widthRatio?: number;
      heightRatio?: number;
    };

type SimpleTweetPhotoGroupItem = {
  type: 'photo-group';
  photos: TweetPhoto[];
  layout: SimpleTweetPhotoLayout;
  aspectRatio?: number;
};

type SimpleTweetArticleCoverItem = {
  type: 'article-cover';
  coverUrl: string;
  coverAlt?: string;
  title?: string;
  excerpt?: string;
  href?: string;
  authorName?: string;
  authorHandle?: string;
  authorAvatarUrl?: string;
  authorVerified?: boolean;
  publishedAt?: string;
  publishedAtText?: string;
  metrics?: TweetMetrics;
};

type SimpleTweetCardData = {
  source: string;
  title: string;
  excerpt: string;
  href?: string;
  items: SimpleTweetContentItem[];
  aiGeneratedText?: string;
  authorName?: string;
  authorHandle?: string;
  authorAvatarUrl?: string;
  authorBadgeAvatarUrl?: string;
  authorVerified?: boolean;
  publishedAt?: string;
  publishedAtText?: string;
  replyContextText?: string;
  replyToHandle?: string;
  translationSourceText?: string;
  translationActionText?: string;
};

type SimpleTweetQuotedTweetItem = {
  type: 'quoted-tweet';
  tweet: SimpleTweetCardData;
};

type SimpleTweetContentItem =
  | SimpleTweetTextItem
  | SimpleTweetVideoItem
  | SimpleTweetVideoPreviewItem
  | SimpleTweetPhotoItem
  | SimpleTweetPhotoGroupItem
  | SimpleTweetArticleCoverItem
  | SimpleTweetQuotedTweetItem;

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

type TextStyle = {
  color?: string;
  fontSize?: string;
  lineHeight?: string;
  textAlign?: string;
  fontStyle?: string;
  fontWeight?: string;
};

type CodeBlockStyle = {
  headerBackgroundColor?: string;
  headerColor?: string;
  copyColor?: string;
  preBackgroundColor?: string;
  preColor?: string;
  codeBackgroundColor?: string;
  codeColor?: string;
  fontFamily?: string;
  fontSize?: string;
  lineHeight?: string;
  tabSize?: string;
};

type CodeToken = {
  text: string;
  color?: string;
  fontStyle?: string;
  fontWeight?: string;
};

type TableBlock = {
  id: string;
  type: 'table';
  rows: TableRow[];
  columnCount?: number;
  tableStyle?: TableStyle;
};

type TableRow = {
  cells: TableCell[];
};

type TableCell = {
  text: string;
  header?: boolean;
  colSpan?: number;
  rowSpan?: number;
  textStyle?: TextStyle;
  backgroundColor?: string;
  borderColor?: string;
};

type TableStyle = {
  backgroundColor?: string;
  borderColor?: string;
};

type TextAnnotation = {
  startOffset: number;
  endOffset: number;
  bold?: boolean;
  href?: string;
  target?: string;
  emojiImageUrl?: string;
  color?: string;
  fontSize?: string;
  lineHeight?: string;
  textAlign?: string;
  fontStyle?: string;
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
    }
  | {
      type: 'UPSERT_X_VIDEO_POSTERS';
      posters: Record<string, string>;
    }
  | {
      type: 'GET_CAPTURED_X_VIDEOS';
    };

type CapturedXVideo = {
  videoId: string;
  poster?: string;
  masterPlaylistUrl?: string;
  videoPlaylists?: Record<string, string>;
  audioPlaylists?: Record<string, string>;
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
  codeBlock: '[data-testid="markdown-code-block"]',
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
const AMPLIFY_VIDEO_ID_PATTERN = /amplify_video(?:_thumb)?\/(\d+)/;
let activeReadinessCleanup: (() => void) | undefined;
let activePosterCleanup: (() => void) | undefined;

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
  stopPosterMonitor();

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

  startPosterMonitor();
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

function startPosterMonitor() {
  void publishVideoPosters();

  const observer = new MutationObserver(() => {
    void publishVideoPosters();
  });

  observer.observe(document.body ?? document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['poster']
  });

  activePosterCleanup = () => observer.disconnect();
}

function stopPosterMonitor() {
  activePosterCleanup?.();
  activePosterCleanup = undefined;
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
    const article = await extractXArticle(new URL(location.href), document);
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

async function extractXArticle(url: URL, root: ParentNode): Promise<Article> {
  const readView = root.querySelector(X_ARTICLE_SELECTORS.readView);
  const longform = readView?.querySelector(X_ARTICLE_SELECTORS.longform);
  const title = normalizeText(readView?.querySelector(X_ARTICLE_SELECTORS.title)?.textContent ?? '');
  const articleId = getXArticleIdFromUrl(url);

  if (!readView || !longform || !title || !articleId) {
    throw new Error('article_not_ready');
  }

  const capturedVideos = await getCapturedVideos();
  const blocks = await extractBlocks(longform, articleId, capturedVideos);
  const coverImage = extractCoverImage(readView, articleId);
  const articleMeta = extractArticleHeaderMetadata(readView, longform);
  const article: Article = {
    id: articleId,
    source: 'x-article',
    sourceUrl: url.toString(),
    canonicalUrl: `${X_CANONICAL_ORIGIN}/${getXArticleAuthorHandleFromUrl(url) ?? 'i'}/article/${articleId}`,
    authorHandle: getXArticleAuthorHandleFromUrl(url),
    ...articleMeta,
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

function extractArticleHeaderMetadata(readView: Element, longform: Element): Partial<Article> {
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
  const time = authorRoot?.parentElement?.querySelector<HTMLTimeElement>('time') ?? readView.querySelector<HTMLTimeElement>('time');
  const metrics = extractArticleHeaderMetricsFromGroup(metricsGroup);

  return {
    ...(authorName ? { authorName } : {}),
    ...(authorHandle ? { authorHandle } : {}),
    ...(authorAvatar ? { authorAvatarUrl: authorAvatar } : {}),
    ...(authorRoot?.querySelector('[data-testid="icon-verified"], [aria-label="认证账号"], [aria-label="Verified account"]')
      ? { authorVerified: true }
      : {}),
    ...(time?.dateTime ? { publishedAt: time.dateTime } : {}),
    ...(time?.textContent ? { publishedAtText: normalizeText(time.textContent) } : {}),
    ...(hasTweetMetrics(metrics) ? { metrics } : {})
  };
}

function findHeaderElementAfterTitle(readView: Element, longform: Element, selector: string, titleElement: Element | null): Element | null {
  const candidates = Array.from(readView.querySelectorAll(selector)).filter((candidate) => !longform.contains(candidate));
  if (!titleElement) {
    return candidates[0] ?? null;
  }
  return candidates.find((candidate) => Boolean(titleElement.compareDocumentPosition(candidate) & Node.DOCUMENT_POSITION_FOLLOWING)) ?? null;
}

function extractArticleHeaderMetricsFromGroup(group: Element | null): TweetMetrics {
  if (!group) {
    return {};
  }

  return {
    replies: extractArticleHeaderMetricValueFromGroup(group, 'reply'),
    reposts: extractArticleHeaderMetricValueFromGroup(group, 'retweet'),
    likes: extractArticleHeaderMetricValueFromGroup(group, 'like'),
    views:
      normalizeText(group.querySelector('a[href*="/analytics"]')?.textContent ?? '') ||
      parseArticleHeaderMetricLabel(group.getAttribute('aria-label') ?? '', /(?:查看|观看|view)/i),
    bookmarks: extractArticleHeaderMetricValueFromGroup(group, 'bookmark')
  };
}

function extractArticleHeaderMetricValueFromGroup(group: Element, testId: string): string | undefined {
  const action = group.querySelector(`[data-testid="${testId}"]`);
  const value = normalizeText(action?.textContent ?? '') || parseArticleHeaderMetricLabel(action?.getAttribute('aria-label') ?? '');
  return value || undefined;
}

function parseArticleHeaderMetricLabel(label: string, hint?: RegExp): string {
  const text = normalizeText(label);
  if (hint && !hint.test(text)) {
    return '';
  }
  return text.match(/[\d,.]+(?:\.\d+)?(?:万|[KMB])?/i)?.[0] ?? '';
}

async function extractBlocks(longform: Element, articleId: string, capturedVideos: CapturedXVideo[]): Promise<ArticleBlock[]> {
  const blocks: ArticleBlock[] = [];
  let pendingListItems: string[] = [];
  let pendingListItemAnnotations: TextAnnotation[][] = [];
  let pendingListItemTextStyles: TextStyle[] = [];
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
    if (pendingListItemTextStyles.some((style) => Object.keys(style).length > 0)) {
      listBlock.itemTextStyles = pendingListItemTextStyles;
    }

    blocks.push(listBlock);
    pendingListItems = [];
    pendingListItemAnnotations = [];
    pendingListItemTextStyles = [];
    pendingListKind = 'unordered';
  }

  for (const block of Array.from(longform.querySelectorAll(X_ARTICLE_SELECTORS.block))) {
    const listKind = getListKind(block);
    if (listKind) {
      const extracted = extractTextWithAnnotations(block, { preserveLineBreaks: true });
      if (extracted.text) {
        if (pendingListItems.length === 0) {
          pendingListKind = listKind;
        } else if (pendingListKind !== listKind) {
          flushPendingList();
          pendingListKind = listKind;
        }
        pendingListItems.push(extracted.text);
        pendingListItemAnnotations.push(extracted.annotations);
        pendingListItemTextStyles.push(extractElementTextStyle(block));
      }
      continue;
    }

    const handwrittenOrderedListItem = extractHandwrittenOrderedListItem(block);
    if (handwrittenOrderedListItem) {
      if (pendingListItems.length === 0) {
        pendingListKind = 'ordered';
      } else if (pendingListKind !== 'ordered') {
        flushPendingList();
        pendingListKind = 'ordered';
      }
      pendingListItems.push(handwrittenOrderedListItem.text);
      pendingListItemAnnotations.push(handwrittenOrderedListItem.annotations);
      pendingListItemTextStyles.push(extractElementTextStyle(block));
      continue;
    }

    flushPendingList();
    const articleBlock = await extractBlock(block, articleId, blocks.length + 1, capturedVideos);
    if (articleBlock) {
      blocks.push(articleBlock);
    }
  }

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

function extractHandwrittenOrderedListItem(block: Element): { text: string; annotations: TextAnnotation[] } | null {
  if (block.matches(X_ARTICLE_SELECTORS.quoteBlock) || isHeadingBlock(block) || hasNonTextContent(block)) {
    return null;
  }

  const extracted = extractTextWithAnnotations(block, { preserveLineBreaks: true });
  const marker = getHandwrittenOrderedListMarker(extracted.text);
  if (!marker) {
    return null;
  }

  const text = extracted.text.slice(marker.length).trim();
  if (!text) {
    return null;
  }

  return {
    text,
    annotations: shiftAnnotations(extracted.annotations, marker.length, text.length)
  };
}

function getHandwrittenOrderedListMarker(text: string): string | null {
  return text.match(/^\s*(?:(?:\d+|[ivxlcdm]+)\s*[.)、:：]|[一二三四五六七八九十百千]+\s*[、.．:：])\s*/i)?.[0] ?? null;
}

function shiftAnnotations(annotations: TextAnnotation[], markerLength: number, textLength: number): TextAnnotation[] {
  return annotations
    .map((annotation) => ({
      ...annotation,
      startOffset: Math.max(0, annotation.startOffset - markerLength),
      endOffset: Math.min(textLength, annotation.endOffset - markerLength)
    }))
    .filter((annotation) => annotation.endOffset > annotation.startOffset);
}

function hasNonTextContent(block: Element): boolean {
  return Boolean(
    block.matches(X_ARTICLE_SELECTORS.codeBlock) ||
      block.querySelector(X_ARTICLE_SELECTORS.codeBlock) ||
      block.querySelector(X_ARTICLE_SELECTORS.tweetBlock) ||
      block.querySelector(X_ARTICLE_SELECTORS.tweetPhoto) ||
      block.querySelector('[data-testid="simpleTweet"], [data-testid="article-cover-image"], img, video, iframe')
  );
}

async function extractBlock(block: Element, articleId: string, index: number, capturedVideos: CapturedXVideo[]): Promise<ArticleBlock | null> {
  if (block.matches(X_ARTICLE_SELECTORS.quoteBlock)) {
    const extracted = extractTextWithAnnotations(block, { preserveLineBreaks: true });
    return extracted.text
      ? {
          id: blockId(articleId, index),
          type: 'quote',
          text: extracted.text,
          textStyle: extractElementTextStyle(block),
          ...(extracted.annotations.length > 0 ? { annotations: extracted.annotations } : {})
        }
      : null;
  }

  const nonTextBlock = await extractNonTextBlock(block, articleId, index, capturedVideos);
  if (nonTextBlock) {
    return nonTextBlock;
  }

  const extracted = extractTextWithAnnotations(block, { preserveLineBreaks: true });
  if (!extracted.text) {
    return null;
  }

  if (isHeadingBlock(block)) {
    return {
      id: blockId(articleId, index),
      type: 'heading',
      text: extracted.text,
      level: getHeadingLevel(block),
      textStyle: extractElementTextStyle(block),
      ...(extracted.annotations.length > 0 ? { annotations: extracted.annotations } : {})
    };
  }

  const textBlock: ArticleBlock = {
    id: blockId(articleId, index),
    type: 'paragraph',
    text: extracted.text,
    textStyle: extractElementTextStyle(block)
  };
  if (textBlock.type === 'paragraph' && extracted.annotations.length > 0) {
    textBlock.annotations = extracted.annotations;
  }

  return textBlock;
}

async function extractNonTextBlock(block: Element, articleId: string, index: number, capturedVideos: CapturedXVideo[]): Promise<ArticleBlock | null> {
  const tweetRef = await extractTweetRefBlock(block, blockId(articleId, index), capturedVideos);
  if (tweetRef) {
    return tweetRef;
  }

  const simpleTweet = await extractSimpleTweetBlock(block, blockId(articleId, index), capturedVideos);
  if (simpleTweet) {
    return simpleTweet;
  }

  const video = extractVideoFromElement(block, blockId(articleId, index), capturedVideos);
  if (video) {
    return video;
  }

  const gif = extractGifFromElement(block, blockId(articleId, index));
  if (gif) {
    return gif;
  }

  const imageGallery = extractImageGalleryFromElement(block, blockId(articleId, index));
  if (imageGallery) {
    return imageGallery;
  }

  const image = extractImageFromElement(block, blockId(articleId, index));
  if (image) {
    return image;
  }

  const link = extractLinkBlock(block, blockId(articleId, index));
  if (link) {
    return link;
  }

  const table = extractTableBlock(block, blockId(articleId, index));
  if (table) {
    return table;
  }

  const code = extractCodeBlock(block, blockId(articleId, index));
  if (code) {
    return code;
  }

  return null;
}

function extractCodeBlock(block: Element, id: string): ArticleBlock | null {
  // X Article wraps fenced markdown code in data-testid="markdown-code-block".
  const codeRoot = block.matches(X_ARTICLE_SELECTORS.codeBlock)
    ? block
    : block.querySelector(X_ARTICLE_SELECTORS.codeBlock);
  if (!codeRoot) {
    return null;
  }

  const code = codeRoot.querySelector('pre code');
  const pre = codeRoot.querySelector('pre');
  const text = normalizeCodeText(code?.textContent ?? pre?.textContent ?? '');
  if (!text) {
    return null;
  }

  const languageClass = Array.from(code?.classList ?? [])
    .find((className) => className.startsWith('language-'))
    ?.replace(/^language-/, '');
  const headerLanguage = normalizeText(codeRoot.querySelector<HTMLElement>(':scope > div:first-child span')?.textContent ?? '');
  const language = normalizeCodeLanguage(languageClass || headerLanguage);

  return {
    id,
    type: 'code',
    text,
    ...(language ? { language } : {}),
    codeStyle: extractCodeBlockStyle(codeRoot, pre, code),
    tokens: extractCodeTokens(code)
  };
}

function extractTableBlock(block: Element, id: string): TableBlock | null {
  const tableRoot = findTableRoot(block);
  if (!tableRoot) {
    return null;
  }

  const rowElements = getTableRowElements(tableRoot);
  const rows = rowElements
    .map((row) => ({
      cells: getTableCellElements(row).map((cell) => ({
        text: normalizePreWrapText(getElementDisplayText(cell, true)),
        ...(isTableHeaderCell(cell) ? { header: true } : {}),
        ...getTableSpanAttributes(cell),
        textStyle: extractElementTextStyle(cell),
        ...extractTableCellSurface(cell)
      }))
    }))
    .filter((row) => row.cells.some((cell) => cell.text));

  if (rows.length === 0) {
    return null;
  }

  return {
    id,
    type: 'table',
    rows,
    columnCount: Math.max(...rows.map((row) => row.cells.reduce((total, cell) => total + (cell.colSpan ?? 1), 0))),
    tableStyle: extractTableSurface(tableRoot)
  };
}

function normalizeCodeLanguage(language: string): string {
  return normalizeText(language).replace(/^language-/, '').toLowerCase();
}

function extractCodeBlockStyle(codeRoot: Element, pre: Element | null, code: Element | null): CodeBlockStyle {
  const header = codeRoot.querySelector(':scope > div:first-child');
  const copyIcon = codeRoot.querySelector('button svg, button [style*="color"]');
  return compactStyle({
    headerBackgroundColor: getStyleValue(header, 'backgroundColor'),
    headerColor: getStyleValue(header, 'color'),
    copyColor: getStyleValue(copyIcon, 'color'),
    preBackgroundColor: getStyleValue(pre, 'backgroundColor'),
    preColor: getStyleValue(pre, 'color'),
    codeBackgroundColor: getStyleValue(code, 'backgroundColor'),
    codeColor: getStyleValue(code, 'color'),
    fontFamily: getStyleValue(code, 'fontFamily') || getStyleValue(pre, 'fontFamily'),
    fontSize: getStyleValue(code, 'fontSize') || getStyleValue(pre, 'fontSize'),
    lineHeight: getStyleValue(code, 'lineHeight') || getStyleValue(pre, 'lineHeight'),
    tabSize: getStyleValue(code, 'tabSize') || getStyleValue(pre, 'tabSize')
  });
}

function extractCodeTokens(code: Element | null): CodeToken[] | undefined {
  if (!code) {
    return undefined;
  }

  const tokens: CodeToken[] = [];
  collectCodeTokens(code, tokens, extractCodeTokenStyle(code));
  return tokens.length > 0 ? tokens : undefined;
}

function collectCodeTokens(node: Node, tokens: CodeToken[], inheritedStyle: Omit<CodeToken, 'text'> = {}): void {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent ?? '';
    if (text) {
      tokens.push({ text, ...inheritedStyle });
    }
    return;
  }

  if (!(node instanceof Element)) {
    return;
  }

  const style = { ...inheritedStyle, ...extractCodeTokenStyle(node) };
  for (const child of Array.from(node.childNodes)) {
    collectCodeTokens(child, tokens, style);
  }
}

function extractCodeTokenStyle(element: Element | null): Omit<CodeToken, 'text'> {
  return compactStyle({
    color: getStyleValue(element, 'color'),
    fontStyle: getStyleValue(element, 'fontStyle'),
    fontWeight: getStyleValue(element, 'fontWeight')
  });
}

function findTableRoot(block: Element): Element | null {
  if (block.matches('table, [role="table"], [role="grid"]')) {
    return block;
  }
  return block.querySelector('table, [role="table"], [role="grid"], [data-testid="markdown-table"]');
}

function getTableRowElements(tableRoot: Element): Element[] {
  const rows = Array.from(tableRoot.querySelectorAll(':scope tr, :scope [role="row"]'));
  if (rows.length > 0) {
    return rows;
  }

  const directRows = Array.from(tableRoot.children).filter((child) => getTableCellElements(child).length > 0);
  return directRows.length > 0 ? directRows : [tableRoot];
}

function getTableCellElements(row: Element): Element[] {
  const cells = Array.from(
    row.querySelectorAll(':scope > th, :scope > td, :scope > [role="columnheader"], :scope > [role="rowheader"], :scope > [role="cell"], :scope > [role="gridcell"]')
  );
  if (cells.length > 0) {
    return cells;
  }
  return Array.from(row.children).filter((child) => normalizeText(child.textContent ?? '') !== '');
}

function isTableHeaderCell(cell: Element): boolean {
  const role = cell.getAttribute('role');
  return cell.tagName.toUpperCase() === 'TH' || role === 'columnheader' || role === 'rowheader';
}

function getTableSpanAttributes(cell: Element): Pick<TableBlock['rows'][number]['cells'][number], 'colSpan' | 'rowSpan'> {
  const colSpan = Number(cell.getAttribute('colspan') ?? cell.getAttribute('aria-colspan') ?? '');
  const rowSpan = Number(cell.getAttribute('rowspan') ?? cell.getAttribute('aria-rowspan') ?? '');
  return {
    ...(Number.isFinite(colSpan) && colSpan > 1 ? { colSpan } : {}),
    ...(Number.isFinite(rowSpan) && rowSpan > 1 ? { rowSpan } : {})
  };
}

function extractTableSurface(element: Element): TableBlock['tableStyle'] {
  return compactStyle({
    backgroundColor: getStyleValue(element, 'backgroundColor'),
    borderColor: getStyleValue(element, 'borderColor')
  });
}

function extractTableCellSurface(element: Element): Pick<TableBlock['rows'][number]['cells'][number], 'backgroundColor' | 'borderColor'> {
  return compactStyle({
    backgroundColor: getStyleValue(element, 'backgroundColor'),
    borderColor: getStyleValue(element, 'borderColor')
  });
}

function extractElementTextStyle(element: Element | null): TextStyle {
  return compactStyle({
    color: getStyleValue(element, 'color'),
    fontSize: getStyleValue(element, 'fontSize'),
    lineHeight: getStyleValue(element, 'lineHeight'),
    textAlign: getStyleValue(element, 'textAlign'),
    fontStyle: getStyleValue(element, 'fontStyle'),
    fontWeight: getStyleValue(element, 'fontWeight')
  });
}

function extractTextAnnotationStyle(element: Element | null): Pick<TextAnnotation, 'color' | 'fontSize' | 'lineHeight' | 'textAlign' | 'fontStyle'> {
  return compactStyle({
    color: getStyleValue(element, 'color'),
    fontSize: getStyleValue(element, 'fontSize'),
    lineHeight: getStyleValue(element, 'lineHeight'),
    textAlign: getStyleValue(element, 'textAlign'),
    fontStyle: getStyleValue(element, 'fontStyle')
  });
}

function getStyleValue(element: Element | null | undefined, property: keyof CSSStyleDeclaration): string | undefined {
  if (!element || !(element instanceof HTMLElement)) {
    return undefined;
  }

  const inlineValue = element.style[property];
  const computedValue =
    typeof window !== 'undefined' && typeof window.getComputedStyle === 'function'
      ? window.getComputedStyle(element)[property]
      : '';
  const value = String(inlineValue || computedValue || '').trim();
  if (!value || value === 'normal' || value === 'auto' || value === 'none' || value === 'rgba(0, 0, 0, 0)') {
    return undefined;
  }
  return value;
}

function compactStyle<T extends Record<string, string | number | boolean | undefined>>(style: T): T {
  return Object.fromEntries(Object.entries(style).filter(([, value]) => value !== undefined && value !== '')) as T;
}

async function extractTweetRefBlock(block: Element, id: string, capturedVideos: CapturedXVideo[]): Promise<ArticleBlock | null> {
  const tweet = block.querySelector(X_ARTICLE_SELECTORS.tweetBlock);
  if (!tweet) {
    return null;
  }

  const articleCard = (await extractSimpleTweetBlock(block, id, capturedVideos)) ?? (await extractSimpleTweetBlock(tweet, id, capturedVideos));
  if (articleCard) {
    return articleCard;
  }

  return extractTweetSummaryBlock(tweet, id, block);
}

async function extractTweetSummaryBlock(tweet: Element, id: string, fallbackBlock?: Element): Promise<ArticleBlock> {
  const profile = extractTweetProfile(tweet);
  const metrics = extractTweetMetrics(tweet);
  const authorLine = buildTweetAuthorLine(profile);
  const body = await extractTweetBodyText(tweet);
  const fallbackText = normalizeText(tweet.querySelector('[data-testid="User-Name"]') ? '' : (tweet.textContent ?? fallbackBlock?.textContent ?? ''));
  const title = authorLine || (body ? 'X Tweet' : fallbackText || 'X Tweet');
  const excerpt = body || (authorLine ? '' : fallbackText);
  const href = getSimpleTweetHref(tweet) ?? (fallbackBlock ? getSimpleTweetHref(fallbackBlock) : undefined);

  return {
    id,
    type: 'simple-tweet',
    source: 'X Tweet',
    title,
    excerpt,
    href,
    items: body ? [{ type: 'text', text: body }] : [],
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

async function expandTweetTextIfNeeded(tweet: Element): Promise<void> {
  const textContainer = tweet.querySelector<HTMLElement>('[data-testid="tweetText"]');
  const showMoreButton = tweet.querySelector<HTMLButtonElement>('[data-testid="tweet-text-show-more-link"]');
  if (!textContainer || !showMoreButton) {
    return;
  }

  const label = getTweetShowMoreButtonLabel(showMoreButton);
  if (!label) {
    return;
  }

  const beforeText = normalizeText(textContainer.textContent ?? '');
  const waitForExpandedText = new Promise<void>((resolve) => {
    const observer = new MutationObserver(() => {
      const nextText = normalizeText(textContainer.textContent ?? '');
      if (nextText && nextText !== beforeText) {
        observer.disconnect();
        resolve();
      }
    });

    observer.observe(textContainer, {
      childList: true,
      characterData: true,
      subtree: true
    });

    showMoreButton.click();
  });

  await Promise.race([waitForExpandedText, wait(500)]);
}

function getTweetShowMoreButtonLabel(button: Element): string {
  return normalizeText(button.textContent ?? button.getAttribute('aria-label') ?? '');
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

async function extractTweetBodyText(tweet: Element): Promise<string> {
  await expandTweetTextIfNeeded(tweet);
  const explicitTweetText = normalizePreWrapText(tweet.querySelector('[data-testid="tweetText"]')?.textContent ?? '');
  if (explicitTweetText) {
    return explicitTweetText;
  }

  const authorRoot = tweet.querySelector('[data-testid="User-Name"]');
  const candidates = Array.from(tweet.querySelectorAll<HTMLElement>('div[dir="auto"]'))
    .filter((element) => !authorRoot?.contains(element))
    .map((element) => normalizePreWrapText(element.textContent ?? ''))
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

async function extractSimpleTweetBlock(block: Element, id: string, capturedVideos: CapturedXVideo[] = []): Promise<ArticleBlock | null> {
  if (!isSimpleTweetCard(block)) {
    return null;
  }

  return extractSimpleTweetBlockFromRoot(block, id, capturedVideos);
}

function isSimpleTweetCard(block: Element): boolean {
  return block.matches('[data-testid="simpleTweet"]') || Boolean(block.querySelector('[data-testid="simpleTweet"]'));
}

async function extractSimpleTweetBlockFromRoot(block: Element, id: string, capturedVideos: CapturedXVideo[] = []): Promise<ArticleBlock | null> {
  const tweetRoot = block.matches('[data-testid="simpleTweet"]')
    ? block
    : block.querySelector('[data-testid="simpleTweet"]');
  if (!tweetRoot) {
    return null;
  }

  const tweet = tweetRoot.querySelector(X_ARTICLE_SELECTORS.tweetBlock) ?? tweetRoot;
  const profile = extractTweetProfile(tweet);
  const items = await extractSimpleTweetItems(tweetRoot, tweet, capturedVideos, 0);
  const excerpt = items.find((item): item is Extract<SimpleTweetContentItem, { type: 'text' }> => item.type === 'text')?.text ?? '';
  if (items.length === 0 && excerpt === '') {
    return null;
  }

  const metrics = extractTweetMetrics(tweet);
  return {
    id,
    type: 'simple-tweet',
    source: 'X Tweet',
    title: buildTweetAuthorLine(profile) || 'X Tweet',
    excerpt,
    href: getSimpleTweetHref(tweetRoot),
    items,
    aiGeneratedText: extractTweetAiGeneratedText(tweet),
    authorBadgeAvatarUrl: extractTweetAuthorBadgeAvatarUrl(tweet),
    replyContextText: extractTweetReplyContextText(tweet),
    replyToHandle: extractTweetReplyToHandle(tweet),
    translationSourceText: extractTweetTranslationSourceText(tweet),
    translationActionText: extractTweetTranslationActionText(tweet),
    ...profile,
    ...(hasTweetMetrics(metrics) ? { metrics } : {})
  };
}

async function extractSimpleTweetItems(
  tweetRoot: Element,
  tweet: Element,
  capturedVideos: CapturedXVideo[],
  depth: number
): Promise<SimpleTweetContentItem[]> {
  const quotedRoots = collectQuotedTweetRoots(tweetRoot, tweet);
  const consumedMediaRoots = new Set<Element>();
  const candidates = new Map<Element, SimpleTweetContentItem | null>();

  const text = await extractTweetBodyText(tweet);
  const textElement = tweet.querySelector('[data-testid="tweetText"]');
  if (textElement && text) {
    candidates.set(textElement, { type: 'text', text });
  }

  const articleCover = tweetRoot.querySelector('[data-testid="article-cover-image"]');
  if (articleCover && !belongsToQuotedTweet(articleCover, quotedRoots)) {
    candidates.set(articleCover, extractArticleCoverItem(articleCover));
    consumedMediaRoots.add(articleCover);
  }

  for (const videoPlayer of Array.from(tweet.querySelectorAll('[data-testid="videoPlayer"]'))) {
    if (belongsToQuotedTweet(videoPlayer, quotedRoots)) {
      continue;
    }
    const mediaRoot = videoPlayer.closest(X_ARTICLE_SELECTORS.tweetPhoto) ?? videoPlayer;
    if (hasConsumedMediaAncestor(mediaRoot, consumedMediaRoots)) {
      continue;
    }
    const video = extractVideoFromElement(mediaRoot, `${depth}-video-${candidates.size}`, capturedVideos);
    if (video) {
      candidates.set(mediaRoot, { type: 'video', video });
      consumedMediaRoots.add(mediaRoot);
    }
  }

  for (const preview of Array.from(tweet.querySelectorAll('[data-testid="previewInterstitial"], [aria-label="嵌入式视频"], [aria-label="Embedded video"]'))) {
    if (belongsToQuotedTweet(preview, quotedRoots)) {
      continue;
    }
    const mediaRoot = preview.closest(X_ARTICLE_SELECTORS.tweetPhoto) ?? preview;
    if (hasConsumedMediaAncestor(mediaRoot, consumedMediaRoots)) {
      continue;
    }
    candidates.set(mediaRoot, extractVideoPreviewItem(mediaRoot));
    consumedMediaRoots.add(mediaRoot);
  }

  const loosePhotos: Array<{ element: HTMLElement; layoutRoot: Element; photo: NonNullable<ReturnType<typeof tweetPhotoElementToPhoto>> }> = [];
  for (const photoElement of Array.from(tweet.querySelectorAll<HTMLElement>(X_ARTICLE_SELECTORS.tweetPhoto))) {
    if (belongsToQuotedTweet(photoElement, quotedRoots) || hasConsumedMediaAncestor(photoElement, consumedMediaRoots)) {
      continue;
    }
    const photo = tweetPhotoElementToPhoto(photoElement);
    if (photo) {
      loosePhotos.push({
        element: photoElement,
        layoutRoot: getSimpleTweetPhotoLayoutRoot(photoElement, tweet),
        photo
      });
    }
  }
  for (const group of groupAdjacentPhotos(loosePhotos)) {
    const anchor = group[0]?.layoutRoot ?? group[0]?.element;
    if (!anchor) {
      continue;
    }
    const layout = buildSimpleTweetPhotoLayout(anchor, group);
    const aspectRatio = getSimpleTweetPhotoGroupAspectRatio(anchor);
    candidates.set(
      anchor,
      group.length === 1
        ? { type: 'photo', photo: group[0].photo }
        : {
            type: 'photo-group',
            photos: group.map((item) => item.photo),
            layout,
            ...(aspectRatio ? { aspectRatio } : {})
          }
    );
  }

  if (depth === 0) {
    for (const quotedRoot of quotedRoots) {
      const quotedTweet = quotedRoot.matches(X_ARTICLE_SELECTORS.tweetBlock)
        ? quotedRoot
        : quotedRoot.querySelector(X_ARTICLE_SELECTORS.tweetBlock) ?? quotedRoot;
      const quotedCard = await extractQuotedTweetCard(quotedRoot, quotedTweet, capturedVideos, depth + 1);
      if (quotedCard) {
        candidates.set(quotedRoot, { type: 'quoted-tweet', tweet: quotedCard });
      }
    }
  }

  return Array.from(candidates.entries())
    .filter((entry): entry is [Element, SimpleTweetContentItem] => Boolean(entry[1]))
    .sort((left, right) => compareNodeOrder(left[0], right[0]))
    .map(([, item]) => item);
}

async function extractQuotedTweetCard(
  tweetRoot: Element,
  tweet: Element,
  capturedVideos: CapturedXVideo[],
  depth: number
): Promise<SimpleTweetCardData | null> {
  const profile = extractTweetProfile(tweet);
  const items = await extractSimpleTweetItems(tweetRoot, tweet, capturedVideos, depth);
  const excerpt = items.find((item): item is Extract<SimpleTweetContentItem, { type: 'text' }> => item.type === 'text')?.text ?? '';
  if (items.length === 0 && excerpt === '') {
    return null;
  }

  return {
    source: 'X Tweet',
    title: buildTweetAuthorLine(profile) || 'X Tweet',
    excerpt,
    href: getSimpleTweetHref(tweetRoot),
    items,
    aiGeneratedText: extractTweetAiGeneratedText(tweet),
    authorBadgeAvatarUrl: extractTweetAuthorBadgeAvatarUrl(tweet),
    replyContextText: extractTweetReplyContextText(tweet),
    replyToHandle: extractTweetReplyToHandle(tweet),
    translationSourceText: extractTweetTranslationSourceText(tweet),
    translationActionText: extractTweetTranslationActionText(tweet),
    ...profile
  };
}

function collectQuotedTweetRoots(tweetRoot: Element, tweet: Element): Element[] {
  const candidates = Array.from(tweetRoot.querySelectorAll('[data-testid="simpleTweet"], [data-testid="tweet"], [role="link"]')).filter((candidate) => {
    if (candidate === tweetRoot || candidate === tweet) {
      return false;
    }
    if (!candidate.querySelector('[data-testid="User-Name"]')) {
      return false;
    }
    return Boolean(
      candidate.querySelector('[data-testid="tweetText"], [data-testid="tweetPhoto"], [data-testid="previewInterstitial"], [data-testid="videoPlayer"], [data-testid="article-cover-image"]')
    );
  });

  return candidates.filter((candidate) => !candidates.some((other) => other !== candidate && other.contains(candidate)));
}

function belongsToQuotedTweet(element: Element, quotedRoots: Element[]): boolean {
  return quotedRoots.some((quotedRoot) => quotedRoot !== element && quotedRoot.contains(element));
}

function hasConsumedMediaAncestor(element: Element, consumedRoots: Set<Element>): boolean {
  for (let current: Element | null = element; current; current = current.parentElement) {
    if (consumedRoots.has(current)) {
      return true;
    }
  }
  return false;
}

function compareNodeOrder(left: Element, right: Element): number {
  if (left === right) {
    return 0;
  }
  const position = left.compareDocumentPosition(right);
  if (position & Node.DOCUMENT_POSITION_FOLLOWING) {
    return -1;
  }
  if (position & Node.DOCUMENT_POSITION_PRECEDING) {
    return 1;
  }
  return 0;
}

function groupAdjacentPhotos(
  items: Array<{ element: HTMLElement; layoutRoot: Element; photo: NonNullable<ReturnType<typeof tweetPhotoElementToPhoto>> }>
): Array<Array<{ element: HTMLElement; layoutRoot: Element; photo: NonNullable<ReturnType<typeof tweetPhotoElementToPhoto>> }>> {
  const groups: Array<Array<{ element: HTMLElement; layoutRoot: Element; photo: NonNullable<ReturnType<typeof tweetPhotoElementToPhoto>> }>> = [];
  for (const item of items) {
    const lastGroup = groups.at(-1);
    const last = lastGroup?.at(-1)?.element;
    if (!lastGroup || !last || !sharePhotoGroupRoot(last, item.element)) {
      groups.push([item]);
      continue;
    }
    lastGroup.push(item);
  }
  return groups;
}

function buildSimpleTweetPhotoLayout(
  layoutRoot: Element,
  items: Array<{ element: HTMLElement; layoutRoot: Element; photo: NonNullable<ReturnType<typeof tweetPhotoElementToPhoto>> }>
): SimpleTweetPhotoLayout {
  const photoMap = new Map(items.map((item) => [item.element, item.photo] as const));
  return buildSimpleTweetPhotoLayoutNode(layoutRoot, items, photoMap, 0) ?? {
    kind: 'row',
    children: items.map((item) => ({ kind: 'photo', photo: item.photo }))
  };
}

function buildSimpleTweetPhotoLayoutNode(
  root: Element,
  items: Array<{ element: HTMLElement; layoutRoot: Element; photo: NonNullable<ReturnType<typeof tweetPhotoElementToPhoto>> }>,
  photoMap: Map<HTMLElement, NonNullable<ReturnType<typeof tweetPhotoElementToPhoto>>>,
  depth: number
): SimpleTweetPhotoLayout | null {
  const localItems = items.filter((item) => root.contains(item.element));
  if (localItems.length === 0) {
    return null;
  }
  if (localItems.length === 1) {
    return { kind: 'photo', photo: localItems[0].photo, ...getSimpleTweetPhotoLayoutSize(root) };
  }

  const branches = Array.from(root.children).filter((child) =>
    localItems.some((item) => child.contains(item.element)) && isSimpleTweetMediaBranch(child)
  );

  if (branches.length === 1) {
    return buildSimpleTweetPhotoLayoutNode(branches[0], localItems, photoMap, depth);
  }

  if (branches.length >= 2) {
    const children = branches
      .map((branch) => buildSimpleTweetPhotoLayoutNode(branch, localItems, photoMap, depth + 1))
      .filter((child): child is SimpleTweetPhotoLayout => child !== null);
    if (children.length === 1) {
      return children[0];
    }
    if (children.length >= 2) {
      return { kind: getSimpleTweetMediaLayoutDirection(root, depth), children, ...getSimpleTweetPhotoLayoutSize(root) };
    }
  }

  const directPhotos = Array.from(root.querySelectorAll<HTMLElement>(X_ARTICLE_SELECTORS.tweetPhoto))
    .filter((photoElement) => localItems.some((item) => item.element === photoElement))
    .map((photoElement) => photoMap.get(photoElement))
    .filter((photo): photo is NonNullable<ReturnType<typeof tweetPhotoElementToPhoto>> => Boolean(photo));

  if (directPhotos.length === 1) {
    return { kind: 'photo', photo: directPhotos[0], ...getSimpleTweetPhotoLayoutSize(root) };
  }

  return {
    kind: getSimpleTweetMediaLayoutDirection(root, depth),
    children: directPhotos.map((photo) => ({ kind: 'photo', photo }))
  };
}

function getSimpleTweetPhotoLayoutSize(root: Element): { widthRatio?: number; heightRatio?: number } {
  const widthRatio = getRatioAttribute(root, 'data-linelens-media-layout-width');
  const heightRatio = getRatioAttribute(root, 'data-linelens-media-layout-height');
  return {
    ...(widthRatio ? { widthRatio } : {}),
    ...(heightRatio ? { heightRatio } : {})
  };
}

function getRatioAttribute(root: Element, name: string): number | undefined {
  const value = Number(root.getAttribute(name));
  if (!Number.isFinite(value) || value <= 0) {
    return undefined;
  }
  return value;
}

function getSimpleTweetMediaLayoutDirection(root: Element, depth: number): 'row' | 'column' {
  const preservedDirection = root.getAttribute('data-linelens-media-layout-direction');
  if (preservedDirection === 'row' || preservedDirection === 'column') {
    return preservedDirection;
  }

  if (root.classList.contains('r-18u37iz')) {
    return 'row';
  }
  if (root.classList.contains('r-eqz5dr')) {
    return 'column';
  }

  return depth === 0 ? 'row' : 'column';
}

function getSimpleTweetPhotoGroupAspectRatio(layoutRoot: Element): number | undefined {
  for (let current: Element | null = layoutRoot; current; current = current.parentElement) {
    const preserved = Number(current.getAttribute('data-linelens-media-aspect-ratio'));
    if (Number.isFinite(preserved) && preserved > 0) {
      return preserved;
    }

    const ratioNode = Array.from(current.children).find((child) => /padding-bottom:\s*[0-9.]+%/i.test(child.getAttribute('style') ?? ''));
    const ratio = ratioNode ? getPaddingBottomAspectRatio(ratioNode) : undefined;
    if (ratio) {
      return ratio;
    }

    if (current.matches(`${X_ARTICLE_SELECTORS.tweetBlock}, [data-testid="simpleTweet"]`)) {
      break;
    }
  }

  return undefined;
}

function sharePhotoGroupRoot(left: Element, right: Element): boolean {
  const leftTweet = left.closest(X_ARTICLE_SELECTORS.tweetBlock) ?? left.closest('[data-testid="simpleTweet"]');
  const rightTweet = right.closest(X_ARTICLE_SELECTORS.tweetBlock) ?? right.closest('[data-testid="simpleTweet"]');
  if (!leftTweet || !rightTweet || leftTweet !== rightTweet) {
    return false;
  }

  return getSimpleTweetPhotoLayoutRoot(left, leftTweet) === getSimpleTweetPhotoLayoutRoot(right, rightTweet);
}

function getSimpleTweetPhotoLayoutRoot(element: Element, tweetBoundary: Element): Element {
  const photoRoot = element.closest(X_ARTICLE_SELECTORS.tweetPhoto) ?? element;
  let layoutRoot: Element | null = null;

  for (let current = photoRoot.parentElement; current && current !== tweetBoundary; current = current.parentElement) {
    const mediaBranches = Array.from(current.children).filter((child) => isSimpleTweetMediaBranch(child));
    if (mediaBranches.length > 1 && mediaBranches.some((child) => child.contains(photoRoot))) {
      layoutRoot = current;
    }
  }

  return layoutRoot ?? photoRoot.parentElement ?? photoRoot;
}

function isSimpleTweetMediaBranch(element: Element): boolean {
  if (element.querySelector('[data-testid="tweetText"]')) {
    return false;
  }

  return Boolean(
    element.querySelector('[data-testid="tweetPhoto"], [data-testid="videoPlayer"], [data-testid="previewInterstitial"], [data-testid="article-cover-image"]')
  );
}

function extractArticleCoverItem(coverRoot: Element): SimpleTweetContentItem | null {
  const coverImage = coverRoot.querySelector<HTMLImageElement>('img');
  const coverUrl = coverImage?.currentSrc || coverImage?.src || '';
  if (!coverUrl) {
    return null;
  }

  const cardRoot = getArticleCoverCardRoot(coverRoot);
  const authorProfile = extractArticleCoverAuthorProfile(cardRoot);
  const metrics = extractMetricsFromGroup(cardRoot.querySelector('[role="group"][aria-label]'));

  return {
    type: 'article-cover',
    coverUrl,
    coverAlt: coverImage?.alt || undefined,
    title: normalizeText(getTextAfterCover(coverRoot, 0)),
    excerpt: normalizeText(getTextAfterCover(coverRoot, 1)),
    href: getSimpleTweetHref(coverRoot.closest('[data-testid="simpleTweet"], [data-testid="tweet"]') ?? coverRoot),
    ...authorProfile,
    ...(hasTweetMetrics(metrics) ? { metrics } : {})
  };
}

function getArticleCoverCardRoot(coverRoot: Element): Element {
  return coverRoot.closest('a[href], [role="link"]') ?? coverRoot.parentElement ?? coverRoot;
}

function extractArticleCoverAuthorProfile(cardRoot: Element): {
  authorName?: string;
  authorHandle?: string;
  authorAvatarUrl?: string;
  authorVerified?: boolean;
  publishedAt?: string;
  publishedAtText?: string;
} {
  const authorRoot = cardRoot.querySelector('[itemprop="author"]');
  const time = cardRoot.querySelector<HTMLTimeElement>('time');
  const avatar = authorRoot?.querySelector<HTMLImageElement>('img');
  const authorName = normalizeText(authorRoot?.querySelector<HTMLElement>('meta[itemprop="name"]')?.getAttribute('content') ?? '');
  const additionalName = normalizeText(authorRoot?.querySelector<HTMLElement>('meta[itemprop="additionalName"]')?.getAttribute('content') ?? '');
  const authorHandle = additionalName ? `@${additionalName.replace(/^@/, '')}` : '';

  return {
    ...(authorName ? { authorName } : {}),
    ...(authorHandle ? { authorHandle } : {}),
    ...(avatar?.currentSrc || avatar?.src ? { authorAvatarUrl: avatar?.currentSrc || avatar?.src } : {}),
    ...(authorRoot?.querySelector('[data-testid="icon-verified"], [aria-label="认证账号"], [aria-label="Verified account"]')
      ? { authorVerified: true }
      : {}),
    ...(time?.dateTime ? { publishedAt: time.dateTime } : {}),
    ...(time?.textContent ? { publishedAtText: normalizeText(time.textContent) } : {})
  };
}

function extractMetricsFromGroup(group: Element | null): TweetMetrics {
  if (!group) {
    return {};
  }

  return {
    replies: extractMetricValueFromGroup(group, 'reply'),
    reposts: extractMetricValueFromGroup(group, 'retweet'),
    likes: extractMetricValueFromGroup(group, 'like'),
    views: extractMetricValueFromGroup(group, 'views'),
    bookmarks: extractMetricValueFromGroup(group, 'bookmark')
  };
}

function extractMetricValueFromGroup(group: Element, testId: string): string | undefined {
  const action = group.querySelector(`[data-testid="${testId}"]`);
  const value = Array.from(action?.querySelectorAll('span') ?? [])
    .map((element) => normalizeText(element.textContent ?? ''))
    .find((text) => /^(?:\d+(?:\.\d+)?[KMB]?|[\d,.]+万?)$/i.test(text));
  return value || undefined;
}

function extractVideoPreviewItem(element: Element): SimpleTweetContentItem | null {
  const image = element.querySelector<HTMLImageElement>('[data-testid="tweetPhoto"] img, img');
  const src = image?.currentSrc || image?.src || getTweetPhotoBackgroundUrl(element);
  if (!src) {
    return null;
  }

  const durationText = Array.from(element.querySelectorAll('span'))
    .map((span) => normalizeText(span.textContent ?? ''))
    .find((text) => /^\d+:\d{2}$/.test(text));

  return {
    type: 'video-preview',
    src,
    alt: image?.alt || undefined,
    href: element.closest('a[href]')?.getAttribute('href') ? new URL(element.closest('a[href]')?.getAttribute('href') ?? '', X_CANONICAL_ORIGIN).toString() : undefined,
    durationText,
    aspectRatio: getImageGalleryAspectRatio(element),
    ...(isCondensedPreview(element) ? { layout: 'condensed' as const } : {}),
    ...(isRoundedSquarePreview(element) ? { shape: 'rounded-square' as const } : {})
  };
}

function isCondensedPreview(element: Element): boolean {
  return Boolean(element.closest('[data-testid="testCondensedMedia"]'));
}

function isRoundedSquarePreview(element: Element): boolean {
  return isCondensedPreview(element) || Math.abs((getImageGalleryAspectRatio(element) ?? 0) - 1) < 0.02;
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

function extractTweetAuthorBadgeAvatarUrl(tweet: Element): string | undefined {
  const authorRoot = tweet.querySelector('[data-testid="User-Name"]');
  const avatarRoot = tweet.querySelector('[data-testid="Tweet-User-Avatar"]');
  const image = Array.from(authorRoot?.querySelectorAll<HTMLImageElement>('img') ?? []).find((candidate) => !avatarRoot?.contains(candidate));
  return image?.currentSrc || image?.src || undefined;
}

function extractTweetReplyToHandle(tweet: Element): string | undefined {
  const replyRoot = getTweetReplyContextRoot(tweet);
  const replyLink = replyRoot?.querySelector<HTMLAnchorElement>('a[href^="/"]');
  return replyLink ? normalizeText(replyLink.textContent ?? '') : undefined;
}

function extractTweetReplyContextText(tweet: Element): string | undefined {
  const text = normalizeText(getTweetReplyContextRoot(tweet)?.textContent ?? '');
  return text || undefined;
}

function getTweetReplyContextRoot(tweet: Element): HTMLElement | undefined {
  return Array.from(tweet.querySelectorAll<HTMLElement>('div[dir="ltr"]')).find((element) => {
    const text = normalizeText(element.textContent ?? '');
    return text.startsWith('回复 @') || text.startsWith('Replying to @');
  });
}

function extractTweetTranslationSourceText(tweet: Element): string | undefined {
  const showOriginalButton = tweet.querySelector('[aria-label="显示原文"], [aria-label="Show original"]');
  const root = showOriginalButton?.closest('[dir="ltr"]');
  const text = normalizeText(root?.textContent ?? '').replace(/\s*(?:显示原文|Show original)\s*$/i, '').trim();
  return text || undefined;
}

function extractTweetTranslationActionText(tweet: Element): string | undefined {
  const showOriginalButton = tweet.querySelector('[aria-label="显示原文"], [aria-label="Show original"]');
  return normalizeText(showOriginalButton?.textContent ?? showOriginalButton?.getAttribute('aria-label') ?? '') || undefined;
}

function extractTweetAiGeneratedText(tweet: Element): string | undefined {
  const metricsGroup = tweet.querySelector('[role="group"][aria-label]');
  const candidates = Array.from(tweet.querySelectorAll<HTMLElement>('div[dir="ltr"], div[dir="auto"]')).filter((element) => {
    if (metricsGroup?.contains(element) || element.closest('[data-testid="User-Name"]')) {
      return false;
    }
    return element.querySelector('svg') !== null;
  });

  for (const candidate of candidates) {
    const text = normalizeText(candidate.textContent ?? '');
    if (text === '由 AI 生成' || text === 'Made by AI' || text === 'Generated by AI') {
      return text;
    }
  }

  return undefined;
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

function extractGifFromElement(element: Element, id: string): GifBlock | null {
  const tweetPhoto = element.matches(X_ARTICLE_SELECTORS.tweetPhoto)
    ? element
    : element.querySelector(X_ARTICLE_SELECTORS.tweetPhoto);
  const videoPlayer = tweetPhoto?.querySelector('[data-testid="videoPlayer"]');
  if (!tweetPhoto || !videoPlayer) {
    return null;
  }

  const video = videoPlayer.querySelector<HTMLVideoElement>('video');
  if (!video || video.querySelector('source[src^="blob:"]')) {
    return null;
  }

  const src = video.currentSrc || video.src || video.getAttribute('src') || '';
  if (!src) {
    return null;
  }

  const aspectRatio = getMediaAspectRatio(video, tweetPhoto);
  const backgroundColor = video.style.backgroundColor || getInlineStyleValue(video, 'background-color');
  const top = video.style.top || getInlineStyleValue(video, 'top');
  const left = video.style.left || getInlineStyleValue(video, 'left');
  const transform = video.style.transform || getInlineStyleValue(video, 'transform');

  return {
    id,
    type: 'gif',
    src,
    ...(video.poster ? { poster: video.poster } : {}),
    ...(aspectRatio ? { aspectRatio } : {}),
    ...(backgroundColor ? { backgroundColor } : {}),
    ...(top ? { top } : {}),
    ...(left ? { left } : {}),
    ...(transform ? { transform } : {}),
    paused: video.paused
  };
}

function extractVideoFromElement(element: Element, id: string, capturedVideos: CapturedXVideo[]): VideoBlock | null {
  const tweetPhoto = element.matches(X_ARTICLE_SELECTORS.tweetPhoto)
    ? element
    : element.querySelector(X_ARTICLE_SELECTORS.tweetPhoto);
  const videoPlayer = tweetPhoto?.querySelector('[data-testid="videoPlayer"]');
  if (!tweetPhoto || !videoPlayer) {
    return null;
  }

  const video = videoPlayer.querySelector<HTMLVideoElement>('video');
  const source = video?.querySelector<HTMLSourceElement>('source[src^="blob:"]');
  if (!video || !source) {
    return null;
  }

  const capturedVideo = matchCapturedVideo(video, capturedVideos);
  const hls = buildVideoHlsPayload(capturedVideo);
  const src = chooseCapturedVideoSource(capturedVideo, hls);
  if (!src) {
    return null;
  }

  const aspectRatio = getMediaAspectRatio(video, tweetPhoto);
  const backgroundColor = video.style.backgroundColor || getInlineStyleValue(video, 'background-color');
  const top = video.style.top || getInlineStyleValue(video, 'top');
  const left = video.style.left || getInlineStyleValue(video, 'left');
  const transform = video.style.transform || getInlineStyleValue(video, 'transform');
  const ariaLabel = video.getAttribute('aria-label') ?? undefined;

  return {
    id,
    type: 'video',
    src,
    ...(resolveVideoSourceType(src, source.type) ? { sourceType: resolveVideoSourceType(src, source.type) } : {}),
    transport: 'hls',
    ...(hls ? { hls } : {}),
    ...((capturedVideo?.poster || video.poster) ? { poster: capturedVideo?.poster || video.poster } : {}),
    ...(aspectRatio ? { aspectRatio } : {}),
    ...(backgroundColor ? { backgroundColor } : {}),
    ...(top ? { top } : {}),
    ...(left ? { left } : {}),
    ...(transform ? { transform } : {}),
    ...(video.preload ? { preload: video.preload } : {}),
    playsInline: video.playsInline,
    tabIndex: video.tabIndex,
    ...(ariaLabel ? { ariaLabel } : {}),
    paused: video.paused
  };
}

function extractImageFromElement(element: Element, id: string): ImageBlock | null {
  const image = element.querySelector<HTMLImageElement>(X_ARTICLE_SELECTORS.tweetPhotoImage);
  if (!image) {
    return null;
  }

  return imageElementToBlock(image, id);
}

function extractImageGalleryFromElement(element: Element, id: string): ImageGalleryBlock | null {
  const photos = Array.from(element.querySelectorAll<HTMLElement>(X_ARTICLE_SELECTORS.tweetPhoto))
    .map((photo) => tweetPhotoElementToGalleryItem(photo))
    .filter((item): item is ImageGalleryItem => Boolean(item));

  if (photos.length <= 1) {
    return null;
  }

  const aspectRatio = getImageGalleryAspectRatio(element);
  return {
    id,
    type: 'image-gallery',
    items: photos,
    ...(aspectRatio ? { aspectRatio } : {})
  };
}

function tweetPhotoElementToGalleryItem(element: HTMLElement): ImageGalleryItem | null {
  const image = element.querySelector<HTMLImageElement>('img');
  const src = image?.currentSrc || image?.src || getTweetPhotoBackgroundUrl(element);
  if (!src) {
    return null;
  }

  const href = element.closest('a[href]')?.getAttribute('href') ?? undefined;
  const aspectRatio = image ? getImageAspectRatio(image) : undefined;
  return {
    src,
    alt: image?.alt || undefined,
    ...(href ? { href: new URL(href, X_CANONICAL_ORIGIN).toString() } : {}),
    ...(aspectRatio ? { aspectRatio } : {})
  };
}

function getImageGalleryAspectRatio(element: Element): number | undefined {
  for (let current: Element | null = element; current; current = current.parentElement) {
    const paddingRatio = getPaddingBottomAspectRatio(current);
    if (paddingRatio) {
      return paddingRatio;
    }
  }

  return undefined;
}

function getMediaAspectRatio(media: HTMLMediaElement, container: Element): number | undefined {
  const video = media as HTMLVideoElement;
  const intrinsicRatio = toValidAspectRatio(video.videoWidth, video.videoHeight);
  if (intrinsicRatio) {
    return intrinsicRatio;
  }

  for (let element: Element | null = container; element; element = element.parentElement) {
    const paddingRatio = getPaddingBottomAspectRatio(element);
    if (paddingRatio) {
      return paddingRatio;
    }
  }

  return undefined;
}

async function publishVideoPosters() {
  const posters = collectVideoPosters();
  if (Object.keys(posters).length === 0) {
    return;
  }

  await chrome.runtime.sendMessage({
    type: 'UPSERT_X_VIDEO_POSTERS',
    posters
  }).catch(() => {
    // ignore transient extension reloads
  });
}

function collectVideoPosters(): Record<string, string> {
  const posters: Record<string, string> = {};
  for (const video of Array.from(document.querySelectorAll<HTMLVideoElement>('video[poster]'))) {
    const poster = video.getAttribute('poster') ?? '';
    const videoId = getAmplifyVideoId(poster);
    if (videoId && poster) {
      posters[videoId] = poster;
    }
  }
  return posters;
}

async function getCapturedVideos(): Promise<CapturedXVideo[]> {
  const response = (await chrome.runtime.sendMessage({
    type: 'GET_CAPTURED_X_VIDEOS'
  }).catch(() => null)) as GetCapturedXVideosResponse | null;
  return response?.videos ?? [];
}

function matchCapturedVideo(video: HTMLVideoElement, capturedVideos: CapturedXVideo[]): CapturedXVideo | undefined {
  const candidates = [
    video.poster,
    video.getAttribute('poster') ?? '',
    video.currentSrc,
    video.src
  ];

  for (const candidate of candidates) {
    const videoId = getAmplifyVideoId(candidate);
    if (!videoId) {
      continue;
    }
    const matched = capturedVideos.find((item) => item.videoId === videoId);
    if (matched) {
      return matched;
    }
  }

  return capturedVideos.find((item) => item.poster && item.poster === video.poster);
}

function chooseCapturedVideoSource(
  video: CapturedXVideo | undefined,
  hls: VideoBlock['hls'] | undefined
): string {
  if (hls?.masterPlaylistUrl) {
    return hls.masterPlaylistUrl;
  }

  if (!video) {
    return '';
  }

  const preferredVideo = hls?.videoPlaylists?.[0]?.url;
  if (preferredVideo) {
    return preferredVideo;
  }

  const resolutionEntries = Object.entries(video.videoPlaylists ?? {});
  if (resolutionEntries.length === 0) {
    return '';
  }

  return resolutionEntries
    .sort(([left], [right]) => compareResolutionLabel(right) - compareResolutionLabel(left))[0]?.[1] ?? '';
}

function resolveVideoSourceType(src: string, fallbackType: string): string {
  if (src.includes('.m3u8')) {
    return 'application/x-mpegURL';
  }
  return fallbackType;
}

function getAmplifyVideoId(value: string | null | undefined): string | undefined {
  const match = value?.match(AMPLIFY_VIDEO_ID_PATTERN);
  return match?.[1];
}

function compareResolutionLabel(value: string): number {
  const [width, height] = value.split('x').map((part) => Number(part));
  return (Number.isFinite(width) ? width : 0) * (Number.isFinite(height) ? height : 0);
}

function buildVideoHlsPayload(video: CapturedXVideo | undefined): VideoBlock['hls'] | undefined {
  if (!video) {
    return undefined;
  }

  const masterPlaylistUrl = video.masterPlaylistUrl;
  const audioPlaylistUrl = pickAudioPlaylist(video);
  const videoPlaylists = Object.entries(video.videoPlaylists ?? {})
    .sort(([left], [right]) => compareResolutionLabel(right) - compareResolutionLabel(left))
    .map(([resolution, url]) => {
      const [width, height] = resolution.split('x').map((part) => Number(part));
      return {
        resolution,
        ...(Number.isFinite(width) ? { width } : {}),
        ...(Number.isFinite(height) ? { height } : {}),
        url
      };
    });

  if (!masterPlaylistUrl && !audioPlaylistUrl && videoPlaylists.length === 0) {
    return undefined;
  }

  return {
    masterPlaylistUrl: masterPlaylistUrl,
    audioPlaylistUrl: audioPlaylistUrl,
    videoPlaylists: videoPlaylists
  };
}

function pickAudioPlaylist(video: CapturedXVideo): string | undefined {
  const audioEntries = Object.entries(video.audioPlaylists ?? {});
  if (audioEntries.length === 0) {
    return undefined;
  }

  return audioEntries
    .sort(([left], [right]) => Number(right) - Number(left))[0]?.[1];
}

function getInlineStyleValue(element: HTMLElement, property: string): string {
  const style = element.getAttribute('style') ?? '';
  const match = new RegExp(`${property}:\\s*([^;]+)`, 'i').exec(style);
  return match?.[1]?.replace(/\s+/g, ' ').trim() ?? '';
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
    ...(href ? { href: new URL(href, X_CANONICAL_ORIGIN).toString() } : {}),
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

function extractTextWithAnnotations(
  element: Element,
  options: { preserveLineBreaks?: boolean } = {}
): { text: string; annotations: TextAnnotation[] } {
  const normalize = options.preserveLineBreaks ? normalizePreWrapText : normalizeText;
  const textElements = Array.from(element.querySelectorAll<HTMLElement>('[data-text="true"]'));
  const fullText = normalize(getElementDisplayText(element, options.preserveLineBreaks));
  if (textElements.length === 0) {
    return { text: fullText, annotations: [] };
  }

  const annotations: TextAnnotation[] = [];
  let text = '';
  let searchCursor = 0;
  for (const textElement of textElements) {
    const segment = normalize(textElement.textContent ?? '');
    if (!segment) {
      continue;
    }

    const startOffset = options.preserveLineBreaks ? fullText.indexOf(segment, searchCursor) : text.length;
    if (startOffset === -1) {
      continue;
    }

    if (!options.preserveLineBreaks) {
      text += segment;
    }
    const endOffset = text.length;
    const resolvedEndOffset = options.preserveLineBreaks ? startOffset + segment.length : endOffset;
    searchCursor = resolvedEndOffset;
    const annotation: TextAnnotation = {
      startOffset,
      endOffset: resolvedEndOffset,
      ...extractTextAnnotationStyle(textElement)
    };

    if (resolvedEndOffset > startOffset && isBoldTextElement(textElement)) {
      annotation.bold = true;
    }
    const anchor = textElement.closest<HTMLAnchorElement>('a[href][role="link"], a[href]');
    if (resolvedEndOffset > startOffset && anchor) {
      const href = anchor.getAttribute('href');
      if (href) {
        const linkStyle = extractTextAnnotationStyle(anchor);
        annotation.href = href;
        annotation.target = anchor.getAttribute('target') ?? undefined;
        Object.assign(annotation, linkStyle);
      }
    }
    if (isEmojiTextElement(textElement)) {
      // X renders emoji through a background image and hides the real glyph with
      // `clip-path: circle(...)`; keep the underlying text so sentence units
      // include the emoji instead of dropping it from the reading flow.
      const emojiImageUrl = getEmojiImageUrl(textElement);
      if (emojiImageUrl) {
        annotation.emojiImageUrl = emojiImageUrl;
      }
    }
    if (resolvedEndOffset > startOffset && hasTextAnnotationSignal(annotation)) {
      annotations.push(annotation);
    }
  }

  return { text: options.preserveLineBreaks ? fullText : normalize(text), annotations };
}

function hasTextAnnotationSignal(annotation: TextAnnotation): boolean {
  return Boolean(
    annotation.bold ||
      annotation.href ||
      annotation.emojiImageUrl ||
      annotation.color ||
      annotation.fontSize ||
      annotation.lineHeight ||
      annotation.textAlign ||
      annotation.fontStyle
  );
}

function getElementDisplayText(element: Element, preserveLineBreaks = false): string {
  if (preserveLineBreaks && element instanceof HTMLElement && typeof element.innerText === 'string') {
    return element.innerText;
  }
  return element.textContent ?? '';
}

function isBoldTextElement(textElement: HTMLElement): boolean {
  const styledElement = textElement.closest<HTMLElement>('[style*="font-weight"]');
  const fontWeight = styledElement?.style.fontWeight;
  return fontWeight === 'bold' || fontWeight === '700';
}

function isEmojiTextElement(textElement: HTMLElement): boolean {
  return Boolean(getEmojiImageUrl(textElement));
}

function getEmojiImageUrl(textElement: HTMLElement): string | undefined {
  const emojiLayer = textElement.closest<HTMLElement>('[style*="background-image"]');
  const backgroundImage = emojiLayer?.style.backgroundImage ?? '';
  const match = backgroundImage.match(/url\((['"]?)(.*?)\1\)/i);
  return match?.[2];
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
    (block) =>
      block.type === 'image' ||
      block.type === 'gif' ||
      block.type === 'video' ||
      block.type === 'embed' ||
      block.type === 'simple-tweet' ||
      block.type === 'link' ||
      block.type === 'code'
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
  if (block.type === 'code') {
    return normalizeText(`${block.language ?? ''} ${block.text}`).length;
  }

  return 0;
}

function isTextBlock(block: ArticleBlock): boolean {
  return block.type === 'paragraph' || block.type === 'heading' || block.type === 'quote' || block.type === 'list' || block.type === 'link' || block.type === 'code';
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

function normalizePreWrapText(value: string): string {
  return value
    .replace(/\r\n?/g, '\n')
    .replace(/\u00a0/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function normalizeCodeText(value: string): string {
  return value.replace(/\r\n?/g, '\n').replace(/^\n+|\n+$/g, '');
}

function hasMeaningfulText(value: string): boolean {
  return normalizeText(value).length > 0;
}

function blockId(articleId: string, index: number): string {
  return `${articleId}-b${index}`;
}
