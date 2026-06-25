import type { ImageGalleryBlock, ImageGalleryLayoutNode } from '../../shared/article-schema.js';
import { applyMediaAspectRatio, renderMediaFrame } from './media-frame.js';

export function renderImageGalleryBlock(block: ImageGalleryBlock): HTMLElement {
  const figure = document.createElement('figure');
  figure.className = 'reader-block reader-media reader-image-gallery';
  figure.dataset.blockId = block.id;
  figure.dataset.blockType = 'image-gallery';
  applyMediaAspectRatio(figure, block.aspectRatio);

  const grid = document.createElement('div');
  grid.className = 'reader-image-gallery-grid';

  if (block.layout) {
    grid.append(renderImageGalleryLayoutNode(block.layout, block));
  } else {
    for (let index = 0; index < block.items.length; index += 1) {
      grid.append(renderImageGalleryItem(block, index));
    }
  }

  figure.append(grid);
  return figure;
}

function renderImageGalleryLayoutNode(node: ImageGalleryLayoutNode, block: ImageGalleryBlock): HTMLElement {
  if (node.type === 'item') {
    const itemElement = renderImageGalleryItem(block, node.itemIndex);
    applyImageGalleryFlexMetrics(itemElement, node);
    return itemElement;
  }

  const element = document.createElement('div');
  element.className = 'reader-image-gallery-node';
  element.dataset.layoutType = node.type;
  applyImageGalleryFlexMetrics(element, node);

  for (const child of node.children) {
    element.append(renderImageGalleryLayoutNode(child, block));
  }

  return element;
}

function renderImageGalleryItem(block: ImageGalleryBlock, index: number): HTMLElement {
  const item = block.items[index];
  const itemElement = item?.href ? document.createElement('a') : document.createElement('div');
  itemElement.className = 'reader-image-gallery-item';
  itemElement.dataset.itemIndex = String(index);
  if (!item) {
    itemElement.classList.add('is-missing');
    return itemElement;
  }
  if (item.href) {
    itemElement.setAttribute('href', item.href);
  }

  const frame = renderMediaFrame({
    src: item.src,
    displaySrc: item.displaySrc,
    alt: item.alt,
    backgroundSize: item.backgroundSize,
    backgroundPosition: item.backgroundPosition,
    objectFit: item.objectFit,
    objectPosition: item.objectPosition,
    imageClassName: 'reader-image-gallery-image',
    onError: () => {
      itemElement.classList.add('is-load-error');
      frame.remove();
    }
  });

  itemElement.append(frame);
  return itemElement;
}

function applyImageGalleryFlexMetrics(
  element: HTMLElement,
  node: Pick<ImageGalleryLayoutNode, 'grow' | 'shrink' | 'basis'>
): void {
  if (typeof node.grow === 'number') {
    element.style.flexGrow = String(node.grow);
  }
  if (typeof node.shrink === 'number') {
    element.style.flexShrink = String(node.shrink);
  }
  if (node.basis) {
    element.style.flexBasis = node.basis;
  }
}
