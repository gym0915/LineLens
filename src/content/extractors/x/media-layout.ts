import type { ImageBlock, ImageGalleryBlock } from '../../../shared/article.js';

const X_CANONICAL_ORIGIN = 'https://x.com';

export function xMediaElementToImageBlock(element: HTMLElement, blockId: string): ImageBlock | null {
  const image = element.querySelector<HTMLImageElement>('img');
  const displaySrc = getXMediaBackgroundUrl(element);
  const src = image?.currentSrc || image?.src || image?.getAttribute('src') || displaySrc;
  if (!src) {
    return null;
  }

  const ratioRoot = element.closest('[data-block="true"]') ?? element.closest('a') ?? element;
  const frameAspectRatio = getXMediaAspectRatio(ratioRoot);
  const aspectRatio = frameAspectRatio ?? (image ? getXImageAspectRatio(image) : undefined);
  const href = element.closest('a[href]')?.getAttribute('href') ?? undefined;
  return {
    id: blockId,
    type: 'image',
    src,
    ...(displaySrc ? { displaySrc } : {}),
    alt: image?.alt || image?.getAttribute('alt') || undefined,
    ...(href ? { href: toAbsoluteXUrl(href) } : {}),
    ...(aspectRatio ? { aspectRatio } : {}),
    backgroundSize: 'cover',
    backgroundPosition: 'center center',
    objectFit: 'cover',
    objectPosition: 'center center'
  };
}

export function xMediaGalleryElementToBlock(element: Element, blockId: string): ImageGalleryBlock | null {
  const photos = Array.from(element.querySelectorAll<HTMLElement>('[data-testid="tweetPhoto"]'))
    .map((photo) => xMediaElementToGalleryItem(photo))
    .filter((item): item is ImageGalleryBlock['items'][number] => Boolean(item));

  if (photos.length <= 1) {
    return null;
  }

  return {
    id: blockId,
    type: 'image-gallery',
    items: photos,
    ...(getXMediaAspectRatio(element) ? { aspectRatio: getXMediaAspectRatio(element) } : {})
  };
}

export function getXMediaElementsToConsume(element: Element): Element[] {
  return Array.from(element.querySelectorAll('[data-testid="tweetPhoto"]'));
}

function xMediaElementToGalleryItem(element: HTMLElement): ImageGalleryBlock['items'][number] | null {
  const image = element.querySelector<HTMLImageElement>('img');
  const displaySrc = getXMediaBackgroundUrl(element);
  const src = image?.currentSrc || image?.src || displaySrc;
  if (!src) {
    return null;
  }

  const href = element.closest('a[href]')?.getAttribute('href') ?? undefined;
  const aspectRatio = image ? getXImageAspectRatio(image) : undefined;
  return {
    src,
    ...(displaySrc ? { displaySrc } : {}),
    alt: image?.alt || undefined,
    ...(href ? { href: toAbsoluteXUrl(href) } : {}),
    ...(aspectRatio ? { aspectRatio } : {})
  };
}

export function getXMediaBackgroundLayer(element: Element): HTMLElement | null {
  return element.querySelector<HTMLElement>('[style*="background-image"]');
}

export function getXMediaBackgroundUrl(element: Element): string {
  const backgroundLayer = getXMediaBackgroundLayer(element);
  const style = backgroundLayer?.style.backgroundImage || backgroundLayer?.getAttribute('style') || '';
  const match = /url\((?:"|&quot;)?([^")]+)(?:"|&quot;)?\)/.exec(style);
  return match?.[1]?.replace(/&amp;/g, '&') ?? '';
}

export function getXMediaAspectRatio(element: Element): number | undefined {
  const descendantPreservedRatio = getDescendantPreservedMediaAspectRatio(element);
  if (descendantPreservedRatio) {
    return descendantPreservedRatio;
  }

  const descendantRatio = getDescendantPaddingBottomAspectRatio(element);
  if (descendantRatio) {
    return descendantRatio;
  }

  for (let current: Element | null = element; current; current = current.parentElement) {
    const preservedRatio = getPreservedMediaAspectRatio(current);
    if (preservedRatio) {
      return preservedRatio;
    }

    const paddingRatio = getPaddingBottomAspectRatio(current);
    if (paddingRatio) {
      return paddingRatio;
    }
  }

  return undefined;
}

function getDescendantPreservedMediaAspectRatio(element: Element): number | undefined {
  for (const child of Array.from(element.querySelectorAll<HTMLElement>('[data-linelens-media-aspect-ratio]'))) {
    const ratio = getPreservedMediaAspectRatio(child);
    if (ratio) {
      return ratio;
    }
  }

  return undefined;
}

function getPreservedMediaAspectRatio(element: Element): number | undefined {
  const ratio = Number(element.getAttribute('data-linelens-media-aspect-ratio'));
  return Number.isFinite(ratio) && ratio > 0 ? ratio : undefined;
}

function getDescendantPaddingBottomAspectRatio(element: Element): number | undefined {
  for (const child of Array.from(element.querySelectorAll<HTMLElement>('[style*="padding-bottom"]'))) {
    const paddingBottom = getInlinePaddingBottomPercent(child);
    if (paddingBottom) {
      return roundAspectRatio(100 / paddingBottom);
    }
  }

  return undefined;
}

export function getXImageAspectRatio(image: HTMLImageElement): number | undefined {
  return toValidAspectRatio(image.naturalWidth, image.naturalHeight);
}

function getPaddingBottomAspectRatio(element: Element): number | undefined {
  for (const child of Array.from(element.children)) {
    const paddingBottom = getInlinePaddingBottomPercent(child);
    if (paddingBottom) {
      return roundAspectRatio(100 / paddingBottom);
    }
  }

  return undefined;
}

function getInlinePaddingBottomPercent(element: Element): number | undefined {
  const inlinePaddingBottom = (element as HTMLElement).style?.paddingBottom;
  const match = inlinePaddingBottom
    ? /^([0-9.]+)%$/i.exec(inlinePaddingBottom.trim())
    : /(?:^|;)\s*padding-bottom:\s*([0-9.]+)%/i.exec(element.getAttribute('style') ?? '');
  if (!match) {
    return undefined;
  }

  const value = Number(match[1]);
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

function toValidAspectRatio(width: number, height: number): number | undefined {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return undefined;
  }

  return roundAspectRatio(width / height);
}

function roundAspectRatio(value: number): number {
  return Math.round(value * 10000) / 10000;
}

function toAbsoluteXUrl(href: string): string {
  return new URL(href, X_CANONICAL_ORIGIN).toString();
}
