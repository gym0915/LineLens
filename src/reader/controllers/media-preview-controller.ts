import type { FocusUnit } from '../../shared/article-schema.js';
import type { MediaPreview, MediaPreviewState } from './media-preview-state.js';
import { resolveMediaPreview } from './media-url-resolver.js';

export { createMediaPreviewState, preloadMediaPreviews } from './media-preview-state.js';
export type { MediaPreview, MediaPreviewState } from './media-preview-state.js';
export { handleMediaPreviewKeydown, openMediaPreview } from './media-preview-view.js';

export function getActiveMediaPreview(
  target: Element,
  focusElement: HTMLElement,
  activeUnit: FocusUnit | null,
  mediaPreviewState: MediaPreviewState
): MediaPreview | null {
  if (activeUnit?.unitId !== focusElement.dataset.unitId) {
    return null;
  }

  const blockType = focusElement.dataset.blockType;
  if (blockType === 'image') {
    const imageLink = target.closest<HTMLAnchorElement>('a.reader-media[href]');
    return resolveMediaPreview(imageLink, imageLink?.querySelector<HTMLImageElement>('img.reader-media-image') ?? null, mediaPreviewState);
  }

  if (blockType === 'image-gallery') {
    const galleryLink = target.closest<HTMLAnchorElement>('a.reader-image-gallery-item[href]');
    return resolveMediaPreview(galleryLink, galleryLink?.querySelector<HTMLImageElement>('img.reader-image-gallery-image') ?? null, mediaPreviewState);
  }

  return null;
}

export function getCoverMediaPreview(target: Element, mediaPreviewState: MediaPreviewState): MediaPreview | null {
  const coverLink = target.closest<HTMLAnchorElement>('a.reader-cover[href]');
  if (!coverLink) {
    return null;
  }
  return resolveMediaPreview(coverLink, coverLink.querySelector<HTMLImageElement>('img.reader-media-image') ?? null, mediaPreviewState);
}

export function logReaderMediaLinkClick(articleId: string, focusElement: HTMLElement, media: MediaPreview): void {
  const runtime = globalThis.chrome?.runtime;
  if (!runtime?.sendMessage) {
    return;
  }

  runtime.sendMessage({
    type: 'READER_MEDIA_LINK_CLICKED',
    articleId,
    blockId: focusElement.dataset.blockId,
    blockType: focusElement.dataset.blockType,
    unitId: focusElement.dataset.unitId,
    href: media.href,
    src: media.src,
    resolvedImageUrl: media.src,
    lookupSource: 'article'
  });
}
