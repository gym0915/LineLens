import type { PlatformAdapter } from './adapter-types.js';

export const xArticleAdapter: PlatformAdapter = {
  id: 'x.article',
  platform: 'x',
  contentType: 'article',
  hosts: ['x.com', 'twitter.com'],
  urlPatterns: [/^\/[^/]+\/article\/[^/]+$/],
  enabled: true,
  rootSelector: '[data-testid="twitterArticleReadView"]',
  titleSelector: '[data-testid="twitter-article-title"]',
  contentSelector: '[data-testid="longformRichTextComponent"]',
  fixes: [
    {
      id: 'expand-folded-tweet-text',
      enabledByDefault: true,
      description: 'Expand folded embedded tweet text before extracting simple-tweet body.'
    },
    {
      id: 'normalize-handwritten-ordered-list',
      enabledByDefault: true,
      description: 'Normalize manually typed ordered-list markers into list blocks.'
    },
    {
      id: 'preserve-svg-emoji',
      enabledByDefault: true,
      description: 'Preserve X SVG emoji background-image metadata as inline annotations.'
    },
    {
      id: 'capture-x-video-hls',
      enabledByDefault: true,
      description: 'Use captured X HLS metadata when embedded videos do not expose direct playable sources.'
    }
  ],
  enabledFixes: ['expand-folded-tweet-text', 'normalize-handwritten-ordered-list', 'preserve-svg-emoji', 'capture-x-video-hls'],
  styleWhitelist: {
    preserveProps: ['font-weight'],
    preserveColorFor: ['link'],
    preserveWhiteSpaceValues: ['pre', 'pre-wrap']
  }
};
