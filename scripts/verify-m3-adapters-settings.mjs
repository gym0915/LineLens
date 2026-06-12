import assert from 'node:assert/strict';
import {
  BUILT_IN_PLATFORM_ADAPTERS,
  resolvePlatformAdapter,
  xArticleAdapter,
  weixinArticleAdapter
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
const weixinUrl = new URL('https://mp.weixin.qq.com/s/example');
const unsupportedUrl = new URL('https://example.com/story');

assert.equal(BUILT_IN_PLATFORM_ADAPTERS.length >= 2, true, 'built-in adapters should include X and Weixin drafts');
assert.equal(resolvePlatformAdapter(xUrl)?.id, 'x.article', 'resolver should match x.com article URLs');
assert.equal(resolvePlatformAdapter(twitterUrl)?.id, 'x.article', 'resolver should match twitter.com article URLs');
assert.equal(resolvePlatformAdapter(weixinUrl)?.id, 'weixin.article', 'resolver should match mp.weixin.qq.com drafts');
assert.equal(resolvePlatformAdapter(unsupportedUrl), null, 'resolver should reject unsupported hosts');

assert.equal(xArticleAdapter.rootSelector, '[data-testid="twitterArticleReadView"]', 'X adapter should expose the article root selector');
assert.equal(xArticleAdapter.titleSelector, '[data-testid="twitter-article-title"]', 'X adapter should expose the title selector');
assert.equal(xArticleAdapter.contentSelector, '[data-testid="longformRichTextComponent"]', 'X adapter should expose the longform selector');
assert.equal(xArticleAdapter.fixes.some((fix) => fix.id === 'expand-folded-tweet-text'), true, 'X adapter should expose known extractor fixes');
assert.equal(xArticleAdapter.styleWhitelist.preserveProps.includes('font-weight'), true, 'X adapter should expose content style whitelist');

assert.equal(weixinArticleAdapter.id, 'weixin.article', 'Weixin draft should have a stable adapter id');
assert.equal(weixinArticleAdapter.hosts.includes('weixin.qq.com'), true, 'Weixin draft should cover weixin.qq.com');
assert.equal(weixinArticleAdapter.hosts.includes('mp.weixin.qq.com'), true, 'Weixin draft should cover mp.weixin.qq.com');
assert.equal(weixinArticleAdapter.rootSelector, '#js_content', 'Weixin draft should express a root selector');
assert.equal(weixinArticleAdapter.titleSelector, '#activity-name', 'Weixin draft should express a title selector');
assert.equal(weixinArticleAdapter.enabled, false, 'Weixin draft should be disabled until extractor support exists');

assert.equal(LINE_LENS_SETTINGS_STORAGE_KEY, 'linelens.settings.v1', 'settings storage key should be versioned');
assert.equal(DEFAULT_SETTINGS.schemaVersion, 1, 'settings schema should be versioned');
assert.equal(DEFAULT_SETTINGS.platformAdapters['x.article'].enabled, true, 'X adapter should be enabled by default');
assert.equal(DEFAULT_SETTINGS.platformAdapters['weixin.article'].enabled, false, 'Weixin draft should be disabled by default');

const mergedAdapter = mergePlatformAdapterConfig(xArticleAdapter, {
  rootSelector: 'article[data-custom-root]',
  enabledFixes: ['normalize-handwritten-ordered-list'],
  styleWhitelist: {
    preserveProps: ['font-style'],
    customColorSelectors: ['.rich_media_content strong']
  }
});
assert.equal(mergedAdapter.rootSelector, 'article[data-custom-root]', 'user config should override root selector');
assert.deepEqual(mergedAdapter.enabledFixes, ['normalize-handwritten-ordered-list'], 'user config should override enabled fixes declaratively');
assert.deepEqual(
  mergedAdapter.styleWhitelist.preserveProps,
  ['font-style'],
  'style whitelist arrays should replace defaults when user config provides the field'
);
assert.deepEqual(
  mergedAdapter.styleWhitelist.customColorSelectors,
  ['.rich_media_content strong'],
  'style whitelist should accept declarative custom selectors without hardcoded defaults'
);

const mergedSettings = mergeSettings(DEFAULT_SETTINGS, {
  platformAdapters: {
    'x.article': {
      titleSelector: '[data-custom-title]'
    }
  }
});
assert.equal(
  mergedSettings.platformAdapters['x.article'].titleSelector,
  '[data-custom-title]',
  'settings merge should apply user adapter overrides'
);
assert.equal(
  mergedSettings.platformAdapters['weixin.article'].rootSelector,
  '#js_content',
  'settings merge should preserve untouched built-in drafts'
);

const normalized = normalizeSettings({
  schemaVersion: 999,
  platformAdapters: {
    'x.article': {
      rootSelector: '',
      enabledFixes: ['unknown-fix', 'normalize-handwritten-ordered-list'],
      script: 'alert(1)'
    }
  }
});
assert.equal(normalized.schemaVersion, 1, 'invalid schema versions should fall back to v1');
assert.equal(normalized.platformAdapters['x.article'].rootSelector, xArticleAdapter.rootSelector, 'empty selectors should fall back');
assert.deepEqual(
  normalized.platformAdapters['x.article'].enabledFixes,
  ['normalize-handwritten-ordered-list'],
  'illegal fix ids should be ignored'
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
        styleWhitelist: {
          preserveProps: ['font-style'],
          preserveColorFor: ['inline-emphasis']
        }
      },
      'weixin.article': {
        enabled: true,
        styleWhitelist: {
          preserveProps: ['letter-spacing'],
          customColorSelectors: ['.custom-rich-text strong']
        }
      }
    }
  })
}));
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
  localStorageSettings.platformAdapters['weixin.article'].enabled,
  true,
  'localStorage settings should apply platform-specific adapter flags'
);
assert.deepEqual(
  localStorageSettings.platformAdapters['weixin.article'].styleWhitelist.customColorSelectors,
  ['.custom-rich-text strong'],
  'localStorage settings should replace Weixin-specific style whitelist fields independently'
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
