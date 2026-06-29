import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const repoRoot = resolve(import.meta.dirname, '..');

function read(path) {
  return readFileSync(resolve(repoRoot, path), 'utf8');
}

const packageJson = JSON.parse(read('package.json'));
const tokensCss = read('public/styles/tokens.css');
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
  packageJson.scripts['verify:reader-night-mode-system'],
  'node scripts/verify-reader-night-mode-system.mjs',
  'night mode verifier should be exposed as an npm script'
);

for (const [token, value] of [
  ['--reader-theme-night-bg', '#0b1325'],
  ['--reader-theme-night-foreground', '#dae2fc'],
  ['--reader-theme-night-active', '#ffffff'],
  ['--reader-theme-night-title', '#ffffff'],
  ['--reader-theme-night-card', '#171f32'],
  ['--reader-theme-night-card-high', '#222a3d'],
  ['--reader-theme-night-secondary', '#bfc6e0'],
  ['--reader-theme-night-secondary-container', '#3f465c'],
  ['--reader-theme-night-border', 'rgba(255, 255, 255, 0.1)'],
  ['--reader-theme-night-border-faint', 'rgba(255, 255, 255, 0.08)'],
  ['--reader-theme-night-muted', 'rgba(218, 226, 252, 0.08)'],
  ['--reader-theme-night-hover', 'rgba(218, 226, 252, 0.42)'],
  ['--reader-theme-night-subtle', 'rgba(218, 226, 252, 0.62)'],
  ['--reader-theme-night-highlight-surface', 'rgba(255, 255, 255, 0.1)'],
  ['--reader-theme-night-highlight-shadow', '0 0 40px rgba(255, 255, 255, 0.15)'],
  ['--reader-theme-night-panel-shadow', '0 18px 60px rgba(0, 0, 0, 0.38), 0 0 40px rgba(255, 255, 255, 0.12)'],
  ['--reader-theme-night-code-surface', '#131b2e'],
  ['--reader-theme-night-code-header', '#222a3d'],
  ['--reader-theme-night-code-pre-surface', 'rgba(255, 255, 255, 0.08)'],
  ['--reader-theme-night-media-placeholder', 'rgba(255, 255, 255, 0.08)'],
]) {
  assert(hasTokenDeclaration(tokensCss, token, value), token + ' should expose DESIGN.md night mode value ' + value);
}

assert.match(tokensCss, /color-scheme:\s*light;/, 'day mode should declare a light color scheme');
assert.match(tokensCss, /@media\s*\(prefers-color-scheme:\s*dark\)\s*\{\s*:root\s*\{[\s\S]*?color-scheme:\s*dark;/, 'night mode should switch through prefers-color-scheme only');

for (const [token, value] of [
  ['--reader-system-background', 'var(--reader-theme-night-bg)'],
  ['--reader-system-foreground', 'var(--reader-theme-night-foreground)'],
  ['--reader-canvas', 'var(--reader-system-background)'],
  ['--reader-ink', 'var(--reader-system-foreground)'],
  ['--reader-text-active', 'var(--reader-theme-night-active)'],
  ['--reader-text-title', 'var(--reader-theme-night-title)'],
  ['--reader-highlight-surface', 'var(--reader-theme-night-highlight-surface)'],
  ['--reader-highlight-shadow', 'var(--reader-theme-night-highlight-shadow)'],
  ['--reader-social-ink', 'var(--reader-theme-night-foreground)'],
  ['--reader-social-muted', 'var(--reader-theme-night-subtle)'],
  ['--reader-social-blue', 'var(--reader-theme-night-secondary)'],
  ['--reader-social-blue-outline', 'rgba(191, 198, 224, 0.45)'],
  ['--reader-social-border', 'var(--reader-theme-night-border)'],
  ['--reader-social-surface', 'var(--reader-theme-night-card)'],
  ['--reader-social-media-border', 'var(--reader-theme-night-border)'],
  ['--reader-social-media-placeholder', 'var(--reader-theme-night-card-high)']
]) {
  assert(hasMediaTokenDeclaration(tokensCss, token, value), token + ' should map to the night theme inside prefers-color-scheme');
}

assert.doesNotMatch(allStyleCss, /matchMedia|localStorage|dataset\.readerTheme|applyReaderTheme|createReaderThemeSwitch/, 'system theme switching should not add Reader runtime theme logic');

// Layout, font, and typography tokens must be shared between day and night modes.
// Only color tokens should differ between themes.
const sharedTokens = [
  '--reader-column-width', '--reader-page-padding-x',
  '--reader-title-size', '--reader-title-line-height', '--reader-title-weight',
  '--reader-body-size', '--reader-body-weight', '--reader-body-line-height',
  '--reader-radius-content', '--reader-radius-sm',
  '--reader-font-body', '--reader-font-display', '--reader-font-ui',
  '--reader-heading-size', '--reader-heading-weight', '--reader-heading-line-height',
  '--reader-quote-size', '--reader-quote-line-height',
  '--reader-list-size', '--reader-list-line-height',
  '--reader-embed-size', '--reader-embed-line-height',
  '--reader-code-ui-size', '--reader-code-body-size', '--reader-code-line-height',
  '--reader-table-line-height',
  '--reader-paragraph-gap', '--reader-media-gap'
];
const darkMediaBlock = tokensCss.match(/@media\s*\(prefers-color-scheme:\s*dark\)\s*\{\s*:root\s*\{([\s\S]*?)\n\s*\}\s*\}/);
assert(darkMediaBlock, 'tokens.css should contain one :root dark media block');
for (const token of sharedTokens) {
  assert(!new RegExp(escapeRegExp(token) + '\\s*:').test(darkMediaBlock[1]),
    token + ' must not be overridden in dark mode — layout/font/typography is shared between themes');
}
assert.doesNotMatch(
  tokensCss,
  /--reader-(?:theme-night-)?highlight-backdrop-filter\s*:/,
  'highlight focus should not expose a theme-dependent backdrop-filter token because day and night must share one rendering mechanism'
);

assert.match(tokensCss, /--reader-table-surface\s*:/, 'table surface should be owned by Reader theme tokens');
assert.match(tokensCss, /--reader-table-header-surface\s*:/, 'table header surface should be owned by Reader theme tokens');
assert.match(tokensCss, /--reader-table-border\s*:/, 'table border should be owned by Reader theme tokens');
assert.match(tokensCss, /--reader-table-active-border\s*:/, 'active table border should be owned by Reader theme tokens');
assert.match(tokensCss, /--reader-table-ink\s*:/, 'table text color should be owned by Reader theme tokens');
assert.match(tokensCss, /--reader-table-header-ink\s*:/, 'table header text color should be owned by Reader theme tokens');

assert(
  hasMediaTokenDeclaration(tokensCss, '--reader-table-border', 'var(--reader-theme-night-border-faint)'),
  'inactive night-mode table borders should use the faint border token'
);
assert(
  hasMediaTokenDeclaration(tokensCss, '--reader-table-active-border', 'rgba(218, 226, 252, 0.52)'),
  'active night-mode table borders should keep the brighter active table line'
);
assert.match(
  read('public/styles/focus.css'),
  /\.reader-table\.focus-unit\.is-active\s*\{[\s\S]*?--reader-table-border:\s*var\(--reader-table-active-border\);/,
  'active tables should brighten their inherited table border token only in active state'
);

assert.doesNotMatch(
  read('public/styles/focus.css'),
  /backdrop-filter\s*:/,
  'focus.css should not use backdrop-filter for inline active focus because it creates a separate night-mode rendering path'
);

const overlaysCss = read('public/styles/overlays.css');
assert.match(
  overlaysCss,
  /\.highlight-layer\.is-visible\s*\{[\s\S]*?opacity:\s*1;/,
  'shared HighlightLayer should remain visible in night mode'
);
assert.match(
  overlaysCss,
  /\.highlight-focus\s*\{[\s\S]*?background:\s*var\(--reader-highlight-surface\);[\s\S]*?box-shadow:\s*var\(--reader-highlight-shadow\);/,
  'shared HighlightLayer should own the night-mode focus surface and halo'
);
assert.doesNotMatch(
  read('public/styles/focus.css'),
  /\.focus-unit\.is-active[\s\S]*?box-shadow:\s*var\(--reader-card-shadow\);/,
  'active FocusUnit components should not duplicate the shared focus halo'
);
assert.doesNotMatch(
  read('public/styles/focus.css'),
  /\.focus-unit\.is-active[\s\S]*?background:\s*var\(--reader-highlight-surface\);/,
  'active FocusUnit components should not duplicate the shared focus background'
);

console.log('verify:reader-night-mode-system passed');

function hasTokenDeclaration(css, token, value) {
  return new RegExp(escapeRegExp(token) + '\\s*:\\s*' + escapeRegExp(value) + '\\s*;').test(css);
}

function hasMediaTokenDeclaration(css, token, value) {
  const mediaBlock = css.match(/@media\s*\(prefers-color-scheme:\s*dark\)\s*\{\s*:root\s*\{([\s\S]*?)\n\s*\}\s*\}/);
  assert(mediaBlock, 'tokens.css should contain one :root dark media block');
  return hasTokenDeclaration(mediaBlock[1], token, value);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^$()|[\]\\]/g, '\\$&').replace(/[{}]/g, '\\$&');
}
