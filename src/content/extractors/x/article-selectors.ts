export const X_ARTICLE_SELECTORS = {
  readView: '[data-testid="twitterArticleReadView"]',
  title: '[data-testid="twitter-article-title"]',
  richTextView: '[data-testid="twitterArticleRichTextView"]',
  longform: '[data-testid="longformRichTextComponent"]',
  block: '[data-block="true"]',
  quoteBlock: 'blockquote.longform-blockquote[data-block="true"]',
  tweetBlock: '[data-testid="tweet"]',
  tweetPhoto: '[data-testid="tweetPhoto"]',
  tweetPhotoImage: '[data-testid="tweetPhoto"] img'
} as const;
