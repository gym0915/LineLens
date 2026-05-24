import type { ReadyResult } from '../../../shared/extractor-types.js';
import { hasMeaningfulText, normalizeText } from '../../../shared/text.js';
import { isXArticleUrl } from '../../../shared/url.js';
import { X_ARTICLE_SELECTORS } from './article-selectors.js';

const MIN_READY_BLOCKS = 3;
const MIN_READY_TEXT_LENGTH = 200;

export function matchXArticleUrl(url: URL): boolean {
  return isXArticleUrl(url);
}

export function detectXArticleDom(root: ParentNode): ReadyResult {
  const readView = root.querySelector(X_ARTICLE_SELECTORS.readView);
  if (!readView) {
    return { ready: false, reason: 'missing_article_root' };
  }

  const title = readView.querySelector(X_ARTICLE_SELECTORS.title);
  if (!title || !hasMeaningfulText(title.textContent ?? '')) {
    return { ready: false, reason: 'missing_title' };
  }

  const richTextView = readView.querySelector(X_ARTICLE_SELECTORS.richTextView);
  if (!richTextView) {
    return { ready: false, reason: 'missing_rich_text_view' };
  }

  const longform = readView.querySelector(X_ARTICLE_SELECTORS.longform);
  if (!longform) {
    return { ready: false, reason: 'missing_longform_content' };
  }

  const blocks = Array.from(longform.querySelectorAll(X_ARTICLE_SELECTORS.block));
  const textLength = normalizeText(longform.textContent ?? '').length;

  if (blocks.length < MIN_READY_BLOCKS || textLength < MIN_READY_TEXT_LENGTH) {
    return { ready: false, reason: 'content_not_stable' };
  }

  return { ready: true };
}
