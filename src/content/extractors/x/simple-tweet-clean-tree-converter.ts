import type { SimpleTweetBlock } from '../../../shared/article.js';
import { extractSimpleTweetBlockFromCleanTreeRoot, isSimpleTweetCard } from './simple-tweet.js';

export function isSimpleTweetElement(element: Element): boolean {
  return isSimpleTweetCard(element);
}

export function convertSimpleTweetElement(params: {
  element: Element;
  blockId: string;
  consumedElements: Set<Element>;
}): SimpleTweetBlock | null {
  const tweetRoot = params.element.matches('[data-testid="simpleTweet"]')
    ? params.element
    : params.element.querySelector('[data-testid="simpleTweet"]');
  if (!tweetRoot) {
    return null;
  }

  const block = extractSimpleTweetBlockFromCleanTreeRoot(params.element, params.blockId);
  if (!block) {
    return null;
  }

  params.consumedElements.add(params.element);
  params.consumedElements.add(tweetRoot);
  for (const ancestor of Array.from(rootBlockAncestors(tweetRoot))) {
    params.consumedElements.add(ancestor);
  }

  return block;
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
