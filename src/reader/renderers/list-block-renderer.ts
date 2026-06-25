import type { TextAnnotation, TextStyle } from '../../shared/article-schema.js';
import { createReaderTextSpan } from '../reader-text-renderer.js';

export function renderListBlock(
  blockId: string,
  items: string[],
  kind: 'ordered' | 'unordered' = 'unordered',
  itemAnnotations: TextAnnotation[][] = [],
  _itemTextStyles: TextStyle[] = []
): HTMLElement {
  const list = document.createElement(kind === 'ordered' ? 'ol' : 'ul');
  list.className = 'reader-block reader-list';
  list.dataset.blockId = blockId;
  list.dataset.blockType = 'list';

  items.forEach((text, index) => {
    const item = document.createElement('li');
    item.className = 'reader-list-item';
    item.dataset.listItemIndex = `${index}`;
    if (hasSourceOrderedListMarker(text)) {
      item.classList.add('reader-list-item--source-marker');
    }

    const bullet = document.createElement('span');
    bullet.className = 'reader-list-bullet';
    bullet.setAttribute('aria-hidden', 'true');
    bullet.textContent = kind === 'ordered' ? getOrderedListBullet(text, index) : '•';

    const content = document.createElement('span');
    content.className = 'reader-list-text';
    content.append(
      createReaderTextSpan(text, itemAnnotations[index] ?? [], {
        role: 'list-item'
      })
    );

    item.append(bullet, content);
    list.append(item);
  });

  return list;
}

function getOrderedListBullet(text: string, index: number): string {
  return hasSourceOrderedListMarker(text) ? '' : `${index + 1}.`;
}

function hasSourceOrderedListMarker(text: string): boolean {
  return /^\s*\d+\.\s+/.test(text);
}
