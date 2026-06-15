import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const repoRoot = resolve(import.meta.dirname, '..');

function read(path) {
  return readFileSync(resolve(repoRoot, path), 'utf8');
}

const tokensCss = read('public/styles/tokens.css');
const readerCss = read('public/reader.css');
const fontsCss = read('public/styles/fonts.css');
const layoutCss = read('public/styles/layout.css');
const focusCss = read('public/styles/focus.css');
const mediaCss = read('public/styles/media.css');
const socialCss = read('public/styles/social-card.css');
const codeCss = read('public/styles/code.css');
const blocksCss = read('public/styles/blocks.css');
const responsiveCss = read('public/styles/responsive.css');
const overlaysCss = read('public/styles/overlays.css');
const rendererSource = read('src/reader/block-renderer.ts');
const textRendererSource = read('src/reader/reader-text-renderer.ts');

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
  ['--reader-title-size', 'clamp(2rem, 5vw, 2.75rem)'],
  ['--reader-title-line-height', '1.18'],
  ['--reader-title-weight', '600'],
  ['--reader-body-size', '16.5px'],
  ['--reader-body-weight', '400'],
  ['--reader-body-line-height', '1.9'],
  ['--reader-heading-size', '22px'],
  ['--reader-heading-line-height', '1.35'],
  ['--reader-heading-weight', '600'],
  ['--reader-quote-size', '17px'],
  ['--reader-quote-line-height', '1.85'],
  ['--reader-list-size', 'var(--reader-body-size)'],
  ['--reader-list-line-height', '1.8'],
  ['--reader-embed-size', '14px'],
  ['--reader-embed-line-height', '1.7'],
  ['--reader-code-ui-size', '13px'],
  ['--reader-code-body-size', '13.5px'],
  ['--reader-code-line-height', '1.55'],
  ['--reader-table-line-height', '1.5'],
  ['--reader-card-shadow', '0 2px 14px rgba(44, 37, 33, 0.11)'],
  ['--reader-font-body', '"Atkinson Hyperlegible", "LXGW WenKai TC", system-ui, sans-serif'],
  ['--reader-font-display', '"Atkinson Hyperlegible", "LXGW WenKai TC", system-ui, sans-serif'],
  ['--reader-font-ui', '"Atkinson Hyperlegible", "LXGW WenKai TC", system-ui, sans-serif'],
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

assert.doesNotMatch(readerCss, /fonts\.googleapis\.com/, 'reader should not depend on remote Google font CSS');
assert.match(readerCss, /@import "\.\/styles\/fonts\.css";/, 'reader should import local font faces');
for (const fontFile of [
  'AtkinsonHyperlegible-Regular.woff2',
  'AtkinsonHyperlegible-Bold.woff2',
  'AtkinsonHyperlegible-Italic.woff2',
  'AtkinsonHyperlegible-BoldItalic.woff2',
  'lxgw-wenkai-tc-v10-latin-regular.woff2',
  'lxgw-wenkai-tc-v10-latin-300.woff2',
  'lxgw-wenkai-tc-v10-latin-700.woff2'
]) {
  assert(fontsCss.includes(`../fonts/${fontFile}`), `local font face should reference ${fontFile}`);
}
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
assert.match(layoutCss, /font-size:\s*var\(--reader-title-size\);/, 'article title should use the title size token');
assert.match(layoutCss, /font-weight:\s*var\(--reader-title-weight\);/, 'article title should use the title weight token');
assert.match(layoutCss, /line-height:\s*var\(--reader-title-line-height\);/, 'article title should use the title line-height token');
assert.match(layoutCss, /font-size:\s*var\(--reader-body-size\);/, 'article body should use the body size token');
assert.match(layoutCss, /font-weight:\s*var\(--reader-body-weight\);/, 'article body should use the body weight token');
assert.match(layoutCss, /line-height:\s*var\(--reader-body-line-height\);/, 'article body should use the body line-height token');
assert.match(blocksCss, /\.reader-block\[data-block-type="heading"\]\s*\{[\s\S]*?font-size:\s*var\(--reader-heading-size\);/, 'heading blocks should use the heading size token');
assert.match(blocksCss, /\.reader-block\[data-block-type="heading"\]\s*\{[\s\S]*?font-weight:\s*var\(--reader-heading-weight\);/, 'heading blocks should use the heading weight token');
assert.match(blocksCss, /\.reader-block\[data-block-type="heading"\]\s*\{[\s\S]*?line-height:\s*var\(--reader-heading-line-height\);/, 'heading blocks should use the heading line-height token');
assert.match(blocksCss, /\.reader-block\[data-block-type="quote"\]\s*\{[\s\S]*?font-size:\s*var\(--reader-quote-size\);/, 'quote blocks should use the quote size token');
assert.match(blocksCss, /\.reader-block\[data-block-type="quote"\]\s*\{[\s\S]*?line-height:\s*var\(--reader-quote-line-height\);/, 'quote blocks should use the quote line-height token');
assert.match(blocksCss, /\.reader-embed\s*\{[\s\S]*?font-size:\s*var\(--reader-embed-size\);/, 'embed blocks should use the embed size token');
assert.match(blocksCss, /\.reader-embed\s*\{[\s\S]*?line-height:\s*var\(--reader-embed-line-height\);/, 'embed blocks should use the embed line-height token');
assert.match(blocksCss, /\.reader-list-item\s*\{[\s\S]*?font-size:\s*var\(--reader-list-size\);/, 'list items should use the list size token');
assert.match(blocksCss, /\.reader-list-item\s*\{[\s\S]*?line-height:\s*var\(--reader-list-line-height\);/, 'list items should use the list line-height token');
assert.match(blocksCss, /\.reader-table-cell\s*\{[\s\S]*?line-height:\s*var\(--reader-table-line-height\);/, 'table cells should use the table line-height token');
assert.match(codeCss, /font-family:\s*var\(--reader-font-mono\);/, 'code blocks should use mono font token');
assert.match(codeCss, /\.reader-code-language\s*\{[\s\S]*?font-size:\s*var\(--reader-code-ui-size\);/, 'code language label should use the code UI size token');
assert.match(codeCss, /\.reader-code-pre\s*\{[\s\S]*?font-size:\s*var\(--reader-code-body-size\);/, 'code pre should use the code body size token');
assert.match(codeCss, /line-height:\s*var\(--reader-code-line-height\);/, 'code blocks should use the code line-height token');
assert.doesNotMatch(rendererSource, /function renderTextBlock[\s\S]*?applyTextStyle\(element, textStyle\);[\s\S]*?function getHeadingTagName/, 'ordinary Reader text blocks should not apply source textStyle inline');
assert.doesNotMatch(textRendererSource, /if \(style\.fontSize\) element\.style\.fontSize = style\.fontSize;/, 'inline Reader text should not apply source font-size');
assert.doesNotMatch(textRendererSource, /if \(style\.lineHeight\) element\.style\.lineHeight = style\.lineHeight;/, 'inline Reader text should not apply source line-height');
assert.doesNotMatch(textRendererSource, /if \(style\.textAlign\) element\.style\.textAlign = style\.textAlign;/, 'inline Reader text should not apply source text-align');
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
