import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  DEFAULT_READER_SETTINGS,
  READER_COLUMN_WIDTH_SETTINGS,
  READER_FOCUS_GRANULARITY_SETTINGS,
  READER_FONT_SCALE_SETTINGS,
  READER_LINE_HEIGHT_SETTINGS,
  READER_READING_MODE_SETTINGS,
  READER_THEME_SETTINGS
} from '../dist/shared/reader-config.js';
import { DEFAULT_SETTINGS, normalizeSettings } from '../dist/shared/settings.js';

const repoRoot = resolve(import.meta.dirname, '..');

function read(path) {
  return readFileSync(resolve(repoRoot, path), 'utf8');
}

const readerApp = read('src/reader/reader-app.ts');
const overlaysCss = read('public/styles/overlays.css');
const settingsSource = read('src/shared/settings.ts');
const readerConfigSource = read('src/shared/reader-config.ts');

assert.deepEqual(DEFAULT_SETTINGS.reader, DEFAULT_READER_SETTINGS, 'Reader settings should be part of the default settings schema');
assert.deepEqual(
  READER_THEME_SETTINGS,
  ['system', 'warm-white', 'warm-yellow', 'soft-rose', 'soft-blue', 'soft-sage', 'soft-lavender', 'soft-peach', 'cool-gray'],
  'Reader theme schema should reserve system plus token-backed themes'
);
assert.deepEqual(READER_FONT_SCALE_SETTINGS, ['small', 'medium', 'large'], 'Reader font-size schema should be reserved as data');
assert.deepEqual(READER_LINE_HEIGHT_SETTINGS, ['compact', 'comfortable', 'spacious'], 'Reader line-height schema should be reserved as data');
assert.deepEqual(READER_COLUMN_WIDTH_SETTINGS, ['narrow', 'standard', 'wide'], 'Reader column-width schema should be reserved as data');
assert.deepEqual(READER_FOCUS_GRANULARITY_SETTINGS, ['sentence', 'paragraph', 'block'], 'Reader FocusUnit granularity schema should be reserved as data');
assert.deepEqual(READER_READING_MODE_SETTINGS, ['focus', 'continuous'], 'Reader reading-mode schema should be reserved as data');

assert.deepEqual(
  normalizeSettings({
    schemaVersion: 1,
    reader: {
      theme: 'soft-blue',
      fontScale: 'large',
      lineHeight: 'spacious',
      columnWidth: 'wide',
      focusGranularity: 'paragraph',
      readingMode: 'continuous'
    }
  }).reader,
  {
    theme: 'soft-blue',
    fontScale: 'large',
    lineHeight: 'spacious',
    columnWidth: 'wide',
    focusGranularity: 'paragraph',
    readingMode: 'continuous'
  },
  'valid Reader settings should be normalized as declarative data'
);
assert.deepEqual(
  normalizeSettings({
    schemaVersion: 1,
    reader: {
      theme: 'custom-css',
      fontScale: 'calc(100vw)',
      lineHeight: '<template>',
      columnWidth: () => 'wide',
      focusGranularity: 'source-dom',
      readingMode: 'summary-panel',
      script: 'alert(1)',
      template: '<script></script>'
    }
  }).reader,
  DEFAULT_READER_SETTINGS,
  'invalid Reader settings should fall back without preserving scripts or templates'
);

for (const forbiddenUiSymbol of [
  'createReaderThemeSettings(',
  'createReaderThemeSwitch(',
  'reader-settings-panel',
  'reader-settings-button',
  'reader-theme-switch',
  'dataset.readerTheme'
]) {
  assert(!readerApp.includes(forbiddenUiSymbol), `P3 should reserve Reader settings schema without mounting UI: ${forbiddenUiSymbol}`);
}

for (const forbiddenStyleSelector of [
  '.reader-settings',
  '.reader-theme-switch',
  '.reader-settings-panel',
  '.reader-settings-button'
]) {
  assert(!overlaysCss.includes(forbiddenStyleSelector), `P3 should not add visible Reader settings UI styles: ${forbiddenStyleSelector}`);
}

for (const requiredSourceToken of [
  'ReaderSettingsConfig',
  'DEFAULT_READER_SETTINGS',
  'READER_THEME_SETTINGS',
  'READER_FONT_SCALE_SETTINGS',
  'READER_LINE_HEIGHT_SETTINGS',
  'READER_COLUMN_WIDTH_SETTINGS',
  'READER_FOCUS_GRANULARITY_SETTINGS',
  'READER_READING_MODE_SETTINGS'
]) {
  assert(readerConfigSource.includes(requiredSourceToken), `${requiredSourceToken} should live in reader-config.ts`);
}
assert(settingsSource.includes('mergeReaderSettingsConfig'), 'settings normalization should merge Reader settings in shared settings');

console.log('verify:reader-theme-settings-ui passed');
