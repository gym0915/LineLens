import type { PlatformAdapter } from './adapter-types.js';

const SUBSTACK_ARTICLE_ROOT_SELECTOR = 'article.newsletter-post.post-viewer-post, article.podcast-post.post-viewer-post';
const SUBSTACK_TITLE_SELECTOR = [
  'article.newsletter-post.post-viewer-post > div:first-child a[href*="/p/"]',
  'article.podcast-post.post-viewer-post > div:first-child a[href*="/p/"]',
  'article.podcast-post.post-viewer-post > div:nth-child(2) a[href*="/p/"]'
].join(', ');
const SUBSTACK_CONTENT_SELECTOR = '.available-content .body.markup';
const SUBSTACK_ASSETS3_COMPONENT_BLOCK_SELECTOR = [
  '.body.markup [data-component-name="Image2ToDOM"]',
  '.body.markup > [data-component-name="Youtube2ToDOM"]',
  '.body.markup > [data-component-name="VideoEmbedPlayer"]',
  '.body.markup audio[src]',
  '.body.markup > [data-component-name="FootnoteToDOM"]',
  '.body.markup > [data-component-name="Paywall"]',
  '.body.markup > [data-testid="paywall"]',
  '.body.markup > [data-component-name="SubscribeWidget"]'
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
  contentSelector: SUBSTACK_CONTENT_SELECTOR,
  semanticMap: {
    blockSelector:
      '.body.markup > p, ' +
      '.body.markup > h1, .body.markup > h2, .body.markup > h3, .body.markup > h4, .body.markup > h5, .body.markup > h6, ' +
      '.body.markup > ul > li, .body.markup > ol > li, ' +
      '.body.markup > blockquote, ' +
      '.body.markup > .captioned-image-container img, ' +
      SUBSTACK_ASSETS3_COMPONENT_BLOCK_SELECTOR + ', ' +
      '.body.markup > a[data-component-name]',
    paragraphSelector: '.body.markup > p',
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
    }
  ],
  readiness: {
    minBlockCount: 10,
    minTextLength: 500,
    requiredSelectors: [SUBSTACK_ARTICLE_ROOT_SELECTOR, SUBSTACK_CONTENT_SELECTOR]
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
