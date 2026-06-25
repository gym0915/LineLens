import type { Article, FocusUnit, SimpleTweetContentItem, TweetPhoto } from '../../shared/article-schema.js';

export interface MediaPreview {
  href: string;
  src: string;
  alt: string;
}

type MediaPreloadStatus = 'idle' | 'loading' | 'loaded' | 'failed';

type MediaPreloadEntry = {
  media: MediaPreview;
  status: MediaPreloadStatus;
  promise?: Promise<void>;
};

export type MediaPreviewState = {
  items: MediaPreview[];
  byHref: Map<string, MediaPreview>;
  preloads: Map<string, MediaPreloadEntry>;
  activeIndex: number;
  requestId: number;
  activePreloadCount: number;
  queue: MediaPreview[];
};

const MEDIA_PRELOAD_CONCURRENCY = 2;

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

function resolveMediaPreview(
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

export function createMediaPreviewState(article: Article): MediaPreviewState {
  const mediaPreviewState: MediaPreviewState = {
    items: [],
    byHref: new Map<string, MediaPreview>(),
    preloads: new Map<string, MediaPreloadEntry>(),
    activeIndex: -1,
    requestId: 0,
    activePreloadCount: 0,
    queue: []
  };

  if (article.coverImage?.href) {
    addMediaPreview(mediaPreviewState, {
      href: article.coverImage.href,
      src: upgradeXImageUrl(article.coverImage.src),
      alt: article.coverImage.alt ?? '图像'
    });
  }

  for (const block of article.blocks) {
    if (block.type === 'image' && block.href) {
      addMediaPreview(mediaPreviewState, {
        href: block.href,
        src: upgradeXImageUrl(block.src),
        alt: block.alt ?? '图像'
      });
      continue;
    }

    if (block.type === 'image-gallery') {
      for (const item of block.items) {
        if (!item.href) {
          continue;
        }
        addMediaPreview(mediaPreviewState, {
          href: item.href,
          src: upgradeXImageUrl(item.src),
          alt: item.alt ?? '图像'
        });
      }
    }

    if (block.type === 'simple-tweet') {
      addSimpleTweetMediaPreviews(mediaPreviewState, block.items);
    }
  }

  return mediaPreviewState;
}

function addSimpleTweetMediaPreviews(mediaPreviewState: MediaPreviewState, items: SimpleTweetContentItem[]): void {
  if (!Array.isArray(items)) {
    return;
  }

  for (const item of items) {
    if (item.type === 'photo') {
      addTweetPhotoMediaPreview(mediaPreviewState, item.photo);
    } else if (item.type === 'photo-group') {
      for (const photo of item.photos) {
        addTweetPhotoMediaPreview(mediaPreviewState, photo);
      }
    } else if (item.type === 'quoted-tweet') {
      addSimpleTweetMediaPreviews(mediaPreviewState, item.tweet.items);
    }
  }
}

function addTweetPhotoMediaPreview(mediaPreviewState: MediaPreviewState, photo: TweetPhoto): void {
  if (!photo.href) {
    return;
  }
  addMediaPreview(mediaPreviewState, {
    href: photo.href,
    src: upgradeXImageUrl(photo.src),
    alt: photo.alt ?? '图像'
  });
}

function addMediaPreview(mediaPreviewState: MediaPreviewState, media: MediaPreview): void {
  if (!findMediaPreviewByHref(mediaPreviewState, media.href)) {
    mediaPreviewState.items.push(media);
  }
  for (const key of getMediaHrefKeys(media.href)) {
    mediaPreviewState.byHref.set(key, media);
  }
}

function findMediaPreviewByHref(mediaPreviewState: MediaPreviewState, ...hrefs: string[]): MediaPreview | null {
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

function getMediaHrefKeys(href: string): string[] {
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

export function preloadMediaPreviews(mediaPreviewState: MediaPreviewState): void {
  for (const media of mediaPreviewState.items) {
    queueMediaPreload(mediaPreviewState, media);
  }
  pumpMediaPreloadQueue(mediaPreviewState);
}

function queueMediaPreload(mediaPreviewState: MediaPreviewState, media: MediaPreview): MediaPreloadEntry {
  const entry = getMediaPreloadEntry(mediaPreviewState, media);
  if (entry.status === 'idle' && !mediaPreviewState.queue.includes(media)) {
    mediaPreviewState.queue.push(media);
  }
  return entry;
}

function getMediaPreloadEntry(mediaPreviewState: MediaPreviewState, media: MediaPreview): MediaPreloadEntry {
  const existing = mediaPreviewState.preloads.get(media.src);
  if (existing) {
    return existing;
  }
  const entry: MediaPreloadEntry = { media, status: 'idle' };
  mediaPreviewState.preloads.set(media.src, entry);
  return entry;
}

function pumpMediaPreloadQueue(mediaPreviewState: MediaPreviewState): void {
  while (mediaPreviewState.activePreloadCount < MEDIA_PRELOAD_CONCURRENCY && mediaPreviewState.queue.length > 0) {
    const media = mediaPreviewState.queue.shift();
    if (!media) {
      return;
    }
    startMediaPreload(mediaPreviewState, media, false);
  }
}

function ensurePriorityMediaPreload(mediaPreviewState: MediaPreviewState, media: MediaPreview): MediaPreloadEntry {
  const entry = getMediaPreloadEntry(mediaPreviewState, media);
  if (entry.status === 'idle') {
    mediaPreviewState.queue = mediaPreviewState.queue.filter((queuedMedia) => queuedMedia.src !== media.src);
    startMediaPreload(mediaPreviewState, media, true);
  }
  return entry;
}

function startMediaPreload(mediaPreviewState: MediaPreviewState, media: MediaPreview, priority: boolean): MediaPreloadEntry {
  const entry = getMediaPreloadEntry(mediaPreviewState, media);
  if (entry.status === 'loading' || entry.status === 'loaded') {
    return entry;
  }

  entry.status = 'loading';
  if (!priority) {
    mediaPreviewState.activePreloadCount += 1;
  }

  entry.promise = new Promise<void>((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      entry.status = 'loaded';
      resolve();
    };
    image.onerror = () => {
      entry.status = 'failed';
      reject(new Error(`Failed to preload media: ${media.src}`));
    };
    image.src = media.src;
  }).finally(() => {
    if (!priority) {
      mediaPreviewState.activePreloadCount = Math.max(0, mediaPreviewState.activePreloadCount - 1);
      pumpMediaPreloadQueue(mediaPreviewState);
    }
  });

  entry.promise.catch(() => undefined);
  return entry;
}

function upgradeXImageUrl(src: string): string {
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


type MediaPreviewDirection = 'previous' | 'next' | null;

export function openMediaPreview(mediaPreviewState: MediaPreviewState, media: MediaPreview, root: HTMLElement, direction: MediaPreviewDirection = null): void {
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

function showMediaPreviewAtIndex(mediaPreviewState: MediaPreviewState, index: number, root: HTMLElement, direction: MediaPreviewDirection = null): boolean {
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
