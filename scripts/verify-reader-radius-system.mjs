import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const repoRoot = resolve(import.meta.dirname, '..');

function read(path) {
  return readFileSync(resolve(repoRoot, path), 'utf8');
}

const tokensCss = read('public/styles/tokens.css');
const readerCss = read('public/reader.css');
const layoutCss = read('public/styles/layout.css');
const focusCss = read('public/styles/focus.css');
const mediaCss = read('public/styles/media.css');
const socialCss = read('public/styles/social-card.css');
const codeCss = read('public/styles/code.css');
const blocksCss = read('public/styles/blocks.css');
const responsiveCss = read('public/styles/responsive.css');
const overlaysCss = read('public/styles/overlays.css');

for (const [token, value] of [
  ['--reader-system-background', '#faf9f5'],
  ['--reader-system-foreground', '#2c2521'],
  ['--reader-system-card', '#ffffff'],
  ['--reader-theme-warm-white-bg', '#faf9f5'],
  ['--reader-theme-warm-white-code-bg', '#ececea'],
  ['--reader-theme-warm-white-ref-bg', '#fdfcfa'],
  ['--reader-theme-warm-yellow-bg', '#fff7d2'],
  ['--reader-theme-soft-rose-bg', '#f7e1e7'],
  ['--reader-theme-soft-blue-bg', '#dbe7f3'],
  ['--reader-theme-soft-sage-bg', '#dde9d7'],
  ['--reader-theme-soft-lavender-bg', '#e8dcef'],
  ['--reader-theme-soft-peach-bg', '#fde5d6'],
  ['--reader-theme-cool-gray-bg', '#e0e2e6'],
  ['--reader-radius-content', '8px'],
  ['--reader-body-line-height', '1.9'],
  ['--reader-quote-line-height', '1.85'],
  ['--reader-list-line-height', '1.8'],
  ['--reader-code-line-height', '1.55'],
  ['--reader-table-line-height', '1.5'],
  ['--reader-card-shadow', '0 2px 14px rgba(44, 37, 33, 0.11)'],
  ['--reader-font-body', '"EB Garamond", Georgia, serif'],
  ['--reader-font-display', '"Playfair Display", Georgia, serif'],
  ['--reader-font-ui', '"DM Sans", system-ui, sans-serif'],
  ['--reader-font-mono', '"DM Mono", "Fira Mono", Menlo, Consolas, monospace'],
  ['--reader-social-ink', 'rgb(15, 20, 25)'],
  ['--reader-social-muted', 'rgb(83, 100, 113)'],
  ['--reader-social-blue', 'rgb(29, 155, 240)'],
  ['--reader-social-border', 'rgb(207, 217, 222)'],
  ['--reader-social-surface', 'var(--reader-canvas)']
]) {
  assert(
    hasTokenDeclaration(tokensCss, token, value),
    `design token ${token} should be extracted from Clean Reading Page as ${value}`
  );
}

assert.doesNotMatch(tokensCss, /--reader-code-token-/, 'code highlight colors should follow the phase4 worktree CSS path, not design tokens');

assert.match(readerCss, /family=DM\+Mono/, 'reader should import the mono font used by the design system');
assert.match(readerCss, /family=EB\+Garamond/, 'reader should import the Clean Reading Page body font');
assert.match(tokensCss, /--reader-radius-card:\s*var\(--reader-radius-content\);/, 'card radius should resolve through the content radius token');
assert.match(tokensCss, /--reader-radius-media:\s*var\(--reader-radius-content\);/, 'media radius should resolve through the content radius token');

const requiredRadiusSelectors = [
  [focusCss, 'p .focus-unit.is-active'],
  [focusCss, '.reader-simple-tweet.focus-unit.is-active'],
  [mediaCss, '.reader-media img'],
  [mediaCss, '.reader-media-frame'],
  [mediaCss, '.reader-image-gallery-grid'],
  [mediaCss, '.reader-gif-media'],
  [mediaCss, '.reader-video-media'],
  [socialCss, '.reader-simple-tweet'],
  [socialCss, '.reader-simple-tweet-frame'],
  [socialCss, '.reader-simple-tweet-photo-grid'],
  [socialCss, '.reader-simple-tweet-photo-layout'],
  [socialCss, '.reader-simple-tweet-media'],
  [socialCss, '.reader-simple-tweet .reader-video-media'],
  [socialCss, '.reader-simple-tweet-quoted'],
  [socialCss, '.reader-simple-tweet-condensed-media .reader-simple-tweet-media'],
  [socialCss, '.reader-simple-tweet-condensed-media .reader-simple-tweet-photo-grid'],
  [socialCss, '.reader-simple-tweet-video-preview-rounded-square'],
  [codeCss, '.reader-code'],
  [blocksCss, '.reader-table']
];

for (const [css, selector] of requiredRadiusSelectors) {
  assert(
    hasRuleDeclaration(css, selector, 'border-radius', 'var(--reader-radius-content)') ||
      hasRuleDeclaration(css, selector, 'border-radius', 'var(--reader-radius-card)') ||
      hasRuleDeclaration(css, selector, 'border-radius', 'var(--reader-radius-media)'),
    `${selector} should use the reader radius design token`
  );
}

for (const [name, css] of [
  ['layout', layoutCss],
  ['focus', focusCss],
  ['media', mediaCss],
  ['social-card', socialCss],
  ['code', codeCss],
  ['blocks', blocksCss],
  ['responsive', responsiveCss],
  ['overlays', overlaysCss]
]) {
  assert.doesNotMatch(css, /font-family:\s*"(?:EB Garamond|Playfair Display|DM Sans|DM Mono|Lora)"/, `${name} font family should use design tokens`);
  assert.doesNotMatch(css, /border-radius:\s*(?:4|8|10|12|16)px/, `${name} content radius should not be hard-coded`);
}

const cssOutsideTokens = [
  layoutCss,
  focusCss,
  mediaCss,
  socialCss,
  codeCss,
  blocksCss,
  responsiveCss,
  overlaysCss
].join('\n');

for (const hardCodedValue of [
  '#2c2521',
  '#ffffff',
  'rgb(15, 20, 25)',
  'rgb(83, 100, 113)',
  'rgb(29, 155, 240)',
  'rgb(207, 217, 222)',
  '0 2px 14px rgba(44, 37, 33, 0.11)',
  '0 2px 8px rgba(15, 20, 25, 0.08)'
]) {
  assert(!cssOutsideTokens.includes(hardCodedValue), `${hardCodedValue} should only live in tokens.css`);
}

assert.match(layoutCss, /font-family:\s*var\(--reader-font-body\);/, 'reader shell should use body font token');
assert.match(layoutCss, /line-height:\s*var\(--reader-body-line-height\);/, 'article body should use the body line-height token');
assert.match(blocksCss, /\.reader-block\[data-block-type="quote"\]\s*\{[\s\S]*?line-height:\s*var\(--reader-quote-line-height\);/, 'quote blocks should use the quote line-height token');
assert.match(blocksCss, /\.reader-list-item\s*\{[\s\S]*?line-height:\s*var\(--reader-list-line-height\);/, 'list items should use the list line-height token');
assert.match(blocksCss, /\.reader-table-cell\s*\{[\s\S]*?line-height:\s*var\(--reader-table-line-height\);/, 'table cells should use the table line-height token');
assert.match(codeCss, /font-family:\s*var\(--reader-font-mono\);/, 'code blocks should use mono font token');
assert.match(codeCss, /line-height:\s*var\(--reader-code-line-height\);/, 'code blocks should use the code line-height token');
for (const [selector, color] of [
  ['.reader-code-token-keyword', '#b724b7'],
  ['.reader-code-token-tag', '#bd6500'],
  ['.reader-code-token-string', '#2f73ff'],
  ['.reader-code-token-comment', 'rgba(44, 37, 33, 0.42)'],
  ['.reader-code-token-heading', '#f05247'],
  ['.reader-code-token-number', '#7a5a00'],
  ['.reader-code-token-punctuation', 'rgba(44, 37, 33, 0.72)']
]) {
  assert(hasRuleDeclaration(codeCss, selector, 'color', color), `${selector} should keep the phase4 worktree color ${color}`);
}
assert.match(socialCss, /color:\s*var\(--reader-social-muted\);/, 'social cards should use social color tokens');
assert.match(socialCss, /\.reader-simple-tweet-frame\s*\{[\s\S]*?background:\s*var\(--reader-social-surface\);/, 'simpleTweet frame should read background from the social surface token');
assert.match(socialCss, /\.reader-simple-tweet-quoted\s*\{[\s\S]*?background:\s*var\(--reader-social-surface\);/, 'quoted simpleTweet should read background from the social surface token');
assert.match(overlaysCss, /box-shadow:\s*var\(--reader-overlay-shadow\);/, 'overlay shadow should use the design shadow token');

console.log('verify:reader-radius-system passed');

function hasTokenDeclaration(css, token, value) {
  return new RegExp(`${escapeRegExp(token)}\\s*:\\s*${escapeRegExp(value)}\\s*;`).test(css);
}

function hasRuleDeclaration(css, selector, property, value) {
  for (const rule of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selectors = rule[1].split(',').map((item) => item.trim());
    if (!selectors.includes(selector.trim())) continue;
    if (new RegExp(`${escapeRegExp(property)}\\s*:\\s*${escapeRegExp(value)}\\s*;`).test(rule[2])) {
      return true;
    }
  }
  return false;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${ }()|[\]\\]/g, '\\$&');
}
