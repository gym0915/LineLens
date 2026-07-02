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
  ['--reader-system-background', '#F9F7F3'],
  ['--reader-system-foreground', '#2c2521'],
  ['--reader-system-card', '#ffffff'],
  ['--reader-theme-warm-white-bg', '#F9F7F3'],
  ['--reader-theme-warm-white-code-bg', '#ECECEA'],
  ['--reader-theme-warm-white-ref-bg', '#FDFCFA'],
  ['--reader-theme-warm-yellow-bg', '#FFF7D2'],
  ['--reader-theme-soft-rose-bg', '#F7E1E7'],
  ['--reader-theme-soft-blue-bg', '#DBE7F3'],
  ['--reader-theme-soft-sage-bg', '#DDE9D7'],
  ['--reader-theme-soft-lavender-bg', '#E8DCEF'],
  ['--reader-theme-soft-peach-bg', '#FDE5D6'],
  ['--reader-theme-cool-gray-bg', '#E0E2E6'],
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
  ['--reader-social-surface', 'var(--reader-canvas)'],
  ['--reader-meta-avatar-size', '40px'],
  ['--reader-meta-author-primary-size', '17px'],
  ['--reader-meta-author-secondary-size', '16px'],
  ['--reader-meta-metrics-size', '14px'],
  ['--reader-meta-metric-icon-size', '20px'],
  ['--reader-social-card-avatar-size', '48px'],
  ['--reader-social-card-padding', '14px 16px 12px'],
  ['--reader-social-card-author-primary-size', '17px'],
  ['--reader-social-card-author-secondary-size', '16px'],
  ['--reader-social-card-text-size', '16.5px'],
  ['--reader-social-card-show-more-size', '16px'],
  ['--reader-social-card-actions-size', '14px'],
  ['--reader-social-card-action-icon-size', '20px'],
  ['--reader-social-card-avatar-size-mobile', '40px'],
  ['--reader-social-card-padding-mobile', '12px'],
  ['--reader-social-card-author-primary-size-mobile', '16px'],
  ['--reader-social-card-author-secondary-size-mobile', '15px'],
  ['--reader-social-card-text-size-mobile', '15.5px'],
  ['--reader-social-card-condensed-media-size-mobile', '76px'],
  ['--reader-social-card-actions-size-mobile', '14px'],
  ['--reader-social-card-action-icon-size-mobile', '20px'],
  ['--reader-media-preview-control-size', '42px'],
  ['--reader-media-preview-control-icon-size', '28px'],
  ['--reader-media-preview-image-enter-duration', '400ms'],
  ['--reader-media-preview-status-size', '14px'],
  ['--reader-media-control-height', '24px'],
  ['--reader-media-gif-pause-width', '28px'],
  ['--reader-media-gif-badge-size', '13px'],
  ['--reader-media-gif-icon-size', '15px'],
  ['--reader-media-error-min-height', '140px'],
  ['--reader-social-article-title-size', '19px'],
  ['--reader-social-article-excerpt-size', '16.5px'],
  ['--reader-social-article-avatar-size', '40px'],
  ['--reader-social-article-author-primary-size', '17px'],
  ['--reader-social-article-author-secondary-size', '16px'],
  ['--reader-social-article-metrics-size', '14px'],
  ['--reader-social-article-metric-icon-size', '20px'],
  ['--reader-social-condensed-media-size', '84px'],
  ['--reader-social-condensed-video-badge-size', '12px'],
  ['--reader-social-condensed-text-size', '15px'],
  ['--reader-toast-size', '13px'],
  ['--reader-hint-size', '10px'],
  ['--reader-kicker-size', '10px'],
  ['--reader-social-card-compact-avatar-size', '24px'],
  ['--reader-social-card-compact-author-size', '15px'],
  ['--reader-social-card-shell-photo-gap', '26px'],
  ['--reader-social-card-shell-video-gap', '20px'],
  ['--reader-social-card-video-portrait-max-width', '360px'],
  ['--reader-social-card-reply-size', '16px'],
  ['--reader-social-card-translation-icon-size', '20px'],
  ['--reader-social-card-ai-generated-size', '14px'],
  ['--reader-social-card-ai-generated-icon-size', '18px'],
  ['--reader-social-media-grid-gap', '1px'],
  ['--reader-social-video-duration-size', '15px'],
  ['--reader-social-source-size', '12px'],
  ['--reader-social-source-icon-size', '13px'],
  ['--reader-media-gallery-gap', '2px'],
  ['--reader-media-load-error-size', '14px']
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

for (const [name, css] of [
  ['layout', layoutCss],
  ['media', mediaCss],
  ['overlays', overlaysCss],
  ['responsive', responsiveCss],
  ['social-card', socialCss]
]) {
  for (const declaration of collectRawDimensionalDeclarations(css)) {
    assert(
      declaration.value.includes('var(') || isAllowedStructuralDimensionalDeclaration(declaration),
      `${name} should not keep tokenizable raw dimensional value: ${declaration.property}: ${declaration.value}`
    );
  }
}

assert.match(layoutCss, /font-family:\s*var\(--reader-font-body\);/, 'reader shell should use body font token');
assert.match(layoutCss, /\.reader-kicker\s*\{[\s\S]*?top:\s*var\(--reader-kicker-top\);[\s\S]*?left:\s*var\(--reader-kicker-left\);[\s\S]*?font-size:\s*var\(--reader-kicker-size\);/, 'reader kicker should use kicker position and size tokens');
assert.match(layoutCss, /font-size:\s*var\(--reader-title-size\);/, 'article title should use the title size token');
assert.match(layoutCss, /\.article-title\s*\{[\s\S]*?margin:\s*0 0 var\(--reader-title-margin-bottom\);/, 'article title margin should use the title margin token');
assert.match(layoutCss, /font-weight:\s*var\(--reader-title-weight\);/, 'article title should use the title weight token');
assert.match(layoutCss, /line-height:\s*var\(--reader-title-line-height\);/, 'article title should use the title line-height token');
assert.match(layoutCss, /font-size:\s*var\(--reader-body-size\);/, 'article body should use the body size token');
assert.match(layoutCss, /font-weight:\s*var\(--reader-body-weight\);/, 'article body should use the body weight token');
assert.match(layoutCss, /line-height:\s*var\(--reader-body-line-height\);/, 'article body should use the body line-height token');
assert.match(layoutCss, /\.article-meta-avatar\s*\{[\s\S]*?width:\s*var\(--reader-meta-avatar-size\);[\s\S]*?height:\s*var\(--reader-meta-avatar-size\);/, 'article meta avatar should use the meta avatar size token');
assert.match(layoutCss, /\.article-meta-author-primary\s*\{[\s\S]*?font-size:\s*var\(--reader-meta-author-primary-size\);/, 'article meta primary author text should use the meta primary size token');
assert.match(layoutCss, /\.article-meta-author-secondary\s*\{[\s\S]*?font-size:\s*var\(--reader-meta-author-secondary-size\);/, 'article meta secondary text should use the meta secondary size token');
assert.match(layoutCss, /\.article-meta-metrics\s*\{[\s\S]*?font-size:\s*var\(--reader-meta-metrics-size\);/, 'article meta metrics should use the meta metrics size token');
assert.match(layoutCss, /\.article-meta-metric-icon\s*\{[\s\S]*?width:\s*var\(--reader-meta-metric-icon-size\);[\s\S]*?height:\s*var\(--reader-meta-metric-icon-size\);/, 'article meta metric icons should use the meta icon size token');
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
assert.match(socialCss, /\.reader-simple-tweet\s*\{[\s\S]*?margin:\s*var\(--reader-social-card-margin-block\) 0;/, 'simpleTweet card margin should use the social card margin token');
assert.match(socialCss, /\.reader-simple-tweet-frame\s*\{[\s\S]*?grid-template-columns:\s*var\(--reader-social-card-avatar-size\) minmax\(0, 1fr\);/, 'simpleTweet frame should use the social card avatar size token for its grid column');
assert.match(socialCss, /\.reader-simple-tweet-frame\s*\{[\s\S]*?padding:\s*var\(--reader-social-card-padding\);/, 'simpleTweet frame padding should use the social card padding token');
assert.match(socialCss, /\.reader-simple-tweet-avatar\s*\{[\s\S]*?width:\s*var\(--reader-social-card-avatar-size\);[\s\S]*?height:\s*var\(--reader-social-card-avatar-size\);/, 'simpleTweet avatar should use the social card avatar size token');
assert.match(socialCss, /\.reader-simple-tweet-author-primary\s*\{[\s\S]*?font-size:\s*var\(--reader-social-card-author-primary-size\);/, 'simpleTweet primary author text should use the social card primary size token');
assert.match(socialCss, /\.reader-simple-tweet-author-secondary\s*\{[\s\S]*?font-size:\s*var\(--reader-social-card-author-secondary-size\);/, 'simpleTweet secondary author text should use the social card secondary size token');
assert.match(socialCss, /\.reader-simple-tweet-verified-icon\s*\{[\s\S]*?width:\s*var\(--reader-social-card-verified-icon-size\);[\s\S]*?height:\s*var\(--reader-social-card-verified-icon-size\);/, 'simpleTweet verified icon should use the social card verified icon token');
assert.match(socialCss, /\.reader-simple-tweet-text-container\s*\{[\s\S]*?font-size:\s*var\(--reader-social-card-text-size\);/, 'simpleTweet text body should use the social card text size token');
assert.match(socialCss, /\.reader-simple-tweet-show-more\s*\{[\s\S]*?font-size:\s*var\(--reader-social-card-show-more-size\);/, 'simpleTweet show-more control should use the social card show-more size token');
assert.match(socialCss, /\.reader-simple-tweet-actions\s*\{[\s\S]*?font-size:\s*var\(--reader-social-card-actions-size\);/, 'simpleTweet actions should use the social card actions size token');
assert.match(socialCss, /\.reader-simple-tweet-action-icon\s*\{[\s\S]*?width:\s*var\(--reader-social-card-action-icon-size\);[\s\S]*?height:\s*var\(--reader-social-card-action-icon-size\);/, 'simpleTweet action icons should use the social card action icon size token');
assert.match(socialCss, /\.reader-simple-tweet-frame\s*\{[\s\S]*?background:\s*var\(--reader-social-surface\);/, 'simpleTweet frame should read background from the social surface token');
assert.match(socialCss, /\.reader-simple-tweet-quoted\s*\{[\s\S]*?background:\s*var\(--reader-social-surface\);/, 'quoted simpleTweet should read background from the social surface token');
assert.match(socialCss, /\.reader-simple-tweet-frame-compact\s*\{[\s\S]*?grid-template-columns:\s*var\(--reader-social-card-compact-avatar-size\) minmax\(0, 1fr\);[\s\S]*?padding:\s*var\(--reader-social-card-compact-padding\);/, 'compact simpleTweet frame should use compact card tokens');
assert.match(socialCss, /\.reader-simple-tweet-frame-compact \.reader-simple-tweet-avatar\s*\{[\s\S]*?width:\s*var\(--reader-social-card-compact-avatar-size\);[\s\S]*?height:\s*var\(--reader-social-card-compact-avatar-size\);/, 'compact simpleTweet avatar should use compact avatar token');
assert.match(socialCss, /\.reader-simple-tweet-shell-photo\s*\{[\s\S]*?gap:\s*var\(--reader-social-card-shell-photo-gap\);/, 'simpleTweet photo shell should use the photo shell gap token');
assert.match(socialCss, /\.reader-simple-tweet-shell-video\s*\{[\s\S]*?gap:\s*var\(--reader-social-card-shell-video-gap\);/, 'simpleTweet video shell should use the video shell gap token');
assert.match(socialCss, /\.reader-simple-tweet-video-portrait\s*\{[\s\S]*?width:\s*min\(100%, var\(--reader-social-card-video-portrait-max-width\)\);/, 'portrait tweet video should use the portrait max-width token');
assert.match(socialCss, /\.reader-simple-tweet-reply-context,[\s\S]*?\.reader-simple-tweet-translation\s*\{[\s\S]*?font-size:\s*var\(--reader-social-card-reply-size\);/, 'reply and translation context should use the reply size token');
assert.match(socialCss, /\.reader-simple-tweet-translation-icon\s*\{[\s\S]*?width:\s*var\(--reader-social-card-translation-icon-size\);[\s\S]*?height:\s*var\(--reader-social-card-translation-icon-size\);/, 'translation icon should use the translation icon token');
assert.match(socialCss, /\.reader-simple-tweet-ai-generated\s*\{[\s\S]*?font-size:\s*var\(--reader-social-card-ai-generated-size\);/, 'AI generated badge should use the AI generated size token');
assert.match(socialCss, /\.reader-simple-tweet-ai-generated-icon\s*\{[\s\S]*?width:\s*var\(--reader-social-card-ai-generated-icon-size\);[\s\S]*?height:\s*var\(--reader-social-card-ai-generated-icon-size\);/, 'AI generated icon should use the AI generated icon token');
assert.match(socialCss, /\.reader-simple-tweet-photo-grid\s*\{[\s\S]*?gap:\s*var\(--reader-social-media-grid-gap\);/, 'simpleTweet photo grid should use the social media grid gap token');
assert.match(socialCss, /\.reader-simple-tweet-photo-layout\s*\{[\s\S]*?gap:\s*var\(--reader-social-media-grid-gap\);/, 'simpleTweet photo layout should use the social media grid gap token');
assert.match(socialCss, /\.reader-simple-tweet-video-duration\s*\{[\s\S]*?left:\s*var\(--reader-social-video-duration-left\);[\s\S]*?bottom:\s*var\(--reader-social-video-duration-bottom\);[\s\S]*?font-size:\s*var\(--reader-social-video-duration-size\);/, 'simpleTweet video duration should use video duration tokens');
assert.match(socialCss, /\.reader-simple-tweet-source\s*\{[\s\S]*?bottom:\s*var\(--reader-social-source-bottom\);[\s\S]*?left:\s*var\(--reader-social-source-left\);[\s\S]*?font-size:\s*var\(--reader-social-source-size\);/, 'simpleTweet source badge should use source badge tokens');
assert.match(socialCss, /\.reader-simple-tweet-source-icon\s*\{[\s\S]*?width:\s*var\(--reader-social-source-icon-size\);[\s\S]*?height:\s*var\(--reader-social-source-icon-size\);/, 'simpleTweet source icon should use source icon token');
assert.match(responsiveCss, /@media\s*\(max-width:\s*720px\)\s*\{[\s\S]*?grid-template-columns:\s*var\(--reader-social-card-avatar-size-mobile\) minmax\(0, 1fr\);/, 'mobile simpleTweet frame should use the mobile avatar size token for its grid column');
assert.match(responsiveCss, /\.reader-simple-tweet-avatar\s*\{[\s\S]*?width:\s*var\(--reader-social-card-avatar-size-mobile\);[\s\S]*?height:\s*var\(--reader-social-card-avatar-size-mobile\);/, 'mobile simpleTweet avatar should use the mobile avatar size token');
assert.match(responsiveCss, /\.reader-simple-tweet-author-primary\s*\{[\s\S]*?font-size:\s*var\(--reader-social-card-author-primary-size-mobile\);/, 'mobile simpleTweet primary author should use the mobile primary size token');
assert.match(responsiveCss, /\.reader-simple-tweet-author-secondary\s*\{[\s\S]*?font-size:\s*var\(--reader-social-card-author-secondary-size-mobile\);/, 'mobile simpleTweet secondary author should use the mobile secondary size token');
assert.match(responsiveCss, /\.reader-simple-tweet-text-container\s*\{[\s\S]*?font-size:\s*var\(--reader-social-card-text-size-mobile\);/, 'mobile simpleTweet text should use the mobile text size token');
assert.match(responsiveCss, /\.reader-simple-tweet-condensed\s*\{[\s\S]*?grid-template-columns:\s*var\(--reader-social-card-condensed-media-size-mobile\) minmax\(0, 1fr\);/, 'mobile condensed tweet should use the mobile condensed media token for its grid column');
assert.match(responsiveCss, /\.reader-simple-tweet-actions\s*\{[\s\S]*?font-size:\s*var\(--reader-social-card-actions-size-mobile\);/, 'mobile simpleTweet actions should use the mobile actions size token');
assert.match(responsiveCss, /\.reader-simple-tweet-action-icon\s*\{[\s\S]*?width:\s*var\(--reader-social-card-action-icon-size-mobile\);[\s\S]*?height:\s*var\(--reader-social-card-action-icon-size-mobile\);/, 'mobile simpleTweet action icons should use the mobile action icon token');
assert.match(overlaysCss, /box-shadow:\s*var\(--reader-overlay-shadow\);/, 'overlay shadow should use the design shadow token');
assert.match(overlaysCss, /\.reader-media-preview\s*\{[\s\S]*?transition:\s*opacity var\(--reader-media-preview-fade-duration\) ease;/, 'media preview fade should use the preview fade token');
assert.match(overlaysCss, /\.reader-media-preview-close\s*\{[\s\S]*?width:\s*var\(--reader-media-preview-control-size\);[\s\S]*?height:\s*var\(--reader-media-preview-control-size\);/, 'media preview close button should use the preview control size token');
assert.match(overlaysCss, /\.reader-media-preview-close\s*\{[\s\S]*?font-size:\s*var\(--reader-media-preview-control-icon-size\);/, 'media preview close button should use the preview icon size token');
assert.match(overlaysCss, /\.reader-media-preview-nav\s*\{[\s\S]*?width:\s*var\(--reader-media-preview-control-size\);[\s\S]*?height:\s*var\(--reader-media-preview-control-size\);/, 'media preview nav buttons should use the preview control size token');
assert.match(overlaysCss, /\.reader-media-preview.is-entering-from-left \.reader-media-preview-image\s*\{[\s\S]*?var\(--reader-media-preview-image-enter-duration\)/, 'media preview image enter animation should use the duration token');
assert.match(overlaysCss, /\.reader-media-preview-status\s*\{[\s\S]*?font-size:\s*var\(--reader-media-preview-status-size\);/, 'media preview status should use the preview status size token');
assert.match(mediaCss, /\.reader-gif-overlay\s*\{[\s\S]*?left:\s*var\(--reader-media-control-offset\);[\s\S]*?bottom:\s*var\(--reader-media-control-offset\);/, 'GIF overlay should use the media control offset token');
assert.match(mediaCss, /\.reader-gif-pause,[\s\S]*?\.reader-gif-badge\s*\{[\s\S]*?height:\s*var\(--reader-media-control-height\);/, 'GIF controls should use the media control height token');
assert.match(mediaCss, /\.reader-gif-pause\s*\{[\s\S]*?width:\s*var\(--reader-media-gif-pause-width\);/, 'GIF pause button should use the GIF pause width token');
assert.match(mediaCss, /\.reader-gif-badge\s*\{[\s\S]*?font-size:\s*var\(--reader-media-gif-badge-size\);/, 'GIF badge should use the GIF badge size token');
assert.match(mediaCss, /\.reader-gif-pause-icon\s*\{[\s\S]*?width:\s*var\(--reader-media-gif-icon-size\);[\s\S]*?height:\s*var\(--reader-media-gif-icon-size\);/, 'GIF pause icon should use the GIF icon size token');
assert.match(mediaCss, /\.reader-media\.is-load-error\s*\{[\s\S]*?min-height:\s*var\(--reader-media-error-min-height\);/, 'media load-error surface should use the media error min-height token');
assert.match(mediaCss, /\.reader-image-gallery-grid\s*\{[\s\S]*?gap:\s*var\(--reader-media-gallery-gap\);/, 'image gallery grid should use the media gallery gap token');
assert.match(mediaCss, /\.reader-image-gallery-node\s*\{[\s\S]*?gap:\s*var\(--reader-media-gallery-gap\);/, 'image gallery nested nodes should use the media gallery gap token');
assert.match(mediaCss, /\.reader-media\.is-load-error\s*\{[\s\S]*?font-size:\s*var\(--reader-media-load-error-size\);/, 'media load-error text should use the media load-error size token');
assert.match(socialCss, /\.reader-simple-tweet-title\s*\{[\s\S]*?font-size:\s*var\(--reader-social-article-title-size\);/, 'simpleTweet article title should use the article title size token');
assert.match(socialCss, /\.reader-simple-tweet-excerpt\s*\{[\s\S]*?font-size:\s*var\(--reader-social-article-excerpt-size\);/, 'simpleTweet article excerpt should use the article excerpt size token');
assert.match(socialCss, /\.reader-simple-tweet-article-avatar\s*\{[\s\S]*?width:\s*var\(--reader-social-article-avatar-size\);[\s\S]*?height:\s*var\(--reader-social-article-avatar-size\);/, 'simpleTweet article avatar should use the article avatar size token');
assert.match(socialCss, /\.reader-simple-tweet-article-author-primary\s*\{[\s\S]*?font-size:\s*var\(--reader-social-article-author-primary-size\);/, 'simpleTweet article primary author should use the article primary author size token');
assert.match(socialCss, /\.reader-simple-tweet-article-author-secondary\s*\{[\s\S]*?font-size:\s*var\(--reader-social-article-author-secondary-size\);/, 'simpleTweet article secondary author should use the article secondary author size token');
assert.match(socialCss, /\.reader-simple-tweet-article-meta-metrics\s*\{[\s\S]*?font-size:\s*var\(--reader-social-article-metrics-size\);/, 'simpleTweet article metrics should use the article metrics size token');
assert.match(socialCss, /\.reader-simple-tweet-article-metric-icon\s*\{[\s\S]*?width:\s*var\(--reader-social-article-metric-icon-size\);[\s\S]*?height:\s*var\(--reader-social-article-metric-icon-size\);/, 'simpleTweet article metric icons should use the article metric icon token');
assert.match(socialCss, /\.reader-simple-tweet-condensed\s*\{[\s\S]*?grid-template-columns:\s*var\(--reader-social-condensed-media-size\) minmax\(0, 1fr\);/, 'condensed tweet should use the condensed media size token for its grid column');
assert.match(socialCss, /\.reader-simple-tweet-condensed-media \.reader-simple-tweet-media\s*\{[\s\S]*?width:\s*var\(--reader-social-condensed-media-size\);[\s\S]*?min-height:\s*var\(--reader-social-condensed-media-size\);/, 'condensed tweet media should use the condensed media size token');
assert.match(socialCss, /\.reader-simple-tweet-condensed-media \.reader-simple-tweet-video-duration\s*\{[\s\S]*?font-size:\s*var\(--reader-social-condensed-video-badge-size\);/, 'condensed tweet video badge should use the condensed badge size token');
assert.match(socialCss, /\.reader-simple-tweet-condensed-text \.reader-simple-tweet-text-container\s*\{[\s\S]*?font-size:\s*var\(--reader-social-condensed-text-size\);/, 'condensed tweet text should use the condensed text size token');
assert.match(overlaysCss, /\.reader-toast\s*\{[\s\S]*?bottom:\s*var\(--reader-toast-bottom\);[\s\S]*?font-size:\s*var\(--reader-toast-size\);/, 'toast should use toast layout and size tokens');
assert.match(overlaysCss, /\.reader-hint\s*\{[\s\S]*?bottom:\s*var\(--reader-hint-bottom\);[\s\S]*?font-size:\s*var\(--reader-hint-size\);/, 'reader hint should use hint layout and size tokens');

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

function collectRawDimensionalDeclarations(css) {
  const declarations = [];
  for (const match of css.matchAll(/(^|\n)\s*([a-z-]+)\s*:\s*([^;]*(?:\d+(?:\.\d+)?px|100vw|100vh|100%|999px)[^;]*);/g)) {
    declarations.push({ property: match[2], value: match[3].trim() });
  }
  return declarations;
}

function isAllowedStructuralDimensionalDeclaration({ property, value }) {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if ((property === 'width' || property === 'height' || property === 'max-width') && normalized === '100%') return true;
  if ((property === 'max-width' && normalized === '100vw') || (property === 'max-height' && normalized === '100vh')) return true;
  if (property === 'border-radius' && normalized === '999px') return true;
  if (property === 'transform' && normalized === 'translateY(-1px)') return true;
  if ((property === 'border' || property === 'border-top' || property === 'border-bottom') && normalized.startsWith('1px solid ')) return true;
  return false;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${ }()|[\]\\]/g, '\\$&');
}
