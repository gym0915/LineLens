import { registerSpecialComponentHandler } from '../configurable/special-component-handlers.js';
import { convertSimpleTweetElement } from './simple-tweet-clean-tree-converter.js';

export function registerXSimpleTweetHandler(): void {
  registerSpecialComponentHandler({
    handlerId: 'x.simple-tweet',
    extract(root, context) {
      return convertSimpleTweetElement({
        element: root,
        blockId: `${context.debugId}:clean-block-${context.index}`,
        consumedElements: new Set<Element>()
      });
    }
  });
}
