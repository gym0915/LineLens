import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const repoRoot = resolve(import.meta.dirname, '..');

function read(path) {
  return readFileSync(resolve(repoRoot, path), 'utf8');
}

const readerApp = read('src/reader/reader-app.ts');
const tokensCss = read('public/styles/tokens.css');
const overlaysCss = read('public/styles/overlays.css');

for (const token of [
  ['--reader-theme-warm-white-bg', '#faf9f5'],
  ['--reader-theme-warm-yellow-bg', '#fff8da'],
  ['--reader-theme-soft-rose-bg', '#f9e8ec'],
  ['--reader-theme-soft-blue-bg', '#e2ecf5'],
  ['--reader-theme-soft-sage-bg', '#e3eddf'],
  ['--reader-theme-soft-lavender-bg', '#ede4f2'],
  ['--reader-theme-soft-peach-bg', '#feeadd'],
  ['--reader-theme-cool-gray-bg', '#e6e8eb']
]) {
  assert(tokensCss.includes(token[0] + ': ' + token[1] + ';'), token[0] + ' should use the requested theme color');
}

for (const token of [
  '--reader-theme-bg',
  '--reader-settings-button-size',
  '--reader-settings-panel-width',
  '--reader-theme-switch-width',
  '--reader-theme-switch-height',
  '--reader-theme-switch-gap',
  '--reader-theme-switch-thumb-size',
  '--reader-settings-divider',
  '--reader-settings-control-height',
  '--reader-settings-focus-outline',
  '--reader-settings-menu-animation-duration'
]) {
  assert(tokensCss.includes(token + ':'), token + ' should live in reader design tokens');
}

assert(readerApp.includes('READER_THEME_OPTIONS'), 'Theme options should be centralized in reader-app');
assert(readerApp.includes('createReaderThemeSettings('), 'Reader should mount a settings UI shell');
assert(readerApp.includes('applyReaderTheme('), 'Reader should apply selected theme through one function');
assert(readerApp.includes('createReaderThemeSwitch('), 'Reader should mount theme switch outside the settings panel');
assert(readerApp.includes('reader-theme-switch'), 'Reader should expose the standalone theme switch');
assert(readerApp.includes('createMoonIcon('), 'Theme switch should expose a moon state');
assert(readerApp.includes('createSunIcon('), 'Theme switch should expose a sun state');
assert(readerApp.includes('reader-settings-button'), 'Reader should expose a bottom-right settings button');
assert(readerApp.includes('reader-settings-panel'), 'Reader should expose a settings panel');
assert(readerApp.includes('reader-settings-divider'), 'Reader settings should include section dividers');
assert(!readerApp.includes('reader-settings-swatch'), 'Theme swatches should be removed from the settings panel');
assert(readerApp.includes('reader-settings-clarity'), 'Reader should expose clarity controls');
assert(readerApp.includes('reader-settings-fonts'), 'Reader should expose font controls');
assert(readerApp.includes('READER_CLARITY_OPTIONS'), 'Clarity options should be centralized');
assert(readerApp.includes('READER_FONT_OPTIONS'), 'Font options should be centralized');
assert(readerApp.includes('createSliderSettingsIcon('), 'Settings button should use the slider icon from the reference');
assert(readerApp.includes('aria-pressed'), 'Interactive setting choices should expose active state');
assert(readerApp.includes('dataset.readerTheme'), 'Theme selection should update the semantic reader theme dataset');
assert(!readerApp.includes('warm-yellow'), 'Standalone switch should only expose the first and last theme choices');
assert(!/#(?:faf9f5|fff8da|f9e8ec|e2ecf5|e3eddf|ede4f2|feeadd|e6e8eb)/i.test(readerApp), 'Reader app should not hard-code theme colors');

for (const selector of [
  '.reader-settings',
  '.reader-theme-switch',
  '.reader-theme-switch-input',
  '.reader-theme-switch-slider',
  '.reader-theme-switch-thumb',
  '.reader-settings-button',
  '.reader-settings-panel',
  '.reader-settings-title',
  '.reader-settings-divider',
  '.reader-settings-clarity',
  '.reader-settings-clarity-option',
  '.reader-settings-fonts',
  '.reader-settings-font-option'
]) {
  assert(overlaysCss.includes(selector + ' {'), selector + ' should be styled in overlays.css');
}

assert(overlaysCss.includes('bottom: var(--reader-settings-offset);'), 'Settings entry should use offset token');
assert(overlaysCss.includes('right: calc(var(--reader-settings-offset) + var(--reader-settings-button-size) + var(--reader-theme-switch-gap));'), 'Theme switch should sit to the left of the settings button');
assert(overlaysCss.includes('bottom: calc(var(--reader-settings-offset) + (var(--reader-settings-button-size) / 2));'), 'Theme switch should align to the settings button vertical center');
assert(overlaysCss.includes('transform: translateY(50%);'), 'Theme switch should center itself from its midpoint');
assert(overlaysCss.includes('width: var(--reader-settings-panel-width);'), 'Settings panel should use width token');
assert(overlaysCss.includes('width: var(--reader-theme-switch-width);'), 'Theme switch should use switch width token');
assert(overlaysCss.includes('height: var(--reader-theme-switch-height);'), 'Theme switch should use switch height token');
assert(tokensCss.includes('--reader-theme-switch-width: 54px;'), 'Theme switch should be noticeably smaller than the first pass');
assert(tokensCss.includes('--reader-theme-switch-height: 28px;'), 'Theme switch height should be reduced');
assert(tokensCss.includes('--reader-theme-switch-icon-inset:'), 'Theme switch icon placement should be tokenized');
assert(overlaysCss.includes('transform: translateX(var(--reader-theme-switch-thumb-shift));'), 'Theme switch thumb should slide through a tokenized distance');
assert(overlaysCss.includes('.reader-theme-switch.is-cool-gray .reader-theme-switch-thumb') && overlaysCss.includes('transform: translateX(0);'), 'Night switch state should keep the thumb on the left like the reference');
assert(overlaysCss.includes('z-index: 2;'), 'Theme switch icons should sit above the thumb on the pill track');
assert(!overlaysCss.includes('.reader-settings-swatch'), 'Settings swatch styles should be removed');
assert(overlaysCss.includes('animation: reader-settings-panel-enter var(--reader-settings-menu-animation-duration)'), 'Settings panel should animate on open');
assert(overlaysCss.includes('@keyframes reader-settings-panel-enter'), 'Settings panel should define its popover animation');
assert(overlaysCss.includes('height: var(--reader-settings-control-height);'), 'Settings controls should use control height token');
assert(!/#(?:faf9f5|fff8da|f9e8ec|e2ecf5|e3eddf|ede4f2|feeadd|e6e8eb)/i.test(overlaysCss), 'Overlay CSS should not hard-code theme colors');

console.log('verify:reader-theme-settings-ui passed');
