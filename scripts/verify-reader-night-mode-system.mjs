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
  ['--reader-theme-night-highlight-backdrop-filter', 'blur(20px)'],
  ['--reader-theme-night-panel-shadow', '0 18px 60px rgba(0, 0, 0, 0.38), 0 0 40px rgba(255, 255, 255, 0.12)'],
  ['--reader-theme-night-code-surface', '#131b2e'],
  ['--reader-theme-night-code-header', '#222a3d'],
  ['--reader-theme-night-code-pre-surface', 'rgba(255, 255, 255, 0.08)'],
  ['--reader-theme-night-media-placeholder', 'rgba(255, 255, 255, 0.08)'],
  ['--reader-theme-night-column-width', '680px'],
  ['--reader-theme-night-page-padding-x', '24px'],
  ['--reader-theme-night-title-size', 'clamp(2rem, 5vw, 3rem)'],
  ['--reader-theme-night-title-line-height', '1.17'],
  ['--reader-theme-night-title-weight', '700'],
  ['--reader-theme-night-body-size', '20px'],
  ['--reader-theme-night-body-line-height', '1.8'],
  ['--reader-theme-night-radius-content', '16px'],
  ['--reader-theme-night-radius-sm', '8px'],
  ['--reader-theme-night-radius-xl', '48px'],
  ['--reader-theme-night-font', 'Inter, "Atkinson Hyperlegible", "LXGW WenKai TC", system-ui, sans-serif']
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
  ['--reader-highlight-backdrop-filter', 'var(--reader-theme-night-highlight-backdrop-filter)'],
  ['--reader-column-width', 'var(--reader-theme-night-column-width)'],
  ['--reader-page-padding-x', 'var(--reader-theme-night-page-padding-x)'],
  ['--reader-title-size', 'var(--reader-theme-night-title-size)'],
  ['--reader-title-line-height', 'var(--reader-theme-night-title-line-height)'],
  ['--reader-title-weight', 'var(--reader-theme-night-title-weight)'],
  ['--reader-body-size', 'var(--reader-theme-night-body-size)'],
  ['--reader-body-line-height', 'var(--reader-theme-night-body-line-height)'],
  ['--reader-radius-content', 'var(--reader-theme-night-radius-content)'],
  ['--reader-radius-sm', 'var(--reader-theme-night-radius-sm)'],
  ['--reader-font-body', 'var(--reader-theme-night-font)'],
  ['--reader-font-display', 'var(--reader-theme-night-font)'],
  ['--reader-font-ui', 'var(--reader-theme-night-font)'],
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
assert.match(read('public/styles/focus.css'), /backdrop-filter:\s*var\(--reader-highlight-backdrop-filter\);/, 'active focus surface should consume the tokenized spotlight backdrop filter');

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
