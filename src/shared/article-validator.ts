import type { Article, ArticleBlock } from './article.js';
import { normalizeText } from './text.js';

export type ValidationResult =
  | {
      valid: true;
    }
  | {
      valid: false;
      reason: string;
    };

const MIN_BLOCK_COUNT = 3;
const MIN_TEXT_LENGTH = 200;

export function validateArticle(article: Article): ValidationResult {
  if (!normalizeText(article.id)) {
    return { valid: false, reason: 'missing_id' };
  }

  if (!normalizeText(article.title)) {
    return { valid: false, reason: 'missing_title' };
  }

  if (!Array.isArray(article.blocks) || article.blocks.length < MIN_BLOCK_COUNT) {
    return { valid: false, reason: 'insufficient_blocks' };
  }

  const textLength = article.blocks.reduce((total, block) => total + getBlockTextLength(block), 0);
  const hasTextBlock = article.blocks.some((block) => isTextBlock(block));
  const hasMediaBlock = article.blocks.some((block) => block.type === 'image' || block.type === 'embed');

  if (textLength <= MIN_TEXT_LENGTH && !(hasTextBlock && hasMediaBlock)) {
    return { valid: false, reason: 'insufficient_content' };
  }

  return { valid: true };
}

function getBlockTextLength(block: ArticleBlock): number {
  if (block.type === 'paragraph' || block.type === 'heading' || block.type === 'quote') {
    return normalizeText(block.text).length;
  }

  if (block.type === 'list') {
    return block.items.reduce((total, item) => total + normalizeText(item).length, 0);
  }

  if (block.type === 'embed') {
    return normalizeText(`${block.label} ${block.text ?? ''}`).length;
  }

  return 0;
}

function isTextBlock(block: ArticleBlock): boolean {
  return block.type === 'paragraph' || block.type === 'heading' || block.type === 'quote' || block.type === 'list';
}
