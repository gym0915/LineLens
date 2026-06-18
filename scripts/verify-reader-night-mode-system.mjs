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

assert.doesNotMatch(
  read('public/styles/focus.css'),
  /backdrop-filter\s*:/,
  'focus.css should not use backdrop-filter for inline active focus because it creates a separate night-mode rendering path'
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
