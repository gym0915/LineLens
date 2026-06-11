import type {
  ArticleBlock,
  ImageBlock,
  ImageGalleryBlock,
  ListBlock,
  ParagraphBlock,
  QuoteBlock,
  TextAnnotation,
  TextStyle,
  CodeBlock,
  CodeBlockStyle,
  CodeToken,
  TableBlock,
  SimpleTweetCardData,
  SimpleTweetContentItem,
  SimpleTweetPhotoLayout,
  SimpleTweetBlock,
  TweetMetrics,
  VideoBlock
} from '../../shared/article.js';
import type { CleanTreeContext } from './clone-content-tree.js';

export type CleanTreeBlockConversionOptions = {
  enabledBlockTypes?: Array<ArticleBlock['type']>;
};

const DEFAULT_ENABLED_BLOCK_TYPES: Array<ArticleBlock['type']> = ['paragraph', 'heading', 'quote', 'list', 'image', 'code', 'table', 'simple-tweet', 'image-gallery'];
const X_CANONICAL_ORIGIN = 'https://x.com';

export function convertCleanTreeToBlocks(
  root: Element,
  context: CleanTreeContext,
  options: CleanTreeBlockConversionOptions = {}
): ArticleBlock[] {
  const enabledBlockTypes = new Set(options.enabledBlockTypes ?? DEFAULT_ENABLED_BLOCK_TYPES);
  const blocks: ArticleBlock[] = [];
  const consumedElements = new Set<Element>();
  let index = 0;

  for (const element of Array.from(root.querySelectorAll('[data-block="true"], [data-linelens-list-kind], [data-testid="markdown-code-block"], [data-testid="simpleTweet"], table, [role="table"], [role="grid"], h1, h2, h3, h4, h5, h6, blockquote, img'))) {
    if (consumedElements.has(element) || hasConsumedAncestor(element, consumedElements)) {
      continue;
    }

    const block = convertElementToBlock(element, context, index, enabledBlockTypes, consumedElements);
    if (block === null) {
      continue;
    }

    blocks.push(block);
    index += 1;
  }

  return blocks;
}

function convertElementToBlock(
  element: Element,
  context: CleanTreeContext,
  index: number,
  enabledBlockTypes: Set<ArticleBlock['type']>,
  consumedElements: Set<Element>
): ArticleBlock | null {
  if (isSimpleTweetElement(element) && enabledBlockTypes.has('simple-tweet')) {
    return convertSimpleTweetElement(element, context, index, consumedElements);
  }

  if (isImageGalleryElement(element) && enabledBlockTypes.has('image-gallery')) {
    return convertImageGalleryElement(element, context, index, consumedElements);
  }

  if (isImageElement(element) && enabledBlockTypes.has('image')) {
    return convertImageElement(element, context, index);
  }

  if (isHeadingElement(element) && enabledBlockTypes.has('heading')) {
    return convertTextElement(element, context, index, 'heading');
  }

  if (isCodeElement(element) && enabledBlockTypes.has('code')) {
    return convertCodeElement(element, context, index, consumedElements);
  }

  if (isTableElement(element) && enabledBlockTypes.has('table')) {
    return convertTableElement(element, context, index, consumedElements);
  }

  if (isListElement(element) && enabledBlockTypes.has('list')) {
    return convertListElementGroup(element, context, index, consumedElements);
  }

  if (isQuoteElement(element) && enabledBlockTypes.has('quote')) {
    return convertTextElement(element, context, index, 'quote');
  }

  if (shouldSkipParagraphFallback(element)) {
    return null;
  }

  if (enabledBlockTypes.has('paragraph')) {
    return convertTextElement(element, context, index, 'paragraph');
  }

  return null;
}

function convertTextElement(
  element: Element,
  context: CleanTreeContext,
  index: number,
  type: 'heading' | 'paragraph' | 'quote'
): ParagraphBlock | QuoteBlock | Extract<ArticleBlock, { type: 'heading' }> | null {
  const text = getPreferredTextContent(element, type);
  if (text === '') {
    return null;
  }

  const base = {
    id: cleanTreeBlockId(context, index),
    text,
    annotations: extractTextAnnotations(element, text),
    textStyle: extractElementTextStyle(element)
  };

  if (type === 'heading') {
    return {
      ...base,
      type,
      level: getHeadingLevel(element)
    };
  }

  return {
    ...base,
    type
  };
}

function convertListElementGroup(
  element: Element,
  context: CleanTreeContext,
  index: number,
  consumedElements: Set<Element>
): ListBlock | null {
  const kind = element.getAttribute('data-linelens-list-kind') === 'ordered' ? 'ordered' : 'unordered';
  const elements = collectAdjacentListElements(element, kind);
  const normalizedItems = elements.map((item) => normalizeListItem(item, kind)).filter((item) => item.text !== '');

  if (normalizedItems.length === 0) {
    return null;
  }

  elements.forEach((item) => consumedElements.add(item));

  return {
    id: cleanTreeBlockId(context, index),
    type: 'list',
    kind,
    items: normalizedItems.map((item) => item.text),
    itemAnnotations: normalizedItems.map((item) => item.annotations),
    itemTextStyles: normalizedItems.map((item) => item.textStyle)
  };
}

function convertImageElement(element: Element, context: CleanTreeContext, index: number): ImageBlock | null {
  const image = element.tagName.toUpperCase() === 'IMG' ? element : element.querySelector('img');
  const src = image?.getAttribute('src') ?? element.getAttribute('src');
  if (!src) {
    return null;
  }

  return {
    id: cleanTreeBlockId(context, index),
    type: 'image',
    src,
    alt: image?.getAttribute('alt') ?? element.getAttribute('alt') ?? undefined,
    href: element.closest('a')?.getAttribute('href') ?? undefined
  };
}

function convertSimpleTweetElement(
  element: Element,
  context: CleanTreeContext,
  index: number,
  consumedElements: Set<Element>
): SimpleTweetBlock | null {
  const tweetRoot = element.matches('[data-testid="simpleTweet"]')
    ? element
    : element.querySelector('[data-testid="simpleTweet"]');
  if (!tweetRoot) {
    return null;
  }

  const tweet = tweetRoot.querySelector('[data-testid="tweet"]') ?? tweetRoot;
  const profile = extractTweetProfile(tweet);
  const items = extractSimpleTweetItemsSync(tweetRoot, tweet, 0);
  const excerpt = items.find((item): item is Extract<SimpleTweetContentItem, { type: 'text' }> => item.type === 'text')?.text ?? '';
  if (items.length === 0 && excerpt === '') {
    return null;
  }

  consumedElements.add(element);
  consumedElements.add(tweetRoot);
  for (const ancestor of Array.from(rootBlockAncestors(tweetRoot))) {
    consumedElements.add(ancestor);
  }

  const metrics = extractTweetMetrics(tweet);
  return {
    id: cleanTreeBlockId(context, index),
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

function convertImageGalleryElement(
  element: Element,
  context: CleanTreeContext,
  index: number,
  consumedElements: Set<Element>
): ImageGalleryBlock | null {
  const photos = Array.from(element.querySelectorAll<HTMLElement>('[data-testid="tweetPhoto"]'))
    .map((photo) => tweetPhotoElementToGalleryItem(photo))
    .filter((item): item is ImageGalleryBlock['items'][number] => Boolean(item));

  if (photos.length <= 1) {
    return null;
  }

  for (const photo of Array.from(element.querySelectorAll('[data-testid="tweetPhoto"]'))) {
    consumedElements.add(photo);
  }

  return {
    id: cleanTreeBlockId(context, index),
    type: 'image-gallery',
    items: photos,
    ...(getImageGalleryAspectRatio(element) ? { aspectRatio: getImageGalleryAspectRatio(element) } : {})
  };
}

function extractSimpleTweetItemsSync(tweetRoot: Element, tweet: Element, depth: number): SimpleTweetContentItem[] {
  const quotedRoots = collectQuotedTweetRoots(tweetRoot, tweet);
  const consumedMediaRoots = new Set<Element>();
  const candidates = new Map<Element, SimpleTweetContentItem | null>();

  const text = extractTweetBodyText(tweet);
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
    const mediaRoot = videoPlayer.closest('[data-testid="tweetPhoto"]') ?? videoPlayer;
    if (hasConsumedMediaAncestor(mediaRoot, consumedMediaRoots)) {
      continue;
    }
    const video = extractInlineSimpleTweetVideo(mediaRoot);
    if (video) {
      candidates.set(mediaRoot, { type: 'video', video });
      consumedMediaRoots.add(mediaRoot);
    }
  }

  for (const preview of Array.from(tweet.querySelectorAll('[data-testid="previewInterstitial"], [aria-label="嵌入式视频"], [aria-label="Embedded video"]'))) {
    if (belongsToQuotedTweet(preview, quotedRoots)) {
      continue;
    }
    const mediaRoot = preview.closest('[data-testid="tweetPhoto"]') ?? preview;
    if (hasConsumedMediaAncestor(mediaRoot, consumedMediaRoots)) {
      continue;
    }
    candidates.set(mediaRoot, extractVideoPreviewItem(mediaRoot));
    consumedMediaRoots.add(mediaRoot);
  }

  const loosePhotos: Array<{ element: HTMLElement; layoutRoot: Element; photo: NonNullable<ReturnType<typeof tweetPhotoElementToPhoto>> }> = [];
  for (const photoElement of Array.from(tweet.querySelectorAll<HTMLElement>('[data-testid="tweetPhoto"]'))) {
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
        ? extractPhotoItem(group[0].element, group[0].photo)
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
      const quotedTweet = quotedRoot.matches('[data-testid="tweet"]')
        ? quotedRoot
        : quotedRoot.querySelector('[data-testid="tweet"]') ?? quotedRoot;
      const quotedCard = extractQuotedTweetCard(quotedRoot, quotedTweet, depth + 1);
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

function extractQuotedTweetCard(tweetRoot: Element, tweet: Element, depth: number): SimpleTweetCardData | null {
  const profile = extractTweetProfile(tweet);
  const items = extractSimpleTweetItemsSync(tweetRoot, tweet, depth);
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

  const directPhotos = Array.from(root.querySelectorAll<HTMLElement>('[data-testid="tweetPhoto"]'))
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
  const computedSize = getSimpleTweetComputedLayoutSize(root);
  const widthRatio = computedSize.widthRatio ?? getRatioAttribute(root, 'data-linelens-media-layout-width');
  const heightRatio = computedSize.heightRatio ?? getRatioAttribute(root, 'data-linelens-media-layout-height');
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
  const computedDirection = getSimpleTweetComputedLayoutDirection(root);
  if (computedDirection) {
    return computedDirection;
  }

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

function readSimpleTweetComputedLayoutStyle(root: Element): { display: string; flexDirection: string } | null {
  if (typeof window === 'undefined' || typeof window.getComputedStyle !== 'function') {
    return null;
  }
  const style = window.getComputedStyle(root);
  return {
    display: style.display,
    flexDirection: style.flexDirection
  };
}

function getSimpleTweetComputedLayoutDirection(root: Element): 'row' | 'column' | undefined {
  const style = readSimpleTweetComputedLayoutStyle(root);
  if (!style || style.display !== 'flex' && style.display !== 'inline-flex') {
    return undefined;
  }
  if (style.flexDirection === 'row' || style.flexDirection === 'row-reverse') {
    return 'row';
  }
  if (style.flexDirection === 'column' || style.flexDirection === 'column-reverse') {
    return 'column';
  }
  return undefined;
}

function getSimpleTweetComputedLayoutSize(root: Element): { widthRatio?: number; heightRatio?: number } {
  if (!(root instanceof HTMLElement) || !root.parentElement) {
    return {};
  }
  const rect = root.getBoundingClientRect();
  const parentRect = root.parentElement.getBoundingClientRect();
  if (!rect.width || !rect.height || !parentRect.width || !parentRect.height) {
    return {};
  }
  return {
    widthRatio: Math.round((rect.width / parentRect.width) * 10000) / 10000,
    heightRatio: Math.round((rect.height / parentRect.height) * 10000) / 10000
  };
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

    if (current.getAttribute('data-testid') === 'tweet' || current.getAttribute('data-testid') === 'simpleTweet') {
      break;
    }
  }

  return undefined;
}

function sharePhotoGroupRoot(left: Element, right: Element): boolean {
  const leftTweet = left.closest('[data-testid="tweet"]') ?? left.closest('[data-testid="simpleTweet"]');
  const rightTweet = right.closest('[data-testid="tweet"]') ?? right.closest('[data-testid="simpleTweet"]');
  if (!leftTweet || !rightTweet || leftTweet !== rightTweet) {
    return false;
  }

  return getSimpleTweetPhotoLayoutRoot(left, leftTweet) === getSimpleTweetPhotoLayoutRoot(right, rightTweet);
}

function getSimpleTweetPhotoLayoutRoot(element: Element, tweetBoundary: Element): Element {
  const photoRoot = element.closest('[data-testid="tweetPhoto"]') ?? element;
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

function getTextAfterCover(coverRoot: Element, offset: number): string {
  const textBlocks = Array.from(coverRoot.parentElement?.querySelectorAll<HTMLElement>('div[dir="auto"]') ?? []);
  const coverIndex = textBlocks.findIndex((element) => coverRoot.contains(element));
  const candidates = coverIndex >= 0 ? textBlocks.slice(coverIndex + 1) : textBlocks;
  return candidates[offset]?.textContent ?? '';
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
    href: element.closest('a[href]')?.getAttribute('href') ? toAbsoluteXUrl(element.closest('a[href]')?.getAttribute('href') ?? '') : undefined,
    durationText,
    aspectRatio: getImageGalleryAspectRatio(element),
    ...(isCondensedPreview(element) ? { layout: 'condensed' as const } : {}),
    ...(isRoundedSquarePreview(element) ? { shape: 'rounded-square' as const } : {})
  };
}

function extractPhotoItem(
  element: Element,
  photo: NonNullable<ReturnType<typeof tweetPhotoElementToPhoto>>
): SimpleTweetContentItem {
  return {
    type: 'photo',
    photo,
    ...(isCondensedMedia(element) ? { layout: 'condensed' as const } : {}),
    ...(isRoundedSquareMedia(element) ? { shape: 'rounded-square' as const } : {})
  };
}

function isCondensedPreview(element: Element): boolean {
  return isCondensedMedia(element);
}

function isRoundedSquarePreview(element: Element): boolean {
  return isRoundedSquareMedia(element) || Math.abs((getImageGalleryAspectRatio(element) ?? 0) - 1) < 0.02;
}

function isCondensedMedia(element: Element): boolean {
  return Boolean(element.closest('[data-testid="testCondensedMedia"]'));
}

function isRoundedSquareMedia(element: Element): boolean {
  return isCondensedMedia(element);
}

function extractInlineSimpleTweetVideo(element: Element): VideoBlock | null {
  const video = element.querySelector<HTMLVideoElement>('[data-testid="videoPlayer"] video');
  if (!video) {
    return null;
  }

  const src = video.currentSrc || video.src || video.getAttribute('src') || '';
  if (!src) {
    return null;
  }

  return {
    id: 'clean-tree-simple-tweet-video',
    type: 'video',
    src,
    ...(video.poster ? { poster: video.poster } : {}),
    ...(getImageGalleryAspectRatio(element) ? { aspectRatio: getImageGalleryAspectRatio(element) } : {}),
    ...(video.preload ? { preload: video.preload } : {}),
    playsInline: video.playsInline,
    tabIndex: video.tabIndex,
    ...(video.getAttribute('aria-label') ? { ariaLabel: video.getAttribute('aria-label') ?? undefined } : {}),
    paused: video.paused
  };
}

function convertCodeElement(
  element: Element,
  context: CleanTreeContext,
  index: number,
  consumedElements: Set<Element>
): CodeBlock | null {
  const codeRoot = element.matches('[data-testid="markdown-code-block"]')
    ? element
    : element.querySelector('[data-testid="markdown-code-block"]');
  const code = codeRoot?.querySelector('pre code');
  const pre = codeRoot?.querySelector('pre');
  const text = normalizeCodeText(code?.textContent ?? pre?.textContent ?? '');
  if (text === '') {
    return null;
  }

  consumedElements.add(element);
  if (codeRoot) {
    consumedElements.add(codeRoot);
    for (const ancestor of Array.from(rootBlockAncestors(codeRoot))) {
      consumedElements.add(ancestor);
    }
  }

  const languageClass = Array.from(code?.classList ?? [])
    .find((className) => className.startsWith('language-'))
    ?.replace(/^language-/, '');
  const headerLanguage = normalizeText(codeRoot?.querySelector<HTMLElement>(':scope > div:first-child span')?.textContent ?? '');
  const language = normalizeCodeLanguage(languageClass || headerLanguage);

  return {
    id: cleanTreeBlockId(context, index),
    type: 'code',
    text,
    ...(language ? { language } : {}),
    codeStyle: extractCodeBlockStyle(codeRoot ?? null, pre ?? null, code ?? null),
    tokens: extractCodeTokens(code ?? null)
  };
}

function convertTableElement(
  element: Element,
  context: CleanTreeContext,
  index: number,
  consumedElements: Set<Element>
): TableBlock | null {
  const tableRoot = findTableRoot(element);
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

  consumedElements.add(element);
  consumedElements.add(tableRoot);
  for (const ancestor of Array.from(rootBlockAncestors(tableRoot))) {
    consumedElements.add(ancestor);
  }

  return {
    id: cleanTreeBlockId(context, index),
    type: 'table',
    rows,
    columnCount: Math.max(...rows.map((row) => row.cells.reduce((total, cell) => total + (cell.colSpan ?? 1), 0))),
    tableStyle: extractTableSurface(tableRoot)
  };
}

function extractTextAnnotations(element: Element, fullText = normalizeText(element.textContent ?? '')): TextAnnotation[] {
  const annotations: TextAnnotation[] = [];
  const normalizeSegment = fullText.includes('\n') ? normalizePreWrapText : normalizeText;
  let searchCursor = 0;

  for (const textElement of Array.from(element.querySelectorAll('[data-text="true"], a[href], [role="link"], [data-linelens-emoji-image-url]'))) {
    const text = normalizeSegment(textElement.textContent ?? '');
    if (text === '') {
      continue;
    }

    const startOffset = fullText.indexOf(text, searchCursor);
    if (startOffset === -1) {
      continue;
    }
    searchCursor = startOffset + text.length;

    const annotation: TextAnnotation = {
      startOffset,
      endOffset: startOffset + text.length,
      ...extractTextAnnotationStyle(textElement)
    };
    const emojiImageUrl = textElement.closest('[data-linelens-emoji-image-url]')?.getAttribute('data-linelens-emoji-image-url');
    const linkElement = textElement.closest('a[href], [role="link"]');

    if (isBoldElement(textElement)) {
      annotation.bold = true;
    }
    if (linkElement !== null) {
      const href = linkElement.getAttribute('href');
      if (href) {
        annotation.href = href;
      }
      annotation.target = linkElement.getAttribute('target') ?? undefined;
      Object.assign(annotation, extractTextAnnotationStyle(linkElement));
    }
    if (emojiImageUrl) {
      annotation.emojiImageUrl = emojiImageUrl;
    }

    if (hasTextAnnotationSignal(annotation)) {
      annotations.push(annotation);
    }
  }

  return annotations;
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

function isBoldElement(element: Element): boolean {
  return Boolean(element.closest('strong, b, [style*="font-weight: bold"], [style*="font-weight: 700"]'));
}

function isHeadingElement(element: Element): boolean {
  return /^H[1-6]$/.test(element.tagName.toUpperCase()) || element.getAttribute('data-linelens-block-role') === 'heading';
}

function isQuoteElement(element: Element): boolean {
  return element.tagName.toUpperCase() === 'BLOCKQUOTE' || element.getAttribute('data-testid') === 'tweet';
}

function isListElement(element: Element): boolean {
  return element.hasAttribute('data-linelens-list-kind') || element.tagName.toUpperCase() === 'LI';
}

function isImageElement(element: Element): boolean {
  return element.tagName.toUpperCase() === 'IMG' || element.getAttribute('data-testid') === 'tweetPhoto';
}

function isImageGalleryElement(element: Element): boolean {
  return element.querySelectorAll('[data-testid="tweetPhoto"]').length > 1;
}

function isCodeElement(element: Element): boolean {
  return element.matches('[data-testid="markdown-code-block"]') || element.querySelector('[data-testid="markdown-code-block"]') !== null;
}

function isTableElement(element: Element): boolean {
  return findTableRoot(element) !== null;
}

function isSimpleTweetElement(element: Element): boolean {
  return element.matches('[data-testid="simpleTweet"]') || element.querySelector('[data-testid="simpleTweet"]') !== null;
}

function shouldSkipParagraphFallback(element: Element): boolean {
  return (
    element.querySelector('[data-linelens-list-kind], [data-testid="markdown-code-block"], pre, code') !== null ||
    element.closest('[data-testid="markdown-code-block"], pre, code') !== null ||
    isMediaUiOnlyBlock(element)
  );
}

function getPreferredTextContent(element: Element, type: 'heading' | 'paragraph' | 'quote'): string {
  if (type === 'heading') {
    return normalizeText(element.textContent ?? '');
  }

  if (type === 'quote') {
    return normalizePreWrapText(getElementDisplayText(element, true));
  }

  const mediaText = getMediaBlockPrimaryText(element);
  if (mediaText !== null) {
    return mediaText;
  }

  return normalizePreWrapText(getElementDisplayText(element, true));
}

function getElementDisplayText(element: Element, preserveLineBreaks = false): string {
  if (preserveLineBreaks && element instanceof HTMLElement && typeof element.innerText === 'string') {
    return element.innerText;
  }
  return element.textContent ?? '';
}

function extractCodeBlockStyle(codeRoot: Element | null, pre: Element | null, code: Element | null): CodeBlockStyle {
  const header = codeRoot?.querySelector(':scope > div:first-child') ?? null;
  const copyIcon = codeRoot?.querySelector('button svg, button [style*="color"]') ?? null;
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

function findTableRoot(element: Element): Element | null {
  if (element.matches('table, [role="table"], [role="grid"]')) {
    return element;
  }
  return element.querySelector('table, [role="table"], [role="grid"], [data-testid="markdown-table"]');
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

function getMediaBlockPrimaryText(element: Element): string | null {
  if (!isMediaContainerBlock(element)) {
    return null;
  }

  const textSpans = Array.from(element.querySelectorAll('[data-text="true"]'));
  const spanText = textSpans
    .map((textElement) => normalizeText(textElement.textContent ?? ''))
    .filter(Boolean)
    .join(' ')
    .trim();

  if (spanText) {
    return spanText;
  }

  return textSpans.length > 0 ? '' : null;
}

function isMediaUiOnlyBlock(element: Element): boolean {
  const mediaText = getMediaBlockPrimaryText(element);
  if (!isMediaContainerBlock(element) || mediaText !== null) {
    return false;
  }

  const rawText = normalizeText(element.textContent ?? '');
  return rawText === 'GIF' || /^\d+:\d{2}$/.test(rawText);
}

function isMediaContainerBlock(element: Element): boolean {
  return (
    element.hasAttribute('data-block') &&
    (element.querySelector('[data-testid="videoPlayer"]') !== null || element.querySelector('[data-testid="tweetPhoto"]') !== null)
  );
}

function collectAdjacentListElements(element: Element, kind: 'ordered' | 'unordered'): Element[] {
  const elements = [element];
  let current: Element | null = element;

  while (current !== null) {
    const next = nextElementInDocument(current);
    if (next === null || !isListElement(next) || getListKind(next) !== kind) {
      break;
    }

    elements.push(next);
    current = next;
  }

  return elements;
}

function nextElementInDocument(element: Element): Element | null {
  if (element.nextElementSibling) {
    return element.nextElementSibling;
  }

  let current: Element | null = element;
  while (current !== null) {
    const parent: Element | null = current.parentElement;
    if (parent?.nextElementSibling) {
      return parent.nextElementSibling;
    }
    current = parent;
  }

  return null;
}

function getListKind(element: Element): 'ordered' | 'unordered' | null {
  if (!isListElement(element)) {
    return null;
  }

  return element.getAttribute('data-linelens-list-kind') === 'ordered' ? 'ordered' : 'unordered';
}

function* rootBlockAncestors(element: Element): Generator<Element> {
  let current = element.parentElement;
  while (current !== null) {
    if (current.hasAttribute('data-block')) {
      yield current;
    }
    current = current.parentElement;
  }
}

function hasConsumedAncestor(element: Element, consumedElements: Set<Element>): boolean {
  let current = element.parentElement;
  while (current !== null) {
    if (consumedElements.has(current)) {
      return true;
    }
    current = current.parentElement;
  }

  return false;
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
    ...(href ? { href: toAbsoluteXUrl(href) } : {})
  };
}

function getTweetPhotoBackgroundUrl(element: Element): string {
  const backgroundLayer = element.querySelector<HTMLElement>('[style*="background-image"]');
  const style = backgroundLayer?.style.backgroundImage || backgroundLayer?.getAttribute('style') || '';
  const match = /url\((?:"|&quot;)?([^")]+)(?:"|&quot;)?\)/.exec(style);
  return match?.[1]?.replace(/&amp;/g, '&') ?? '';
}

function tweetPhotoElementToGalleryItem(element: HTMLElement): ImageGalleryBlock['items'][number] | null {
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
    ...(href ? { href: toAbsoluteXUrl(href) } : {}),
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

function getImageAspectRatio(image: HTMLImageElement): number | undefined {
  return toValidAspectRatio(image.naturalWidth, image.naturalHeight);
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

function extractTweetBodyText(tweet: Element): string {
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

function extractTweetMetrics(tweet: Element): TweetMetrics {
  return {
    ...extractTweetMetric(tweet, 'reply', 'replies'),
    ...extractTweetMetric(tweet, 'retweet', 'reposts'),
    ...extractTweetMetric(tweet, 'like', 'likes'),
    ...extractTweetMetric(tweet, 'bookmark', 'bookmarks'),
    ...extractTweetViewsMetric(tweet)
  };
}

function extractTweetMetric(tweet: Element, testId: string, key: keyof TweetMetrics): Partial<TweetMetrics> {
  const root = tweet.querySelector(`[data-testid="${testId}"]`);
  const value = normalizeText(root?.textContent ?? '') || parseTweetMetricLabel(root?.getAttribute('aria-label') ?? '');
  return value ? { [key]: value } : {};
}

function extractTweetViewsMetric(tweet: Element): Pick<TweetMetrics, 'views'> {
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

function getSimpleTweetHref(block: Element): string | undefined {
  const statusLink = Array.from(block.querySelectorAll<HTMLAnchorElement>('a[href*="/status/"]')).find((anchor) => {
    const href = anchor.getAttribute('href') ?? '';
    return /\/status\/\d+/.test(href);
  });
  const href = statusLink?.getAttribute('href') ?? '';
  return href ? toAbsoluteXUrl(href) : undefined;
}

function isTweetDateText(text: string): boolean {
  return /^(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}$/i.test(text) || /^\d+月\d+日$/.test(text);
}

function isTweetMetricText(text: string): boolean {
  return /^(?:\d+(?:\.\d+)?[KMB]?|\d+\s+(?:replies|reposts|likes|bookmarks|views))$/i.test(text);
}

function toAbsoluteXUrl(href: string): string {
  return new URL(href, X_CANONICAL_ORIGIN).toString();
}

function normalizeListItem(
  element: Element,
  kind: 'ordered' | 'unordered'
): { text: string; annotations: TextAnnotation[]; textStyle: TextStyle } {
  const rawText = normalizePreWrapText(getElementDisplayText(element, true));
  const markerMatch = kind === 'ordered' ? rawText.match(/^\d+\.\s+/) : null;
  const markerLength = markerMatch?.[0].length ?? 0;
  const text = markerLength > 0 ? rawText.slice(markerLength).trim() : rawText;
  const annotations = extractTextAnnotations(element, rawText);
  const textStyle = extractElementTextStyle(element);

  if (markerLength === 0) {
    return { text, annotations, textStyle };
  }

  return {
    text,
    textStyle,
    annotations: annotations
      .filter((annotation) => annotation.endOffset > markerLength)
      .map((annotation) => ({
        ...annotation,
        startOffset: Math.max(0, annotation.startOffset - markerLength),
        endOffset: Math.max(0, annotation.endOffset - markerLength)
      }))
      .filter((annotation) => annotation.startOffset < annotation.endOffset && annotation.startOffset < text.length)
      .map((annotation) => ({
        ...annotation,
        endOffset: Math.min(annotation.endOffset, text.length)
      }))
  };
}

function getHeadingLevel(element: Element): 1 | 2 | 3 | 4 | 5 | 6 {
  const tagName = element.tagName.toUpperCase();
  if (/^H[1-6]$/.test(tagName)) {
    return Number(tagName.slice(1)) as 1 | 2 | 3 | 4 | 5 | 6;
  }

  const level = Number(element.getAttribute('data-linelens-heading-level') ?? 2);
  return [1, 2, 3, 4, 5, 6].includes(level) ? (level as 1 | 2 | 3 | 4 | 5 | 6) : 2;
}

function cleanTreeBlockId(context: CleanTreeContext, index: number): string {
  return `${context.debugId}:clean-block-${index}`;
}

function normalizeText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function normalizeCodeText(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/\u00a0/g, ' ').trim();
}

function normalizeCodeLanguage(language: string): string {
  return normalizeText(language).replace(/^language-/, '').toLowerCase();
}

function normalizePreWrapText(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/\u00a0/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
