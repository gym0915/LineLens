import { xArticleAdapter } from '../../adapters/index.js';

export const X_ARTICLE_SELECTORS = {
  readView: xArticleAdapter.rootSelector,
  title: xArticleAdapter.titleSelector ?? '[data-testid="twitter-article-title"]',
  richTextView: '[data-testid="twitterArticleRichTextView"]',
  longform: xArticleAdapter.contentSelector ?? '[data-testid="longformRichTextComponent"]',
  block: '[data-block="true"]',
  quoteBlock: 'blockquote.longform-blockquote[data-block="true"]',
  tweetBlock: '[data-testid="tweet"]',
  codeBlock: '[data-testid="markdown-code-block"]',
  tweetPhoto: '[data-testid="tweetPhoto"]',
  tweetPhotoImage: '[data-testid="tweetPhoto"] img'
} as const;
