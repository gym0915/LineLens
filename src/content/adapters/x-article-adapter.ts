import type { PlatformAdapter } from './adapter-types.js';
import { xCodeColorThemePairs } from '../extractors/x/code-theme.js';

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
  semanticMap: {
    blockSelector: '[data-block="true"]',
    paragraphSelector: '[data-block="true"]',
    headingSelector: '.longform-header-one, .longform-header-two, [data-linelens-block-role="heading"], h1, h2, h3, h4, h5, h6',
    quoteSelector: 'blockquote.longform-blockquote[data-block="true"], blockquote',
    orderedListSelector: '.public-DraftStyleDefault-orderedListItem, .longform-ordered-list-item, [data-linelens-list-kind="ordered"]',
    unorderedListSelector: '.public-DraftStyleDefault-unorderedListItem, .longform-unordered-list-item, [data-linelens-list-kind="unordered"]',
    imageSelector: '[data-testid="tweetPhoto"], img',
    imageGallerySelector: '[data-testid="tweetPhoto"]',
    codeSelector: '[data-testid="markdown-code-block"], pre, code',
    tableSelector: 'table, [role="table"], [role="grid"]',
    linkSelector: 'a[href], [role="link"]',
    textSelector: '[data-text]'
  },
  cleanRules: {
    removeSelectors: [
      'script',
      'style',
      'noscript',
      'button',
      'input',
      'textarea',
      'select',
      'option',
      'svg',
      '[role="button"]',
      '[data-testid="bookmark"]',
      '[data-testid="like"]',
      '[data-testid="reply"]',
      '[data-testid="retweet"]',
      '[data-testid="unlike"]'
    ],
    unwrapSelectors: [],
    preserveAttributeNames: [
      'alt',
      'aria-label',
      'contenteditable',
      'datetime',
      'dir',
      'href',
      'lang',
      'rel',
      'role',
      'src',
      'style',
      'target',
      'title'
    ]
  },
  readiness: {
    minTextLength: 200,
    minBlockCount: 3,
    requiredSelectors: [
      '[data-testid="twitterArticleReadView"]',
      '[data-testid="twitter-article-title"]',
      '[data-testid="longformRichTextComponent"]'
    ]
  },
  validation: {
    minBlockCount: 3,
    minTextLength: 200,
    titleStrategy: 'required',
    emptyContentStrategy: 'reject'
  },
  codeThemePairs: xCodeColorThemePairs,
  fixes: [
    {
      id: 'expand-folded-tweet-text',
      enabledByDefault: true,
      description: 'Expand folded embedded tweet text before extracting simple-tweet body.'
    },
    {
      id: 'normalize-handwritten-ordered-list',
      enabledByDefault: true,
      description: 'Normalize X Draft.js list semantics while preserving manually typed ordered markers as text.'
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
    },
    {
      id: 'preserve-x-media-caption',
      enabledByDefault: true,
      description: 'Preserve X article media caption semantics before class/id sanitizing.'
    },
    {
      id: 'preserve-x-media-layout',
      enabledByDefault: true,
      description: 'Preserve X media layout direction and aspect ratio before class/style sanitizing.'
    }
  ],
  enabledFixes: [
    'expand-folded-tweet-text',
    'normalize-handwritten-ordered-list',
    'preserve-svg-emoji',
    'capture-x-video-hls',
    'preserve-x-media-caption',
    'preserve-x-media-layout'
  ],
  styleWhitelist: {
    preserveProps: ['font-weight'],
    preserveColorFor: ['link'],
    preserveWhiteSpaceValues: ['pre', 'pre-wrap']
  },
  specialComponents: [
    {
      id: 'x.simple-tweet',
      type: 'social-card',
      rootSelector: '[data-testid="simpleTweet"]',
      handlerId: 'x.simple-tweet',
      preserveSelectors: ['[data-testid="tweetText"]', 'img', '[data-testid="videoPlayer"]'],
      removeSelectors: ['[data-testid="reply"]', '[data-testid="retweet"]', '[data-testid="like"]']
    },
    {
      id: 'x.video-or-gif',
      type: 'video',
      rootSelector: '[data-testid="videoPlayer"]',
      handlerId: 'x.video-or-gif'
    }
  ]
};
