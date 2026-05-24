import type { Article, ArticleBlock } from '../shared/article-schema.js';

export function renderArticleShell(article: Article): HTMLElement {
  const articleElement = document.createElement('article');
  articleElement.className = 'reader-article';
  articleElement.dataset.articleId = article.id;

  const header = document.createElement('header');
  header.className = 'article-header';

  const kicker = document.createElement('p');
  kicker.className = 'reader-kicker';
  kicker.textContent = 'LineLens Reader';

  const title = document.createElement('h1');
  title.className = 'article-title';
  title.dataset.blockId = 'title';
  title.dataset.blockType = 'title';
  title.textContent = article.title;

  header.append(kicker, title);

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
      return renderTextBlock('h2', block.id, block.type, block.text);
    case 'paragraph':
      return renderTextBlock('p', block.id, block.type, block.text);
    case 'quote':
      return renderTextBlock('blockquote', block.id, block.type, block.text);
    case 'image':
      return renderImageBlock(block.id, block.src, block.alt);
    case 'embed':
      return renderEmbedBlock(block.id, block.label, block.text);
  }
}

function renderTextBlock(
  tagName: 'blockquote' | 'h2' | 'p',
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

function renderImageBlock(blockId: string, src: string, alt = ''): HTMLElement {
  const figure = document.createElement('figure');
  figure.className = 'reader-block reader-media';
  figure.dataset.blockId = blockId;
  figure.dataset.blockType = 'image';

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

function renderEmbedBlock(blockId: string, label: string, text?: string): HTMLElement {
  const element = document.createElement('aside');
  element.className = 'reader-block reader-embed';
  element.dataset.blockId = blockId;
  element.dataset.blockType = 'embed';
  element.textContent = text ? `${label}: ${text}` : label;
  return element;
}
