import type { EmbedBlock, ImageBlock, ImageGalleryBlock, ImageGalleryItem } from '../../shared/article.js';

export type ImageCandidate = Pick<
  ImageBlock,
  | 'src'
  | 'srcset'
  | 'sizes'
  | 'displaySrc'
  | 'alt'
  | 'href'
  | 'aspectRatio'
  | 'backgroundSize'
  | 'backgroundPosition'
  | 'objectFit'
  | 'objectPosition'
>;

export type ImageMetadataResolver = (element: Element) => Pick<ImageBlock, 'aspectRatio' | 'objectFit' | 'objectPosition'>;

export function resolveImageCandidate(
  element: Element,
  options: {
    extractPlatformImageMetadata?: ImageMetadataResolver;
  } = {}
): ImageCandidate | null {
  const image = findImageElement(element);
  const picture = findPictureElement(element, image);
  const source = findPictureSource(picture);
  const srcset = firstNonEmpty(
    image ? getMediaAttribute(image, 'srcset') : undefined,
    source ? getMediaAttribute(source, 'srcset') : undefined
  );
  const sizes = firstNonEmpty(
    image ? getMediaAttribute(image, 'sizes') : undefined,
    source ? getMediaAttribute(source, 'sizes') : undefined
  );
  const src = firstNonEmpty(
    image?.currentSrc,
    image ? getMediaAttribute(image, 'src') : undefined,
    image ? getMediaAttribute(image, 'data-src') : undefined,
    image ? getMediaAttribute(image, 'data-original') : undefined,
    image ? firstSrcsetUrl(getMediaAttribute(image, 'srcset')) : undefined,
    source ? firstSrcsetUrl(getMediaAttribute(source, 'srcset')) : undefined,
    getMediaAttribute(element, 'src'),
    getMediaAttribute(element, 'data-src'),
    getMediaAttribute(element, 'data-original')
  );
  if (!src) {
    return null;
  }

  const metadataElement = image ?? element;
  const platformMetadata = options.extractPlatformImageMetadata?.(metadataElement) ?? {};
  const standardMetadata = extractStandardImageMetadata(metadataElement, platformMetadata);

  return {
    src,
    ...(srcset ? { srcset } : {}),
    ...(sizes ? { sizes } : {}),
    alt: firstNonEmpty(image ? getMediaAttribute(image, 'alt') : undefined, getMediaAttribute(element, 'alt')) ?? undefined,
    href: findClosestHref(image ?? element) ?? undefined,
    ...standardMetadata
  };
}

export function resolveImageGalleryElement(
  element: Element,
  blockId: string,
  options: {
    extractPlatformImageMetadata?: ImageMetadataResolver;
  } = {}
): ImageGalleryBlock | null {
  const items: ImageGalleryItem[] = [];
  const seen = new Set<string>();

  for (const image of findGalleryImageElements(element)) {
    const candidate = resolveImageCandidate(image, options);
    if (!candidate || seen.has(candidate.src)) {
      continue;
    }
    seen.add(candidate.src);
    items.push(candidate);
  }

  if (items.length < 2) {
    return null;
  }

  const aspectRatio = readPositiveNumberAttribute(element, 'data-linelens-media-aspect-ratio') ?? items[0]?.aspectRatio;
  return {
    id: blockId,
    type: 'image-gallery',
    items,
    ...(aspectRatio ? { aspectRatio } : {})
  };
}

export function resolveEmbedElement(element: Element, blockId: string): EmbedBlock | null {
  const embed = findEmbedSourceElement(element);
  if (!embed) {
    return null;
  }

  const href = firstNonEmpty(getMediaAttribute(embed, 'src'), getMediaAttribute(embed, 'data-src'));
  if (!href) {
    return null;
  }

  const provider = resolveEmbedProvider(href);
  const title = firstNonEmpty(
    getMediaAttribute(embed, 'title'),
    getMediaAttribute(embed, 'aria-label'),
    getMediaAttribute(element, 'title'),
    providerLabel(provider)
  );
  const poster = firstNonEmpty(
    getMediaAttribute(embed, 'poster'),
    getMediaAttribute(embed, 'data-poster'),
    getMediaAttribute(element, 'data-poster'),
    getMediaAttribute(embed, 'data-thumbnail'),
    getMediaAttribute(element, 'data-thumbnail')
  );

  return {
    id: blockId,
    type: 'embed',
    label: providerLabel(provider),
    provider,
    href,
    ...(title ? { title, text: title } : {}),
    ...(poster
      ? {
          media: [
            {
              type: 'image' as const,
              src: poster,
              href,
              alt: title,
              objectFit: 'cover' as const
            }
          ]
        }
      : {})
  };
}

function findImageElement(element: Element): HTMLImageElement | null {
  if (element.tagName.toUpperCase() === 'IMG') {
    return element as HTMLImageElement;
  }

  return element.querySelector<HTMLImageElement>('img');
}

function findPictureElement(element: Element, image: HTMLImageElement | null): HTMLPictureElement | null {
  if (element.tagName.toUpperCase() === 'PICTURE') {
    return element as HTMLPictureElement;
  }

  return image?.closest('picture') ?? element.querySelector<HTMLPictureElement>('picture');
}

function findPictureSource(picture: HTMLPictureElement | null): HTMLSourceElement | null {
  if (!picture) {
    return null;
  }

  return Array.from(picture.querySelectorAll<HTMLSourceElement>('source')).find((source) => getMediaAttribute(source, 'srcset')) ?? null;
}

function findGalleryImageElements(element: Element): HTMLImageElement[] {
  if (element.tagName.toUpperCase() === 'IMG') {
    return [element as HTMLImageElement];
  }

  return Array.from(element.querySelectorAll<HTMLImageElement>('img'));
}

function findEmbedSourceElement(element: Element): HTMLElement | null {
  if (isEmbedSourceElement(element)) {
    return element as HTMLElement;
  }

  return element.querySelector<HTMLElement>('iframe[src], iframe[data-src], embed[src], embed[data-src]');
}

function isEmbedSourceElement(element: Element): boolean {
  const tagName = element.tagName.toUpperCase();
  return (tagName === 'IFRAME' || tagName === 'EMBED') && Boolean(firstNonEmpty(getMediaAttribute(element, 'src'), getMediaAttribute(element, 'data-src')));
}

function getMediaAttribute(element: Element, attributeName: string): string | undefined {
  const value = element.getAttribute(attributeName)?.trim();
  return value ? value : undefined;
}

function findClosestHref(element: Element): string | null {
  return element.closest<HTMLAnchorElement>('a[href]')?.getAttribute('href') ?? null;
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

function readPositiveNumberAttribute(element: Element, attributeName: string): number | undefined {
  const value = Number(element.getAttribute(attributeName) ?? '');
  if (!Number.isFinite(value) || value <= 0) {
    return undefined;
  }

  return value;
}

function firstSrcsetUrl(srcset: string | undefined): string | undefined {
  const firstCandidate = srcset
    ?.split(',')
    .map((candidate) => candidate.trim())
    .find(Boolean);
  return firstCandidate?.split(/\s+/)[0];
}

function firstNonEmpty(...values: Array<string | undefined | null>): string | undefined {
  return values.find((value): value is string => Boolean(value?.trim()));
}

function resolveEmbedProvider(href: string): EmbedBlock['provider'] {
  try {
    const host = new URL(href).hostname.toLowerCase();
    if (host.includes('youtube.com') || host.includes('youtu.be')) {
      return 'youtube';
    }
    if (host === 'x.com' || host.endsWith('.x.com') || host.includes('twitter.com')) {
      return 'x';
    }
    if (host.includes('substack.com')) {
      return 'substack';
    }
  } catch {
    return 'generic';
  }

  return 'generic';
}

function providerLabel(provider: EmbedBlock['provider']): string {
  switch (provider) {
    case 'youtube':
      return 'YouTube';
    case 'x':
      return 'X';
    case 'substack':
      return 'Substack';
    case 'generic':
    default:
      return 'Embed';
  }
}
