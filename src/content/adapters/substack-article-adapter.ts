import type { PlatformAdapter } from './adapter-types.js';

export const substackArticleAdapter: PlatformAdapter = {
  id: 'substack.article',
  platform: 'substack',
  contentType: 'article',
  articleSource: 'substack-article',
  hosts: ['substack.com'],
  urlPatterns: [/^\/inbox\/post\/[^/]+$/, /^\/home\/post\/[^/]+$/],
  enabled: true,
  rootSelector: 'article.newsletter-post.post-viewer-post',
  titleSelector: 'article.newsletter-post.post-viewer-post > div:first-child a[href*="/p/"]',
  contentSelector: '.available-content .body.markup',
  semanticMap: {
    blockSelector:
      '.body.markup > p, ' +
      '.body.markup > h1, .body.markup > h2, .body.markup > h3, .body.markup > h4, .body.markup > h5, .body.markup > h6, ' +
      '.body.markup > ul > li, .body.markup > ol > li, ' +
      '.body.markup > blockquote, ' +
      '.body.markup > .captioned-image-container img, ' +
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
    removeSelectors: ['script', 'style', 'noscript', 'button', '[role="button"]', '.paywall'],
    unwrapSelectors: [],
    preserveAttributeNames: [
      'href',
      'src',
      'srcset',
      'sizes',
      'alt',
      'title',
      'class',
      'style',
      'data-component-name',
      'data-attrs',
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
    requiredSelectors: ['article.newsletter-post.post-viewer-post', '.available-content .body.markup']
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
