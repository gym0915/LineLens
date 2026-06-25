import type { EmbedBlock } from '../../shared/article-schema.js';
import { applyMediaAspectRatio, renderMediaFrame } from './media-frame.js';

export function renderEmbedBlock(block: EmbedBlock): HTMLElement {
  if (block.provider || block.authorName || block.authorAvatarUrl || block.media?.length || block.metrics) {
    return renderSocialEmbedBlock(block);
  }

  const element = document.createElement('aside');
  element.className = 'reader-block reader-embed';
  element.dataset.blockId = block.id;
  element.dataset.blockType = 'embed';
  element.textContent = block.text ? `${block.label}: ${block.text}` : block.label;
  return element;
}

function renderSocialEmbedBlock(block: EmbedBlock): HTMLElement {
  const card = block.href ? document.createElement('a') : document.createElement('aside');
  card.className = 'reader-block reader-embed reader-social-embed';
  card.dataset.blockId = block.id;
  card.dataset.blockType = 'embed';
  if (block.href) {
    card.setAttribute('href', block.href);
    card.setAttribute('target', '_blank');
    card.setAttribute('rel', 'noopener noreferrer');
  }

  const header = document.createElement('div');
  header.className = 'reader-social-embed-header';

  if (block.authorAvatarUrl) {
    const avatar = document.createElement('img');
    avatar.className = 'reader-social-embed-avatar';
    avatar.src = block.authorAvatarUrl;
    avatar.alt = '';
    avatar.loading = 'lazy';
    header.append(avatar);
  }

  const author = document.createElement('div');
  author.className = 'reader-social-embed-author';
  const primary = document.createElement('div');
  primary.className = 'reader-social-embed-author-primary';
  if (block.authorName) {
    const name = document.createElement('span');
    name.className = 'reader-social-embed-author-name';
    name.textContent = block.authorName;
    primary.append(name);
  }
  const provider = document.createElement('span');
  provider.className = 'reader-social-embed-provider';
  provider.textContent = block.label;
  primary.append(provider);

  const secondary = document.createElement('div');
  secondary.className = 'reader-social-embed-author-secondary';
  if (block.authorHandle) {
    const handle = document.createElement('span');
    handle.className = 'reader-social-embed-author-handle';
    handle.textContent = block.authorHandle;
    secondary.append(handle);
  }
  author.append(primary, secondary);
  header.append(author);

  const body = document.createElement('div');
  body.className = 'reader-social-embed-body';
  if (block.text) {
    const text = document.createElement('p');
    text.className = 'reader-social-embed-text';
    text.textContent = block.text;
    body.append(text);
  }

  if (block.media?.length) {
    const mediaGrid = document.createElement('div');
    mediaGrid.className = `reader-social-embed-media reader-social-embed-media-count-${Math.min(block.media.length, 4)}`;
    for (const item of block.media) {
      const mediaItem = item.href ? document.createElement('span') : document.createElement('div');
      mediaItem.className = 'reader-social-embed-media-item';
      applyMediaAspectRatio(mediaItem, item.aspectRatio);
      mediaItem.append(
        renderMediaFrame({
          src: item.src,
          alt: item.alt,
          objectFit: item.objectFit,
          objectPosition: item.objectPosition,
          imageClassName: 'reader-social-embed-media-image'
        })
      );
      mediaGrid.append(mediaItem);
    }
    body.append(mediaGrid);
  }

  const meta = document.createElement('div');
  meta.className = 'reader-social-embed-meta';
  if (block.publishedAtText) {
    const time = document.createElement('span');
    time.className = 'reader-social-embed-time';
    time.textContent = block.publishedAtText;
    meta.append(time);
  }

  const metrics = renderSocialEmbedMetrics(block.metrics);
  if (metrics) {
    meta.append(metrics);
  }

  card.append(header, body);
  if (meta.childNodes.length > 0) {
    card.append(meta);
  }
  return card;
}

function renderSocialEmbedMetrics(metrics: EmbedBlock['metrics']): HTMLElement | null {
  if (!metrics || !Object.values(metrics).some(Boolean)) {
    return null;
  }

  const row = document.createElement('span');
  row.className = 'reader-social-embed-metrics';
  for (const value of [metrics.replies, metrics.reposts, metrics.likes, metrics.views].filter(Boolean)) {
    const metric = document.createElement('span');
    metric.className = 'reader-social-embed-metric';
    metric.textContent = value ?? '';
    row.append(metric);
  }
  return row;
}
