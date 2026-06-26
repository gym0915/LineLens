import type {
  Article,
  ArticleBlock
} from '../shared/article-schema.js';
import { renderArticleHeader } from './renderers/article-header-renderer.js';
import { renderCodeBlock } from './renderers/code-block-renderer.js';
import { renderImageGalleryBlock } from './renderers/gallery-renderer.js';
import { renderImageBlock } from './renderers/image-renderer.js';
import { renderListBlock } from './renderers/list-block-renderer.js';
import { renderSimpleTweetBlock } from './renderers/simple-tweet-renderer.js';
import { renderEmbedBlock } from './renderers/social-embed-renderer.js';
import { renderTableBlock } from './renderers/table-block-renderer.js';
import { renderHeadingBlock, renderLinkBlock, renderParagraphBlock, renderQuoteBlock } from './renderers/text-block-renderer.js';
import { renderGifBlock, renderVideoBlock } from './renderers/video-renderer.js';

export { cleanupRenderedMedia } from './renderers/video-renderer.js';

export function renderArticleShell(article: Article): HTMLElement {
  const articleElement = document.createElement('article');
  articleElement.className = 'reader-article';
  articleElement.dataset.articleId = article.id;

  const body = document.createElement('section');
  body.className = 'article-body';

  for (const block of article.blocks) {
    body.append(renderBlock(block));
  }

  articleElement.append(renderArticleHeader(article), body);
  return articleElement;
}

function renderBlock(block: ArticleBlock): HTMLElement {
  switch (block.type) {
    case 'heading':
      return renderHeadingBlock(block.id, block.level, block.text, block.annotations, block.textStyle);
    case 'paragraph':
      return renderParagraphBlock(block.id, block.text, block.annotations, block.textStyle, block.role);
    case 'quote':
      return renderQuoteBlock(block.id, block.text, block.annotations, block.textStyle);
    case 'image':
      return renderImageBlock(block);
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
      return renderEmbedBlock(block);
  }
}
