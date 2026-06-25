import type { GifBlock, VideoBlock } from '../../shared/article-schema.js';
import { applyMediaAspectRatio } from './media-frame.js';

type HlsConstructor = {
  isSupported(): boolean;
  new (config?: Record<string, unknown>): {
    attachMedia(media: HTMLMediaElement): void;
    loadSource(source: string): void;
    destroy(): void;
  };
};

declare global {
  interface Window {
    Hls?: HlsConstructor;
  }
}

type MediaCleanupElement = HTMLElement & {
  __linelensCleanup__?: () => void;
};

export function cleanupRenderedMedia(root: ParentNode): void {
  root.querySelectorAll<MediaCleanupElement>('.reader-video, .reader-gif').forEach((element) => {
    element.__linelensCleanup__?.();
    delete element.__linelensCleanup__;
  });
}

export function renderGifBlock(block: GifBlock): HTMLElement {
  const figure = document.createElement('figure');
  figure.className = 'reader-block reader-media reader-gif';
  figure.dataset.blockId = block.id;
  figure.dataset.blockType = 'gif';
  applyMediaAspectRatio(figure, block.aspectRatio);

  const media = document.createElement('div');
  media.className = 'reader-gif-media';
  if (block.backgroundColor) {
    media.style.backgroundColor = block.backgroundColor;
  }

  const video = document.createElement('video');
  video.className = 'reader-gif-video';
  if (block.poster) {
    video.poster = block.poster;
  }
  video.autoplay = true;
  video.loop = true;
  video.muted = true;
  video.playsInline = true;
  video.preload = 'none';
  video.setAttribute('aria-label', 'GIF');
  if (block.top) {
    video.style.top = block.top;
  }
  if (block.left) {
    video.style.left = block.left;
  }
  if (block.transform) {
    video.style.transform = block.transform;
  }
  video.addEventListener('error', () => {
    figure.classList.add('is-load-error');
    video.remove();
    const fallback = document.createElement('figcaption');
    fallback.textContent = 'GIF 加载失败';
    figure.append(fallback);
  });

  const teardownGifPlayback = attachVisibilityControlledPlayback(figure, video, () => {
    video.src = block.src;
    return () => {
      video.removeAttribute('src');
      video.load();
    };
  });
  (figure as MediaCleanupElement).__linelensCleanup__ = teardownGifPlayback;

  const overlay = document.createElement('div');
  overlay.className = 'reader-gif-overlay';

  const pause = document.createElement('button');
  pause.type = 'button';
  pause.className = 'reader-gif-pause';
  pause.setAttribute('aria-label', 'Pause');
  pause.append(renderGifPauseIcon());
  let isPlaying = true;
  pause.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (!isPlaying) {
      void video.play();
      isPlaying = true;
      pause.setAttribute('aria-label', 'Pause');
      replaceGifControlIcon(pause, renderGifPauseIcon());
      return;
    }
    video.pause();
    isPlaying = false;
    pause.setAttribute('aria-label', 'Play');
    replaceGifControlIcon(pause, renderGifPlayIcon());
  });

  const badge = document.createElement('span');
  badge.className = 'reader-gif-badge';
  badge.textContent = 'GIF';

  overlay.append(pause, badge);
  media.append(video, overlay);
  figure.append(media);
  return figure;
}

export function renderVideoBlock(block: VideoBlock): HTMLElement {
  return renderVideoPlayer(block, {
    blockId: block.id,
    blockType: 'video',
    className: 'reader-block reader-media reader-video'
  });
}

export function renderVideoPlayer(
  block: VideoBlock,
  options: {
    blockId: string;
    blockType: string;
    className: string;
  }
): HTMLElement {
  const figure = document.createElement('figure');
  figure.className = options.className;
  figure.dataset.blockId = options.blockId;
  figure.dataset.blockType = options.blockType;
  applyMediaAspectRatio(figure, block.aspectRatio);

  const media = document.createElement('div');
  media.className = 'reader-video-media';
  if (block.backgroundColor) {
    media.style.backgroundColor = block.backgroundColor;
  }

  const video = document.createElement('video');
  video.className = 'reader-video-player';
  video.controls = true;
  video.autoplay = true;
  video.muted = true;
  video.defaultMuted = true;
  if (block.poster) {
    video.poster = block.poster;
  }
  if (block.preload) {
    video.preload = block.preload;
  }
  if (block.playsInline !== undefined) {
    video.playsInline = block.playsInline;
  }
  if (block.tabIndex !== undefined) {
    video.tabIndex = block.tabIndex;
  }
  if (block.ariaLabel) {
    video.setAttribute('aria-label', block.ariaLabel);
  }
  video.style.width = '100%';
  video.style.height = '100%';
  video.style.position = 'absolute';
  video.style.backgroundColor = block.backgroundColor ?? 'black';
  video.style.top = block.top ?? '0%';
  video.style.left = block.left ?? '0%';
  if (block.transform) {
    video.style.transform = block.transform;
  }
  const teardownRenderedArticleShell = attachVisibilityControlledPlayback(figure, video, () => attachVideoPlayback(video, block));
  (figure as MediaCleanupElement).__linelensCleanup__ = teardownRenderedArticleShell;

  video.addEventListener('error', () => {
    figure.classList.add('is-load-error');
    const fallback = document.createElement('figcaption');
    fallback.textContent = '视频暂不可播放';
    if (!figure.querySelector('figcaption')) {
      figure.append(fallback);
    }
  });

  media.append(video);
  figure.append(media);
  return figure;
}

function attachVisibilityControlledPlayback(
  container: HTMLElement,
  video: HTMLVideoElement,
  activate: () => () => void
): () => void {
  let hasActivated = false;
  let teardownPlayback: (() => void) | null = null;
  let wasPlayingBeforeOcclusion = video.autoplay;
  let visibilityPauseInProgress = false;
  let isMostlyVisible = false;

  const activateOnce = () => {
    if (hasActivated) {
      return;
    }
    hasActivated = true;
    teardownPlayback = activate();
  };

  const pauseForOcclusion = () => {
    if (!hasActivated) {
      return;
    }
    wasPlayingBeforeOcclusion = !video.paused;
    if (!video.paused) {
      visibilityPauseInProgress = true;
      video.pause();
      queueMicrotask(() => {
        visibilityPauseInProgress = false;
      });
    }
  };

  const resumeIfNeeded = () => {
    activateOnce();
    if (wasPlayingBeforeOcclusion) {
      void video.play().catch(() => undefined);
    }
  };

  const forcePlay = () => {
    activateOnce();
    wasPlayingBeforeOcclusion = true;
    void video.play().catch(() => undefined);
  };

  const isHighlighted = () => Boolean(container.classList.contains('is-active') || container.closest('.focus-unit.is-active'));
  const playIfHighlightedAndVisible = () => {
    if (isMostlyVisible && isHighlighted()) {
      forcePlay();
    }
  };

  const handlePlay = () => {
    if (!visibilityPauseInProgress) {
      wasPlayingBeforeOcclusion = true;
    }
  };
  const handlePause = () => {
    if (!visibilityPauseInProgress) {
      wasPlayingBeforeOcclusion = false;
    }
  };
  video.addEventListener('play', handlePlay);
  video.addEventListener('pause', handlePause);

  if (!('IntersectionObserver' in window)) {
    forcePlay();
    return () => {
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      teardownPlayback?.();
    };
  }

  const observeRoot = document.body ?? document.documentElement ?? container;
  const highlightObserver = new MutationObserver(() => {
    playIfHighlightedAndVisible();
  });
  highlightObserver.observe(observeRoot, {
    attributes: true,
    attributeFilter: ['class'],
    subtree: true
  });
  playIfHighlightedAndVisible();

  const observer = new IntersectionObserver(
    (entries) => {
      const entry = entries[0];
      if (!entry) {
        return;
      }

      isMostlyVisible = entry.intersectionRatio > 0.2;
      if (!isMostlyVisible) {
        pauseForOcclusion();
        return;
      }

      resumeIfNeeded();
      playIfHighlightedAndVisible();
    },
    {
      threshold: [0, 0.2, 1]
    }
  );
  observer.observe(container);

  return () => {
    observer.disconnect();
    highlightObserver.disconnect();
    video.removeEventListener('play', handlePlay);
    video.removeEventListener('pause', handlePause);
    teardownPlayback?.();
  };
}

function attachVideoPlayback(video: HTMLVideoElement, block: VideoBlock): () => void {
  const source = document.createElement('source');
  let cleanupBlobUrl: string | null = null;
  let hls: {
    loadSource(source: string): void;
    attachMedia(media: HTMLMediaElement): void;
    destroy(): void;
  } | null = null;

  const useNativeSource = (src: string) => {
    source.src = src;
    if (block.sourceType) {
      source.type = block.sourceType;
    }
    video.append(source);
    video.muted = block.transport !== 'hls';
  };

  if (block.transport !== 'hls') {
    useNativeSource(block.src);
    return () => undefined;
  }

  const hlsSource = resolveHlsSource(block);
  const Hls = window.Hls;

  if (Hls && Hls.isSupported() && hlsSource) {
    hls = new Hls({
      enableWorker: true,
      lowLatencyMode: false,
      maxBufferLength: 60
    });
    hls.attachMedia(video);
    hls.loadSource(hlsSource.source);
    video.muted = true;
    video.defaultMuted = true;
    cleanupBlobUrl = hlsSource.revokeUrl ?? null;
    return () => {
      if (hls) {
        hls.destroy();
        hls = null;
      }
      if (cleanupBlobUrl) {
        URL.revokeObjectURL(cleanupBlobUrl);
        cleanupBlobUrl = null;
      }
    };
  }

  useNativeSource(block.src);
  return () => {
    if (cleanupBlobUrl) {
      URL.revokeObjectURL(cleanupBlobUrl);
      cleanupBlobUrl = null;
    }
  };
}

function resolveHlsSource(block: VideoBlock): { source: string; revokeUrl?: string } | null {
  if (block.hls?.masterPlaylistUrl) {
    return { source: block.hls.masterPlaylistUrl };
  }

  const masterPlaylist = generateMasterPlaylist(block);
  if (!masterPlaylist) {
    return block.src ? { source: block.src } : null;
  }

  const blob = new Blob([masterPlaylist], { type: 'application/vnd.apple.mpegurl' });
  const source = URL.createObjectURL(blob);
  return {
    source,
    revokeUrl: source
  };
}

function generateMasterPlaylist(block: VideoBlock): string | null {
  const audioPlaylistUrl = block.hls?.audioPlaylistUrl;
  const videoPlaylists = block.hls?.videoPlaylists ?? [];
  if (!audioPlaylistUrl || videoPlaylists.length === 0) {
    return null;
  }

  let masterPlaylist = `#EXTM3U
#EXT-X-VERSION:6
#EXT-X-INDEPENDENT-SEGMENTS
#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="audio",NAME="Main",DEFAULT=YES,AUTOSELECT=YES,LANGUAGE="und",URI="${audioPlaylistUrl}"

`;

  for (const playlist of videoPlaylists) {
    const bandwidth = estimateBandwidth(playlist.width, playlist.height);
    const resolution = playlist.width && playlist.height ? `,RESOLUTION=${playlist.width}x${playlist.height}` : '';
    masterPlaylist += `#EXT-X-STREAM-INF:BANDWIDTH=${bandwidth},CODECS="avc1.42c00d,mp4a.40.2"${resolution},AUDIO="audio"
${playlist.url}

`;
  }

  return masterPlaylist;
}

function estimateBandwidth(width?: number, height?: number): number {
  const safeWidth = Number.isFinite(width) ? Number(width) : 640;
  const safeHeight = Number.isFinite(height) ? Number(height) : 360;
  return Math.max(128000, Math.floor(safeWidth * safeHeight * 3));
}

function replaceGifControlIcon(button: HTMLButtonElement, icon: SVGSVGElement): void {
  button.replaceChildren(icon);
}

function renderGifPauseIcon(): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('class', 'reader-gif-pause-icon');

  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute(
    'd',
    'M7.5 5c.465 0 .697 0 .89.038.794.158 1.414.778 1.572 1.571.038.194.038.426.038.891v9c0 .465 0 .697-.038.89-.158.794-.778 1.414-1.571 1.572C8.197 19 7.965 19 7.5 19s-.697 0-.89-.038c-.794-.158-1.414-.778-1.572-1.571C5 17.197 5 16.965 5 16.5v-9c0-.465 0-.697.038-.89.158-.794.778-1.414 1.571-1.572C6.803 5 7.035 5 7.5 5zm9 0c.465 0 .697 0 .89.038.794.158 1.414.778 1.572 1.571.038.194.038.426.038.891v9c0 .465 0 .697-.038.89-.158.794-.778 1.414-1.571 1.572-.194.038-.426.038-.891.038s-.697 0-.89-.038c-.794-.158-1.414-.778-1.572-1.571C14 17.197 14 16.965 14 16.5v-9c0-.465 0-.697.038-.89.158-.794.778-1.414 1.571-1.572C15.803 5 16.035 5 16.5 5z'
  );
  svg.append(path);
  return svg;
}

function renderGifPlayIcon(): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('class', 'reader-gif-play-icon');

  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute(
    'd',
    'M6 17.928V6.072C6 4.508 7.712 3.55 9.045 4.366l9.673 5.929c1.273.78 1.273 2.63 0 3.41l-9.673 5.929C7.712 20.45 6 19.49 6 17.928z'
  );
  svg.append(path);
  return svg;
}
