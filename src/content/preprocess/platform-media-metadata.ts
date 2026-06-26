import type { ImageBlock, ImageGalleryBlock } from '../../shared/article.js';
import type { PlatformAdapter } from '../adapters/index.js';
import { extractSubstackImageUrlMetadata } from '../extractors/substack/image-metadata.js';
import {
  getXMediaElementsToConsume,
  xMediaElementToImageBlock,
  xMediaGalleryElementToBlock
} from '../extractors/x/media-layout.js';

export function extractPlatformImageMetadata(
  adapter: PlatformAdapter,
  element: Element
): Pick<ImageBlock, 'aspectRatio' | 'objectFit' | 'objectPosition'> {
  const src = element.getAttribute('src') ?? '';
  if (!src) {
    return {};
  }

  if (adapter.platform === 'substack') {
    return extractSubstackImageUrlMetadata(src);
  }

  return {};
}

export function convertPlatformSpecialImageElement(
  adapter: PlatformAdapter,
  element: HTMLElement,
  blockId: string
): ImageBlock | null {
  if (adapter.platform === 'x') {
    return xMediaElementToImageBlock(element, blockId);
  }

  return null;
}

export function convertPlatformImageGalleryElement(
  adapter: PlatformAdapter,
  element: Element,
  blockId: string
): ImageGalleryBlock | null {
  if (adapter.platform === 'x') {
    return xMediaGalleryElementToBlock(element, blockId);
  }

  return null;
}

export function getPlatformImageGalleryConsumedElements(adapter: PlatformAdapter, element: Element): Element[] {
  if (adapter.platform === 'x') {
    return getXMediaElementsToConsume(element);
  }

  return [];
}
