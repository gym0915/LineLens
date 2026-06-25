import type { ImageBlock } from '../../shared/article-schema.js';
import { applyMediaAspectRatio, renderMediaFrame } from './media-frame.js';

export function renderImageBlock(block: ImageBlock): HTMLElement {
  const figure = block.href ? document.createElement('a') : document.createElement('figure');
  figure.className = 'reader-block reader-media';
  figure.dataset.blockId = block.id;
  figure.dataset.blockType = 'image';
  if (block.href) {
    figure.setAttribute('href', block.href);
  }
  applyMediaAspectRatio(figure, block.aspectRatio);

  const frame = renderMediaFrame({
    src: block.src,
    displaySrc: block.displaySrc,
    alt: block.alt,
    backgroundSize: block.backgroundSize,
    backgroundPosition: block.backgroundPosition,
    objectFit: block.objectFit,
    objectPosition: block.objectPosition,
    imageClassName: 'reader-media-image',
    onError: () => {
      figure.classList.add('is-load-error');
      frame.remove();
      const fallback = document.createElement('figcaption');
      fallback.textContent = block.alt ? `图片加载失败：${block.alt}` : '图片加载失败';
      figure.append(fallback);
    }
  });

  figure.append(frame);
  return figure;
}

export function renderCoverImageBlock(block: ImageBlock): HTMLElement {
  const figure = renderImageBlock(block);
  figure.className = 'reader-cover reader-media';
  figure.dataset.blockType = 'cover';
  return figure;
}
