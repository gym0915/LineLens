import type {
  Article,
  ArticleBlock,
  CodeBlock,
  CodeToken,
  GifBlock,
  ImageGalleryBlock,
  ImageGalleryLayoutNode,
  SimpleTweetBlock,
  SimpleTweetCardData,
  SimpleTweetContentItem,
  SimpleTweetLayoutNode,
  SimpleTweetPhotoLayout,
  TableBlock,
  TextAnnotation,
  TextStyle,
  TweetMetrics,
  TweetPhoto,
  VideoBlock
} from '../shared/article-schema.js';
import { appendReaderText, applyReaderTextMetadata, createReaderTextSpan } from './reader-text-renderer.js';

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

export function renderArticleShell(article: Article): HTMLElement {
  const articleElement = document.createElement('article');
  articleElement.className = 'reader-article';
  articleElement.dataset.articleId = article.id;

  const header = document.createElement('header');
  header.className = 'article-header';

  const kicker = document.createElement('p');
  kicker.className = 'reader-kicker';
  kicker.textContent = 'LineLens';

  const title = document.createElement('h1');
  title.className = 'article-title';
  title.dataset.blockId = 'title';
  title.dataset.blockType = 'title';
  title.textContent = article.title;

  header.append(kicker);

  if (article.coverImage) {
    header.append(
      renderCoverImageBlock(
        article.coverImage.id,
        article.coverImage.src,
        article.coverImage.alt,
        article.coverImage.aspectRatio,
        article.coverImage.href
      )
    );
  }

  header.append(title);
  const authorMeta = renderArticleHeaderAuthorMeta(article);
  if (authorMeta) {
    header.append(authorMeta);
  }
  const metrics = renderArticleHeaderMetrics(article);
  if (metrics) {
    header.append(metrics);
  }

  const body = document.createElement('section');
  body.className = 'article-body';

  for (const block of article.blocks) {
    body.append(renderBlock(block));
  }

  articleElement.append(header, body);
  return articleElement;
}

function renderArticleHeaderAuthorMeta(article: Article): HTMLElement | null {
  if (!article.authorName && !article.authorAvatarUrl && !article.publishedAtText) {
    return null;
  }

  const row = document.createElement('a');
  row.className = 'article-meta article-meta-author';
  row.href = article.canonicalUrl;
  row.setAttribute('aria-label', [article.authorName, article.authorHandle, article.publishedAtText].filter(Boolean).join(' '));

  if (article.authorAvatarUrl) {
    const avatar = document.createElement('img');
    avatar.className = 'article-meta-avatar';
    avatar.src = article.authorAvatarUrl;
    avatar.alt = '';
    avatar.loading = 'lazy';
    row.append(avatar);
  }

  const text = document.createElement('span');
  text.className = 'article-meta-author-text';

  const primary = document.createElement('span');
  primary.className = 'article-meta-author-primary';
  if (article.authorName) {
    const name = document.createElement('span');
    name.className = 'article-meta-author-name';
    name.textContent = article.authorName;
    primary.append(name);
  }
  if (article.authorVerified) {
    const verified = renderVerifiedIcon();
    verified.classList.add('article-meta-verified-icon');
    primary.append(verified);
  }

  const secondary = document.createElement('span');
  secondary.className = 'article-meta-author-secondary';
  if (article.authorHandle) {
    const handle = document.createElement('span');
    handle.textContent = article.authorHandle;
    secondary.append(handle);
  }
  if (article.publishedAtText) {
    if (article.authorHandle) {
      const divider = document.createElement('span');
      divider.textContent = '·';
      secondary.append(divider);
    }
    const date = document.createElement('span');
    date.textContent = article.publishedAtText;
    secondary.append(date);
  }

  if (primary.childNodes.length > 0) {
    text.append(primary);
  }
  if (secondary.childNodes.length > 0) {
    text.append(secondary);
  }
  row.append(text, renderGrokIcon());
  return row;
}

function renderArticleHeaderMetrics(article: Article): HTMLElement | null {
  if (!article.metrics || !Object.values(article.metrics).some(Boolean)) {
    return null;
  }

  const row = document.createElement('a');
  row.className = 'article-meta article-meta-metrics';
  row.href = article.canonicalUrl;
  row.setAttribute('aria-label', 'Article interactions');

  const primary = document.createElement('span');
  primary.className = 'article-meta-metric-primary';
  primary.append(
    renderArticleHeaderMetric(renderReplyIcon(), article.metrics.replies),
    renderArticleHeaderMetric(renderRetweetIcon(), article.metrics.reposts),
    renderArticleHeaderMetric(renderLikeIcon(), article.metrics.likes),
    renderArticleHeaderMetric(renderViewsIcon(), article.metrics.views)
  );

  const trailing = document.createElement('span');
  trailing.className = 'article-meta-metric-trailing';
  trailing.append(renderArticleHeaderMetric(renderBookmarkIcon()), renderArticleHeaderMetric(renderShareIcon()));
  row.append(primary, trailing);
  return row;
}

function renderArticleHeaderMetric(icon: SVGSVGElement, value?: string): HTMLElement {
  const metric = document.createElement('span');
  metric.className = 'article-meta-metric';
  icon.classList.add('article-meta-metric-icon');
  metric.append(icon);
  if (value) {
    const text = document.createElement('span');
    text.textContent = value;
    metric.append(text);
  }
  return metric;
}

export function cleanupRenderedMedia(root: ParentNode): void {
  root.querySelectorAll<MediaCleanupElement>('.reader-video, .reader-gif').forEach((element) => {
    element.__linelensCleanup__?.();
    delete element.__linelensCleanup__;
  });
}

function renderBlock(block: ArticleBlock): HTMLElement {
  switch (block.type) {
    case 'heading':
      return renderTextBlock(getHeadingTagName(block.level), block.id, block.type, block.text, block.annotations, block.textStyle);
    case 'paragraph':
      return renderTextBlock('p', block.id, block.type, block.text, block.annotations, block.textStyle);
    case 'quote':
      return renderTextBlock('blockquote', block.id, block.type, block.text, block.annotations, block.textStyle);
    case 'image':
      return renderImageBlock(block.id, block.src, block.alt, block.aspectRatio, block.href);
    case 'image-gallery':
      return renderImageGalleryBlock(block);
    case 'list':
      return renderListBlock(block.id, block.items, block.kind, block.itemAnnotations, block.itemTextStyles);
    case 'link':
      return renderLinkBlock(block.id, block.text, block.href, block.target);
    case 'code':
      return renderCodeBlock(block);
    case 'table':
      return renderTableBlock(block);
    case 'gif':
      return renderGifBlock(block);
    case 'video':
      return renderVideoBlock(block);
    case 'simple-tweet':
      return renderSimpleTweetBlock(block);
    case 'embed':
      return renderEmbedBlock(block.id, block.label, block.text);
  }
}

function renderTextBlock(
  tagName: 'blockquote' | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'p',
  blockId: string,
  blockType: string,
  text: string,
  annotations: TextAnnotation[] = [],
  textStyle?: TextStyle
): HTMLElement {
  const element = document.createElement(tagName);
  element.className = 'reader-block';
  element.dataset.blockId = blockId;
  element.dataset.blockType = blockType;
  applyTextStyle(element, textStyle);
  applyReaderTextMetadata(
    element,
    appendReaderText(element, text, annotations, {
      role: blockType === 'paragraph' ? 'body' : blockType === 'quote' ? 'quote' : 'heading'
    })
  );
  return element;
}

function getHeadingTagName(level: 1 | 2 | 3 | 4 | 5 | 6 = 2): 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' {
  return `h${level}`;
}

function applyTextStyle(element: HTMLElement, style?: TextStyle): void {
  if (!style) return;
  if (style.color) element.style.color = style.color;
  if (style.fontSize) element.style.fontSize = style.fontSize;
  if (style.lineHeight) element.style.lineHeight = style.lineHeight;
  if (style.textAlign) element.style.textAlign = style.textAlign;
  if (style.fontStyle) element.style.fontStyle = style.fontStyle;
  if (style.fontWeight) element.style.fontWeight = style.fontWeight;
}

function renderImageBlock(blockId: string, src: string, alt = '', aspectRatio?: number, href?: string): HTMLElement {
  const figure = href ? document.createElement('a') : document.createElement('figure');
  figure.className = 'reader-block reader-media';
  figure.dataset.blockId = blockId;
  figure.dataset.blockType = 'image';
  if (href) {
    figure.setAttribute('href', href);
  }
  applyMediaAspectRatio(figure, aspectRatio);

  const image = document.createElement('img');
  image.className = 'reader-media-image';
  image.src = src;
  image.alt = alt;
  image.loading = 'lazy';
  image.addEventListener('error', () => {
    figure.classList.add('is-load-error');
    image.remove();
    const fallback = document.createElement('figcaption');
    fallback.textContent = alt ? `图片加载失败：${alt}` : '图片加载失败';
    figure.append(fallback);
  });

  figure.append(image);
  return figure;
}

function renderCoverImageBlock(blockId: string, src: string, alt = '', aspectRatio?: number, href?: string): HTMLElement {
  const figure = renderImageBlock(blockId, src, alt, aspectRatio, href);
  figure.className = 'reader-cover reader-media';
  figure.dataset.blockType = 'cover';
  return figure;
}

function renderImageGalleryBlock(block: ImageGalleryBlock): HTMLElement {
  const figure = document.createElement('figure');
  figure.className = 'reader-block reader-media reader-image-gallery';
  figure.dataset.blockId = block.id;
  figure.dataset.blockType = 'image-gallery';
  applyMediaAspectRatio(figure, block.aspectRatio);

  const grid = document.createElement('div');
  grid.className = 'reader-image-gallery-grid';

  if (block.layout) {
    grid.append(renderImageGalleryLayoutNode(block.layout, block));
  } else {
    for (let index = 0; index < block.items.length; index += 1) {
      grid.append(renderImageGalleryItem(block, index));
    }
  }

  figure.append(grid);
  return figure;
}

function renderImageGalleryLayoutNode(node: ImageGalleryLayoutNode, block: ImageGalleryBlock): HTMLElement {
  if (node.type === 'item') {
    const itemElement = renderImageGalleryItem(block, node.itemIndex);
    applyImageGalleryFlexMetrics(itemElement, node);
    return itemElement;
  }

  const element = document.createElement('div');
  element.className = 'reader-image-gallery-node';
  element.dataset.layoutType = node.type;
  applyImageGalleryFlexMetrics(element, node);

  for (const child of node.children) {
    element.append(renderImageGalleryLayoutNode(child, block));
  }

  return element;
}

function renderImageGalleryItem(block: ImageGalleryBlock, index: number): HTMLElement {
  const item = block.items[index];
  const itemElement = item?.href ? document.createElement('a') : document.createElement('div');
  itemElement.className = 'reader-image-gallery-item';
  itemElement.dataset.itemIndex = String(index);
  if (!item) {
    itemElement.classList.add('is-missing');
    return itemElement;
  }
  if (item.href) {
    itemElement.setAttribute('href', item.href);
  }

  const background = document.createElement('span');
  background.className = 'reader-image-gallery-background';
  background.style.backgroundImage = `url("${item.displaySrc ?? item.src}")`;
  background.style.backgroundSize = item.backgroundSize ?? item.objectFit ?? 'cover';
  background.style.backgroundPosition = item.backgroundPosition ?? item.objectPosition ?? 'center center';
  background.setAttribute('aria-hidden', 'true');

  const image = document.createElement('img');
  image.className = 'reader-image-gallery-image';
  image.src = item.src;
  image.alt = item.alt ?? '';
  image.loading = 'lazy';
  image.style.objectFit = item.objectFit ?? item.backgroundSize ?? 'cover';
  image.style.objectPosition = item.objectPosition ?? item.backgroundPosition ?? 'center center';
  image.addEventListener('error', () => {
    itemElement.classList.add('is-load-error');
    background.remove();
    image.remove();
  });

  itemElement.append(background, image);
  return itemElement;
}

function applyImageGalleryFlexMetrics(
  element: HTMLElement,
  node: Pick<ImageGalleryLayoutNode, 'grow' | 'shrink' | 'basis'>
): void {
  if (typeof node.grow === 'number') {
    element.style.flexGrow = String(node.grow);
  }
  if (typeof node.shrink === 'number') {
    element.style.flexShrink = String(node.shrink);
  }
  if (node.basis) {
    element.style.flexBasis = node.basis;
  }
}

function renderGifBlock(block: GifBlock): HTMLElement {
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

function renderVideoBlock(block: VideoBlock): HTMLElement {
  return renderVideoPlayer(block, {
    blockId: block.id,
    blockType: 'video',
    className: 'reader-block reader-media reader-video'
  });
}

function renderVideoPlayer(
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

function applyMediaAspectRatio(element: HTMLElement, aspectRatio?: number): void {
  if (!aspectRatio || !Number.isFinite(aspectRatio) || aspectRatio <= 0) {
    return;
  }

  const value = String(aspectRatio);
  element.dataset.aspectRatio = value;
  element.setAttribute('style', `--reader-media-aspect-ratio: ${value};`);
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

function renderListBlock(
  blockId: string,
  items: string[],
  kind: 'ordered' | 'unordered' = 'unordered',
  itemAnnotations: TextAnnotation[][] = [],
  itemTextStyles: TextStyle[] = []
): HTMLElement {
  const list = document.createElement(kind === 'ordered' ? 'ol' : 'ul');
  list.className = 'reader-block reader-list';
  list.dataset.blockId = blockId;
  list.dataset.blockType = 'list';

  items.forEach((text, index) => {
    const item = document.createElement('li');
    item.className = 'reader-list-item';
    item.dataset.listItemIndex = `${index}`;
    if (hasSourceOrderedListMarker(text)) {
      item.classList.add('reader-list-item--source-marker');
    }

    const bullet = document.createElement('span');
    bullet.className = 'reader-list-bullet';
    bullet.setAttribute('aria-hidden', 'true');
    bullet.textContent = kind === 'ordered' ? getOrderedListBullet(text, index) : '•';

    const content = document.createElement('span');
    content.className = 'reader-list-text';
    applyTextStyle(content, itemTextStyles[index]);
    content.append(
      createReaderTextSpan(text, itemAnnotations[index] ?? [], {
        role: 'list-item'
      })
    );

    item.append(bullet, content);
    list.append(item);
  });

  return list;
}

function getOrderedListBullet(text: string, index: number): string {
  return hasSourceOrderedListMarker(text) ? '' : `${index + 1}.`;
}

function hasSourceOrderedListMarker(text: string): boolean {
  return /^\s*\d+\.\s+/.test(text);
}

function renderLinkBlock(blockId: string, text: string, href: string, target?: string): HTMLElement {
  const element = document.createElement('a');
  element.className = 'reader-block reader-link';
  element.dataset.blockId = blockId;
  element.dataset.blockType = 'link';
  element.textContent = text;
  element.setAttribute('href', href);
  if (target) {
    element.setAttribute('target', target);
  }
  element.setAttribute('rel', 'noreferrer');
  return element;
}

function renderSimpleTweetBlock(block: SimpleTweetBlock): HTMLElement {
  const renderableBlock = withRenderableItems(block);
  const hasPlayableVideo = renderableBlock.items.some((item) => item.type === 'video');
  const card = document.createElement(hasPlayableVideo ? 'div' : 'a');
  card.className = 'reader-block reader-simple-tweet';
  card.dataset.blockId = block.id;
  card.dataset.blockType = 'simple-tweet';
  if (block.href && card.tagName === 'A') {
    card.setAttribute('href', block.href);
    card.setAttribute('rel', 'noreferrer');
  } else if (block.href) {
    card.dataset.href = block.href;
  }
  renderSimpleTweetCardFrame(renderableBlock, card, { compact: false, showActions: true });
  return card;
}

function renderSimpleTweetCardFrame(
  block: SimpleTweetCardData & { metrics?: TweetMetrics; layoutTree?: SimpleTweetLayoutNode },
  host: HTMLElement,
  options: { compact: boolean; showActions: boolean }
): void {
  const tweetFrame = document.createElement('div');
  tweetFrame.className = 'reader-simple-tweet-frame';
  if (options.compact) {
    tweetFrame.classList.add('reader-simple-tweet-frame-compact');
  }

  const contentColumn = document.createElement('div');
  contentColumn.className = 'reader-simple-tweet-content-column';

  const header = document.createElement('div');
  header.className = 'reader-simple-tweet-header';
  header.append(renderSimpleTweetAuthor(block), renderGrokIcon());

  const shell = document.createElement('div');
  shell.className = 'reader-simple-tweet-shell';
  const content = document.createElement('div');
  content.className = 'reader-simple-tweet-content';
  content.append(block.layoutTree && !options.compact ? renderSimpleTweetLayoutTree(block) : renderSimpleTweetContentItems(block.items, options.compact));
  shell.append(content);

  if (options.showActions) {
    contentColumn.append(header, shell);
    if (block.aiGeneratedText) {
      contentColumn.append(renderSimpleTweetAiGeneratedBadge(block.aiGeneratedText));
    }
    contentColumn.append(renderSimpleTweetActions(block.metrics));
  } else if (options.compact) {
    contentColumn.append(header);
    shell.classList.add('reader-simple-tweet-shell-compact');
    tweetFrame.append(renderSimpleTweetAvatar(block), contentColumn, shell);
    host.append(tweetFrame);
    return;
  } else {
    contentColumn.append(header, shell);
  }
  tweetFrame.append(renderSimpleTweetAvatar(block), contentColumn);
  host.append(tweetFrame);
}

function renderSimpleTweetLayoutTree(block: SimpleTweetCardData & { layoutTree?: SimpleTweetLayoutNode }): HTMLElement {
  const body = findSimpleTweetLayoutRole(block.layoutTree, 'body') ?? block.layoutTree;
  if (!body) {
    return renderSimpleTweetContentItems(block.items, false);
  }

  const wrapper = document.createElement('div');
  wrapper.className = 'reader-simple-tweet-text-only reader-simple-tweet-layout-tree';
  for (const child of body.kind === 'container' ? body.children : [body]) {
    wrapper.append(renderSimpleTweetLayoutNode(child, block));
  }
  return wrapper;
}

function findSimpleTweetLayoutRole(node: SimpleTweetLayoutNode | undefined, role: string): SimpleTweetLayoutNode | null {
  if (!node) {
    return null;
  }
  if (node.role === role) {
    return node;
  }
  if (node.kind === 'container') {
    for (const child of node.children) {
      const found = findSimpleTweetLayoutRole(child, role);
      if (found) {
        return found;
      }
    }
  }
  return null;
}

function renderSimpleTweetLayoutNode(node: SimpleTweetLayoutNode, block: SimpleTweetCardData): HTMLElement {
  if (node.kind === 'leaf') {
    return renderSimpleTweetLayoutLeaf(node, block);
  }

  if (node.role === 'quotedTweet') {
    const quoted = resolveQuotedTweetLayoutItem(node, block);
    if (quoted) {
      const element = renderSimpleTweetContentItem(quoted);
      element.classList.add('reader-simple-tweet-layout-node', 'reader-simple-tweet-layout-quotedTweet');
      return element;
    }
  }

  const container = document.createElement('div');
  container.className = 'reader-simple-tweet-layout-node reader-simple-tweet-layout-' + node.role;
  applySimpleTweetLayoutProps(container, node);
  for (const child of node.children) {
    container.append(renderSimpleTweetLayoutNode(child, block));
  }
  return container;
}

function resolveQuotedTweetLayoutItem(
  node: Extract<SimpleTweetLayoutNode, { kind: 'container' }>,
  block: SimpleTweetCardData
): Extract<SimpleTweetContentItem, { type: 'quoted-tweet' }> | null {
  const firstRef = findFirstSimpleTweetLayoutContentRef(node);
  const itemIndex = firstRef ? /^item:(\d+):item:/.exec(firstRef)?.[1] : undefined;
  const item = itemIndex !== undefined ? block.items[Number(itemIndex)] : undefined;
  return item?.type === 'quoted-tweet' ? item : null;
}

function findFirstSimpleTweetLayoutContentRef(node: SimpleTweetLayoutNode): string | null {
  if (node.kind === 'leaf') {
    return node.contentRef;
  }
  for (const child of node.children) {
    const ref = findFirstSimpleTweetLayoutContentRef(child);
    if (ref) {
      return ref;
    }
  }
  return null;
}

function renderSimpleTweetLayoutLeaf(node: Extract<SimpleTweetLayoutNode, { kind: 'leaf' }>, block: SimpleTweetCardData): HTMLElement {
  const item = resolveSimpleTweetLayoutContent(node.contentRef, block);
  if (!item) {
    const empty = document.createElement('span');
    empty.className = `reader-simple-tweet-layout-leaf reader-simple-tweet-layout-${node.role}`;
    return empty;
  }

  const element = renderSimpleTweetContentItem(item);
  element.classList.add('reader-simple-tweet-layout-leaf', `reader-simple-tweet-layout-${node.role}`);
  return element;
}

function resolveSimpleTweetLayoutContent(contentRef: string, block: SimpleTweetCardData): SimpleTweetContentItem | null {
  const parts = contentRef.split(':');
  let items = block.items;
  let cursor = 0;

  while (cursor < parts.length) {
    const token = parts[cursor];
    if (token === 'item') {
      const itemIndex = Number(parts[cursor + 1]);
      const item = items[itemIndex];
      if (!item) {
        return null;
      }
      if (parts[cursor + 2] === 'photo' && item.type === 'photo-group') {
        const photoIndex = Number(parts[cursor + 3]);
        const photo = item.photos[photoIndex];
        return photo ? { type: 'photo', photo } : null;
      }
      if (parts[cursor + 2] === 'item' && item.type === 'quoted-tweet') {
        items = item.tweet.items;
        cursor += 2;
        continue;
      }
      return item;
    }
    cursor += 1;
  }

  return null;
}

function applySimpleTweetLayoutProps(
  element: HTMLElement,
  node: Extract<SimpleTweetLayoutNode, { kind: 'container' }>
): void {
  if (node.display) {
    element.style.display = node.display;
  }
  if (node.flexDirection) {
    element.style.flexDirection = node.flexDirection;
  }
  if (node.gridTemplateColumns) {
    element.style.gridTemplateColumns = node.gridTemplateColumns;
  }
  if (typeof node.gapPx === 'number') {
    element.style.gap = `${node.gapPx}px`;
  }
  if (node.alignItems) {
    element.style.alignItems = node.alignItems;
  }
  if (node.justifyContent) {
    element.style.justifyContent = node.justifyContent;
  }
  if (typeof node.aspectRatio === 'number') {
    element.style.aspectRatio = String(node.aspectRatio);
  }
}

function withRenderableItems<T extends SimpleTweetCardData & { metrics?: TweetMetrics }>(block: T): T {
  if (Array.isArray(block.items)) {
    return block;
  }

  const legacy = block as T & {
    coverUrl?: string;
    coverAlt?: string;
    photos?: TweetPhoto[];
    video?: VideoBlock;
  };

  const items: SimpleTweetContentItem[] = [];
  if (legacy.excerpt) {
    items.push({ type: 'text', text: legacy.excerpt });
  }
  if (legacy.video) {
    items.push({ type: 'video', video: legacy.video });
  } else if (legacy.photos?.length) {
    items.push(
      legacy.photos.length === 1
        ? { type: 'photo', photo: legacy.photos[0] }
        : {
            type: 'photo-group',
            photos: legacy.photos,
            layout: {
              kind: 'row',
              children: legacy.photos.map((photo) => ({ kind: 'photo', photo }))
            },
            aspectRatio: 16 / 9
          }
    );
  } else if (legacy.coverUrl) {
    items.push({
      type: 'article-cover',
      coverUrl: legacy.coverUrl,
      coverAlt: legacy.coverAlt,
      title: legacy.title,
      excerpt: legacy.excerpt,
      href: legacy.href
    });
  }

  return {
    ...block,
    items
  };
}

function renderSimpleTweetTextOnlyBlock(block: SimpleTweetCardData): HTMLDivElement {
  const content = document.createElement('div');
  content.className = 'reader-simple-tweet-text-only';

  if (block.replyToHandle) {
    const reply = document.createElement('div');
    reply.className = 'reader-simple-tweet-reply-context';
    const replyText = block.replyContextText || `Replying to ${block.replyToHandle}`;
    const handleIndex = replyText.indexOf(block.replyToHandle);

    const handle = document.createElement('span');
    handle.className = 'reader-simple-tweet-link-text';
    handle.textContent = block.replyToHandle;
    if (handleIndex >= 0) {
      reply.append(document.createTextNode(replyText.slice(0, handleIndex)), handle, document.createTextNode(replyText.slice(handleIndex + block.replyToHandle.length)));
    } else {
      reply.append(document.createTextNode(replyText));
    }
    content.append(reply);
  }

  if (block.translationSourceText) {
    const translation = document.createElement('div');
    translation.className = 'reader-simple-tweet-translation';
    translation.append(renderSimpleTweetTranslationIcon());

    const label = document.createElement('span');
    label.textContent = block.translationSourceText;
    translation.append(label);

    const original = document.createElement('span');
    original.className = 'reader-simple-tweet-link-text';
    original.textContent = block.translationActionText ?? 'Show original';
    translation.append(original);
    content.append(translation);
  }

  content.append(renderExpandableSimpleTweetText(block.excerpt || block.title));
  return content;
}

function renderSimpleTweetContentItems(items: SimpleTweetContentItem[], compact: boolean): HTMLDivElement {
  const content = document.createElement('div');
  content.className = 'reader-simple-tweet-text-only';
  if (compact) {
    content.classList.add('reader-simple-tweet-content-compact');
    const condensed = renderCondensedSimpleTweetItems(items);
    if (condensed) {
      content.append(condensed);
      return content;
    }
  }

  for (const item of items) {
    content.append(renderSimpleTweetContentItem(item));
  }
  if (items.length === 0) {
    content.append(renderExpandableSimpleTweetText(''));
  }
  return content;
}

function renderCondensedSimpleTweetItems(items: SimpleTweetContentItem[]): HTMLElement | null {
  const previewIndex = items.findIndex((item) => item.type === 'video-preview' || (item.type === 'photo' && item.layout === 'condensed'));
  const textIndex = items.findIndex((item) => item.type === 'text');
  if (previewIndex < 0 || textIndex < 0) {
    return null;
  }

  const container = document.createElement('div');
  container.className = 'reader-simple-tweet-condensed';
  const mediaSlot = document.createElement('div');
  mediaSlot.className = 'reader-simple-tweet-condensed-media';
  const textSlot = document.createElement('div');
  textSlot.className = 'reader-simple-tweet-condensed-text';

  for (const [index, item] of items.entries()) {
    if (index === previewIndex) {
      mediaSlot.append(renderSimpleTweetContentItem(item));
    } else if (index === textIndex) {
      textSlot.append(renderSimpleTweetContentItem(item));
    } else {
      textSlot.append(renderSimpleTweetContentItem(item));
    }
  }

  container.append(mediaSlot, textSlot);
  return container;
}

function renderSimpleTweetContentItem(item: SimpleTweetContentItem): HTMLElement {
  switch (item.type) {
    case 'text':
      return renderExpandableSimpleTweetText(item.text);
    case 'photo':
      return renderSimpleTweetPhotoGrid([item.photo]);
    case 'photo-group':
      return renderSimpleTweetPhotoLayoutTree(item.layout, item.aspectRatio);
    case 'video': {
      const video = renderVideoPlayer(item.video, {
        blockId: `${item.video.id}-embedded`,
        blockType: 'simple-tweet-video',
        className: 'reader-simple-tweet-video reader-media reader-video'
      });
      if (item.video.aspectRatio && Number.isFinite(item.video.aspectRatio) && item.video.aspectRatio < 1) {
        video.classList.add('reader-simple-tweet-video-portrait');
      }
      return video;
    }
    case 'video-preview':
      return renderSimpleTweetVideoPreview(item);
    case 'article-cover':
      return renderSimpleTweetArticleCover(item);
    case 'quoted-tweet': {
      const nested = document.createElement('div');
      nested.className = 'reader-simple-tweet reader-simple-tweet-quoted';
      renderSimpleTweetCardFrame(item.tweet, nested, { compact: true, showActions: false });
      return nested;
    }
  }
}

function renderSimpleTweetVideoPreview(item: Extract<SimpleTweetContentItem, { type: 'video-preview' }>): HTMLElement {
  const media = document.createElement(item.href ? 'a' : 'div');
  media.className = 'reader-simple-tweet-media reader-simple-tweet-video-preview';
  if (item.layout === 'condensed') {
    media.classList.add('reader-simple-tweet-video-preview-condensed');
  }
  if (item.shape === 'rounded-square') {
    media.classList.add('reader-simple-tweet-video-preview-rounded-square');
  }
  if (item.href && media.tagName === 'A') {
    media.setAttribute('href', item.href);
    media.setAttribute('rel', 'noreferrer');
  }
  applyMediaAspectRatio(media, item.aspectRatio);

  const image = document.createElement('img');
  image.className = 'reader-simple-tweet-cover';
  image.src = item.src;
  image.alt = item.alt ?? '';
  image.loading = 'lazy';
  media.append(image);

  if (item.durationText) {
    const duration = document.createElement('span');
    duration.className = 'reader-simple-tweet-video-duration';
    duration.textContent = item.durationText;
    media.append(duration);
  }
  return media;
}

function renderSimpleTweetArticleCover(item: Extract<SimpleTweetContentItem, { type: 'article-cover' }>): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'reader-simple-tweet-media';

  const image = document.createElement('img');
  image.className = 'reader-simple-tweet-cover';
  image.src = item.coverUrl;
  image.alt = item.coverAlt ?? '';
  image.loading = 'lazy';
  wrapper.append(image);

  const sourceBadge = document.createElement('span');
  sourceBadge.className = 'reader-simple-tweet-source';
  sourceBadge.setAttribute('aria-label', 'X Article');
  sourceBadge.append(renderXLogoIcon(), renderSourceLabelText('Article'));
  wrapper.append(sourceBadge);

  if (item.title || item.excerpt) {
    const text = document.createElement('div');
    text.className = 'reader-simple-tweet-content';
    if (item.title) {
      const title = document.createElement('div');
      title.className = 'reader-simple-tweet-title';
      title.append(createReaderTextSpan(item.title, [], { role: 'social-title' }));
      text.append(title);
    }
    if (item.excerpt) {
      const excerpt = document.createElement('div');
      excerpt.className = 'reader-simple-tweet-excerpt';
      excerpt.append(createReaderTextSpan(item.excerpt, [], { role: 'social-excerpt' }));
      text.append(excerpt);
    }
    const authorMeta = renderSimpleTweetArticleCoverAuthorMeta(item);
    if (authorMeta) {
      text.append(authorMeta);
    }
    const metrics = renderSimpleTweetArticleCoverMetrics(item);
    if (metrics) {
      text.append(metrics);
    }
    wrapper.append(text);
  }

  return wrapper;
}

function renderSimpleTweetArticleCoverAuthorMeta(
  item: Extract<SimpleTweetContentItem, { type: 'article-cover' }>
): HTMLElement | null {
  if (!item.authorName && !item.authorHandle && !item.publishedAtText) {
    return null;
  }

  const row = document.createElement('div');
  row.className = 'reader-simple-tweet-article-meta reader-simple-tweet-article-meta-author';
  if (item.href) {
    row.dataset.href = item.href;
  }

  if (item.authorAvatarUrl) {
    const avatar = document.createElement('img');
    avatar.className = 'reader-simple-tweet-article-avatar';
    avatar.src = item.authorAvatarUrl;
    avatar.alt = '';
    avatar.loading = 'lazy';
    row.append(avatar);
  }

  const text = document.createElement('div');
  text.className = 'reader-simple-tweet-article-author-text';

  const primary = document.createElement('div');
  primary.className = 'reader-simple-tweet-article-author-primary';
  if (item.authorName) {
    const name = document.createElement('span');
    name.textContent = item.authorName;
    primary.append(name);
  }
  if (item.authorVerified) {
    const verified = renderVerifiedIcon();
    verified.classList.add('reader-simple-tweet-article-verified-icon');
    primary.append(verified);
  }

  const secondary = document.createElement('div');
  secondary.className = 'reader-simple-tweet-article-author-secondary';
  if (item.authorHandle) {
    const handle = document.createElement('span');
    handle.textContent = item.authorHandle;
    secondary.append(handle);
  }
  if (item.publishedAtText) {
    if (item.authorHandle) {
      const divider = document.createElement('span');
      divider.textContent = '·';
      secondary.append(divider);
    }
    const date = document.createElement('span');
    date.textContent = item.publishedAtText;
    secondary.append(date);
  }

  if (primary.childNodes.length > 0) {
    text.append(primary);
  }
  if (secondary.childNodes.length > 0) {
    text.append(secondary);
  }

  row.append(text);
  return row;
}

function renderSimpleTweetArticleCoverMetrics(
  item: Extract<SimpleTweetContentItem, { type: 'article-cover' }>
): HTMLElement | null {
  if (!item.metrics || !Object.values(item.metrics).some(Boolean)) {
    return null;
  }

  const row = document.createElement('div');
  row.className = 'reader-simple-tweet-article-meta reader-simple-tweet-article-meta-metrics';
  if (item.href) {
    row.dataset.href = item.href;
  }

  row.append(
    renderSimpleTweetArticleMetric(renderReplyIcon(), item.metrics.replies),
    renderSimpleTweetArticleMetric(renderRetweetIcon(), item.metrics.reposts),
    renderSimpleTweetArticleMetric(renderLikeIcon(), item.metrics.likes),
    renderSimpleTweetArticleMetric(renderViewsIcon(), item.metrics.views)
  );

  const trailing = document.createElement('div');
  trailing.className = 'reader-simple-tweet-article-metric-trailing';
  trailing.append(renderSimpleTweetArticleMetric(renderBookmarkIcon()), renderSimpleTweetArticleMetric(renderShareIcon()));
  row.append(trailing);

  return row;
}

function renderSimpleTweetArticleMetric(icon: SVGSVGElement, value?: string): HTMLElement {
  const item = document.createElement('span');
  item.className = 'reader-simple-tweet-article-metric';
  icon.classList.add('reader-simple-tweet-article-metric-icon');
  item.append(icon);
  if (value) {
    const text = document.createElement('span');
    text.textContent = value;
    item.append(text);
  }
  return item;
}

function renderExpandableSimpleTweetText(tweetText: string): HTMLDivElement {
  const container = document.createElement('div');
  container.setAttribute('class', 'reader-simple-tweet-text-container is-collapsed');

  const text = document.createElement('div');
  text.className = 'reader-simple-tweet-text';
  text.setAttribute('data-testid', 'tweetText');
  text.append(
    createReaderTextSpan(tweetText, [], {
      role: 'social-body'
    })
  );

  const showMore = document.createElement('span');
  showMore.className = 'reader-simple-tweet-show-more';
  showMore.setAttribute('role', 'button');
  showMore.setAttribute('tabindex', '0');
  showMore.textContent = 'Show more';

  const expand = (event: Event): void => {
    event.preventDefault();
    event.stopPropagation();
    container.classList.remove('is-collapsed');
    showMore.remove();
  };

  showMore.addEventListener('click', expand);
  showMore.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      expand(event);
    }
  });

  container.append(text, showMore);

  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(() => {
      if (!container.isConnected || !container.classList.contains('is-collapsed')) return;
      if (text.scrollHeight <= text.clientHeight + 1) {
        container.classList.remove('is-collapsed');
        showMore.remove();
      }
    });
  }

  return container;
}

function renderSimpleTweetPhotoGrid(photos: TweetPhoto[]): HTMLDivElement {
  const grid = document.createElement('div');
  grid.className = `reader-simple-tweet-photo-grid reader-simple-tweet-photo-count-${Math.min(photos.length, 4)}`;

  photos.slice(0, 4).forEach((photo, index) => {
    const item = document.createElement('div');
    item.className = 'reader-simple-tweet-photo';
    item.setAttribute('data-testid', 'tweetPhoto');
    if (photo.href) {
      item.dataset.href = photo.href;
    }

    const background = document.createElement('span');
    background.className = 'reader-simple-tweet-photo-background';
    background.style.backgroundImage = `url("${photo.displaySrc ?? photo.src}")`;
    background.setAttribute('aria-hidden', 'true');

    const image = document.createElement('img');
    image.src = photo.src;
    image.alt = photo.alt ?? `Tweet image ${index + 1}`;
    image.loading = 'lazy';

    item.append(background, image);
    grid.append(item);
  });

  return grid;
}

function renderSimpleTweetPhotoLayoutTree(layout: SimpleTweetPhotoLayout, aspectRatio?: number): HTMLElement {
  if (layout.kind === 'photo') {
    const container = document.createElement('div');
    container.className = 'reader-simple-tweet-photo-layout reader-simple-tweet-photo-layout-leaf';
    applyMediaAspectRatio(container, aspectRatio);
    container.append(renderSimpleTweetPhotoCell(layout.photo, 0));
    return container;
  }

  const container = document.createElement('div');
  container.className = `reader-simple-tweet-photo-layout reader-simple-tweet-photo-layout-${layout.kind}`;
  applyMediaAspectRatio(container, aspectRatio);

  layout.children.forEach((child, index) => {
    if (child.kind === 'photo') {
      const cell = renderSimpleTweetPhotoCell(child.photo, index);
      applySimpleTweetPhotoLayoutSize(cell, child, layout.kind);
      container.append(cell);
      return;
    }

    const branch = document.createElement('div');
    branch.className = 'reader-simple-tweet-photo-branch';
    applySimpleTweetPhotoLayoutSize(branch, child, layout.kind);
    branch.append(renderSimpleTweetPhotoLayoutTree(child));
    container.append(branch);
  });

  return container;
}

function renderSimpleTweetPhotoCell(photo: TweetPhoto, index: number): HTMLDivElement {
  const item = document.createElement('div');
  item.className = 'reader-simple-tweet-photo';
  item.setAttribute('data-testid', 'tweetPhoto');
  if (photo.href) {
    item.dataset.href = photo.href;
  }

  const background = document.createElement('span');
  background.className = 'reader-simple-tweet-photo-background';
  background.style.backgroundImage = `url("${photo.displaySrc ?? photo.src}")`;
  background.setAttribute('aria-hidden', 'true');

  const image = document.createElement('img');
  image.src = photo.src;
  image.alt = photo.alt ?? `Tweet image ${index + 1}`;
  image.loading = 'lazy';

  item.append(background, image);
  return item;
}

function applySimpleTweetPhotoLayoutSize(element: HTMLElement, layout: SimpleTweetPhotoLayout, parentKind: 'row' | 'column'): void {
  const ratio = parentKind === 'row' ? layout.widthRatio : layout.heightRatio;
  if (!ratio || ratio <= 0) {
    return;
  }

  const percentage = Math.round(ratio * 10000) / 100;
  element.style.flex = `0 0 ${percentage}%`;
}

function renderSimpleTweetAvatar(block: SimpleTweetCardData): HTMLImageElement {
  const avatar = document.createElement('img');
  avatar.className = 'reader-simple-tweet-avatar';
  avatar.src = block.authorAvatarUrl ?? 'https://pbs.twimg.com/profile_images/1921559263094218753/p2-n_n4w_x96.jpg';
  avatar.alt = '';
  avatar.loading = 'lazy';
  avatar.setAttribute('data-testid', 'Tweet-User-Avatar');
  return avatar;
}

function renderSimpleTweetAuthor(block: SimpleTweetCardData): HTMLDivElement {
  const author = document.createElement('div');
  author.className = 'reader-simple-tweet-author';

  const primary = document.createElement('div');
  primary.className = 'reader-simple-tweet-author-primary';

  const displayName = document.createElement('span');
  displayName.className = 'reader-simple-tweet-display-name';
  displayName.setAttribute('data-testid', 'User-Name');
  displayName.textContent = block.authorName ?? 'karin.';

  primary.append(displayName);
  if (block.authorVerified || (block.authorVerified === undefined && !block.authorName && !block.authorHandle)) {
    primary.append(renderVerifiedIcon());
  }
  if (block.authorBadgeAvatarUrl) {
    const badge = document.createElement('img');
    badge.className = 'reader-simple-tweet-author-badge';
    badge.src = block.authorBadgeAvatarUrl;
    badge.alt = '';
    badge.loading = 'lazy';
    primary.append(badge);
  }

  const secondary = document.createElement('div');
  secondary.className = 'reader-simple-tweet-author-secondary';

  const handle = document.createElement('span');
  handle.textContent = block.authorHandle ?? '@omokage_AIsOK';

  const separator = document.createElement('span');
  separator.setAttribute('aria-hidden', 'true');
  separator.textContent = '·';

  const date = document.createElement('time');
  date.dateTime = block.publishedAt ?? '2026-02-08T16:26:18.000Z';
  date.textContent = block.publishedAtText ?? 'Feb 9';

  secondary.append(handle, separator, date);
  author.append(primary, secondary);
  return author;
}

function renderVerifiedIcon(): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 22 22');
  svg.setAttribute('aria-label', 'Verified account');
  svg.setAttribute('role', 'img');
  svg.setAttribute('class', 'reader-simple-tweet-verified-icon');
  svg.setAttribute('data-testid', 'icon-verified');

  const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute(
    'd',
    'M20.396 11c-.018-.646-.215-1.275-.57-1.816-.354-.54-.852-.972-1.438-1.246.223-.607.27-1.264.14-1.897-.131-.634-.437-1.218-.882-1.687-.47-.445-1.053-.75-1.687-.882-.633-.13-1.29-.083-1.897.14-.273-.587-.704-1.086-1.245-1.44S11.647 1.62 11 1.604c-.646.017-1.273.213-1.813.568s-.969.854-1.24 1.44c-.608-.223-1.267-.272-1.902-.14-.635.13-1.22.436-1.69.882-.445.47-.749 1.055-.878 1.688-.13.633-.08 1.29.144 1.896-.587.274-1.087.705-1.443 1.245-.356.54-.555 1.17-.574 1.817.02.647.218 1.276.574 1.817.356.54.856.972 1.443 1.245-.224.606-.274 1.263-.144 1.896.13.634.433 1.218.877 1.688.47.443 1.054.747 1.687.878.633.132 1.29.084 1.897-.136.274.586.705 1.084 1.246 1.439.54.354 1.17.551 1.816.569.647-.016 1.276-.213 1.817-.567s.972-.854 1.245-1.44c.604.239 1.266.296 1.903.164.636-.132 1.22-.447 1.68-.907.46-.46.776-1.044.908-1.681s.075-1.299-.165-1.903c.586-.274 1.084-.705 1.439-1.246.354-.54.551-1.17.569-1.816zM9.662 14.85l-3.429-3.428 1.293-1.302 2.072 2.072 4.4-4.794 1.347 1.246z'
  );

  group.append(path);
  svg.append(group);
  return svg;
}

function renderGrokIcon(): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 33 32');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('class', 'reader-simple-tweet-grok-icon');

  const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute(
    'd',
    'M12.745 20.54l10.97-8.19c.539-.4 1.307-.244 1.564.38 1.349 3.288.746 7.241-1.938 9.955-2.683 2.714-6.417 3.31-9.83 1.954l-3.728 1.745c5.347 3.697 11.84 2.782 15.898-1.324 3.219-3.255 4.216-7.692 3.284-11.693l.008.009c-1.351-5.878.332-8.227 3.782-13.031L33 0l-4.54 4.59v-.014L12.743 20.544m-2.263 1.987c-3.837-3.707-3.175-9.446.1-12.755 2.42-2.449 6.388-3.448 9.852-1.979l3.72-1.737c-.67-.49-1.53-1.017-2.515-1.387-4.455-1.854-9.789-.931-13.41 2.728-3.483 3.523-4.579 8.94-2.697 13.561 1.405 3.454-.899 5.898-3.22 8.364C1.49 30.2.666 31.074 0 32l10.478-9.466'
  );

  group.append(path);
  svg.append(group);
  return svg;
}

function renderSimpleTweetTranslationIcon(): SVGSVGElement {
  const icon = renderGrokIcon();
  icon.setAttribute('class', 'reader-simple-tweet-translation-icon');
  return icon;
}

function renderSimpleTweetActions(metrics: TweetMetrics = {}): HTMLDivElement {
  const actions = document.createElement('div');
  actions.className = 'reader-simple-tweet-actions';
  actions.setAttribute('role', 'group');
  actions.setAttribute(
    'aria-label',
    `${metrics.replies ?? '9'} replies, ${metrics.reposts ?? '12'} reposts, ${metrics.likes ?? '112'} likes, ${metrics.views ?? '21K'} views`
  );

  const primaryActions = document.createElement('div');
  primaryActions.className = 'reader-simple-tweet-actions-primary';
  primaryActions.append(
    renderSimpleTweetAction(renderReplyIcon(), metrics.replies ?? '9', 'reply'),
    renderSimpleTweetAction(renderRetweetIcon(), metrics.reposts ?? '12', 'retweet'),
    renderSimpleTweetAction(renderLikeIcon(), metrics.likes ?? '112', 'like'),
    renderSimpleTweetAction(renderViewsIcon(), metrics.views ?? '21K', 'views')
  );

  const secondaryActions = document.createElement('div');
  secondaryActions.className = 'reader-simple-tweet-actions-secondary';
  secondaryActions.append(renderSimpleTweetAction(renderBookmarkIcon(), '', 'bookmark'), renderSimpleTweetAction(renderShareIcon(), '', 'share'));

  actions.append(primaryActions, secondaryActions);

  return actions;
}

function renderSimpleTweetAiGeneratedBadge(text: string): HTMLDivElement {
  const badge = document.createElement('div');
  badge.className = 'reader-simple-tweet-ai-generated';

  const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  icon.setAttribute('viewBox', '0 0 24 24');
  icon.setAttribute('aria-hidden', 'true');
  icon.setAttribute('class', 'reader-simple-tweet-ai-generated-icon');

  const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  const path1 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path1.setAttribute(
    'd',
    'M12.998 1.94c.18 3.015 1.04 5.156 2.473 6.59 1.433 1.433 3.574 2.292 6.589 2.472v1.996c-3.015.18-5.156 1.04-6.59 2.473-1.433 1.433-2.292 3.574-2.472 6.589h-1.996c-.18-3.015-1.04-5.156-2.473-6.59-1.433-1.433-3.574-2.292-6.589-2.472v-1.996c3.015-.18 5.156-1.04 6.59-2.473 1.433-1.433 2.292-3.574 2.472-6.589h1.996z'
  );
  const path2 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path2.setAttribute(
    'd',
    'M4.997.95c.123 1.23.361 1.889.763 2.29.401.402 1.06.64 2.29.763v.994c-1.23.123-1.889.361-2.29.763-.402.401-.64 1.06-.763 2.29h-.994c-.123-1.23-.361-1.89-.763-2.29-.401-.402-1.06-.64-2.29-.763v-.994c1.23-.123 1.889-.361 2.29-.763.402-.401.64-1.06.763-2.29h.994z'
  );
  group.append(path1, path2);
  icon.append(group);

  const label = document.createElement('span');
  label.className = 'reader-simple-tweet-ai-generated-text';
  label.textContent = text;

  badge.append(icon, label);
  return badge;
}

function renderSimpleTweetAction(icon: SVGSVGElement, value: string, name: string): HTMLSpanElement {
  const action = document.createElement('span');
  action.className = `reader-simple-tweet-action reader-simple-tweet-action-${name}`;
  action.setAttribute('data-testid', name);
  action.append(icon);
  if (value) {
    const text = document.createElement('span');
    text.textContent = value;
    action.append(text);
  }
  return action;
}

function renderXLogoIcon(): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('class', 'reader-simple-tweet-source-icon');

  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute(
    'd',
    'M21.742 21.75l-7.563-11.179 7.056-8.321h-2.456l-5.691 6.714-4.54-6.714H2.359l7.29 10.776L2.25 21.75h2.456l6.035-7.118 4.818 7.118h6.191-.008zM7.739 3.818L18.81 20.182h-2.447L5.29 3.818h2.447z'
  );

  svg.append(path);
  return svg;
}

function renderSourceLabelText(text: string): HTMLSpanElement {
  const element = document.createElement('span');
  element.className = 'reader-simple-tweet-source-text';
  element.textContent = text;
  return element;
}

function renderReplyIcon(): SVGSVGElement {
  return renderSimpleTweetPathIcon(
    'M1.751 10c0-4.42 3.584-8 8.005-8h4.366c4.49 0 8.129 3.64 8.129 8.13 0 2.96-1.607 5.68-4.196 7.11l-8.054 4.46v-3.69h-.067c-4.49.1-8.183-3.51-8.183-8.01zm8.005-6c-3.317 0-6.005 2.69-6.005 6 0 3.37 2.77 6.08 6.138 6.01l.351-.01h1.761v2.3l5.087-2.81c1.951-1.08 3.163-3.13 3.163-5.36 0-3.39-2.744-6.13-6.129-6.13H9.756z'
  );
}

function renderRetweetIcon(): SVGSVGElement {
  return renderSimpleTweetPathIcon(
    'M4.5 3.88l4.432 4.14-1.364 1.46L5.5 7.55V16c0 1.1.896 2 2 2H13v2H7.5c-2.209 0-4-1.79-4-4V7.55L1.432 9.48.068 8.02 4.5 3.88zM16.5 6H11V4h5.5c2.209 0 4 1.79 4 4v8.45l2.068-1.93 1.364 1.46-4.432 4.14-4.432-4.14 1.364-1.46 2.068 1.93V8c0-1.1-.896-2-2-2z'
  );
}

function renderLikeIcon(): SVGSVGElement {
  return renderSimpleTweetPathIcon(
    'M16.697 5.5c-1.222-.06-2.679.51-3.89 2.16l-.805 1.09-.806-1.09C9.984 6.01 8.526 5.44 7.304 5.5c-1.243.07-2.349.78-2.91 1.91-.552 1.12-.633 2.78.479 4.82 1.074 1.97 3.257 4.27 7.129 6.61 3.87-2.34 6.052-4.64 7.126-6.61 1.111-2.04 1.03-3.7.477-4.82-.561-1.13-1.666-1.84-2.908-1.91zm4.187 7.69c-1.351 2.48-4.001 5.12-8.379 7.67l-.503.3-.504-.3c-4.379-2.55-7.029-5.19-8.382-7.67-1.36-2.5-1.336-4.89-.514-6.55.832-1.68 2.48-2.68 4.592-2.79 1.57-.08 3.252.51 4.808 2.12 1.554-1.61 3.236-2.2 4.806-2.12 2.112.11 3.76 1.11 4.592 2.79.822 1.66.846 4.05-.512 6.55z'
  );
}

function renderViewsIcon(): SVGSVGElement {
  return renderSimpleTweetPathIcon(
    'M8.75 21V3h2v18h-2zM18 21V8.5h2V21h-2zM4 21l.004-10h2L6 21H4zm9.248 0v-7h2v7h-2z'
  );
}

function renderBookmarkIcon(): SVGSVGElement {
  return renderSimpleTweetPathIcon(
    'M4 4.5C4 3.12 5.119 2 6.5 2h11C18.881 2 20 3.12 20 4.5v18.44l-8-5.71-8 5.71V4.5zM6.5 4c-.276 0-.5.22-.5.5v14.56l6-4.29 6 4.29V4.5c0-.28-.224-.5-.5-.5h-11z'
  );
}

function renderShareIcon(): SVGSVGElement {
  return renderSimpleTweetPathIcon(
    'M12 2.59l5.7 5.7-1.41 1.42L13 6.41V16h-2V6.41l-3.29 3.3L6.3 8.29l5.7-5.7zM21 15l-.02 3.51c0 1.38-1.12 2.49-2.5 2.49H5.5C4.12 21 3 19.88 3 18.5V15h2v3.5c0 .28.22.5.5.5h12.98c.28 0 .5-.22.5-.5L19 15h2z'
  );
}

function renderSimpleTweetPathIcon(pathData: string): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('class', 'reader-simple-tweet-action-icon');

  const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', pathData);
  group.append(path);
  svg.append(group);
  return svg;
}

function renderEmbedBlock(blockId: string, label: string, text?: string): HTMLElement {
  const element = document.createElement('aside');
  element.className = 'reader-block reader-embed';
  element.dataset.blockId = blockId;
  element.dataset.blockType = 'embed';
  element.textContent = text ? `${label}: ${text}` : label;
  return element;
}

function renderTableBlock(block: TableBlock): HTMLElement {
  const wrapper = document.createElement('figure');
  wrapper.className = 'reader-block reader-table';
  wrapper.dataset.blockId = block.id;
  wrapper.dataset.blockType = 'table';
  if (block.tableStyle?.backgroundColor) wrapper.style.background = block.tableStyle.backgroundColor;
  if (block.tableStyle?.borderColor) wrapper.style.borderColor = block.tableStyle.borderColor;

  const table = document.createElement('table');
  table.className = 'reader-table-grid';
  if (block.columnCount) {
    table.style.setProperty('--reader-table-columns', String(block.columnCount));
  }

  const tbody = document.createElement('tbody');
  for (const row of block.rows) {
    const tr = document.createElement('tr');
    for (const cell of row.cells) {
      const cellElement = document.createElement(cell.header ? 'th' : 'td');
      cellElement.className = 'reader-table-cell';
      if (cell.colSpan) cellElement.colSpan = cell.colSpan;
      if (cell.rowSpan) cellElement.rowSpan = cell.rowSpan;
      if (cell.backgroundColor) cellElement.style.background = cell.backgroundColor;
      if (cell.borderColor) cellElement.style.borderColor = cell.borderColor;
      applyTextStyle(cellElement, cell.textStyle);
      cellElement.textContent = cell.text;
      tr.append(cellElement);
    }
    tbody.append(tr);
  }

  table.append(tbody);
  wrapper.append(table);
  return wrapper;
}

function renderCodeBlock(block: CodeBlock): HTMLElement {
  const figure = document.createElement('figure');
  figure.className = 'reader-block reader-code';
  figure.dataset.blockId = block.id;
  figure.dataset.blockType = 'code';

  const header = document.createElement('figcaption');
  header.className = 'reader-code-header';
  if (block.codeStyle?.headerBackgroundColor) header.style.background = block.codeStyle.headerBackgroundColor;
  if (block.codeStyle?.headerColor) header.style.color = block.codeStyle.headerColor;

  const label = document.createElement('span');
  label.className = 'reader-code-language';
  label.textContent = block.language || detectCodeLanguage(block.text) || 'text';
  if (block.codeStyle?.headerColor) label.style.color = block.codeStyle.headerColor;

  const button = document.createElement('button');
  button.className = 'reader-code-copy';
  button.type = 'button';
  button.setAttribute('aria-label', 'Copy to clipboard');
  button.dataset.copyCode = block.text;
  if (block.codeStyle?.copyColor) button.style.color = block.codeStyle.copyColor;
  button.append(renderCopyIcon());

  header.append(label, button);

  const pre = document.createElement('pre');
  pre.className = 'reader-code-pre';
  applyCodeStyle(pre, block.codeStyle);
  const code = document.createElement('code');
  code.className = `language-${label.textContent}`;
  if (block.codeStyle?.codeBackgroundColor) code.style.background = block.codeStyle.codeBackgroundColor;
  if (block.codeStyle?.codeColor) code.style.color = block.codeStyle.codeColor;
  if (block.codeStyle?.fontFamily) code.style.fontFamily = block.codeStyle.fontFamily;
  if (block.codeStyle?.fontSize) code.style.fontSize = block.codeStyle.fontSize;
  if (block.codeStyle?.lineHeight) code.style.lineHeight = block.codeStyle.lineHeight;
  if (block.codeStyle?.tabSize) code.style.tabSize = block.codeStyle.tabSize;
  if (block.tokens && block.tokens.length > 0) {
    appendExtractedCodeTokens(code, block.tokens);
  } else {
    appendHighlightedCode(code, block.text, label.textContent);
  }
  pre.append(code);
  figure.append(header, pre);
  return figure;
}

function applyCodeStyle(pre: HTMLElement, style?: CodeBlock['codeStyle']): void {
  if (!style) return;
  if (style.preBackgroundColor) pre.style.background = style.preBackgroundColor;
  if (style.preColor) pre.style.color = style.preColor;
  if (style.fontFamily) pre.style.fontFamily = style.fontFamily;
  if (style.fontSize) pre.style.fontSize = style.fontSize;
  if (style.lineHeight) pre.style.lineHeight = style.lineHeight;
  if (style.tabSize) pre.style.tabSize = style.tabSize;
}

function appendExtractedCodeTokens(container: HTMLElement, tokens: CodeToken[]): void {
  for (const token of tokens) {
    if (!token.color && !token.fontStyle && !token.fontWeight) {
      container.append(document.createTextNode(token.text));
      continue;
    }

    const span = document.createElement('span');
    span.textContent = token.text;
    if (token.color) span.style.color = token.color;
    if (token.fontStyle) span.style.fontStyle = token.fontStyle;
    if (token.fontWeight) span.style.fontWeight = token.fontWeight;
    container.append(span);
  }
}

function renderCopyIcon(): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('class', 'reader-code-copy-icon');
  const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute(
    'd',
    'M19.5 2C20.88 2 22 3.12 22 4.5v11c0 1.21-.86 2.22-2 2.45V4.5c0-.28-.22-.5-.5-.5H6.05c.23-1.14 1.24-2 2.45-2h11zm-4 4C16.88 6 18 7.12 18 8.5v11c0 1.38-1.12 2.5-2.5 2.5h-11C3.12 22 2 20.88 2 19.5v-11C2 7.12 3.12 6 4.5 6h11zM4 19.5c0 .28.22.5.5.5h11c.28 0 .5-.22.5-.5v-11c0-.28-.22-.5-.5-.5h-11c-.28 0-.5.22-.5.5v11z'
  );
  group.append(path);
  svg.append(group);
  return svg;
}

function appendHighlightedCode(container: HTMLElement, text: string, language: string): void {
  if (language === 'markdown' || language === 'md') {
    appendHighlightedMarkdown(container, text);
    return;
  }

  const pattern = getCodeTokenPattern(language);
  let cursor = 0;
  for (const match of text.matchAll(pattern)) {
    if (match.index === undefined) continue;
    if (match.index > cursor) {
      container.append(document.createTextNode(text.slice(cursor, match.index)));
    }
    const span = document.createElement('span');
    span.className = `reader-code-token reader-code-token-${classifyCodeToken(match[0])}`;
    span.textContent = match[0];
    container.append(span);
    cursor = match.index + match[0].length;
  }
  if (cursor < text.length) {
    container.append(document.createTextNode(text.slice(cursor)));
  }
}

function appendHighlightedMarkdown(container: HTMLElement, text: string): void {
  const linePattern = /([^\n]*)(\n|$)/g;
  for (const match of text.matchAll(linePattern)) {
    const line = match[1];
    const lineEnd = match[2];
    if (!line && !lineEnd) continue;

    appendHighlightedMarkdownLine(container, line);
    if (lineEnd) {
      container.append(document.createTextNode(lineEnd));
    }
  }
}

function appendHighlightedMarkdownLine(container: HTMLElement, line: string): void {
  const headingMatch = line.match(/^(\s*)(#{1,6})(\s+)(.*)$/);
  if (headingMatch) {
    container.append(document.createTextNode(headingMatch[1]));
    appendCodeToken(container, headingMatch[2], 'punctuation');
    appendCodeToken(container, `${headingMatch[3]}${headingMatch[4]}`, 'heading');
    return;
  }

  const orderedListMatch = line.match(/^(\s*)(\d+\.)(\s+.*)$/);
  if (orderedListMatch) {
    container.append(document.createTextNode(orderedListMatch[1]));
    appendCodeToken(container, orderedListMatch[2], 'punctuation');
    container.append(document.createTextNode(orderedListMatch[3]));
    return;
  }

  const unorderedListMatch = line.match(/^(\s*)([-*+])(\s+.*)$/);
  if (unorderedListMatch) {
    container.append(document.createTextNode(unorderedListMatch[1]));
    appendCodeToken(container, unorderedListMatch[2], 'punctuation');
    container.append(document.createTextNode(unorderedListMatch[3]));
    return;
  }

  container.append(document.createTextNode(line));
}

function appendCodeToken(container: HTMLElement, text: string, tokenType: string): void {
  const span = document.createElement('span');
  span.className = `reader-code-token reader-code-token-${tokenType}`;
  span.textContent = text;
  container.append(span);
}

function getCodeTokenPattern(language: string): RegExp {
  if (['xml', 'html', 'jsx', 'tsx'].includes(language)) {
    return /<\/?[A-Za-z][\w:-]*|>|\/>|"[^"]*"|'[^']*'|\/\/[^\n]*|\b(?:class|function|const|let|var|return|type|interface|export|import|from|extends|pub|struct|impl|fn|let|mut)\b/g;
  }
  return /\/\/[^\n]*|"[^"]*"|'[^']*'|\b(?:class|function|const|let|var|return|type|interface|export|import|from|extends|pub|struct|impl|fn|mut|async|await)\b|\b\d+(?:\.\d+)?\b/g;
}

function classifyCodeToken(token: string): string {
  if (token.startsWith('//')) return 'comment';
  if (/^["']/.test(token)) return 'string';
  if (/^<\/?[A-Za-z]/.test(token)) return 'tag';
  if (/^\d/.test(token)) return 'number';
  if (token === '>' || token === '/>') return 'punctuation';
  return 'keyword';
}

function detectCodeLanguage(text: string): string {
  if (/^\s*</.test(text)) return 'xml';
  if (/\bpub\s+struct\b|\bfn\s+\w+/.test(text)) return 'rust';
  if (/\bnpm\s+install\b|\bcd\s+/.test(text)) return 'shell';
  return '';
}
