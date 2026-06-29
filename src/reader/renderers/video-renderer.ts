import type { GifBlock, VideoBlock } from '../../shared/article-schema.js';
import { applyMediaAspectRatio } from './media-frame.js';
import { attachVisibilityControlledPlayback } from './video-playback-controller.js';
import { attachVideoSourceController } from './video-source-controller.js';

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
  const teardownRenderedArticleShell = attachVisibilityControlledPlayback(figure, video, () =>
    attachVideoSourceController(video, block)
  );
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
