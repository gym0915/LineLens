import type { Article, SimpleTweetContentItem, TweetPhoto } from '../../shared/article-schema.js';
import { findMediaPreviewByHref, getMediaHrefKeys, upgradeXImageUrl } from './media-url-resolver.js';

export interface MediaPreview {
  href: string;
  src: string;
  alt: string;
}

export type MediaPreloadStatus = 'idle' | 'loading' | 'loaded' | 'failed';

export type MediaPreloadEntry = {
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

export function ensurePriorityMediaPreload(mediaPreviewState: MediaPreviewState, media: MediaPreview): MediaPreloadEntry {
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
