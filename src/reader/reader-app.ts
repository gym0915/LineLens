import { cleanupRenderedMedia, renderArticleShell } from './block-renderer.js';
import { buildFocusUnits } from './focus-unit-builder.js';
import { FocusEngine } from './focus-engine.js';
import { HighlightLayer } from './highlight-layer.js';
import { ProgressStore } from './progress-store.js';
import type { Article, FocusUnit, SimpleTweetContentItem, TweetPhoto } from '../shared/article-schema.js';

export function mountReaderApp(root: HTMLElement, article: Article): void {
  cleanupRenderedMedia(root);
  root.textContent = '';

  const articleElement = renderArticleShell(article);
  const status = document.createElement('footer');
  status.className = 'reader-status';
  const toast = document.createElement('div');
  toast.className = 'reader-toast';
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');
  const hint = document.createElement('p');
  hint.className = 'reader-hint';
  hint.textContent = '使用 ← → 逐步阅读，Home / End 跳到首尾';

  root.append(articleElement, hint, status, toast);

  const { units, elements } = buildFocusUnits(article, articleElement);
  const highlightLayer = new HighlightLayer();
  highlightLayer.mount(root);
  const progressStore = new ProgressStore();
  const savedProgress = progressStore.get(article.id);
  const initialIndex = resolveInitialIndex(savedProgress?.unitId, units);
  let activeUnit: FocusUnit | null = null;
  let activeIndex: number | null = null;
  let hasRenderedInitialFocus = false;
  let refreshFrame = 0;
  const mediaPreviewState = createMediaPreviewState(article);
  preloadMediaPreviews(mediaPreviewState);

  const engine = new FocusEngine(units, (unit, index) => {
    const shouldScroll = hasRenderedInitialFocus && index !== activeIndex;
    activeUnit = unit;
    activeIndex = index;
    highlightLayer.update(unit, elements, { scroll: shouldScroll });
    hasRenderedInitialFocus = true;
    progressStore.save({
      articleId: article.id,
      unitId: unit.unitId,
      focusIndex: index,
      updatedAt: Date.now()
    });
    status.textContent = formatReadingStatus(units, index);
  });
  engine.setAnchorMode('free');

  root.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }

    const copyButton = target.closest<HTMLButtonElement>('button[data-copy-code]');
    if (copyButton) {
      event.preventDefault();
      event.stopPropagation();
      void copyCodeToClipboard(copyButton.dataset.copyCode ?? '', toast);
      return;
    }

    const coverPreview = getCoverMediaPreview(target, mediaPreviewState);
    if (coverPreview) {
      event.preventDefault();
      event.stopPropagation();
      hideHint(hint);
      openMediaPreview(mediaPreviewState, coverPreview, root);
      return;
    }

    const focusElement = target.closest<HTMLElement>('[data-unit-id]');
    if (!focusElement?.dataset.unitId) {
      return;
    }

    const index = units.findIndex((unit) => unit.unitId === focusElement.dataset.unitId);
    if (index >= 0) {
      const mediaPreview = getActiveMediaPreview(target, focusElement, activeUnit, mediaPreviewState);
      if (mediaPreview) {
        event.preventDefault();
        event.stopPropagation();
        hideHint(hint);
        logReaderMediaLinkClick(article.id, focusElement, mediaPreview);
        openMediaPreview(mediaPreviewState, mediaPreview, root);
        return;
      }

      const shouldNavigateBlock = shouldNavigateBlockHref(target, focusElement, activeUnit);
      if (shouldSelectBlockLinkBeforeNavigation(target, focusElement, activeUnit)) {
        event.preventDefault();
        event.stopPropagation();
      }
      hideHint(hint);
      engine.setIndex(index);
      if (shouldNavigateBlock) {
        event.preventDefault();
        event.stopPropagation();
        openBlockHref(focusElement.dataset.href ?? '');
      }
    }
  });

  window.addEventListener('keydown', (event) => {
    if (handleMediaPreviewKeydown(event, mediaPreviewState, root)) {
      return;
    }

    if (shouldIgnoreKeydown(event)) {
      return;
    }

    if (event.key === 'ArrowRight') {
      event.preventDefault();
      hideHint(hint);
      engine.next();
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      hideHint(hint);
      engine.previous();
    } else if (event.key === 'Home') {
      event.preventDefault();
      hideHint(hint);
      engine.first();
    } else if (event.key === 'End') {
      event.preventDefault();
      hideHint(hint);
      engine.last();
    } else if (event.key === 'h' || event.key === 'H') {
      event.preventDefault();
      hideHint(hint);
      engine.first();
    } else if (event.key === 'e' || event.key === 'E') {
      event.preventDefault();
      hideHint(hint);
      engine.last();
    }
  });

  engine.start(initialIndex);

  const scheduleHighlightRefresh = () => {
    if (refreshFrame) {
      return;
    }

    refreshFrame = window.requestAnimationFrame(() => {
      refreshFrame = 0;
      if (activeUnit) {
        highlightLayer.refresh(activeUnit, elements);
      }
    });
  };

  window.addEventListener('resize', scheduleHighlightRefresh);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      scheduleHighlightRefresh();
    }
  });
  document.fonts?.ready.then(scheduleHighlightRefresh).catch(() => undefined);

  articleElement.querySelectorAll('img').forEach((image) => {
    image.addEventListener('load', scheduleHighlightRefresh);
    image.addEventListener('error', scheduleHighlightRefresh);
  });

  window.addEventListener(
    'pagehide',
    () => {
      cleanupRenderedMedia(articleElement);
    },
    { once: true }
  );
}

async function copyCodeToClipboard(text: string, toast: HTMLElement): Promise<void> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      copyCodeWithFallback(text);
    }
    showToast(toast, '代码已复制');
  } catch {
    try {
      copyCodeWithFallback(text);
      showToast(toast, '代码已复制');
    } catch {
      showToast(toast, '复制失败');
    }
  }
}

function copyCodeWithFallback(text: string): void {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', 'true');
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  textarea.style.top = '0';
  document.body.append(textarea);
  textarea.select();
  document.execCommand('copy');
  textarea.remove();
}

function showToast(toast: HTMLElement, message: string): void {
  toast.textContent = message;
  toast.classList.add('is-visible');
  window.setTimeout(() => {
    toast.classList.remove('is-visible');
  }, 1600);
}

function resolveInitialIndex(unitId: string | undefined, units: FocusUnit[]): number {
  if (!unitId) {
    return 0;
  }

  const index = units.findIndex((unit) => unit.unitId === unitId);
  return index >= 0 ? index : 0;
}

interface MediaPreview {
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

type MediaPreviewState = {
  items: MediaPreview[];
  byHref: Map<string, MediaPreview>;
  preloads: Map<string, MediaPreloadEntry>;
  activeIndex: number;
  requestId: number;
  activePreloadCount: number;
  queue: MediaPreview[];
};

const MEDIA_PRELOAD_CONCURRENCY = 2;

function getActiveMediaPreview(
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

function getCoverMediaPreview(target: Element, mediaPreviewState: MediaPreviewState): MediaPreview | null {
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

function createMediaPreviewState(article: Article): MediaPreviewState {
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

function preloadMediaPreviews(mediaPreviewState: MediaPreviewState): void {
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

function shouldSelectBlockLinkBeforeNavigation(target: Element, focusElement: HTMLElement, activeUnit: FocusUnit | null): boolean {
  if (activeUnit?.unitId === focusElement.dataset.unitId) {
    return false;
  }

  const blockType = focusElement.dataset.blockType;
  if (blockType === 'simple-tweet') {
    if (isSimpleTweetVideoInteractionTarget(target)) {
      return false;
    }
    return Boolean(target.closest('a.reader-simple-tweet[href]') || focusElement.dataset.href);
  }
  if (blockType === 'image') {
    return Boolean(target.closest('a.reader-media[href]'));
  }
  if (blockType === 'image-gallery') {
    return Boolean(target.closest('a.reader-image-gallery-item[href]'));
  }

  return false;
}

type MediaPreviewDirection = 'previous' | 'next' | null;

function openMediaPreview(mediaPreviewState: MediaPreviewState, media: MediaPreview, root: HTMLElement, direction: MediaPreviewDirection = null): void {
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
  if (status) status.textContent = '图片加载中...';
  if (image) {
    image.removeAttribute('src');
    image.alt = media.alt;
    image.setAttribute('alt', media.alt);
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

function handleMediaPreviewKeydown(event: KeyboardEvent, mediaPreviewState: MediaPreviewState, root: HTMLElement): boolean {
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

function logReaderMediaLinkClick(articleId: string, focusElement: HTMLElement, media: MediaPreview): void {
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

function shouldNavigateBlockHref(target: Element, focusElement: HTMLElement, activeUnit: FocusUnit | null): boolean {
  if (activeUnit?.unitId !== focusElement.dataset.unitId) {
    return false;
  }
  if (focusElement.dataset.blockType !== 'simple-tweet') {
    return false;
  }
  if (!focusElement.dataset.href) {
    return false;
  }
  if (isSimpleTweetVideoInteractionTarget(target)) {
    return false;
  }
  return !target.closest('a[href]');
}

function isSimpleTweetVideoInteractionTarget(target: Element): boolean {
  for (let current: Element | null = target; current; current = current.parentElement) {
    const blockType = current.getAttribute('data-block-type');
    if (
      current.tagName === 'VIDEO' ||
      current.tagName === 'BUTTON' ||
      current.tagName === 'INPUT' ||
      current.getAttribute('role') === 'slider' ||
      current.classList.contains('reader-video-media') ||
      current.classList.contains('reader-video-player') ||
      blockType === 'simple-tweet-video' ||
      blockType === 'video'
    ) {
      return true;
    }
  }
  return false;
}

function openBlockHref(href: string): void {
  if (!href) {
    return;
  }

  if (typeof window.open === 'function') {
    const openedWindow = window.open(href, '_self');
    if (openedWindow) {
      return;
    }
  }

  if (typeof window.location?.assign === 'function') {
    window.location.assign(href);
  }
}

function shouldIgnoreKeydown(event: KeyboardEvent): boolean {
  if (window.getSelection?.()?.toString()) {
    return true;
  }

  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return target.isContentEditable || ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName);
}

function hideHint(hint: HTMLElement): void {
  hint.classList.add('is-hidden');
}

function formatReadingStatus(units: FocusUnit[], activeIndex: number): string {
  const progress = Math.round(((activeIndex + 1) / units.length) * 100);
  const remainingWords = units
    .slice(activeIndex + 1)
    .reduce((count, unit) => count + ('text' in unit ? countWords(unit.text) : 0), 0);
  const minutesLeft = Math.max(1, Math.ceil(remainingWords / 200));
  return `${progress}% · ${minutesLeft} min remaining`;
}

function countWords(text: string): number {
  const latinWords = text.match(/[A-Za-z0-9]+(?:[-'][A-Za-z0-9]+)*/g)?.length ?? 0;
  const cjkChars = text.match(/[\u3400-\u9fff]/g)?.length ?? 0;
  return latinWords + Math.ceil(cjkChars / 2);
}
