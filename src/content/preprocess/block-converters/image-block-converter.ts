import type { ImageBlock } from '../../../shared/article.js';
import { resolveImageCandidate } from '../media-resolver.js';

export type ImageBlockConverterDeps = {
  blockId: string;
  specialImageRootSelector?: string;
  convertSpecialImageElement(element: HTMLElement): ImageBlock | null;
  extractPlatformImageMetadata(element: Element): Pick<
    ImageBlock,
    'aspectRatio' | 'backgroundColor' | 'objectFit' | 'objectPosition' | 'visualBleedScale' | 'visualBleedMode'
  >;
};

export function convertImageElement(element: Element, deps: ImageBlockConverterDeps): ImageBlock | null {
  const specialImageRoot = deps.specialImageRootSelector
    ? element.matches(deps.specialImageRootSelector)
      ? (element as HTMLElement)
      : element.closest<HTMLElement>(deps.specialImageRootSelector)
    : null;
  if (specialImageRoot) {
    const specialImage = deps.convertSpecialImageElement(specialImageRoot);
    if (specialImage) {
      return specialImage;
    }
  }

  const candidate = resolveImageCandidate(element, {
    extractPlatformImageMetadata: deps.extractPlatformImageMetadata
  });
  if (!candidate) {
    return null;
  }

  return {
    id: deps.blockId,
    type: 'image',
    ...candidate
  };
}
