import assert from 'node:assert/strict';
import {
  BUILT_IN_PLATFORM_ADAPTERS,
  DEFAULT_CONTENT_SETTINGS,
  fixtureArticleAdapter,
  resolvePlatformAdapter,
  substackArticleAdapter,
  xArticleAdapter
} from '../dist/content/adapters/index.js';
import {
  DEFAULT_READER_SETTINGS,
  READER_COLUMN_WIDTH_SETTINGS,
  READER_FOCUS_GRANULARITY_SETTINGS,
  READER_FONT_SCALE_SETTINGS,
  READER_LINE_HEIGHT_SETTINGS,
  READER_READING_MODE_SETTINGS,
  READER_THEME_SETTINGS
} from '../dist/shared/reader-config.js';
import {
  DEFAULT_SETTINGS,
  LINE_LENS_SETTINGS_STORAGE_KEY,
  loadSettingsFromLocalStorage,
  mergePlatformAdapterConfig,
  mergeSettings,
  normalizeSettings
} from '../dist/shared/settings.js';
import { resolveSemanticSelectors } from '../dist/content/preprocess/semantic-map-selectors.js';

const xUrl = new URL('https://x.com/example/article/123456789');
const twitterUrl = new URL('https://twitter.com/example/article/123456789');
const substackInboxUrl = new URL('https://substack.com/inbox/post/202529490');
const latentSpaceUrl = new URL('https://www.latent.space/p/how-to-think-about-agent-browsers');
const fixtureUrl = new URL('https://fixture.linelens.local/article/1');
const futurePlatformUrl = new URL('https://future.example.com/article/123');
const unsupportedUrl = new URL('https://example.com/story');

assert.deepEqual(
  BUILT_IN_PLATFORM_ADAPTERS.map((adapter) => adapter.id),
  ['x.article', 'substack.article', 'fixture.article'],
  'built-in adapters should include X, Substack, and the local fixture platform'
);
assert.equal(resolvePlatformAdapter(xUrl)?.id, 'x.article', 'resolver should match x.com article URLs');
assert.equal(resolvePlatformAdapter(twitterUrl)?.id, 'x.article', 'resolver should match twitter.com article URLs');
assert.equal(resolvePlatformAdapter(substackInboxUrl)?.id, 'substack.article', 'resolver should match substack.com inbox article URLs');
assert.equal(resolvePlatformAdapter(latentSpaceUrl)?.id, 'substack.article', 'resolver should match Substack custom-domain article URLs');
assert.equal(resolvePlatformAdapter(fixtureUrl)?.id, 'fixture.article', 'resolver should match the local fixture article URLs');
assert.equal(resolvePlatformAdapter(futurePlatformUrl), null, 'resolver should not match removed future-platform drafts');
assert.equal(resolvePlatformAdapter(unsupportedUrl), null, 'resolver should reject unsupported hosts');

assert.equal(xArticleAdapter.rootSelector, '[data-testid="twitterArticleReadView"]', 'X adapter should expose the article root selector');
assert.equal(xArticleAdapter.titleSelector, '[data-testid="twitter-article-title"]', 'X adapter should expose the title selector');
assert.equal(xArticleAdapter.contentSelector, '[data-testid="longformRichTextComponent"]', 'X adapter should expose the longform selector');
assert.equal(xArticleAdapter.fixes.some((fix) => fix.id === 'expand-folded-tweet-text'), true, 'X adapter should expose known extractor fixes');
assert.equal(xArticleAdapter.styleWhitelist.preserveProps.includes('font-weight'), true, 'X adapter should expose content style whitelist');
assert.deepEqual(
  xArticleAdapter.readiness?.requiredSelectors,
  [
    '[data-testid="twitterArticleReadView"]',
    '[data-testid="twitter-article-title"]',
    '[data-testid="longformRichTextComponent"]'
  ],
  'X adapter readiness.requiredSelectors should express current DOM readiness gates'
);
assert.equal(xArticleAdapter.readiness?.minBlockCount, 3, 'X adapter readiness.minBlockCount should match the current detector threshold');
assert.equal(xArticleAdapter.readiness?.minTextLength, 200, 'X adapter readiness.minTextLength should match the current detector threshold');
assert.equal(xArticleAdapter.validation?.minBlockCount, 3, 'X adapter validation.minBlockCount should match article validator defaults');
assert.equal(xArticleAdapter.validation?.minTextLength, 200, 'X adapter validation.minTextLength should match article validator defaults');
assert.equal(xArticleAdapter.validation?.titleStrategy, 'required', 'X adapter validation.titleStrategy should express current required title behavior');
assert.equal(xArticleAdapter.validation?.emptyContentStrategy, 'reject', 'X adapter validation.emptyContentStrategy should express current empty content rejection');
assert.equal(
  xArticleAdapter.cleanRules?.removeSelectors?.some((selector) => selector.includes('script')),
  true,
  'X adapter cleanRules.removeSelectors should express script-like shell removal'
);
assert.equal(
  xArticleAdapter.cleanRules?.removeSelectors?.some((selector) => selector.includes('[role="button"]')),
  true,
  'X adapter cleanRules.removeSelectors should express interactive shell removal'
);

assert.equal(xArticleAdapter.semanticMap?.blockSelector, '[data-block="true"]', 'X adapter should expose block selector semantics');
assert.equal(xArticleAdapter.semanticMap?.paragraphSelector, '[data-block="true"]', 'X adapter should expose paragraph selector semantics');
assert.match(xArticleAdapter.semanticMap?.headingSelector ?? '', /longform-header-one/, 'X adapter should expose heading selector semantics');
assert.match(xArticleAdapter.semanticMap?.quoteSelector ?? '', /blockquote/, 'X adapter should expose quote selector semantics');
assert.match(xArticleAdapter.semanticMap?.orderedListSelector ?? '', /orderedListItem/, 'X adapter should expose ordered list selector semantics');
assert.match(xArticleAdapter.semanticMap?.unorderedListSelector ?? '', /unorderedListItem/, 'X adapter should expose unordered list selector semantics');
assert.match(xArticleAdapter.semanticMap?.imageSelector ?? '', /tweetPhoto/, 'X adapter should expose image selector semantics');
assert.match(xArticleAdapter.semanticMap?.imageGallerySelector ?? '', /tweetPhoto/, 'X adapter should expose image gallery selector semantics');
assert.match(xArticleAdapter.semanticMap?.codeSelector ?? '', /markdown-code-block/, 'X adapter should expose code selector semantics');
assert.match(xArticleAdapter.semanticMap?.tableSelector ?? '', /role="table"/, 'X adapter should expose table selector semantics');
assert.match(xArticleAdapter.semanticMap?.linkSelector ?? '', /a\[href\]/, 'X adapter should expose link selector semantics');
assert.equal(xArticleAdapter.semanticMap?.textSelector, '[data-text]', 'X adapter should expose text selector semantics');

const resolvedXSemanticSelectors = resolveSemanticSelectors(xArticleAdapter.semanticMap);
assert.deepEqual(
  Object.keys(resolvedXSemanticSelectors),
  [
    'blockSelector',
    'paragraphSelector',
    'headingSelector',
    'quoteSelector',
    'orderedListSelector',
    'unorderedListSelector',
    'imageSelector',
    'imageGallerySelector',
    'codeSelector',
    'tableSelector',
    'linkSelector',
    'textSelector'
  ],
  'semanticMap resolver should expose a complete selector contract'
);
assert.equal(
  resolveSemanticSelectors({ headingSelector: '  [data-heading]  ', quoteSelector: '' }).headingSelector,
  '[data-heading]',
  'semanticMap resolver should trim custom selectors'
);
assert.equal(
  resolveSemanticSelectors({ headingSelector: '  [data-heading]  ', quoteSelector: '' }).quoteSelector,
  '[data-linelens-block-role="quote"], [data-kind="quote"], blockquote',
  'semanticMap resolver should fall back to a platform-neutral selector when selector values are empty'
);

assert.equal(
  xArticleAdapter.specialComponents?.some((component) => component.id === 'x.simple-tweet' && component.handlerId === 'x.simple-tweet' && component.type === 'social-card'),
  true,
  'X adapter should declare the simpleTweet special component'
);
assert.equal(
  xArticleAdapter.specialComponents?.some((component) => component.id === 'x.video-or-gif' || component.handlerId === 'x.video-or-gif'),
  false,
  'X adapter should not declare video/GIF as a special component until a registered handler exists'
);

assert.equal(substackArticleAdapter.articleSource, 'substack-article', 'Substack adapter should expose article source metadata');
assert.equal(substackArticleAdapter.rootSelector, 'article.newsletter-post.post-viewer-post', 'Substack adapter should expose the article root selector');
assert.equal(substackArticleAdapter.contentSelector, '.available-content .body.markup', 'Substack adapter should expose the body markup selector');
assert.equal(
  substackArticleAdapter.specialComponents?.some(
    (component) => component.id === 'substack.twitter-embed' && component.handlerId === 'substack.twitter-embed' && component.type === 'embed'
  ),
  true,
  'Substack adapter should declare Twitter2ToDOM as a platform embed component'
);

assert.equal(LINE_LENS_SETTINGS_STORAGE_KEY, 'linelens.settings.v1', 'settings storage key should be versioned');
assert.equal(DEFAULT_SETTINGS.schemaVersion, 1, 'settings schema should be versioned');
assert.deepEqual(
  DEFAULT_SETTINGS.platformAdapters,
  {},
  'shared default settings should not embed content adapter config'
);
assert.deepEqual(
  Object.keys(DEFAULT_CONTENT_SETTINGS.platformAdapters),
  ['x.article', 'substack.article', 'fixture.article'],
  'content default settings should carry X, Substack, and fixture adapter config'
);
assert.equal(DEFAULT_CONTENT_SETTINGS.platformAdapters['x.article'].enabled, true, 'X adapter should be enabled by default');
assert.equal(DEFAULT_CONTENT_SETTINGS.platformAdapters['substack.article'].enabled, true, 'Substack adapter should be enabled by default');
assert.equal(DEFAULT_CONTENT_SETTINGS.platformAdapters['fixture.article'].enabled, true, 'fixture adapter should be enabled for local validation');
assert.deepEqual(
  DEFAULT_SETTINGS.reader,
  DEFAULT_READER_SETTINGS,
  'default settings should include Reader settings without requiring the UI to exist'
);
assert.deepEqual(
  READER_THEME_SETTINGS,
  ['system', 'warm-white', 'warm-yellow', 'soft-rose', 'soft-blue', 'soft-sage', 'soft-lavender', 'soft-peach', 'cool-gray'],
  'Reader settings should reserve known theme choices'
);
assert.deepEqual(READER_FONT_SCALE_SETTINGS, ['small', 'medium', 'large'], 'Reader settings should reserve font size choices');
assert.deepEqual(READER_LINE_HEIGHT_SETTINGS, ['compact', 'comfortable', 'spacious'], 'Reader settings should reserve line-height choices');
assert.deepEqual(READER_COLUMN_WIDTH_SETTINGS, ['narrow', 'standard', 'wide'], 'Reader settings should reserve column width choices');
assert.deepEqual(READER_FOCUS_GRANULARITY_SETTINGS, ['sentence', 'paragraph', 'block'], 'Reader settings should reserve FocusUnit granularity choices');
assert.deepEqual(READER_READING_MODE_SETTINGS, ['focus', 'continuous'], 'Reader settings should reserve reading mode choices');
assert.equal(fixtureArticleAdapter.validation?.titleStrategy, 'required', 'fixture adapter should exercise configurable title validation');
assert.deepEqual(fixtureArticleAdapter.cleanRules?.unwrapSelectors, ['.content-wrapper'], 'fixture adapter should exercise cleanRules unwrap semantics');

const replacementSpecialComponents = [
  {
    id: 'custom.social',
    type: 'social-card',
    rootSelector: '[data-custom-social]',
    handlerId: 'custom.social-handler',
    preserveSelectors: ['img', '[data-text]'],
    removeSelectors: ['button']
  }
];

const mergedAdapter = mergePlatformAdapterConfig(xArticleAdapter, {
  rootSelector: 'article[data-custom-root]',
  enabledFixes: ['normalize-handwritten-ordered-list'],
  semanticMap: {
    headingSelector: 'article h1',
    quoteSelector: ''
  },
  cleanRules: {
    removeSelectors: ['.ad-slot', '', ' [data-promoted] '],
    unwrapSelectors: ['.article-body-wrapper'],
    preserveAttributeNames: ['data-article-id']
  },
  readiness: {
    minTextLength: 500,
    minBlockCount: 5,
    requiredSelectors: ['article', ' h1 '],
    stableDomMs: 250
  },
  validation: {
    minBlockCount: 4,
    minTextLength: 450,
    titleStrategy: 'fallback-from-h1',
    emptyContentStrategy: 'allow-media-only'
  },
  specialComponents: replacementSpecialComponents,
  styleWhitelist: {
    preserveProps: ['font-style'],
    customColorSelectors: ['.rich-content strong']
  }
});
assert.equal(mergedAdapter.rootSelector, 'article[data-custom-root]', 'user config should override root selector');
assert.deepEqual(mergedAdapter.enabledFixes, ['normalize-handwritten-ordered-list'], 'user config should override enabled fixes declaratively');
assert.equal(mergedAdapter.semanticMap?.headingSelector, 'article h1', 'semanticMap should support field-level selector overrides');
assert.equal(mergedAdapter.semanticMap?.quoteSelector, xArticleAdapter.semanticMap?.quoteSelector, 'empty semanticMap selectors should be ignored');
assert.deepEqual(
  mergedAdapter.cleanRules?.removeSelectors,
  ['.ad-slot', '[data-promoted]'],
  'cleanRules.removeSelectors should accept only non-empty selector strings'
);
assert.deepEqual(
  mergedAdapter.cleanRules?.unwrapSelectors,
  ['.article-body-wrapper'],
  'cleanRules.unwrapSelectors should merge sanitized selector arrays'
);
assert.deepEqual(
  mergedAdapter.cleanRules?.preserveAttributeNames,
  ['data-article-id'],
  'cleanRules.preserveAttributeNames should merge sanitized string arrays'
);
assert.deepEqual(
  mergedAdapter.readiness,
  {
    minTextLength: 500,
    minBlockCount: 5,
    requiredSelectors: ['article', 'h1'],
    stableDomMs: 250
  },
  'readiness config should merge sanitized positive thresholds and selector arrays'
);
assert.deepEqual(
  mergedAdapter.validation,
  {
    minBlockCount: 4,
    minTextLength: 450,
    titleStrategy: 'fallback-from-h1',
    emptyContentStrategy: 'allow-media-only'
  },
  'validation config should merge sanitized positive thresholds and enum values'
);
assert.deepEqual(mergedAdapter.specialComponents, replacementSpecialComponents, 'specialComponents should replace defaults when the user provides a valid array');
assert.deepEqual(
  mergedAdapter.styleWhitelist.preserveProps,
  ['font-style'],
  'style whitelist arrays should replace defaults when user config provides the field'
);
assert.deepEqual(
  mergedAdapter.styleWhitelist.customColorSelectors,
  ['.rich-content strong'],
  'style whitelist should accept declarative custom selectors without hardcoded defaults'
);

const mergedSettings = mergeSettings(DEFAULT_CONTENT_SETTINGS, {
  reader: {
    theme: 'cool-gray',
    fontScale: 'large',
    lineHeight: 'spacious',
    columnWidth: 'wide',
    focusGranularity: 'paragraph',
    readingMode: 'continuous'
  },
  platformAdapters: {
    'x.article': {
      titleSelector: '[data-custom-title]',
      semanticMap: {
        paragraphSelector: 'article p'
      }
    }
  }
});
assert.equal(
  mergedSettings.platformAdapters['x.article'].titleSelector,
  '[data-custom-title]',
  'settings merge should apply user adapter overrides'
);
assert.equal(
  mergedSettings.platformAdapters['x.article'].semanticMap?.paragraphSelector,
  'article p',
  'settings merge should apply user semanticMap overrides'
);
assert.deepEqual(
  mergedSettings.reader,
  {
    theme: 'cool-gray',
    fontScale: 'large',
    lineHeight: 'spacious',
    columnWidth: 'wide',
    focusGranularity: 'paragraph',
    readingMode: 'continuous'
  },
  'settings merge should apply Reader setting overrides without mounting UI'
);

const normalized = normalizeSettings({
  schemaVersion: 999,
  reader: {
    theme: 'script',
    fontScale: 'huge',
    lineHeight: '<template>',
    columnWidth: 999,
    focusGranularity: 'source-dom',
    readingMode: 'ai-summary',
    script: 'alert(1)',
    template: '<script></script>'
  },
  platformAdapters: {
    'x.article': {
      rootSelector: '',
      semanticMap: {
        headingSelector: '',
        unknownSelector: 'script'
      },
      enabledFixes: ['unknown-fix', 'normalize-handwritten-ordered-list'],
      cleanRules: {
        removeSelectors: ['', 42, 'script'],
        unwrapSelectors: [],
        preserveAttributeNames: ['', 'data-safe']
      },
      readiness: {
        minTextLength: -1,
        minBlockCount: Number.POSITIVE_INFINITY,
        requiredSelectors: ['', 'main'],
        stableDomMs: 0,
        script: 'alert(1)'
      },
      validation: {
        minBlockCount: 0,
        minTextLength: NaN,
        titleStrategy: 'execute-script',
        emptyContentStrategy: 'template'
      },
      specialComponents: [{ id: 'unsafe', type: 'social-card', rootSelector: '', handlerId: 'unsafe', extract: 'alert(1)', template: '<script></script>' }],
      script: 'alert(1)'
    }
  }
}, DEFAULT_CONTENT_SETTINGS);
assert.equal(normalized.schemaVersion, 1, 'invalid schema versions should fall back to v1');
assert.deepEqual(normalized.reader, DEFAULT_READER_SETTINGS, 'invalid Reader settings should fall back to defaults');
assert.equal(Object.hasOwn(normalized.reader, 'script'), false, 'Reader settings should not allow arbitrary scripts');
assert.equal(Object.hasOwn(normalized.reader, 'template'), false, 'Reader settings should not allow HTML templates');
assert.equal(normalized.platformAdapters['x.article'].rootSelector, xArticleAdapter.rootSelector, 'empty selectors should fall back');
assert.equal(normalized.platformAdapters['x.article'].semanticMap?.headingSelector, xArticleAdapter.semanticMap?.headingSelector, 'empty semantic selectors should fall back');
assert.deepEqual(
  normalized.platformAdapters['x.article'].enabledFixes,
  ['normalize-handwritten-ordered-list'],
  'illegal fix ids should be ignored'
);
assert.deepEqual(
  normalized.platformAdapters['x.article'].cleanRules?.removeSelectors,
  ['script'],
  'settings should keep only valid cleanRules selector entries'
);
assert.deepEqual(
  normalized.platformAdapters['x.article'].cleanRules?.unwrapSelectors,
  xArticleAdapter.cleanRules?.unwrapSelectors,
  'empty cleanRules arrays should fall back to defaults'
);
assert.deepEqual(
  normalized.platformAdapters['x.article'].cleanRules?.preserveAttributeNames,
  ['data-safe'],
  'settings should keep only valid cleanRules string entries'
);
assert.equal(
  normalized.platformAdapters['x.article'].readiness?.minTextLength,
  xArticleAdapter.readiness?.minTextLength,
  'invalid readiness numbers should fall back to defaults'
);
assert.deepEqual(
  normalized.platformAdapters['x.article'].readiness?.requiredSelectors,
  ['main'],
  'readiness.requiredSelectors should keep only valid selectors'
);
assert.equal(
  Object.hasOwn(normalized.platformAdapters['x.article'].readiness ?? {}, 'script'),
  false,
  'readiness config should not allow arbitrary scripts'
);
assert.deepEqual(
  normalized.platformAdapters['x.article'].validation,
  xArticleAdapter.validation,
  'invalid validation thresholds and enum values should fall back to defaults'
);
assert.deepEqual(
  normalized.platformAdapters['x.article'].specialComponents,
  xArticleAdapter.specialComponents,
  'invalid specialComponents should fall back to adapter defaults'
);
assert.equal(
  normalized.platformAdapters['x.article'].specialComponents?.some((component) => Object.hasOwn(component, 'extract') || Object.hasOwn(component, 'template')),
  false,
  'settings should never preserve executable or template fields on specialComponents'
);
assert.equal(
  Object.hasOwn(normalized.platformAdapters['x.article'], 'script'),
  false,
  'settings should not allow arbitrary scripts'
);

const localStorageSettings = loadSettingsFromLocalStorage(fakeStorage({
  [LINE_LENS_SETTINGS_STORAGE_KEY]: JSON.stringify({
    schemaVersion: 1,
    reader: {
      theme: 'soft-sage',
      fontScale: 'small',
      lineHeight: 'compact',
      columnWidth: 'narrow',
      focusGranularity: 'block',
      readingMode: 'focus'
    },
    platformAdapters: {
      'x.article': {
        semanticMap: {
          imageSelector: 'article img'
        },
        cleanRules: {
          removeSelectors: ['.paywall']
        },
        readiness: {
          minBlockCount: 8
        },
        validation: {
          titleStrategy: 'optional'
        },
        styleWhitelist: {
          preserveProps: ['font-style'],
          preserveColorFor: ['inline-emphasis']
        }
      }
    }
  })
}), DEFAULT_CONTENT_SETTINGS);
assert.equal(
  localStorageSettings.platformAdapters['x.article'].semanticMap?.imageSelector,
  'article img',
  'localStorage settings should replace X semanticMap fields'
);
assert.deepEqual(
  localStorageSettings.reader,
  {
    theme: 'soft-sage',
    fontScale: 'small',
    lineHeight: 'compact',
    columnWidth: 'narrow',
    focusGranularity: 'block',
    readingMode: 'focus'
  },
  'localStorage settings should preserve sanitized Reader settings'
);
assert.deepEqual(
  localStorageSettings.platformAdapters['x.article'].cleanRules?.removeSelectors,
  ['.paywall'],
  'localStorage settings should replace cleanRules fields'
);
assert.equal(
  localStorageSettings.platformAdapters['x.article'].readiness?.minBlockCount,
  8,
  'localStorage settings should replace readiness fields'
);
assert.equal(
  localStorageSettings.platformAdapters['x.article'].validation?.titleStrategy,
  'optional',
  'localStorage settings should replace validation enum fields'
);
assert.deepEqual(
  localStorageSettings.platformAdapters['x.article'].styleWhitelist.preserveProps,
  ['font-style'],
  'localStorage settings should replace X-specific style whitelist fields'
);
assert.deepEqual(
  localStorageSettings.platformAdapters['x.article'].styleWhitelist.preserveColorFor,
  ['inline-emphasis'],
  'localStorage settings should replace X-specific color whitelist fields'
);
assert.equal(
  loadSettingsFromLocalStorage(fakeStorage({ [LINE_LENS_SETTINGS_STORAGE_KEY]: '{' }), DEFAULT_CONTENT_SETTINGS).platformAdapters['x.article'].rootSelector,
  xArticleAdapter.rootSelector,
  'invalid localStorage settings should fall back to defaults'
);

console.log('M3 adapter and settings verification passed');

function fakeStorage(values) {
  return {
    getItem(key) {
      return Object.hasOwn(values, key) ? values[key] : null;
    }
  };
}
