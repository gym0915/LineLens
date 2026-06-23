import type { PlatformAdapter } from './adapter-types.js';

export const fixtureArticleAdapter: PlatformAdapter = {
  id: 'fixture.article',
  platform: 'fixture',
  contentType: 'article',
  hosts: ['fixture.linelens.local'],
  urlPatterns: [/^\/article\/.+$/],
  enabled: true,
  rootSelector: '[data-article-root]',
  titleSelector: '[data-article-title]',
  contentSelector: '[data-article-content]',
  semanticMap: {
    blockSelector: '[data-block]',
    paragraphSelector: '[data-kind="paragraph"]',
    headingSelector: '[data-kind="heading"]',
    quoteSelector: '[data-kind="quote"]',
    orderedListSelector: '[data-kind="ordered-list"]',
    unorderedListSelector: '[data-kind="unordered-list"]',
    imageSelector: '[data-kind="image"] img',
    imageGallerySelector: '[data-kind="image-gallery"]',
    codeSelector: '[data-kind="code"]',
    tableSelector: '[data-kind="table"]',
    linkSelector: 'a[href]',
    textSelector: '[data-text="true"]'
  },
  cleanRules: {
    removeSelectors: ['.ad', '.recommendation', '.comments', 'button', '[role="button"]'],
    unwrapSelectors: ['.content-wrapper'],
    preserveAttributeNames: ['href', 'src', 'alt', 'role', 'data-kind', 'data-block', 'data-text', 'data-linelens-heading-level']
  },
  readiness: {
    minBlockCount: 7,
    minTextLength: 80,
    requiredSelectors: ['[data-article-root]', '[data-article-title]', '[data-article-content]']
  },
  validation: {
    minBlockCount: 7,
    minTextLength: 80,
    titleStrategy: 'required',
    emptyContentStrategy: 'reject'
  },
  fixes: [],
  enabledFixes: [],
  styleWhitelist: {
    preserveProps: ['font-weight', 'font-style'],
    preserveColorFor: ['link'],
    preserveWhiteSpaceValues: ['pre', 'pre-wrap']
  }
};
