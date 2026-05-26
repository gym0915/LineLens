import type { Article, ArticleBlock, GifBlock, SimpleTweetBlock, TextAnnotation, TweetMetrics, TweetPhoto } from '../shared/article-schema.js';

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
        article.coverImage.aspectRatio
      )
    );
  }

  header.append(title);

  const body = document.createElement('section');
  body.className = 'article-body';

  for (const block of article.blocks) {
    body.append(renderBlock(block));
  }

  articleElement.append(header, body);
  return articleElement;
}

function renderBlock(block: ArticleBlock): HTMLElement {
  switch (block.type) {
    case 'heading':
      return renderTextBlock(getHeadingTagName(block.level), block.id, block.type, block.text);
    case 'paragraph':
      return renderTextBlock('p', block.id, block.type, block.text, block.annotations);
    case 'quote':
      return renderTextBlock('blockquote', block.id, block.type, block.text, block.annotations);
    case 'image':
      return renderImageBlock(block.id, block.src, block.alt, block.aspectRatio);
    case 'list':
      return renderListBlock(block.id, block.items, block.kind);
    case 'link':
      return renderLinkBlock(block.id, block.text, block.href, block.target);
    case 'code':
      return renderCodeBlock(block.id, block.text, block.language);
    case 'gif':
      return renderGifBlock(block);
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
  annotations: TextAnnotation[] = []
): HTMLElement {
  const element = document.createElement(tagName);
  element.className = 'reader-block';
  element.dataset.blockId = blockId;
  element.dataset.blockType = blockType;
  appendAnnotatedText(element, text, annotations);
  return element;
}

function appendAnnotatedText(container: HTMLElement, sourceText: string, annotations: TextAnnotation[] = []): void {
  const relevantAnnotations = annotations
    .filter((annotation) => (annotation.bold || annotation.href) && annotation.endOffset > annotation.startOffset)
    .map((annotation) => ({
      startOffset: Math.max(annotation.startOffset, 0),
      endOffset: Math.min(annotation.endOffset, sourceText.length),
      bold: annotation.bold,
      href: annotation.href,
      target: annotation.target
    }))
    .filter((annotation) => annotation.endOffset > annotation.startOffset)
    .sort((a, b) => a.startOffset - b.startOffset);

  let cursor = 0;
  for (const annotation of relevantAnnotations) {
    if (annotation.startOffset < cursor) {
      continue;
    }

    if (annotation.startOffset > cursor) {
      container.append(document.createTextNode(sourceText.slice(cursor, annotation.startOffset)));
    }

    const text = sourceText.slice(annotation.startOffset, annotation.endOffset);
    let annotatedNode: HTMLElement;
    if (annotation.href) {
      const link = document.createElement('a');
      link.setAttribute('href', annotation.href);
      if (annotation.target) {
        link.setAttribute('target', annotation.target);
      }
      link.setAttribute('rel', 'noreferrer');
      link.textContent = text;
      annotatedNode = link;
    } else {
      const strong = document.createElement('strong');
      strong.textContent = text;
      annotatedNode = strong;
    }

    if (annotation.bold && annotation.href) {
      const strong = document.createElement('strong');
      strong.append(annotatedNode);
      container.append(strong);
    } else {
      container.append(annotatedNode);
    }
    cursor = annotation.endOffset;
  }

  if (cursor < sourceText.length) {
    container.append(document.createTextNode(sourceText.slice(cursor)));
  }
}

function getHeadingTagName(level: 1 | 2 | 3 | 4 | 5 | 6 = 2): 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' {
  return `h${level}`;
}

function renderImageBlock(blockId: string, src: string, alt = '', aspectRatio?: number): HTMLElement {
  const figure = document.createElement('figure');
  figure.className = 'reader-block reader-media';
  figure.dataset.blockId = blockId;
  figure.dataset.blockType = 'image';
  applyMediaAspectRatio(figure, aspectRatio);

  const image = document.createElement('img');
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

function renderCoverImageBlock(blockId: string, src: string, alt = '', aspectRatio?: number): HTMLElement {
  const figure = renderImageBlock(blockId, src, alt, aspectRatio);
  figure.className = 'reader-cover reader-media';
  figure.dataset.blockType = 'cover';
  return figure;
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
  video.src = block.src;
  if (block.poster) {
    video.poster = block.poster;
  }
  video.autoplay = true;
  video.loop = true;
  video.muted = true;
  video.playsInline = true;
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

function renderListBlock(blockId: string, items: string[], kind: 'ordered' | 'unordered' = 'unordered'): HTMLElement {
  const list = document.createElement(kind === 'ordered' ? 'ol' : 'ul');
  list.className = 'reader-block reader-list';
  list.dataset.blockId = blockId;
  list.dataset.blockType = 'list';

  items.forEach((text, index) => {
    const item = document.createElement('li');
    item.className = 'reader-list-item';
    item.dataset.listItemIndex = `${index}`;

    const bullet = document.createElement('span');
    bullet.className = 'reader-list-bullet';
    bullet.setAttribute('aria-hidden', 'true');
    bullet.textContent = kind === 'ordered' ? `${index + 1}.` : '•';

    const content = document.createElement('span');
    content.className = 'reader-list-text';
    content.textContent = text;

    item.append(bullet, content);
    list.append(item);
  });

  return list;
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
  const card = document.createElement('a');
  card.className = 'reader-block reader-simple-tweet';
  card.dataset.blockId = block.id;
  card.dataset.blockType = 'simple-tweet';
  if (block.href) {
    card.setAttribute('href', block.href);
    card.setAttribute('rel', 'noreferrer');
  }

  const tweetFrame = document.createElement('div');
  tweetFrame.className = 'reader-simple-tweet-frame';

  const header = document.createElement('div');
  header.className = 'reader-simple-tweet-header';
  header.append(renderSimpleTweetAvatar(block), renderSimpleTweetAuthor(block), renderGrokIcon());

  const shell = document.createElement('div');
  shell.className = 'reader-simple-tweet-shell';

  const photos = block.photos ?? [];
  const hasPhotoCard = photos.length > 0;

  if (hasPhotoCard) {
    shell.classList.add('reader-simple-tweet-shell-photo');
    const text = document.createElement('div');
    text.className = 'reader-simple-tweet-text';
    text.setAttribute('data-testid', 'tweetText');
    text.textContent = block.excerpt || block.title;
    shell.append(text, renderSimpleTweetPhotoGrid(photos));
  } else if (block.coverUrl) {
    const media = document.createElement('div');
    media.className = 'reader-simple-tweet-media';

    const image = document.createElement('img');
    image.className = 'reader-simple-tweet-cover';
    image.src = block.coverUrl;
    image.alt = block.coverAlt ?? '';
    image.loading = 'lazy';
    media.append(image);

    const sourceBadge = document.createElement('span');
    sourceBadge.className = 'reader-simple-tweet-source';
    sourceBadge.setAttribute('aria-label', block.source);
    sourceBadge.append(renderXLogoIcon(), renderSourceLabelText('Article'));

    media.append(sourceBadge);
    shell.append(media);
  }

  const content = document.createElement('div');
  content.className = 'reader-simple-tweet-content';

  if (!block.coverUrl && !hasPhotoCard) {
    const sourceBadge = document.createElement('span');
    sourceBadge.className = 'reader-simple-tweet-source reader-simple-tweet-source-inline';
    sourceBadge.setAttribute('aria-label', block.source);
    sourceBadge.append(renderXLogoIcon(), renderSourceLabelText('Article'));
    content.append(sourceBadge);
  }

  if (!hasPhotoCard) {
    const titleElement = document.createElement('div');
    titleElement.className = 'reader-simple-tweet-title';
    titleElement.textContent = block.title;

    const excerptElement = document.createElement('div');
    excerptElement.className = 'reader-simple-tweet-excerpt';
    excerptElement.textContent = block.excerpt;

    content.append(titleElement, excerptElement);
    shell.append(content);
  }
  tweetFrame.append(header, shell, renderSimpleTweetActions(block.metrics));
  card.append(tweetFrame);
  return card;
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
    background.style.backgroundImage = `url("${photo.src}")`;
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

function renderSimpleTweetAvatar(block: SimpleTweetBlock): HTMLImageElement {
  const avatar = document.createElement('img');
  avatar.className = 'reader-simple-tweet-avatar';
  avatar.src = block.authorAvatarUrl ?? 'https://pbs.twimg.com/profile_images/1921559263094218753/p2-n_n4w_x96.jpg';
  avatar.alt = '';
  avatar.loading = 'lazy';
  avatar.setAttribute('data-testid', 'Tweet-User-Avatar');
  return avatar;
}

function renderSimpleTweetAuthor(block: SimpleTweetBlock): HTMLDivElement {
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

function renderSimpleTweetActions(metrics: TweetMetrics = {}): HTMLDivElement {
  const actions = document.createElement('div');
  actions.className = 'reader-simple-tweet-actions';
  actions.setAttribute('role', 'group');
  actions.setAttribute(
    'aria-label',
    `${metrics.replies ?? '9'} replies, ${metrics.reposts ?? '12'} reposts, ${metrics.likes ?? '112'} likes, ${metrics.views ?? '21K'} views`
  );

  actions.append(
    renderSimpleTweetAction(renderReplyIcon(), metrics.replies ?? '9', 'reply'),
    renderSimpleTweetAction(renderRetweetIcon(), metrics.reposts ?? '12', 'retweet'),
    renderSimpleTweetAction(renderLikeIcon(), metrics.likes ?? '112', 'like'),
    renderSimpleTweetAction(renderViewsIcon(), metrics.views ?? '21K', 'views'),
    renderSimpleTweetAction(renderBookmarkIcon(), '', 'bookmark'),
    renderSimpleTweetAction(renderShareIcon(), '', 'share')
  );

  return actions;
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

function renderCodeBlock(blockId: string, text: string, language = ''): HTMLElement {
  const figure = document.createElement('figure');
  figure.className = 'reader-block reader-code';
  figure.dataset.blockId = blockId;
  figure.dataset.blockType = 'code';

  const header = document.createElement('figcaption');
  header.className = 'reader-code-header';

  const label = document.createElement('span');
  label.className = 'reader-code-language';
  label.textContent = language || detectCodeLanguage(text) || 'text';

  const button = document.createElement('button');
  button.className = 'reader-code-copy';
  button.type = 'button';
  button.setAttribute('aria-label', 'Copy to clipboard');
  button.dataset.copyCode = text;
  button.append(renderCopyIcon());

  header.append(label, button);

  const pre = document.createElement('pre');
  pre.className = 'reader-code-pre';
  const code = document.createElement('code');
  code.className = `language-${label.textContent}`;
  appendHighlightedCode(code, text, label.textContent);
  pre.append(code);
  figure.append(header, pre);
  return figure;
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
