import assert from 'node:assert/strict';
import {
  BUILT_IN_PLATFORM_ADAPTERS,
  resolvePlatformAdapter,
  xArticleAdapter
} from '../dist/content/adapters/index.js';
import {
  DEFAULT_SETTINGS,
  LINE_LENS_SETTINGS_STORAGE_KEY,
  loadSettingsFromLocalStorage,
  mergePlatformAdapterConfig,
  mergeSettings,
  normalizeSettings
} from '../dist/shared/settings.js';

const xUrl = new URL('https://x.com/example/article/123456789');
const twitterUrl = new URL('https://twitter.com/example/article/123456789');
const futurePlatformUrl = new URL('https://future.example.com/article/123');
const unsupportedUrl = new URL('https://example.com/story');

assert.deepEqual(BUILT_IN_PLATFORM_ADAPTERS.map((adapter) => adapter.id), ['x.article'], 'built-in adapters should only include X in this schema pass');
assert.equal(resolvePlatformAdapter(xUrl)?.id, 'x.article', 'resolver should match x.com article URLs');
assert.equal(resolvePlatformAdapter(twitterUrl)?.id, 'x.article', 'resolver should match twitter.com article URLs');
assert.equal(resolvePlatformAdapter(futurePlatformUrl), null, 'resolver should not match removed future-platform drafts');
assert.equal(resolvePlatformAdapter(unsupportedUrl), null, 'resolver should reject unsupported hosts');

assert.equal(xArticleAdapter.rootSelector, '[data-testid="twitterArticleReadView"]', 'X adapter should expose the article root selector');
assert.equal(xArticleAdapter.titleSelector, '[data-testid="twitter-article-title"]', 'X adapter should expose the title selector');
assert.equal(xArticleAdapter.contentSelector, '[data-testid="longformRichTextComponent"]', 'X adapter should expose the longform selector');
assert.equal(xArticleAdapter.fixes.some((fix) => fix.id === 'expand-folded-tweet-text'), true, 'X adapter should expose known extractor fixes');
assert.equal(xArticleAdapter.styleWhitelist.preserveProps.includes('font-weight'), true, 'X adapter should expose content style whitelist');

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

assert.equal(
  xArticleAdapter.specialComponents?.some((component) => component.id === 'x.simple-tweet' && component.handlerId === 'x.simple-tweet' && component.type === 'social-card'),
  true,
  'X adapter should declare the simpleTweet special component'
);
assert.equal(
  xArticleAdapter.specialComponents?.some((component) => component.id === 'x.video-or-gif' && component.handlerId === 'x.video-or-gif' && component.type === 'video'),
  true,
  'X adapter should declare the video/GIF special component'
);

assert.equal(LINE_LENS_SETTINGS_STORAGE_KEY, 'linelens.settings.v1', 'settings storage key should be versioned');
assert.equal(DEFAULT_SETTINGS.schemaVersion, 1, 'settings schema should be versioned');
assert.deepEqual(Object.keys(DEFAULT_SETTINGS.platformAdapters), ['x.article'], 'default settings should only carry X adapter config');
assert.equal(DEFAULT_SETTINGS.platformAdapters['x.article'].enabled, true, 'X adapter should be enabled by default');

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

const mergedSettings = mergeSettings(DEFAULT_SETTINGS, {
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

const normalized = normalizeSettings({
  schemaVersion: 999,
  platformAdapters: {
    'x.article': {
      rootSelector: '',
      semanticMap: {
        headingSelector: '',
        unknownSelector: 'script'
      },
      enabledFixes: ['unknown-fix', 'normalize-handwritten-ordered-list'],
      specialComponents: [{ id: 'unsafe', type: 'social-card', rootSelector: '', handlerId: 'unsafe' }],
      script: 'alert(1)'
    }
  }
});
assert.equal(normalized.schemaVersion, 1, 'invalid schema versions should fall back to v1');
assert.equal(normalized.platformAdapters['x.article'].rootSelector, xArticleAdapter.rootSelector, 'empty selectors should fall back');
assert.equal(normalized.platformAdapters['x.article'].semanticMap?.headingSelector, xArticleAdapter.semanticMap?.headingSelector, 'empty semantic selectors should fall back');
assert.deepEqual(
  normalized.platformAdapters['x.article'].enabledFixes,
  ['normalize-handwritten-ordered-list'],
  'illegal fix ids should be ignored'
);
assert.deepEqual(
  normalized.platformAdapters['x.article'].specialComponents,
  xArticleAdapter.specialComponents,
  'invalid specialComponents should fall back to adapter defaults'
);
assert.equal(
  Object.hasOwn(normalized.platformAdapters['x.article'], 'script'),
  false,
  'settings should not allow arbitrary scripts'
);

const localStorageSettings = loadSettingsFromLocalStorage(fakeStorage({
  [LINE_LENS_SETTINGS_STORAGE_KEY]: JSON.stringify({
    schemaVersion: 1,
    platformAdapters: {
      'x.article': {
        semanticMap: {
          imageSelector: 'article img'
        },
        styleWhitelist: {
          preserveProps: ['font-style'],
          preserveColorFor: ['inline-emphasis']
        }
      }
    }
  })
}));
assert.equal(
  localStorageSettings.platformAdapters['x.article'].semanticMap?.imageSelector,
  'article img',
  'localStorage settings should replace X semanticMap fields'
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
  loadSettingsFromLocalStorage(fakeStorage({ [LINE_LENS_SETTINGS_STORAGE_KEY]: '{' })).platformAdapters['x.article'].rootSelector,
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
