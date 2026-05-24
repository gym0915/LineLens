import type { Article, ArticleBlock } from '../shared/article-schema.js';

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
      return renderTextBlock('p', block.id, block.type, block.text);
    case 'quote':
      return renderTextBlock('blockquote', block.id, block.type, block.text);
    case 'image':
      return renderImageBlock(block.id, block.src, block.alt, block.aspectRatio);
    case 'list':
      return renderListBlock(block.id, block.items);
    case 'ref-card':
      return renderRefCardBlock(block.id, block.coverUrl, block.coverAlt, block.source, block.title, block.excerpt);
    case 'embed':
      return renderEmbedBlock(block.id, block.label, block.text);
  }
}

function renderTextBlock(
  tagName: 'blockquote' | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'p',
  blockId: string,
  blockType: string,
  text: string
): HTMLElement {
  const element = document.createElement(tagName);
  element.className = 'reader-block';
  element.dataset.blockId = blockId;
  element.dataset.blockType = blockType;
  element.textContent = text;
  return element;
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

function applyMediaAspectRatio(element: HTMLElement, aspectRatio?: number): void {
  if (!aspectRatio || !Number.isFinite(aspectRatio) || aspectRatio <= 0) {
    return;
  }

  const value = String(aspectRatio);
  element.dataset.aspectRatio = value;
  element.setAttribute('style', `--reader-media-aspect-ratio: ${value};`);
}

function renderListBlock(blockId: string, items: string[]): HTMLElement {
  const list = document.createElement('ul');
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
    bullet.textContent = '•';

    const content = document.createElement('span');
    content.className = 'reader-list-text';
    content.textContent = text;

    item.append(bullet, content);
    list.append(item);
  });

  return list;
}

function renderRefCardBlock(
  blockId: string,
  coverUrl: string,
  coverAlt = '',
  source: string,
  title: string,
  excerpt: string
): HTMLElement {
  const card = document.createElement('aside');
  card.className = 'reader-block reader-ref-card';
  card.dataset.blockId = blockId;
  card.dataset.blockType = 'ref-card';

  const shell = document.createElement('div');
  shell.className = 'reader-ref-card-shell';

  const media = document.createElement('div');
  media.className = 'reader-ref-card-media';

  const image = document.createElement('img');
  image.className = 'reader-ref-card-cover';
  image.src = coverUrl;
  image.alt = coverAlt;
  image.loading = 'lazy';

  const sourceBadge = document.createElement('span');
  sourceBadge.className = 'reader-ref-card-source';
  sourceBadge.textContent = source;

  media.append(image, sourceBadge);

  const content = document.createElement('div');
  content.className = 'reader-ref-card-content';

  const titleElement = document.createElement('div');
  titleElement.className = 'reader-ref-card-title';
  titleElement.textContent = title;

  const excerptElement = document.createElement('div');
  excerptElement.className = 'reader-ref-card-excerpt';
  excerptElement.textContent = excerpt;

  content.append(titleElement, excerptElement);
  shell.append(media, content);
  card.append(shell);
  return card;
}

function renderEmbedBlock(blockId: string, label: string, text?: string): HTMLElement {
  const element = document.createElement('aside');
  element.className = 'reader-block reader-embed';
  element.dataset.blockId = blockId;
  element.dataset.blockType = 'embed';
  element.textContent = text ? `${label}: ${text}` : label;
  return element;
}
