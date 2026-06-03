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
  'capture-x-video-hls'
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

function extractBackgroundImageUrl(backgroundImage: string): string | null {
  const match = backgroundImage.match(/^url\(["']?(.*?)["']?\)$/);
  return match?.[1] ?? null;
}
