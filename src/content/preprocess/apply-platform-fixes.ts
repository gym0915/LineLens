import type { PlatformAdapter, PlatformFixId } from '../adapters/adapter-types.js';
import type { CleanTreeContext } from './clone-content-tree.js';

export type PlatformFixResult = {
  id: PlatformFixId;
  applied: boolean;
  changedNodeCount: number;
};

export type PlatformFixesResult = {
  orderedFixIds: PlatformFixId[];
  results: PlatformFixResult[];
};

const FIX_ORDER: PlatformFixId[] = [
  'expand-folded-tweet-text',
  'normalize-handwritten-ordered-list',
  'preserve-svg-emoji',
  'capture-x-video-hls',
  'preserve-x-media-caption',
  'preserve-x-media-layout'
];

export function getPlatformFixOrder(adapter: PlatformAdapter): PlatformFixId[] {
  const availableFixes = new Set(adapter.fixes.map((fix) => fix.id));
  return FIX_ORDER.filter((fixId) => availableFixes.has(fixId));
}

export function applyPlatformFixes(
  root: Element,
  adapter: PlatformAdapter,
  context: CleanTreeContext
): PlatformFixesResult {
  const enabledFixes = new Set(adapter.enabledFixes);
  const orderedFixIds = getPlatformFixOrder(adapter);
  const results = orderedFixIds.map((fixId) => {
    if (!enabledFixes.has(fixId)) {
      return { id: fixId, applied: false, changedNodeCount: 0 };
    }

    return runPlatformFix(fixId, root, context);
  });

  return { orderedFixIds, results };
}

function runPlatformFix(fixId: PlatformFixId, root: Element, context: CleanTreeContext): PlatformFixResult {
  switch (fixId) {
    case 'expand-folded-tweet-text':
      return { id: fixId, applied: true, changedNodeCount: markFoldedTweetTextCandidates(root) };
    case 'normalize-handwritten-ordered-list':
      return { id: fixId, applied: true, changedNodeCount: normalizeOrderedListSemantics(root) };
    case 'preserve-svg-emoji':
      return { id: fixId, applied: true, changedNodeCount: preserveSvgEmojiMetadata(root) };
    case 'capture-x-video-hls':
      return { id: fixId, applied: true, changedNodeCount: markVideoHlsCandidates(root, context) };
    case 'preserve-x-media-caption':
      return { id: fixId, applied: true, changedNodeCount: preserveXMediaCaptionMetadata(root) };
    case 'preserve-x-media-layout':
      return { id: fixId, applied: true, changedNodeCount: preserveXMediaLayoutMetadata(root) };
  }
}

function markFoldedTweetTextCandidates(root: Element): number {
  let changedNodeCount = 0;
  for (const element of Array.from(root.querySelectorAll('[data-testid="tweetText"]'))) {
    element.setAttribute('data-linelens-fix-folded-tweet-text', 'candidate');
    changedNodeCount += 1;
  }

  return changedNodeCount;
}

function normalizeOrderedListSemantics(root: Element): number {
  let changedNodeCount = 0;
  for (const element of Array.from(root.querySelectorAll('.longform-header-one, .longform-header-two'))) {
    element.setAttribute('data-linelens-block-role', 'heading');
    element.setAttribute('data-linelens-heading-level', element.classList.contains('longform-header-one') ? '1' : '2');
    changedNodeCount += 1;
  }

  for (const element of Array.from(root.querySelectorAll('.public-DraftStyleDefault-orderedListItem'))) {
    element.setAttribute('data-linelens-list-kind', 'ordered');
    changedNodeCount += 1;
  }

  for (const element of Array.from(root.querySelectorAll('.public-DraftStyleDefault-unorderedListItem'))) {
    element.setAttribute('data-linelens-list-kind', 'unordered');
    changedNodeCount += 1;
  }

  return changedNodeCount;
}

function preserveSvgEmojiMetadata(root: Element): number {
  let changedNodeCount = 0;
  for (const element of Array.from(root.querySelectorAll<HTMLElement>('[style*="abs.twimg.com/emoji/v2/svg/"]'))) {
    const emojiImageUrl = extractBackgroundImageUrl(element.style.backgroundImage);
    if (emojiImageUrl === null) {
      continue;
    }

    element.setAttribute('data-linelens-emoji-image-url', emojiImageUrl);
    changedNodeCount += 1;
  }

  return changedNodeCount;
}

function markVideoHlsCandidates(root: Element, context: CleanTreeContext): number {
  let changedNodeCount = 0;
  for (const element of Array.from(root.querySelectorAll('[data-testid="videoPlayer"]'))) {
    element.setAttribute('data-linelens-video-hls-candidate', context.debugId);
    changedNodeCount += 1;
  }

  return changedNodeCount;
}

function preserveXMediaCaptionMetadata(root: Element): number {
  let changedNodeCount = 0;
  const captionRoots = new Set<Element>();

  for (const element of Array.from(root.querySelectorAll('.twitter-article-media-caption-id'))) {
    captionRoots.add(element);
  }

  for (const element of Array.from(root.querySelectorAll('[id^="caption-"]'))) {
    captionRoots.add(element);
  }

  for (const captionRoot of Array.from(captionRoots)) {
    const textBlocks = captionRoot.matches('[data-block="true"]')
      ? [captionRoot]
      : Array.from(captionRoot.querySelectorAll('[data-block="true"]'));
    for (const textBlock of textBlocks) {
      textBlock.setAttribute('data-linelens-block-role', 'caption');
      changedNodeCount += 1;
    }
  }

  return changedNodeCount;
}

function preserveXMediaLayoutMetadata(root: Element): number {
  let changedNodeCount = 0;

  const simpleTweetRoots = Array.from(root.querySelectorAll<HTMLElement>('[data-testid="simpleTweet"], [data-testid="tweet"]'));
  const candidates = new Set<HTMLElement>();
  for (const tweetRoot of simpleTweetRoots) {
    for (const element of Array.from(tweetRoot.querySelectorAll<HTMLElement>('a, div, [role="group"], [role="link"]'))) {
      candidates.add(element);
    }
  }
  for (const element of Array.from(root.querySelectorAll<HTMLElement>('[class*="r-18u37iz"], [class*="r-eqz5dr"]'))) {
    candidates.add(element);
  }

  for (const element of Array.from(candidates)) {
    if (!element.querySelector('[data-testid="tweetPhoto"], [data-testid="videoPlayer"], [data-testid="previewInterstitial"]')) {
      continue;
    }

    const direction = getComputedMediaLayoutDirection(element) ?? getClassMediaLayoutDirection(element);
    if (direction) {
      element.setAttribute('data-linelens-media-layout-direction', direction);
      changedNodeCount += 1;

      const branches = Array.from(element.children).filter((child): child is HTMLElement =>
        child instanceof HTMLElement &&
        child.querySelector('[data-testid="tweetPhoto"], [data-testid="videoPlayer"], [data-testid="previewInterstitial"]') !== null
      );
      if (branches.length > 1) {
        for (const branch of branches) {
          const branchRatio = getComputedBranchRatio(branch, element, direction) ?? formatRatio(1 / branches.length);
          if (direction === 'row') {
            branch.setAttribute('data-linelens-media-layout-width', branchRatio);
            branch.setAttribute('data-linelens-media-layout-height', '1');
          } else {
            branch.setAttribute('data-linelens-media-layout-width', '1');
            branch.setAttribute('data-linelens-media-layout-height', branchRatio);
          }
          changedNodeCount += 1;
        }
      }
    }
  }

  for (const element of Array.from(root.querySelectorAll<HTMLElement>('[style*="padding-bottom"]'))) {
    if (!element.parentElement?.querySelector('[data-testid="tweetPhoto"], [data-testid="videoPlayer"], [data-testid="previewInterstitial"]')) {
      continue;
    }

    const aspectRatio = extractPaddingBottomAspectRatio(element.getAttribute('style') ?? '');
    if (!aspectRatio) {
      continue;
    }

    element.parentElement.setAttribute('data-linelens-media-aspect-ratio', aspectRatio);
    changedNodeCount += 1;
  }

  return changedNodeCount;
}

function readComputedMediaLayoutStyle(element: HTMLElement): { display: string; flexDirection: string } | null {
  if (typeof window === 'undefined' || typeof window.getComputedStyle !== 'function') {
    return null;
  }

  const style = window.getComputedStyle(element);
  return {
    display: style.display,
    flexDirection: style.flexDirection
  };
}

function getComputedMediaLayoutDirection(element: HTMLElement): 'row' | 'column' | undefined {
  const style = readComputedMediaLayoutStyle(element);
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

function getClassMediaLayoutDirection(element: HTMLElement): 'row' | 'column' | undefined {
  if (element.classList.contains('r-18u37iz')) {
    return 'row';
  }
  if (element.classList.contains('r-eqz5dr')) {
    return 'column';
  }
  return undefined;
}

function getComputedBranchRatio(branch: HTMLElement, parent: HTMLElement, direction: 'row' | 'column'): string | undefined {
  const branchRect = branch.getBoundingClientRect();
  const parentRect = parent.getBoundingClientRect();
  const value = direction === 'row' ? branchRect.width : branchRect.height;
  const parentValue = direction === 'row' ? parentRect.width : parentRect.height;
  if (!Number.isFinite(value) || !Number.isFinite(parentValue) || value <= 0 || parentValue <= 0) {
    return undefined;
  }

  const ratio = value / parentValue;
  if (!Number.isFinite(ratio) || ratio <= 0 || ratio > 1.02) {
    return undefined;
  }

  return formatRatio(ratio);
}

function formatRatio(value: number): string {
  return String(Math.round(value * 10000) / 10000);
}

function extractBackgroundImageUrl(backgroundImage: string): string | null {
  const match = backgroundImage.match(/^url\(["']?(.*?)["']?\)$/);
  return match?.[1] ?? null;
}

function extractPaddingBottomAspectRatio(style: string): string | null {
  const match = /padding-bottom:\s*([0-9.]+)%/i.exec(style);
  if (!match) {
    return null;
  }

  const padding = Number(match[1]);
  if (!Number.isFinite(padding) || padding <= 0) {
    return null;
  }

  return String(Math.round((100 / padding) * 10000) / 10000);
}

function isHeadingElement(element: Element): boolean {
  return /^H[1-6]$/.test(element.tagName.toUpperCase()) || element.getAttribute('data-linelens-block-role') === 'heading';
}

function normalizeText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}
