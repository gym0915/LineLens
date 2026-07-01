import type { PlatformAdapter } from './adapter-types.js';

const SUBSTACK_ARTICLE_ROOT_SELECTOR = 'article.newsletter-post.post-viewer-post, article.podcast-post.post-viewer-post';
const SUBSTACK_TITLE_SELECTOR = [
  'article.newsletter-post.post-viewer-post > div:first-child a[href*="/p/"]',
  'article.podcast-post.post-viewer-post > div:first-child a[href*="/p/"]',
  'article.podcast-post.post-viewer-post > div:nth-child(2) a[href*="/p/"]'
].join(', ');
const SUBSTACK_BODY_SELECTOR = '.available-content .body.markup';
const SUBSTACK_ASSETS3_COMPONENT_BLOCK_SELECTOR = [
  '.body.markup [data-component-name="Image2ToDOM"]',
  '.body.markup > [data-component-name="Youtube2ToDOM"]',
  '.body.markup > [data-component-name="VideoEmbedPlayer"]',
  'audio[src]',
  '.body.markup > [data-component-name="FootnoteToDOM"]',
  '[data-component-name="Paywall"]',
  '[data-testid="paywall"]',
  '[data-component-name="SubscribeWidget"]'
].join(', ');

export const substackArticleAdapter: PlatformAdapter = {
  id: 'substack.article',
  platform: 'substack',
  contentType: 'article',
  articleSource: 'substack-article',
  hosts: ['substack.com'],
  urlPatterns: [/^\/inbox\/post\/[^/]+$/, /^\/home\/post\/[^/]+$/],
  enabled: true,
  rootSelector: SUBSTACK_ARTICLE_ROOT_SELECTOR,
  titleSelector: SUBSTACK_TITLE_SELECTOR,
  headerSelectors: {
    sourceLabelSelector: ':scope > div:first-child a[data-native="true"][href]',
    titleLinkSelector: SUBSTACK_TITLE_SELECTOR,
    subtitleSelector: ':scope > div:first-child a[href*="/p/"] + div',
    authorNameSelector: '.byline-wrapper a[href*="substack.com/@"]',
    authorAvatarSelector: '.byline-wrapper img[alt*="avatar"]',
    publishedAtSelector: '.byline-wrapper > div:last-child > div:last-child'
  },
  semanticMap: {
    blockSelector:
      '.body.markup > p, ' +
      '.body.markup > hr, .body.markup > div > hr, ' +
      '.body.markup > h1, .body.markup > h2, .body.markup > h3, .body.markup > h4, .body.markup > h5, .body.markup > h6, ' +
      '.body.markup > ul > li, .body.markup > ol > li, ' +
      '.body.markup > blockquote, ' +
      '.body.markup > .captioned-image-container img, ' +
      SUBSTACK_ASSETS3_COMPONENT_BLOCK_SELECTOR + ', ' +
      '.body.markup > a[data-component-name]',
    paragraphSelector: '.body.markup > p',
    dividerSelector: '.body.markup > hr, .body.markup > div > hr',
    headingSelector: '.body.markup > h1, .body.markup > h2, .body.markup > h3, .body.markup > h4, .body.markup > h5, .body.markup > h6',
    quoteSelector: '.body.markup > blockquote',
    orderedListSelector: '.body.markup > ol > li',
    unorderedListSelector: '.body.markup > ul > li',
    imageSelector: '.body.markup > .captioned-image-container img',
    imageGallerySelector: '.body.markup > .captioned-image-container',
    codeSelector: '.body.markup > pre',
    tableSelector: '.body.markup > table',
    linkSelector: 'a[href]',
    textSelector: '*'
  },
  cleanRules: {
    removeSelectors: ['script', 'style', 'noscript', 'button', '[role="button"]'],
    unwrapSelectors: [],
    preserveAttributeNames: [
      'allow',
      'allowautoplay',
      'allowfullscreen',
      'aria-label',
      'controls',
      'controlslist',
      'crossorigin',
      'data-href',
      'data-native',
      'data-testid',
      'href',
      'frameborder',
      'src',
      'srcset',
      'sizes',
      'alt',
      'title',
      'class',
      'id',
      'loading',
      'poster',
      'preload',
      'style',
      'data-component-name',
      'data-attrs',
      'data-video-id',
      'gesture',
      'width',
      'height'
    ]
  },
  specialComponents: [
    {
      id: 'substack.twitter-embed',
      type: 'embed',
      rootSelector: '.body.markup > a[data-component-name="Twitter2ToDOM"]',
      handlerId: 'substack.twitter-embed',
      preserveSelectors: ['img', 'picture', 'source', '[data-attrs]', 'a[href]'],
      removeSelectors: ['button', '[role="button"]']
    },
    {
      id: 'substack.youtube-embed',
      type: 'embed',
      rootSelector: '.body.markup > [data-component-name="Youtube2ToDOM"]',
      handlerId: 'substack.youtube-embed',
      preserveSelectors: ['iframe[src]', 'iframe[data-src]'],
      removeSelectors: ['button', '[role="button"]']
    },
    {
      id: 'substack.video-embed',
      type: 'video',
      rootSelector: '.body.markup > [data-component-name="VideoEmbedPlayer"]',
      handlerId: 'substack.video-embed',
      preserveSelectors: ['video[src]', 'video[poster]', 'source[src]', '[aria-label]'],
      removeSelectors: ['button', '[role="button"]']
    },
    {
      id: 'substack.audio-embed',
      type: 'embed',
      rootSelector: 'audio[src]',
      handlerId: 'substack.audio-embed',
      preserveSelectors: ['audio[src]'],
      removeSelectors: ['button', '[role="button"]']
    },
    {
      id: 'substack.footnote',
      type: 'custom-card',
      rootSelector: '.body.markup > [data-component-name="FootnoteToDOM"]',
      handlerId: 'substack.footnote',
      preserveSelectors: ['a[href]', 'p'],
      removeSelectors: ['button', '[role="button"]']
    },
    {
      id: 'substack.paywall',
      type: 'embed',
      rootSelector: '[data-component-name="Paywall"], [data-testid="paywall"]',
      handlerId: 'substack.paywall',
      preserveSelectors: ['a[href]', '[data-native]', '.paywall-title', '.paywall-intro', '.paywall-cta', '.paywall-login'],
      removeSelectors: ['button', '[role="button"]']
    },
    {
      id: 'substack.subscribe-widget',
      type: 'embed',
      rootSelector: '[data-component-name="SubscribeWidget"]',
      handlerId: 'substack.subscribe-widget',
      preserveSelectors: ['a[href]', '[data-href]'],
      removeSelectors: ['button', '[role="button"]']
    }
  ],
  readiness: {
    minBlockCount: 10,
    minTextLength: 500,
    requiredSelectors: [SUBSTACK_ARTICLE_ROOT_SELECTOR, SUBSTACK_BODY_SELECTOR]
  },
  validation: {
    minBlockCount: 10,
    minTextLength: 500,
    titleStrategy: 'required',
    emptyContentStrategy: 'reject'
  },
  fixes: [],
  enabledFixes: [],
  styleWhitelist: {
    preserveProps: ['font-weight', 'font-style', 'text-decoration'],
    preserveColorFor: ['link'],
    preserveWhiteSpaceValues: ['pre', 'pre-wrap']
  }
};
