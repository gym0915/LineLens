import type { MediaPreview, MediaPreviewState } from './media-preview-state.js';

export function resolveMediaPreview(
  link: HTMLAnchorElement | null | undefined,
  image: HTMLImageElement | null,
  mediaPreviewState: MediaPreviewState
): MediaPreview | null {
  const href = link?.href || link?.getAttribute('href') || '';
  const mappedPreview = findMediaPreviewByHref(mediaPreviewState, href, link?.getAttribute('href') ?? '');
  if (mappedPreview) {
    return mappedPreview;
  }

  const src = upgradeXImageUrl(image?.currentSrc || image?.src || image?.getAttribute('src') || '');
  if (!href || !src) {
    return null;
  }
  return {
    href,
    src,
    alt: image?.alt || link?.getAttribute('aria-label') || '图像'
  };
}

export function findMediaPreviewByHref(mediaPreviewState: MediaPreviewState, ...hrefs: string[]): MediaPreview | null {
  for (const href of hrefs) {
    for (const key of getMediaHrefKeys(href)) {
      const media = mediaPreviewState.byHref.get(key);
      if (media) {
        return media;
      }
    }
  }
  return null;
}

export function getMediaHrefKeys(href: string): string[] {
  if (!href) {
    return [];
  }

  const keys = new Set([href]);
  try {
    const url = new URL(href, window.location.href);
    keys.add(url.toString());
    keys.add(`${url.origin}${url.pathname}${url.search}`);
  } catch {
    // Keep the raw href for non-standard values; browser navigation will handle them elsewhere.
  }
  return [...keys];
}

export function upgradeXImageUrl(src: string): string {
  if (!src || !src.includes('pbs.twimg.com/media/')) {
    return src;
  }

  try {
    const url = new URL(src);
    url.searchParams.set('name', 'orig');
    return url.toString();
  } catch {
    return src.replace(/([?&]name=)[^&]+/, '$1orig');
  }
}
