import type { ImageBlock } from '../../shared/article.js';
import type { PlatformAdapter } from '../adapters/index.js';
import { extractSubstackImageUrlMetadata } from '../extractors/substack/image-metadata.js';

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
