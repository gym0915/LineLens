import type { SimpleTweetBlock, SimpleTweetCardData, SimpleTweetContentItem, SimpleTweetLayoutNode, SimpleTweetPhotoLayout, TextAnnotation, TextStyle, TweetMetrics, TweetPhoto, VideoBlock } from '../../shared/article-schema.js';
import { createReaderTextSpan } from '../reader-text-renderer.js';
import { applySimpleTweetTextStyle } from '../style-policy.js';
import { applyMediaAspectRatio, renderMediaFrame } from './media-frame.js';
import { renderSimpleTweetCardFrame } from './simple-tweet-frame.js';
import { renderVideoPlayer } from './video-renderer.js';
import { renderBookmarkIcon, renderLikeIcon, renderReplyIcon, renderRetweetIcon, renderShareIcon, renderSimpleTweetTranslationIcon, renderSourceLabelText, renderVerifiedIcon, renderViewsIcon, renderXLogoIcon } from './icons.js';

export function renderSimpleTweetBlock(block: SimpleTweetBlock): HTMLElement {
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
  renderSimpleTweetCardFrame(renderableBlock, card, { compact: false, showActions: true }, renderSimpleTweetFrameContent);
  return card;
}

function renderSimpleTweetFrameContent(
  block: SimpleTweetCardData & { layoutTree?: SimpleTweetLayoutNode },
  compact: boolean
): HTMLElement {
  return block.layoutTree && !compact ? renderSimpleTweetLayoutTree(block) : renderSimpleTweetContentItems(block.items, compact);
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
    aspectRatio?: number;
    sourceLabel?: string;
    sourceIconPath?: string;
    sourceColor?: string;
    titleTextStyle?: TextStyle;
    excerptTextStyle?: TextStyle;
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
      aspectRatio: legacy.aspectRatio,
      sourceLabel: legacy.sourceLabel,
      sourceIconPath: legacy.sourceIconPath,
      sourceColor: legacy.sourceColor,
      title: legacy.title,
      titleTextStyle: legacy.titleTextStyle,
      excerpt: legacy.excerpt,
      excerptTextStyle: legacy.excerptTextStyle,
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
      return renderExpandableSimpleTweetText(item.text, item.annotations);
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
      renderSimpleTweetCardFrame(item.tweet, nested, { compact: true, showActions: false }, renderSimpleTweetFrameContent);
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
  wrapper.className = 'reader-simple-tweet-article-card';

  const media = document.createElement('div');
  media.className = 'reader-simple-tweet-media reader-simple-tweet-article-cover-media';
  applyMediaAspectRatio(media, item.aspectRatio);

  const image = document.createElement('img');
  image.className = 'reader-simple-tweet-cover';
  image.src = item.coverUrl;
  image.alt = item.coverAlt ?? '';
  image.loading = 'lazy';
  media.append(image);

  const sourceBadge = document.createElement('span');
  sourceBadge.className = 'reader-simple-tweet-source';
  sourceBadge.setAttribute('aria-label', 'X Article');
  if (item.sourceColor) {
    sourceBadge.setAttribute('style', '--reader-simple-tweet-source-color: ' + item.sourceColor + ';');
  }
  sourceBadge.append(renderXLogoIcon(item.sourceIconPath), renderSourceLabelText(item.sourceLabel ?? 'Article'));
  media.append(sourceBadge);
  wrapper.append(media);

  if (item.title || item.excerpt) {
    const text = document.createElement('div');
    text.className = 'reader-simple-tweet-content reader-simple-tweet-article-cover-content';
    if (item.title) {
      const title = document.createElement('div');
      title.className = 'reader-simple-tweet-title';
      applySimpleTweetTextStyle(title, item.titleTextStyle);
      title.append(createReaderTextSpan(item.title, [], { role: 'social-title' }));
      text.append(title);
    }
    if (item.excerpt) {
      const excerpt = document.createElement('div');
      excerpt.className = 'reader-simple-tweet-excerpt';
      applySimpleTweetTextStyle(excerpt, item.excerptTextStyle);
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

function renderExpandableSimpleTweetText(tweetText: string, annotations: TextAnnotation[] = []): HTMLDivElement {
  const container = document.createElement('div');
  container.setAttribute('class', 'reader-simple-tweet-text-container is-collapsed');

  const text = document.createElement('div');
  text.className = 'reader-simple-tweet-text';
  text.setAttribute('data-testid', 'tweetText');
  text.append(
    createReaderTextSpan(tweetText, annotations, {
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

    item.append(
      renderMediaFrame({
        src: photo.src,
        displaySrc: photo.displaySrc,
        alt: photo.alt ?? `Tweet image ${index + 1}`,
        imageClassName: 'reader-simple-tweet-photo-image'
      })
    );
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

  item.append(
    renderMediaFrame({
      src: photo.src,
      displaySrc: photo.displaySrc,
      alt: photo.alt ?? `Tweet image ${index + 1}`,
      imageClassName: 'reader-simple-tweet-photo-image'
    })
  );
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
