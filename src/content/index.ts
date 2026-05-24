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
      items: string[];
      itemAnnotations?: TextAnnotation[][];
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

type TextAnnotation = {
  startOffset: number;
  endOffset: number;
  bold?: boolean;
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
  nonTextBlock: 'section[data-block="true"][contenteditable="false"]',
  tweetPhotoImage: '[data-testid="tweetPhoto"] img'
} as const;

const X_ARTICLE_HOSTS = new Set(['x.com', 'twitter.com']);
const X_ARTICLE_PATH_PATTERN = /^\/([^/]+)\/article\/(\d+)\/?$/;
const MIN_READY_BLOCKS = 3;
const MIN_READY_TEXT_LENGTH = 200;
const MAX_READY_CHECKS = 40;
const READY_CHECK_INTERVAL_MS = 250;
const LOG_PREFIX = '[LineLens Content]';

void monitorArticleState();

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'EXTRACT_CURRENT_ARTICLE') {
    void extractCurrentArticle().then(sendResponse);
    return true;
  }
});

async function monitorArticleState() {
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
    observer.disconnect();
    window.clearInterval(timer);
  }
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
    canonicalUrl: `https://x.com/${getXArticleAuthorHandleFromUrl(url) ?? 'i'}/article/${articleId}`,
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

  function flushPendingList() {
    if (pendingListItems.length === 0) {
      return;
    }

    const listBlock: ArticleBlock = {
      id: blockId(articleId, blocks.length + 1),
      type: 'list',
      items: pendingListItems
    };
    if (pendingListItemAnnotations.some((annotations) => annotations.length > 0)) {
      listBlock.itemAnnotations = pendingListItemAnnotations;
    }

    blocks.push(listBlock);
    pendingListItems = [];
    pendingListItemAnnotations = [];
  }

  longform.querySelectorAll(X_ARTICLE_SELECTORS.block).forEach((block) => {
    if (isDraftListItem(block)) {
      const extracted = extractTextWithAnnotations(block);
      if (extracted.text) {
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

function isDraftListItem(block: Element): boolean {
  return (
    block.classList.contains('public-DraftStyleDefault-unorderedListItem') ||
    block.classList.contains('public-DraftStyleDefault-orderedListItem') ||
    block.classList.contains('longform-unordered-list-item') ||
    block.classList.contains('longform-ordered-list-item')
  );
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

  if (block.matches(X_ARTICLE_SELECTORS.nonTextBlock)) {
    return extractNonTextBlock(block, articleId, index);
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
  const image = extractImageFromElement(block, blockId(articleId, index));
  if (image) {
    return image;
  }

  const text = normalizeText(block.textContent ?? '');
  return {
    id: blockId(articleId, index),
    type: 'embed',
    label: 'Embedded content',
    text: text || undefined,
    href: block.querySelector('a[href]')?.getAttribute('href') ?? undefined
  };
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
  return {
    id,
    type: 'image',
    src,
    alt: image.alt || undefined,
    href
  };
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
  for (const textElement of textElements) {
    const segment = textElement.textContent ?? '';
    const startOffset = text.length;
    text += segment;
    const endOffset = text.length;

    if (endOffset > startOffset && isBoldTextElement(textElement)) {
      annotations.push({ startOffset, endOffset, bold: true });
    }
  }

  return { text: normalizeText(text), annotations };
}

function isBoldTextElement(textElement: HTMLElement): boolean {
  const styledElement = textElement.closest<HTMLElement>('[style*="font-weight"]');
  const fontWeight = styledElement?.style.fontWeight;
  return fontWeight === 'bold' || fontWeight === '700';
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
  const hasMediaBlock = article.blocks.some((block) => block.type === 'image' || block.type === 'embed');

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

  return 0;
}

function isTextBlock(block: ArticleBlock): boolean {
  return block.type === 'paragraph' || block.type === 'heading' || block.type === 'quote' || block.type === 'list';
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
