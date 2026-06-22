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
  'data-linelens-media-layout-height',
  'data-linelens-media-layout-direction',
  'data-linelens-media-layout-width',
  'data-linelens-video-hls-candidate',
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
    if (shouldRemoveElement(element)) {
      element.remove();
      removedNodeCount += 1;
    }
  }

  const retainedElements = [root, ...Array.from(root.querySelectorAll('*'))];
  for (const element of retainedElements) {
    preserveListSemantics(element);

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

function shouldRemoveElement(element: Element): boolean {
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
