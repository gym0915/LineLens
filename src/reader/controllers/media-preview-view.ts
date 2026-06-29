import type { MediaPreview, MediaPreviewState } from './media-preview-state.js';
import { ensurePriorityMediaPreload } from './media-preview-state.js';

export type MediaPreviewDirection = 'previous' | 'next' | null;

export function openMediaPreview(
  mediaPreviewState: MediaPreviewState,
  media: MediaPreview,
  root: HTMLElement,
  direction: MediaPreviewDirection = null
): void {
  const viewer = ensureMediaPreview(root, mediaPreviewState);
  const mediaIndex = mediaPreviewState.items.indexOf(media);
  mediaPreviewState.activeIndex = mediaIndex >= 0 ? mediaIndex : mediaPreviewState.activeIndex;
  viewer.dataset.href = media.href;
  viewer.classList.add('is-visible');
  viewer.removeAttribute('aria-hidden');
  updateMediaPreviewNavState(viewer, mediaPreviewState);
  applyMediaPreviewEnterAnimation(viewer, direction);
  renderMediaPreviewImage(viewer, mediaPreviewState, media);
}

function applyMediaPreviewEnterAnimation(viewer: HTMLElement, direction: MediaPreviewDirection): void {
  viewer.classList.remove('is-entering-from-left', 'is-entering-from-right');
  if (!direction) {
    return;
  }

  viewer.getBoundingClientRect();
  viewer.classList.add(direction === 'previous' ? 'is-entering-from-left' : 'is-entering-from-right');
}

function renderMediaPreviewImage(viewer: HTMLElement, mediaPreviewState: MediaPreviewState, media: MediaPreview): void {
  const image = viewer.querySelector<HTMLImageElement>('.reader-media-preview-image');
  const status = viewer.querySelector<HTMLElement>('.reader-media-preview-status');
  const requestId = ++mediaPreviewState.requestId;
  const entry = ensurePriorityMediaPreload(mediaPreviewState, media);

  if (entry.status === 'loaded') {
    viewer.classList.remove('is-loading', 'is-load-error');
    if (status) status.textContent = '';
    if (image) {
      image.src = media.src;
      image.alt = media.alt;
      image.setAttribute('src', media.src);
      image.setAttribute('alt', media.alt);
    }
    return;
  }

  viewer.classList.add('is-loading');
  viewer.classList.remove('is-load-error');
  if (status) status.textContent = 'Loading...';
  if (image) {
    image.removeAttribute('src');
    image.alt = '';
    image.removeAttribute('alt');
  }

  entry.promise
    ?.then(() => {
      if (requestId !== mediaPreviewState.requestId || viewer.dataset.href !== media.href) return;
      viewer.classList.remove('is-loading', 'is-load-error');
      if (status) status.textContent = '';
      if (image) {
        image.src = media.src;
        image.alt = media.alt;
        image.setAttribute('src', media.src);
        image.setAttribute('alt', media.alt);
      }
    })
    .catch(() => {
      if (requestId !== mediaPreviewState.requestId || viewer.dataset.href !== media.href) return;
      viewer.classList.remove('is-loading');
      viewer.classList.add('is-load-error');
      if (status) status.textContent = '图片加载失败';
    });
}

function showMediaPreviewAtIndex(
  mediaPreviewState: MediaPreviewState,
  index: number,
  root: HTMLElement,
  direction: MediaPreviewDirection = null
): boolean {
  if (index < 0 || index >= mediaPreviewState.items.length) {
    return false;
  }
  openMediaPreview(mediaPreviewState, mediaPreviewState.items[index], root, direction);
  return true;
}

function showRelativeMediaPreview(mediaPreviewState: MediaPreviewState, delta: number, root: HTMLElement): boolean {
  return showMediaPreviewAtIndex(mediaPreviewState, mediaPreviewState.activeIndex + delta, root, delta < 0 ? 'previous' : 'next');
}

export function handleMediaPreviewKeydown(event: KeyboardEvent, mediaPreviewState: MediaPreviewState, root: HTMLElement): boolean {
  const viewer = document.querySelector<HTMLElement>('.reader-media-preview.is-visible');
  if (!viewer) {
    return false;
  }

  if (event.key === 'Escape') {
    event.preventDefault();
    closeMediaPreview(viewer);
    return true;
  }

  if (event.key === 'ArrowLeft') {
    event.preventDefault();
    showRelativeMediaPreview(mediaPreviewState, -1, root);
    return true;
  }

  if (event.key === 'ArrowRight') {
    event.preventDefault();
    showRelativeMediaPreview(mediaPreviewState, 1, root);
    return true;
  }

  return false;
}

function updateMediaPreviewNavState(viewer: HTMLElement, mediaPreviewState: MediaPreviewState): void {
  const previousButton = viewer.querySelector<HTMLButtonElement>('.reader-media-preview-prev');
  const nextButton = viewer.querySelector<HTMLButtonElement>('.reader-media-preview-next');
  if (previousButton) {
    previousButton.disabled = mediaPreviewState.activeIndex <= 0;
  }
  if (nextButton) {
    nextButton.disabled = mediaPreviewState.activeIndex < 0 || mediaPreviewState.activeIndex >= mediaPreviewState.items.length - 1;
  }
}

function ensureMediaPreview(root: HTMLElement, mediaPreviewState: MediaPreviewState): HTMLElement {
  const existing = document.querySelector<HTMLElement>('.reader-media-preview');
  if (existing) {
    return existing;
  }

  const viewer = document.createElement('div');
  viewer.className = 'reader-media-preview';
  viewer.setAttribute('role', 'dialog');
  viewer.setAttribute('aria-label', '媒体预览');
  viewer.setAttribute('aria-hidden', 'true');
  viewer.addEventListener('click', (event) => {
    if (event.target === viewer) {
      closeMediaPreview(viewer);
    }
  });

  const closeButton = document.createElement('button');
  closeButton.className = 'reader-media-preview-close';
  closeButton.type = 'button';
  closeButton.setAttribute('aria-label', '关闭媒体预览');
  closeButton.textContent = '×';
  closeButton.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    closeMediaPreview(viewer);
  });

  const previousButton = document.createElement('button');
  previousButton.className = 'reader-media-preview-nav reader-media-preview-prev';
  previousButton.type = 'button';
  previousButton.setAttribute('aria-label', '上一张图片');
  previousButton.textContent = '←';
  previousButton.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    showRelativeMediaPreview(mediaPreviewState, -1, root);
  });

  const nextButton = document.createElement('button');
  nextButton.className = 'reader-media-preview-nav reader-media-preview-next';
  nextButton.type = 'button';
  nextButton.setAttribute('aria-label', '下一张图片');
  nextButton.textContent = '→';
  nextButton.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    showRelativeMediaPreview(mediaPreviewState, 1, root);
  });

  const image = document.createElement('img');
  image.className = 'reader-media-preview-image';
  image.alt = '图像';
  image.loading = 'eager';
  image.decoding = 'async';

  const status = document.createElement('div');
  status.className = 'reader-media-preview-status';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');

  viewer.append(closeButton, previousButton, image, status, nextButton);

  const mountPoint = document.body ?? root;
  mountPoint.append(viewer);
  return viewer;
}

function closeMediaPreview(viewer: HTMLElement): void {
  viewer.classList.remove('is-visible', 'is-loading', 'is-load-error', 'is-entering-from-left', 'is-entering-from-right');
  viewer.setAttribute('aria-hidden', 'true');
}
