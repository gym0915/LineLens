import type { ImageBlock } from '../../../shared/article.js';

export type ImageBlockConverterDeps = {
  blockId: string;
  specialImageRootSelector?: string;
  convertSpecialImageElement(element: HTMLElement): ImageBlock | null;
  extractPlatformImageMetadata(element: Element): Pick<ImageBlock, 'aspectRatio' | 'objectFit' | 'objectPosition'>;
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

  const image = element.tagName.toUpperCase() === 'IMG' ? element : element.querySelector('img');
  const src = image?.getAttribute('src') ?? element.getAttribute('src');
  if (!src) {
    return null;
  }
  const imageMetadata = extractStandardImageMetadata(image ?? element, deps.extractPlatformImageMetadata(image ?? element));

  return {
    id: deps.blockId,
    type: 'image',
    src,
    ...(image?.getAttribute('srcset') ? { srcset: image.getAttribute('srcset') ?? undefined } : {}),
    ...(image?.getAttribute('sizes') ? { sizes: image.getAttribute('sizes') ?? undefined } : {}),
    alt: image?.getAttribute('alt') ?? element.getAttribute('alt') ?? undefined,
    href: element.closest('a')?.getAttribute('href') ?? undefined,
    ...imageMetadata
  };
}

function extractStandardImageMetadata(
  element: Element,
  platformMetadata: Pick<ImageBlock, 'aspectRatio' | 'objectFit' | 'objectPosition'>
): Pick<ImageBlock, 'aspectRatio' | 'objectFit' | 'objectPosition'> {
  const width = Number(element.getAttribute('width') ?? '');
  const height = Number(element.getAttribute('height') ?? '');
  const aspectRatio = toValidAspectRatio(width, height) ?? platformMetadata.aspectRatio;
  return {
    ...(aspectRatio ? { aspectRatio } : {}),
    ...(platformMetadata.objectFit ? { objectFit: platformMetadata.objectFit } : {}),
    ...(platformMetadata.objectPosition ? { objectPosition: platformMetadata.objectPosition } : {})
  };
}

function toValidAspectRatio(width: number, height: number): number | undefined {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return undefined;
  }

  const aspectRatio = width / height;
  if (!Number.isFinite(aspectRatio) || aspectRatio <= 0) {
    return undefined;
  }

  return Math.round(aspectRatio * 10000) / 10000;
}
