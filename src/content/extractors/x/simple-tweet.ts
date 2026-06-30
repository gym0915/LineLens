import type {
  SimpleTweetBlock,
  SimpleTweetCardData,
  SimpleTweetContentItem,
  SimpleTweetPhotoLayout,
  TextAnnotation,
  TextStyle,
  TweetMetrics,
  TweetPhoto,
  VideoBlock
} from '../../../shared/article.js';
import type { CapturedXVideo } from '../../../shared/messages.js';
import { normalizePreWrapText, normalizeText } from '../../../shared/text.js';
import { X_CANONICAL_ORIGIN } from '../../../shared/url.js';
import { extractSimpleTweetLayoutTree } from './block-layout-tree.js';
import { getXMediaBackgroundUrl } from './media-layout.js';
import { buildVideoHlsPayload, chooseCapturedVideoSource, matchCapturedVideo } from './video-media.js';

type TweetProfile = {
  authorName?: string;
  authorHandle?: string;
  authorAvatarUrl?: string;
  authorVerified?: boolean;
  publishedAt?: string;
  publishedAtText?: string;
};

export function isSimpleTweetCard(block: Element): boolean {
  return block.matches('[data-testid="simpleTweet"]') || Boolean(block.querySelector('[data-testid="simpleTweet"]'));
}

export async function extractSimpleTweetBlockFromRoot(
  block: Element,
  id: string,
  capturedVideos: CapturedXVideo[] = []
): Promise<SimpleTweetBlock | null> {
  const tweetRoot = block.matches('[data-testid="simpleTweet"]')
    ? block
    : block.querySelector('[data-testid="simpleTweet"]');
  if (!tweetRoot) {
    return null;
  }

  const tweet = tweetRoot.querySelector('[data-testid="tweet"]') ?? tweetRoot;
  const card = await extractSimpleTweetCardData(tweetRoot, tweet, capturedVideos, 0);
  if (!card || card.items.length === 0) {
    return null;
  }

  const metrics = extractTweetMetrics(tweet);
  const layoutTree = extractSimpleTweetLayoutTree(tweetRoot, tweet, card.items);
  return {
    id,
    type: 'simple-tweet',
    ...card,
    ...(layoutTree ? { layoutTree } : {}),
    ...(hasTweetMetrics(metrics) ? { metrics } : {})
  };
}

export function extractSimpleTweetBlockFromCleanTreeRoot(block: Element, id: string): SimpleTweetBlock | null {
  const tweetRoot = block.matches('[data-testid="simpleTweet"]')
    ? block
    : block.querySelector('[data-testid="simpleTweet"]');
  if (!tweetRoot) {
    return null;
  }

  const tweet = tweetRoot.querySelector('[data-testid="tweet"]') ?? tweetRoot;
  const profile = extractTweetProfile(tweet);
  const items = extractSimpleTweetItemsFromCleanTree(tweetRoot, tweet, 0);
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

function extractSimpleTweetItemsFromCleanTree(tweetRoot: Element, tweet: Element, depth: number): SimpleTweetContentItem[] {
  const quotedRoots = collectQuotedTweetRoots(tweetRoot, tweet);
  const consumedMediaRoots = new Set<Element>();
  const candidates = new Map<Element, SimpleTweetContentItem | null>();

  const richText = extractTweetBodyRichTextFromCleanTree(tweet);
  const textElement = tweet.querySelector('[data-testid="tweetText"]');
  if (textElement && richText.text) {
    candidates.set(textElement, {
      type: 'text',
      text: richText.text,
      ...(richText.annotations.length > 0 ? { annotations: richText.annotations } : {})
    });
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
    if (hasConsumedAncestor(mediaRoot, consumedMediaRoots)) {
      continue;
    }
    candidates.set(mediaRoot, extractVideoItem(mediaRoot, `${depth}-video-${candidates.size}`, []));
    consumedMediaRoots.add(mediaRoot);
  }

  for (const preview of Array.from(tweet.querySelectorAll('[data-testid="previewInterstitial"], [aria-label="嵌入式视频"], [aria-label="Embedded video"]'))) {
    if (belongsToQuotedTweet(preview, quotedRoots)) {
      continue;
    }
    const mediaRoot = preview.closest('[data-testid="tweetPhoto"]') ?? preview;
    if (hasConsumedAncestor(mediaRoot, consumedMediaRoots)) {
      continue;
    }
    candidates.set(mediaRoot, extractVideoPreviewItem(mediaRoot));
    consumedMediaRoots.add(mediaRoot);
  }

  const loosePhotos: Array<{ element: HTMLElement; layoutRoot: Element; photo: TweetPhoto }> = [];
  for (const photoElement of Array.from(tweet.querySelectorAll<HTMLElement>('[data-testid="tweetPhoto"]'))) {
    if (belongsToQuotedTweet(photoElement, quotedRoots) || hasConsumedAncestor(photoElement, consumedMediaRoots)) {
      continue;
    }
    const photo = tweetPhotoElementToPhoto(photoElement);
    if (!photo) {
      continue;
    }
    loosePhotos.push({
      element: photoElement,
      layoutRoot: getSimpleTweetPhotoLayoutRoot(photoElement, tweet),
      photo
    });
  }
  for (const group of groupAdjacentPhotos(loosePhotos)) {
    const anchor = group[0]?.layoutRoot ?? group[0]?.element;
    if (!anchor) {
      continue;
    }
    const layout = buildSimpleTweetPhotoLayout(anchor, group);
    candidates.set(
      anchor,
      group.length === 1
        ? extractPhotoItem(group[0].element, group[0].photo)
        : {
            type: 'photo-group',
            photos: group.map((item) => item.photo),
            layout,
            ...(getSimpleTweetPhotoGroupAspectRatio(anchor) ? { aspectRatio: getSimpleTweetPhotoGroupAspectRatio(anchor) } : {})
          }
    );
  }

  if (depth === 0) {
    for (const quotedRoot of quotedRoots) {
      const quotedTweet = quotedRoot.matches('[data-testid="tweet"]')
        ? quotedRoot
        : quotedRoot.querySelector('[data-testid="tweet"]') ?? quotedRoot;
      const quotedCard = extractSimpleTweetCardDataFromCleanTree(quotedRoot, quotedTweet, depth + 1);
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

function extractSimpleTweetCardDataFromCleanTree(tweetRoot: Element, tweet: Element, depth: number): SimpleTweetCardData | null {
  const profile = extractTweetProfile(tweet);
  const items = extractSimpleTweetItemsFromCleanTree(tweetRoot, tweet, depth);
  const excerpt = items.find((item): item is Extract<SimpleTweetContentItem, { type: 'text' }> => item.type === 'text')?.text ?? '';
  if (excerpt === '' && items.length === 0) {
    return null;
  }

  return {
    source: 'X Tweet',
    title: buildTweetAuthorLine(profile) || 'X Tweet',
    excerpt,
    href: getSimpleTweetHref(tweetRoot),
    items,
    authorBadgeAvatarUrl: extractTweetAuthorBadgeAvatarUrl(tweet),
    replyContextText: extractTweetReplyContextText(tweet),
    replyToHandle: extractTweetReplyToHandle(tweet),
    translationSourceText: extractTweetTranslationSourceText(tweet),
    translationActionText: extractTweetTranslationActionText(tweet),
    aiGeneratedText: extractTweetAiGeneratedText(tweet),
    ...profile
  };
}

function extractTweetBodyRichTextFromCleanTree(tweet: Element): { text: string; annotations: TextAnnotation[] } {
  const explicitTweetText = tweet.querySelector('[data-testid="tweetText"]');
  if (explicitTweetText) {
    const richText = extractTweetTextWithInlineEmoji(explicitTweetText);
    if (richText.text) {
      return richText;
    }
  }

  const authorRoot = tweet.querySelector('[data-testid="User-Name"]');
  const candidates = Array.from(tweet.querySelectorAll<HTMLElement>('div[dir="auto"]'))
    .filter((element) => !authorRoot?.contains(element))
    .map((element) => normalizePreWrapText(element.textContent ?? ''))
    .filter((text) => text && !isTweetMetricText(text) && !isTweetDateText(text));

  return { text: candidates[0] ?? '', annotations: [] };
}

export async function extractSimpleTweetCardData(
  tweetRoot: Element,
  tweet: Element,
  capturedVideos: CapturedXVideo[],
  depth: number
): Promise<SimpleTweetCardData | null> {
  const profile = extractTweetProfile(tweet);
  const items = await extractSimpleTweetItems(tweetRoot, tweet, capturedVideos, depth);
  const textItem = items.find((item): item is Extract<SimpleTweetContentItem, { type: 'text' }> => item.type === 'text');
  const excerpt = textItem?.text ?? '';
  if (excerpt === '' && items.length === 0) {
    return null;
  }

  return {
    source: 'X Tweet',
    title: buildTweetAuthorLine(profile) || 'X Tweet',
    excerpt,
    href: getSimpleTweetHref(tweetRoot),
    items,
    authorBadgeAvatarUrl: extractTweetAuthorBadgeAvatarUrl(tweet),
    replyContextText: extractTweetReplyContextText(tweet),
    replyToHandle: extractTweetReplyToHandle(tweet),
    translationSourceText: extractTweetTranslationSourceText(tweet),
    translationActionText: extractTweetTranslationActionText(tweet),
    aiGeneratedText: extractTweetAiGeneratedText(tweet),
    ...profile
  };
}

async function extractSimpleTweetItems(
  tweetRoot: Element,
  tweet: Element,
  capturedVideos: CapturedXVideo[],
  depth: number
): Promise<SimpleTweetContentItem[]> {
  const quotedRoots = collectQuotedTweetRoots(tweetRoot, tweet);
  const quotedRootSet = new Set(quotedRoots);
  const consumedMediaRoots = new Set<Element>();
  const candidates = new Map<Element, SimpleTweetContentItem | null>();

  const richText = await extractTweetBodyRichText(tweet);
  const text = richText.text;
  const textElement = tweet.querySelector('[data-testid="tweetText"]');
  if (textElement && text) {
    candidates.set(textElement, {
      type: 'text',
      text,
      ...(richText.annotations.length > 0 ? { annotations: richText.annotations } : {})
    });
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
    if (hasConsumedAncestor(mediaRoot, consumedMediaRoots)) {
      continue;
    }
    candidates.set(mediaRoot, extractVideoItem(mediaRoot, `${depth}-video-${candidates.size}`, capturedVideos));
    consumedMediaRoots.add(mediaRoot);
  }

  for (const preview of Array.from(tweet.querySelectorAll('[data-testid="previewInterstitial"], [aria-label="嵌入式视频"], [aria-label="Embedded video"]'))) {
    if (belongsToQuotedTweet(preview, quotedRoots)) {
      continue;
    }
    const mediaRoot = preview.closest('[data-testid="tweetPhoto"]') ?? preview;
    if (hasConsumedAncestor(mediaRoot, consumedMediaRoots)) {
      continue;
    }
    candidates.set(mediaRoot, extractVideoPreviewItem(mediaRoot));
    consumedMediaRoots.add(mediaRoot);
  }

  const loosePhotos: Array<{ element: HTMLElement; layoutRoot: Element; photo: TweetPhoto }> = [];
  for (const photoElement of Array.from(tweet.querySelectorAll<HTMLElement>('[data-testid="tweetPhoto"]'))) {
    if (belongsToQuotedTweet(photoElement, quotedRoots) || hasConsumedAncestor(photoElement, consumedMediaRoots)) {
      continue;
    }
    const photo = tweetPhotoElementToPhoto(photoElement);
    if (!photo) {
      continue;
    }
    loosePhotos.push({
      element: photoElement,
      layoutRoot: getSimpleTweetPhotoLayoutRoot(photoElement, tweet),
      photo
    });
  }
  for (const group of groupAdjacentPhotos(loosePhotos)) {
    const anchor = group[0]?.layoutRoot ?? group[0]?.element;
    if (!anchor) {
      continue;
    }
    const layout = buildSimpleTweetPhotoLayout(anchor, group);
    candidates.set(
      anchor,
      group.length === 1
        ? extractPhotoItem(group[0].element, group[0].photo)
        : {
            type: 'photo-group',
            photos: group.map((item) => item.photo),
            layout,
            ...(getSimpleTweetPhotoGroupAspectRatio(anchor) ? { aspectRatio: getSimpleTweetPhotoGroupAspectRatio(anchor) } : {})
          }
    );
  }

  if (depth === 0) {
    for (const quotedRoot of quotedRoots) {
      const quotedTweet = quotedRoot.matches('[data-testid="tweet"]')
        ? quotedRoot
        : quotedRoot.querySelector('[data-testid="tweet"]') ?? quotedRoot;
      const quotedCard = await extractSimpleTweetCardData(quotedRoot, quotedTweet, capturedVideos, depth + 1);
      if (!quotedCard || quotedCard.items.length === 0) {
        continue;
      }
      candidates.set(quotedRoot, { type: 'quoted-tweet', tweet: quotedCard });
    }
  }

  return Array.from(candidates.entries())
    .filter((entry): entry is [Element, SimpleTweetContentItem] => Boolean(entry[1]))
    .sort((left, right) => compareNodeOrder(left[0], right[0]))
    .map(([, item]) => item);
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
  items: Array<{ element: HTMLElement; layoutRoot: Element; photo: TweetPhoto }>
): Array<Array<{ element: HTMLElement; layoutRoot: Element; photo: TweetPhoto }>> {
  const groups: Array<Array<{ element: HTMLElement; layoutRoot: Element; photo: TweetPhoto }>> = [];
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
  items: Array<{ element: HTMLElement; layoutRoot: Element; photo: TweetPhoto }>
): SimpleTweetPhotoLayout {
  const photoMap = new Map(items.map((item) => [item.element, item.photo] as const));
  return buildSimpleTweetPhotoLayoutNode(layoutRoot, items, photoMap, 0) ?? {
    kind: 'row',
    children: items.map((item) => ({ kind: 'photo', photo: item.photo }))
  };
}

function buildSimpleTweetPhotoLayoutNode(
  root: Element,
  items: Array<{ element: HTMLElement; layoutRoot: Element; photo: TweetPhoto }>,
  photoMap: Map<HTMLElement, TweetPhoto>,
  depth: number
): SimpleTweetPhotoLayout | null {
  const localItems = items.filter((item) => root.contains(item.element));
  if (localItems.length === 0) {
    return null;
  }
  if (localItems.length === 1) {
    return {
      kind: 'photo',
      photo: localItems[0].photo,
      ...getSimpleTweetPhotoLayoutSize(root)
    };
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
      return {
        kind: getSimpleTweetMediaLayoutDirection(root, depth),
        children,
        ...getSimpleTweetPhotoLayoutSize(root)
      };
    }
  }

  const directPhotos = Array.from(root.querySelectorAll<HTMLElement>('[data-testid="tweetPhoto"]'))
    .filter((photoElement) => localItems.some((item) => item.element === photoElement))
    .map((photoElement) => photoMap.get(photoElement))
    .filter((photo): photo is TweetPhoto => Boolean(photo));

  if (directPhotos.length === 1) {
    return {
      kind: 'photo',
      photo: directPhotos[0],
      ...getSimpleTweetPhotoLayoutSize(root)
    };
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
    const ratio = ratioNode ? getAspectRatioFromPaddingStyle(ratioNode.getAttribute('style') ?? '') : undefined;
    if (ratio) {
      return ratio;
    }

    if (current.getAttribute('data-testid') === 'tweet' || current.getAttribute('data-testid') === 'simpleTweet') {
      break;
    }
  }

  return undefined;
}

function getAspectRatioFromPaddingStyle(style: string): number | undefined {
  const match = /padding-bottom:\s*([0-9.]+)%/i.exec(style);
  if (!match) {
    return undefined;
  }

  const padding = Number(match[1]);
  if (!Number.isFinite(padding) || padding <= 0) {
    return undefined;
  }

  return Math.round((100 / padding) * 10000) / 10000;
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

function hasConsumedAncestor(element: Element, consumedRoots: Set<Element>): boolean {
  for (let current: Element | null = element; current; current = current.parentElement) {
    if (consumedRoots.has(current)) {
      return true;
    }
  }
  return false;
}

function belongsToQuotedTweet(element: Element, quotedRoots: Element[]): boolean {
  return quotedRoots.some((quotedRoot) => quotedRoot !== element && quotedRoot.contains(element));
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

function extractArticleCoverItem(coverRoot: Element): SimpleTweetContentItem | null {
  const coverImage = coverRoot.querySelector<HTMLImageElement>('img');
  const coverUrl = coverImage?.currentSrc || coverImage?.src || '';
  if (!coverUrl) {
    return null;
  }

  const cardRoot = getArticleCoverCardRoot(coverRoot);
  const authorProfile = extractArticleCoverAuthorProfile(cardRoot);
  const metrics = extractMetricsFromGroup(cardRoot.querySelector('[role="group"][aria-label]'));
  const titleElement = getTextElementAfterCover(coverRoot, 0);
  const excerptElement = getTextElementAfterCover(coverRoot, 1);
  const sourceBadge = extractArticleCoverSourceBadge(coverRoot);

  return {
    type: 'article-cover',
    coverUrl,
    coverAlt: coverImage?.alt || undefined,
    ...(getArticleCoverAspectRatio(coverRoot) ? { aspectRatio: getArticleCoverAspectRatio(coverRoot) } : {}),
    ...sourceBadge,
    title: normalizeText(titleElement?.textContent ?? ''),
    ...(titleElement ? { titleTextStyle: extractElementTextStyle(titleElement) } : {}),
    excerpt: normalizeText(excerptElement?.textContent ?? ''),
    ...(excerptElement ? { excerptTextStyle: extractElementTextStyle(excerptElement) } : {}),
    href: getSimpleTweetHref(coverRoot.closest('[data-testid="simpleTweet"], [data-testid="tweet"]') ?? coverRoot),
    ...authorProfile,
    ...(hasTweetMetrics(metrics) ? { metrics } : {})
  };
}

function extractArticleCoverSourceBadge(coverRoot: Element): { sourceLabel?: string; sourceIconPath?: string; sourceColor?: string } {
  const badge = Array.from(coverRoot.querySelectorAll<HTMLElement>('[role="img"][aria-label]')).find((element) =>
    /^(文章|article)$/i.test(normalizeText(element.getAttribute('aria-label') ?? ''))
  );
  if (!badge) {
    return {};
  }

  const sourceLabel = normalizeText(badge.textContent ?? badge.getAttribute('aria-label') ?? '') || normalizeText(badge.getAttribute('aria-label') ?? '');
  const sourceIconPath = badge.querySelector('svg path')?.getAttribute('d') ?? undefined;
  const sourceColor = getStyleValue(badge.closest('div[dir="ltr"]') ?? badge, 'color');
  return {
    ...(sourceLabel ? { sourceLabel } : {}),
    ...(sourceIconPath ? { sourceIconPath } : {}),
    ...(sourceColor ? { sourceColor } : {})
  };
}

function getArticleCoverAspectRatio(coverRoot: Element): number | undefined {
  for (const element of Array.from(coverRoot.querySelectorAll<HTMLElement>('[style*="padding-bottom"]'))) {
    const ratio = getPaddingBottomAspectRatio(element);
    if (ratio) {
      return ratio;
    }
  }
  return undefined;
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

function extractVideoItem(element: Element, id: string, capturedVideos: CapturedXVideo[]): SimpleTweetContentItem | null {
  const video = extractVideoFromElement(element, id, capturedVideos);
  return video ? { type: 'video', video } : null;
}

function extractVideoPreviewItem(element: Element): SimpleTweetContentItem | null {
  const image = element.querySelector<HTMLImageElement>('[data-testid="tweetPhoto"] img, img');
  const src = image?.currentSrc || image?.src || getXMediaBackgroundUrl(element);
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
    aspectRatio: getPreviewAspectRatio(element),
    ...(isCondensedPreview(element) ? { layout: 'condensed' as const } : {}),
    ...(isRoundedSquarePreview(element) ? { shape: 'rounded-square' as const } : {})
  };
}

function extractPhotoItem(element: Element, photo: TweetPhoto): SimpleTweetContentItem {
  return {
    type: 'photo',
    photo,
    ...(isCondensedPreview(element) ? { layout: 'condensed' as const } : {}),
    ...(isCondensedPreview(element) ? { shape: 'rounded-square' as const } : {})
  };
}

function isCondensedPreview(element: Element): boolean {
  return Boolean(element.closest('[data-testid="testCondensedMedia"]'));
}

function isRoundedSquarePreview(element: Element): boolean {
  return isCondensedPreview(element) || Math.abs((getPreviewAspectRatio(element) ?? 0) - 1) < 0.02;
}

function getPreviewAspectRatio(element: Element): number | undefined {
  for (let current: Element | null = element; current; current = current.parentElement) {
    const ratio = getPaddingBottomAspectRatio(current);
    if (ratio) {
      return ratio;
    }
  }
  return undefined;
}

function getPaddingBottomAspectRatio(element: Element): number | undefined {
  const style = element.getAttribute('style') ?? '';
  const match = /padding-bottom:\s*([\d.]+)%/.exec(style);
  if (!match) {
    return undefined;
  }
  const percent = Number.parseFloat(match[1]);
  return Number.isFinite(percent) && percent > 0 ? 100 / percent : undefined;
}

export function extractTweetProfile(tweet: Element): TweetProfile {
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

export function buildTweetAuthorLine(profile: TweetProfile): string {
  const parts = [profile.authorName, profile.authorHandle, profile.publishedAtText].filter(Boolean);
  return parts.join(' · ');
}

export function extractTweetMetrics(tweet: Element): TweetMetrics {
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

function parseTweetMetricLabel(label: string): string {
  return normalizeText(label).match(/\d+(?:\.\d+)?[KMB万]?/)?.[0] ?? '';
}

export function hasTweetMetrics(metrics: TweetMetrics): boolean {
  return Object.values(metrics).some(Boolean);
}

async function expandTweetTextIfNeeded(tweet: Element): Promise<void> {
  const textContainer = tweet.querySelector<HTMLElement>('[data-testid="tweetText"]');
  const showMoreButton = tweet.querySelector<HTMLButtonElement>('[data-testid="tweet-text-show-more-link"]');
  if (!textContainer || !showMoreButton) {
    return;
  }

  const label = normalizeText(showMoreButton.textContent ?? showMoreButton.getAttribute('aria-label') ?? '');
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

export async function extractTweetBodyText(tweet: Element): Promise<string> {
  return (await extractTweetBodyRichText(tweet)).text;
}

export async function extractTweetBodyRichText(tweet: Element): Promise<{ text: string; annotations: TextAnnotation[] }> {
  await expandTweetTextIfNeeded(tweet);
  const explicitTweetText = tweet.querySelector('[data-testid="tweetText"]');
  if (explicitTweetText) {
    const richText = extractTweetTextWithInlineEmoji(explicitTweetText);
    if (richText.text) {
      return richText;
    }
  }

  const authorRoot = tweet.querySelector('[data-testid="User-Name"]');
  const candidates = Array.from(tweet.querySelectorAll<HTMLElement>('div[dir="auto"]'))
    .filter((element) => !authorRoot?.contains(element))
    .map((element) => normalizePreWrapText(element.textContent ?? ''))
    .filter((text) => text && !isTweetMetricText(text) && !isTweetDateText(text));

  return { text: candidates[0] ?? '', annotations: [] };
}

function extractTweetTextWithInlineEmoji(element: Element): { text: string; annotations: TextAnnotation[] } {
  let rawText = '';
  const annotations: TextAnnotation[] = [];

  const appendNode = (node: Node): void => {
    if (node.nodeType === Node.TEXT_NODE) {
      rawText += node.textContent ?? '';
      return;
    }

    if (!(node instanceof HTMLElement)) {
      for (const child of Array.from(node.childNodes)) {
        appendNode(child);
      }
      return;
    }

    const emojiImageUrl = getXEmojiImageUrl(node);
    if (emojiImageUrl) {
      const emojiText = node.tagName.toUpperCase() === 'IMG' ? (node as HTMLImageElement).alt : normalizeText(node.textContent ?? '');
      if (emojiText) {
        const startOffset = rawText.length;
        rawText += emojiText;
        annotations.push({
          startOffset,
          endOffset: rawText.length,
          emojiImageUrl
        });
      }
      return;
    }

    for (const child of Array.from(node.childNodes)) {
      appendNode(child);
    }
  };

  for (const child of Array.from(element.childNodes)) {
    appendNode(child);
  }

  const text = normalizePreWrapText(rawText);
  return { text, annotations: alignAnnotationsToNormalizedText(rawText, text, annotations) };
}

function getXEmojiImageUrl(element: HTMLElement): string | undefined {
  if (element.tagName.toUpperCase() === 'IMG') {
    const image = element as HTMLImageElement;
    if (image.src && isXEmojiImageUrl(image.src)) {
      return image.currentSrc || image.src;
    }
  }

  const preservedUrl = element.getAttribute('data-linelens-emoji-image-url');
  if (preservedUrl && isXEmojiImageUrl(preservedUrl)) {
    return preservedUrl;
  }

  const backgroundImage = element.style.backgroundImage;
  const match = backgroundImage.match(/url\((['"]?)(.*?)\1\)/i);
  const backgroundUrl = match?.[2];
  return backgroundUrl && isXEmojiImageUrl(backgroundUrl) ? backgroundUrl : undefined;
}

function isXEmojiImageUrl(url: string): boolean {
  return /(?:^|\/)emoji\/v2\/svg\//.test(url);
}

function alignAnnotationsToNormalizedText(rawText: string, normalizedText: string, annotations: TextAnnotation[]): TextAnnotation[] {
  if (rawText === normalizedText) {
    return annotations;
  }

  let searchCursor = 0;
  return annotations.flatMap((annotation) => {
    const segment = normalizePreWrapText(rawText.slice(annotation.startOffset, annotation.endOffset));
    if (!segment) {
      return [];
    }
    const startOffset = normalizedText.indexOf(segment, searchCursor);
    if (startOffset === -1) {
      return [];
    }
    const endOffset = startOffset + segment.length;
    searchCursor = endOffset;
    return [{ ...annotation, startOffset, endOffset }];
  });
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function isTweetDateText(text: string): boolean {
  return /^(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}$/i.test(text) || /^\d+月\d+日$/.test(text);
}

function isTweetMetricText(text: string): boolean {
  return /^(?:\d+(?:\.\d+)?[KMB万]?|\d+\s+(?:replies|reposts|likes|bookmarks|views))$/i.test(text);
}

export function extractTweetAuthorBadgeAvatarUrl(tweet: Element): string | undefined {
  const authorRoot = tweet.querySelector('[data-testid="User-Name"]');
  const avatarRoot = tweet.querySelector('[data-testid="Tweet-User-Avatar"]');
  const image = Array.from(authorRoot?.querySelectorAll<HTMLImageElement>('img') ?? []).find((candidate) => !avatarRoot?.contains(candidate));
  return image?.currentSrc || image?.src || undefined;
}

export function extractTweetReplyToHandle(tweet: Element): string | undefined {
  const replyRoot = getTweetReplyContextRoot(tweet);
  const replyLink = replyRoot?.querySelector<HTMLAnchorElement>('a[href^="/"]');
  return replyLink ? normalizeText(replyLink.textContent ?? '') : undefined;
}

export function extractTweetReplyContextText(tweet: Element): string | undefined {
  const text = normalizeText(getTweetReplyContextRoot(tweet)?.textContent ?? '');
  return text || undefined;
}

function getTweetReplyContextRoot(tweet: Element): HTMLElement | undefined {
  return Array.from(tweet.querySelectorAll<HTMLElement>('div[dir="ltr"]')).find((element) => {
    const text = normalizeText(element.textContent ?? '');
    return text.startsWith('回复 @') || text.startsWith('Replying to @');
  });
}

export function extractTweetTranslationSourceText(tweet: Element): string | undefined {
  const showOriginalButton = tweet.querySelector('[aria-label="显示原文"], [aria-label="Show original"]');
  const root = showOriginalButton?.closest('[dir="ltr"]');
  const text = normalizeText(root?.textContent ?? '').replace(/\s*(?:显示原文|Show original)\s*$/i, '').trim();
  return text || undefined;
}

export function extractTweetTranslationActionText(tweet: Element): string | undefined {
  const showOriginalButton = tweet.querySelector('[aria-label="显示原文"], [aria-label="Show original"]');
  return normalizeText(showOriginalButton?.textContent ?? showOriginalButton?.getAttribute('aria-label') ?? '') || undefined;
}

export function getSimpleTweetHref(block: Element): string | undefined {
  const statusHref = Array.from(block.querySelectorAll<HTMLAnchorElement>('a[href*="/status/"]'))
    .map((anchor) => anchor.getAttribute('href') ?? '')
    .find((href) => /\/status\/(?!.*analytics)/.test(href));

  const href = statusHref || block.querySelector('a[href]')?.getAttribute('href');
  return href ? new URL(href, X_CANONICAL_ORIGIN).toString() : undefined;
}

function getTextElementAfterCover(coverRoot: Element, offset: number): HTMLElement | undefined {
  const textBlocks = Array.from(coverRoot.parentElement?.querySelectorAll<HTMLElement>('div[dir="auto"]') ?? []);
  const coverIndex = textBlocks.findIndex((element) => coverRoot.contains(element));
  const candidates = coverIndex >= 0 ? textBlocks.slice(coverIndex + 1) : textBlocks;
  return candidates[offset];
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

export function tweetPhotoElementToPhoto(element: HTMLElement): TweetPhoto | null {
  const image = element.querySelector<HTMLImageElement>('img');
  const displaySrc = getXMediaBackgroundUrl(element);
  const src = image?.currentSrc || image?.src || displaySrc;
  if (!src) {
    return null;
  }

  const href = element.closest('a[href]')?.getAttribute('href') ?? undefined;
  return {
    src,
    ...(displaySrc ? { displaySrc } : {}),
    alt: image?.alt || undefined,
    ...(href ? { href: new URL(href, X_CANONICAL_ORIGIN).toString() } : {})
  };
}

export function extractVideoFromElement(element: Element, id: string, capturedVideos: CapturedXVideo[]): VideoBlock | null {
  const tweetPhoto = element.matches('[data-testid="tweetPhoto"]')
    ? element
    : element.querySelector('[data-testid="tweetPhoto"]');
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

function resolveVideoSourceType(src: string, fallbackType?: string): string | undefined {
  if (/\.m3u8(?:$|\?)/i.test(src)) {
    return 'application/x-mpegURL';
  }
  return fallbackType || undefined;
}

function getInlineStyleValue(element: HTMLElement, propertyName: string): string | undefined {
  const inlineStyle = element.getAttribute('style') ?? '';
  const match = new RegExp(`${propertyName}\\s*:\\s*([^;]+)`).exec(inlineStyle);
  return match?.[1]?.trim() || undefined;
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

function toValidAspectRatio(width: number, height: number): number | undefined {
  return width > 0 && height > 0 ? width / height : undefined;
}
