import type { PlatformAdapter } from '../adapters/adapter-types.js';
import { applyPlatformFixes, type PlatformFixesResult } from './apply-platform-fixes.js';
import { applyStyleWhitelistToTree } from './style-whitelist.js';

export type CleanTreeContext = {
  platform: string;
  sourceUrl: string;
  adapter: PlatformAdapter;
  debugId: string;
};

export type CloneContentTreeResult = {
  root: Element;
  context: CleanTreeContext;
  removedNodeCount: number;
  strippedAttributeCount: number;
  preservedAttributeCount: number;
  platformFixes: PlatformFixesResult;
};

export type CleanTreeDebugSnapshot = {
  debugId: string;
  platform: string;
  sourceUrl: string;
  rootTagName: string;
  titleCount: number;
  paragraphCount: number;
  quoteCount: number;
  listItemCount: number;
  imageCount: number;
  linkCount: number;
  classAttributeCount: number;
  scriptLikeCount: number;
  interactiveShellCount: number;
  platformFixes: PlatformFixesResult;
};

const REMOVED_TAG_NAMES = new Set([
  'SCRIPT',
  'STYLE',
  'NOSCRIPT',
  'BUTTON',
  'INPUT',
  'TEXTAREA',
  'SELECT',
  'OPTION',
  'SVG'
]);

const PRESERVED_ATTRIBUTE_NAMES = new Set([
  'alt',
  'aria-label',
  'contenteditable',
  'datetime',
  'dir',
  'href',
  'lang',
  'rel',
  'role',
  'src',
  'srcset',
  'sizes',
  'style',
  'target',
  'title'
]);

const PRESERVED_DATA_ATTRIBUTES = new Set([
  'data-block',
  'data-editor',
  'data-linelens-block-role',
  'data-linelens-emoji-image-url',
  'data-linelens-fix-folded-tweet-text',
  'data-linelens-heading-level',
  'data-linelens-list-kind',
  'data-linelens-media-aspect-ratio',
  'data-linelens-media-cover-url',
  'data-linelens-media-layout-height',
  'data-linelens-media-layout-direction',
  'data-linelens-media-layout-width',
  'data-linelens-video-hls-candidate',
  'data-original',
  'data-poster',
  'data-src',
  'data-srcset',
  'data-thumbnail',
  'data-offset-key',
  'data-testid',
  'data-text'
]);

const INTERACTIVE_TEST_IDS = new Set([
  'bookmark',
  'like',
  'reply',
  'retweet',
  'unlike'
]);

export function createCleanTreeContext(params: {
  adapter: PlatformAdapter;
  sourceUrl: string;
  debugId?: string;
}): CleanTreeContext {
  return {
    adapter: params.adapter,
    debugId: params.debugId ?? `${params.adapter.id}:${new URL(params.sourceUrl).hostname}`,
    platform: params.adapter.platform,
    sourceUrl: params.sourceUrl
  };
}

export function cloneContentTree(root: Element, context: CleanTreeContext): CloneContentTreeResult {
  const clonedRoot = root.cloneNode(true);
  if (!(clonedRoot instanceof Element)) {
    throw new Error('cloneContentTree expected an Element root clone');
  }

  const platformFixes = applyPlatformFixes(clonedRoot, context.adapter, context);
  const stats = sanitizeElementTree(clonedRoot, context.adapter);

  return {
    context,
    platformFixes,
    root: clonedRoot,
    ...stats
  };
}

export function buildCleanTreeDebugSnapshot(result: CloneContentTreeResult): CleanTreeDebugSnapshot {
  const { root, context } = result;

  return {
    debugId: context.debugId,
    platform: context.platform,
    sourceUrl: context.sourceUrl,
    rootTagName: root.tagName.toLowerCase(),
    titleCount: context.adapter.titleSelector ? root.querySelectorAll(context.adapter.titleSelector).length : 0,
    paragraphCount: root.querySelectorAll('[data-block="true"]').length,
    quoteCount: root.querySelectorAll('[data-testid="tweet"], [data-testid="simpleTweet"], blockquote').length,
    listItemCount: root.querySelectorAll('li, [data-linelens-list-kind]').length,
    imageCount: root.querySelectorAll('img, [data-testid="tweetPhoto"]').length,
    linkCount: root.querySelectorAll('a[href], [role="link"]').length,
    classAttributeCount: root.querySelectorAll('[class]').length + (root.hasAttribute('class') ? 1 : 0),
    scriptLikeCount: root.querySelectorAll('script, style, noscript').length,
    interactiveShellCount: root.querySelectorAll('button, input, textarea, select, [role="button"]').length,
    platformFixes: result.platformFixes
  };
}

function sanitizeElementTree(root: Element, adapter: PlatformAdapter): {
  removedNodeCount: number;
  strippedAttributeCount: number;
  preservedAttributeCount: number;
} {
  let removedNodeCount = 0;
  let strippedAttributeCount = 0;
  let preservedAttributeCount = 0;

  const elements = Array.from(root.querySelectorAll('*'));
  for (const element of elements) {
    if (shouldRemoveElement(element, adapter)) {
      element.remove();
      removedNodeCount += 1;
    }
  }

  for (const element of Array.from(root.querySelectorAll('*'))) {
    if (matchesAnySelector(element, adapter.cleanRules?.unwrapSelectors)) {
      unwrapElement(element);
    }
  }

  const retainedElements = [root, ...Array.from(root.querySelectorAll('*'))];
  for (const element of retainedElements) {
    preserveListSemantics(element);
    preserveSpecialComponentLayoutSemantics(element);

    for (const attribute of Array.from(element.attributes)) {
      if (shouldPreserveAttribute(attribute.name, adapter)) {
        preservedAttributeCount += 1;
        continue;
      }

      element.removeAttribute(attribute.name);
      strippedAttributeCount += 1;
    }
  }

  applyStyleWhitelistToTree(root, adapter.styleWhitelist);

  return {
    preservedAttributeCount,
    removedNodeCount,
    strippedAttributeCount
  };
}

function preserveListSemantics(element: Element): void {
  if (element.classList.contains('public-DraftStyleDefault-orderedListItem')) {
    element.setAttribute('data-linelens-list-kind', 'ordered');
    return;
  }

  if (element.classList.contains('public-DraftStyleDefault-unorderedListItem')) {
    element.setAttribute('data-linelens-list-kind', 'unordered');
  }
}

function preserveSpecialComponentLayoutSemantics(element: Element): void {
  if (element.getAttribute('data-component-name') === 'VideoEmbedPlayer') {
    const ratioSource = element.querySelector('[style*="padding-bottom"]');
    const aspectRatio = extractPaddingBottomAspectRatio(ratioSource?.getAttribute('style') ?? '');
    if (aspectRatio) {
      element.setAttribute('data-linelens-media-aspect-ratio', aspectRatio);
    }
  }

  if (element.tagName.toUpperCase() === 'AUDIO' && element.getAttribute('src')) {
    const coverUrl = findNearestBackgroundImageUrl(element);
    if (coverUrl) {
      element.setAttribute('data-linelens-media-cover-url', coverUrl);
    }
  }
}

function shouldRemoveElement(element: Element, adapter: PlatformAdapter): boolean {
  if (shouldRetainSpecialComponentInteractiveMetadata(element)) {
    return false;
  }

  if (matchesAnySelector(element, adapter.cleanRules?.removeSelectors)) {
    return true;
  }

  const tagName = element.tagName.toUpperCase();
  if (REMOVED_TAG_NAMES.has(tagName)) {
    return true;
  }

  if (element.getAttribute('role') === 'button') {
    return true;
  }

  const testId = element.getAttribute('data-testid');
  return testId !== null && INTERACTIVE_TEST_IDS.has(testId);
}

function shouldRetainSpecialComponentInteractiveMetadata(element: Element): boolean {
  const tagName = element.tagName.toUpperCase();
  if (tagName !== 'BUTTON') {
    return false;
  }

  const componentRoot = element.closest('[data-component-name="SubscribeWidget"], [data-component-name="Paywall"], [data-testid="paywall"]');
  return componentRoot !== null && Boolean(element.getAttribute('data-href') || (element.textContent ?? '').replace(/\s+/g, ' ').trim());
}

function extractPaddingBottomAspectRatio(style: string): string | null {
  const match = style.match(/padding-bottom\s*:\s*([0-9.]+)%/i);
  if (!match) {
    return null;
  }

  const percentage = Number(match[1]);
  if (!Number.isFinite(percentage) || percentage <= 0) {
    return null;
  }

  return String(Math.round((100 / percentage) * 10000) / 10000);
}

function findNearestBackgroundImageUrl(element: Element): string | null {
  let current: Element | null = element.parentElement;
  for (let depth = 0; current && depth < 6; depth += 1) {
    const candidate = current.querySelector('[style*="background-image"]') ?? (current.matches('[style*="background-image"]') ? current : null);
    const style = candidate?.getAttribute('style') ?? '';
    const match = /background-image\s*:\s*url\((['"]?)(.*?)\1\)/i.exec(style);
    if (match?.[2]) {
      return match[2];
    }
    current = current.parentElement;
  }
  return null;
}

function matchesAnySelector(element: Element, selectors: string[] | undefined): boolean {
  for (const selector of selectors ?? []) {
    try {
      if (selector && element.matches(selector)) {
        return true;
      }
    } catch {
      continue;
    }
  }

  return false;
}

function unwrapElement(element: Element): void {
  const parent = element.parentNode;
  if (!parent) {
    return;
  }

  while (element.firstChild) {
    parent.insertBefore(element.firstChild, element);
  }
  element.remove();
}

function shouldPreserveAttribute(name: string, adapter: PlatformAdapter): boolean {
  const normalizedName = name.toLowerCase();
  if (adapter.cleanRules?.preserveAttributeNames?.map((attributeName) => attributeName.toLowerCase()).includes(normalizedName)) {
    return true;
  }

  if (PRESERVED_ATTRIBUTE_NAMES.has(normalizedName)) {
    return true;
  }

  return PRESERVED_DATA_ATTRIBUTES.has(normalizedName);
}
