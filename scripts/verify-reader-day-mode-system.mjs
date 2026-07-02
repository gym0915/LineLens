import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const repoRoot = resolve(import.meta.dirname, '..');

function read(path) {
  return readFileSync(resolve(repoRoot, path), 'utf8');
}

const packageJson = JSON.parse(read('package.json'));
const tokensCss = read('public/styles/tokens.css');
const codeCss = read('public/styles/code.css');
const readerApp = read('src/reader/reader-app.ts');
const overlaysCss = read('public/styles/overlays.css');
const allStyleCss = [
  'public/styles/base.css',
  'public/styles/blocks.css',
  'public/styles/code.css',
  'public/styles/focus.css',
  'public/styles/layout.css',
  'public/styles/media.css',
  'public/styles/overlays.css',
  'public/styles/responsive.css',
  'public/styles/social-card.css',
  'public/styles/text.css',
  'public/styles/tokens.css'
].map(read).join('\n');

assert.equal(
  packageJson.scripts['verify:reader-day-mode-system'],
  'node scripts/verify-reader-day-mode-system.mjs',
  'day mode verifier should be exposed as an npm script'
);

assert.match(tokensCss, /:root\s*\{[\s\S]*?color-scheme:\s*light;/, 'day mode should declare a light color scheme in :root');
assert.match(tokensCss, /@media\s*\(prefers-color-scheme:\s*dark\)/, 'night mode should remain a system media query override');

for (const [token, value] of [
  ['--reader-theme-warm-white-bg', '#F9F7F3'],
  ['--reader-theme-warm-white-code-bg', '#ECECEA'],
  ['--reader-theme-warm-white-ref-bg', '#FDFCFA'],
  ['--reader-theme-warm-yellow-bg', '#FFF7D2'],
  ['--reader-theme-warm-yellow-code-bg', '#F5EEC0'],
  ['--reader-theme-warm-yellow-ref-bg', '#FFFEF0'],
  ['--reader-theme-soft-rose-bg', '#F7E1E7'],
  ['--reader-theme-soft-rose-code-bg', '#EDD0D8'],
  ['--reader-theme-soft-rose-ref-bg', '#FDF4F7'],
  ['--reader-theme-soft-blue-bg', '#DBE7F3'],
  ['--reader-theme-soft-blue-code-bg', '#C9D9EB'],
  ['--reader-theme-soft-blue-ref-bg', '#EEF4FB'],
  ['--reader-theme-soft-sage-bg', '#DDE9D7'],
  ['--reader-theme-soft-sage-code-bg', '#CCDDC4'],
  ['--reader-theme-soft-sage-ref-bg', '#EEF5EA'],
  ['--reader-theme-soft-lavender-bg', '#E8DCEF'],
  ['--reader-theme-soft-lavender-code-bg', '#DACCE5'],
  ['--reader-theme-soft-lavender-ref-bg', '#F5F0FA'],
  ['--reader-theme-soft-peach-bg', '#FDE5D6'],
  ['--reader-theme-soft-peach-code-bg', '#F3D4C0'],
  ['--reader-theme-soft-peach-ref-bg', '#FEF4EE'],
  ['--reader-theme-cool-gray-bg', '#E0E2E6'],
  ['--reader-theme-cool-gray-code-bg', '#CED0D4'],
  ['--reader-theme-cool-gray-ref-bg', '#F2F3F5']
]) {
  assert(hasTokenDeclaration(tokensCss, token, value), token + ' should match Clean Reading Page light palette value ' + value);
}

for (const [token, value] of [
  ['--reader-system-background', '#F9F7F3'],
  ['--reader-system-foreground', '#2c2521'],
  ['--reader-system-card', '#ffffff'],
  ['--reader-system-border', 'rgba(44, 37, 33, 0.10)'],
  ['--reader-canvas', 'var(--reader-system-background)'],
  ['--reader-ink', 'var(--reader-system-foreground)'],
  ['--reader-text-title', '#2C2521'],
  ['--reader-text-active', 'var(--reader-system-foreground)'],
  ['--reader-dim-low', 'rgba(44, 37, 33, 0.38)'],
  ['--reader-dim-medium', 'rgba(44, 37, 33, 0.22)'],
  ['--reader-dim-high', 'rgba(44, 37, 33, 0.11)'],
  ['--reader-text-muted', 'var(--reader-dim-medium)'],
  ['--reader-text-hover', 'rgba(44, 37, 33, 0.60)'],
  ['--reader-text-chrome', 'rgba(44, 37, 33, 0.35)'],
  ['--reader-text-subtle', 'var(--reader-dim-low)'],
  ['--reader-highlight-surface', 'var(--reader-system-card)'],
  ['--reader-card-shadow', '0 2px 14px rgba(44, 37, 33, 0.11)'],
  ['--reader-highlight-shadow', 'var(--reader-card-shadow)'],
  ['--reader-highlight-outline', 'rgba(44, 37, 33, 0.16)'],
  ['--reader-quote-border-muted', 'rgba(44, 37, 33, 0.18)'],
  ['--reader-quote-border-active', 'rgba(44, 37, 33, 0.55)'],
  ['--reader-border-subtle', 'var(--reader-system-border)'],
  ['--reader-border-faint', 'rgba(44, 37, 33, 0.08)'],
  ['--reader-progress-track', 'var(--reader-border-faint)'],
  ['--reader-progress-fill', 'var(--reader-dim-low)'],
  ['--reader-code-surface', 'var(--reader-theme-warm-white-code-bg)'],
  ['--reader-code-header', 'var(--reader-theme-warm-white-code-bg)'],
  ['--reader-code-pre-surface', 'var(--reader-theme-warm-white-code-bg)'],
  ['--reader-media-placeholder', 'rgba(44, 37, 33, 0.06)'],
  ['--reader-media-active-border', 'rgba(44, 37, 33, 0.14)'],
  ['--reader-toast-surface', 'rgba(44, 37, 33, 0.9)'],
  ['--reader-toast-ink', '#f7f2ea'],
  ['--reader-social-surface', 'var(--reader-canvas)'],
  ['--reader-subscribe-widget-shadow', 'none']
]) {
  assert(hasTokenDeclaration(tokensCss, token, value), token + ' should expose day mode system value ' + value);
}

assert.match(
  codeCss,
  /\.reader-code-token-themed\s*\{[\s\S]*?--reader-active-code-token-color:\s*var\(--reader-code-token-light-color\);/,
  'code token colors should still come from extracted light syntax variables'
);
assert.match(
  codeCss,
  /@media\s*\(prefers-color-scheme:\s*dark\)[\s\S]*--reader-active-code-token-color:\s*var\(--reader-code-token-dark-color, var\(--reader-code-token-light-color\)\);/,
  'code token colors should keep extracted dark syntax fallback support'
);
assert.doesNotMatch(tokensCss, /--reader-code-token-/, 'Reader design tokens should not define source syntax token colors');

for (const forbiddenUiSymbol of [
  'createReaderThemeSettings(',
  'createReaderThemeSwitch(',
  'reader-settings-panel',
  'reader-settings-button',
  'reader-theme-switch',
  'dataset.readerTheme'
]) {
  assert(!readerApp.includes(forbiddenUiSymbol), 'day mode token work must not mount Reader settings UI: ' + forbiddenUiSymbol);
}

for (const forbiddenStyleSelector of [
  '.reader-settings',
  '.reader-theme-switch',
  '.reader-settings-panel',
  '.reader-settings-button'
]) {
  assert(!overlaysCss.includes(forbiddenStyleSelector), 'day mode token work must not add visible Reader settings UI styles: ' + forbiddenStyleSelector);
}

assert.doesNotMatch(
  allStyleCss,
  /dataset\.readerTheme|applyReaderTheme|createReaderThemeSwitch/,
  'day mode token work should not add runtime theme switching hooks to CSS/static assets'
);

console.log('verify:reader-day-mode-system passed');

function hasTokenDeclaration(css, token, value) {
  return new RegExp(escapeRegExp(token) + '\\s*:\\s*' + escapeRegExp(value) + '\\s*;').test(css);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^$()|[\]\\]/g, '\\$&').replace(/[{}]/g, '\\$&');
}
