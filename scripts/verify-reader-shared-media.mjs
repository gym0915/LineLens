import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { JSDOM } from 'jsdom';
import { renderArticleShell } from '../dist/reader/block-renderer.js';

const repoRoot = resolve(import.meta.dirname, '..');

function read(path) {
  return readFileSync(resolve(repoRoot, path), 'utf8');
}

const renderer = [
  read('src/reader/block-renderer.ts'),
  read('src/reader/renderers/media-frame.ts'),
  read('src/reader/renderers/image-renderer.ts'),
  read('src/reader/renderers/gallery-renderer.ts'),
  read('src/reader/renderers/video-renderer.ts')
].join('\n');
const mediaCss = read('public/styles/media.css');
const socialCss = read('public/styles/social-card.css');
const articleTypes = read('src/shared/article.ts');
const extractor = read('src/content/extractors/x/article-extractor.ts');
const legacyBlocks = read('src/content/extractors/x/article-legacy-blocks.ts');
const cleanTreeConverter = read('src/content/preprocess/clean-tree-block-converter.ts');
const xMediaLayout = read('src/content/extractors/x/media-layout.ts');

assert.match(articleTypes, /type ImageBlock = \{[\s\S]*displaySrc\?: string/, 'single image blocks should preserve the visible X background-image URL');
assert.match(articleTypes, /type ImageBlock = \{[\s\S]*backgroundSize\?:/, 'single image blocks should carry media frame background sizing');
assert.match(articleTypes, /type ImageBlock = \{[\s\S]*objectFit\?:/, 'single image blocks should carry media frame object-fit');

assert.match(
  extractor,
  /extractXArticleLegacyBlocks\(\{[\s\S]*?longform,[\s\S]*?articleId,[\s\S]*?capturedVideos[\s\S]*?\}\)/,
  'X article extraction should delegate media block extraction into the legacy block boundary'
);

for (const source of [legacyBlocks]) {
  assert.match(source, /function tweetPhotoElementToImageBlock/, 'X article single-image extraction should use the tweetPhoto container, not only the hidden img');
  assert.match(source, /getXMediaBackgroundLayer/, 'single-image extraction should inspect the visible tweetPhoto background layer through the shared helper');
  assert.match(source, /displaySrc = getXMediaBackgroundUrl\(element\)/, 'single-image extraction should preserve the X visible background image');
  assert.match(source, /const frameAspectRatio = getImageGalleryAspectRatio\(ratioRoot\)/, 'single-image extraction should read the X media frame ratio');
  assert.match(source, /const aspectRatio = frameAspectRatio \?\? \(image \? getImageAspectRatio\(image\) : undefined\)/, 'single-image extraction should prefer frame ratio over natural image ratio');
}

assert.match(cleanTreeConverter, /convertPlatformSpecialImageElement/, 'clean-tree single-image extraction should delegate platform media handling');
assert.doesNotMatch(cleanTreeConverter, /tweetPhotoElementToImageBlock/, 'clean-tree converter should not own X single-image helper naming');
assert.match(xMediaLayout, /function xMediaElementToImageBlock/, 'X-owned media helper should use the tweetPhoto container');
assert.match(xMediaLayout, /export function getXMediaBackgroundLayer/, 'X-owned media helper should own visible tweetPhoto background layer lookup');
assert.match(xMediaLayout, /export function getXMediaBackgroundUrl/, 'X-owned media helper should own visible tweetPhoto background URL parsing');
assert.match(xMediaLayout, /getXMediaAspectRatio\(ratioRoot\)/, 'X-owned media helper should preserve X padding-bottom media frame ratios');
assert.match(xMediaLayout, /objectFit:\s*'cover'/, 'X-owned media helper should preserve X cover cropping');
assert.match(xMediaLayout, /const frameAspectRatio = getXMediaAspectRatio\(ratioRoot\)/, 'X-owned media helper should read the X media frame ratio');
assert.match(xMediaLayout, /const aspectRatio = frameAspectRatio \?\? \(image \? getXImageAspectRatio\(image\) : undefined\)/, 'X-owned media helper should prefer frame ratio over natural image ratio');

assert.match(renderer, /className = 'reader-media-frame'/, 'shared media frame should expose a common frame class');
assert.match(renderer, /className = 'reader-media-background'/, 'shared media frame should render the visible background layer');

const dom = new JSDOM('<!doctype html><body></body>');
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.HTMLImageElement = dom.window.HTMLImageElement;

const sharedMediaArticle = {
  id: 'shared-media-contract',
  source: 'fixture',
  sourceUrl: 'https://example.com/source',
  canonicalUrl: 'https://example.com/source',
  title: 'Shared media contract',
  extractedAt: Date.now(),
  blocks: [
    {
      id: 'body-image',
      type: 'image',
      src: 'https://example.com/body-hidden.jpg',
      displaySrc: 'https://example.com/body-visible.jpg',
      alt: 'Body image',
      backgroundSize: 'cover',
      objectFit: 'cover',
      aspectRatio: 1.5
    },
    {
      id: 'gallery',
      type: 'image-gallery',
      aspectRatio: 1.7778,
      items: [
        {
          src: 'https://example.com/gallery-hidden.jpg',
          displaySrc: 'https://example.com/gallery-visible.jpg',
          alt: 'Gallery image',
          backgroundSize: 'cover',
          objectFit: 'cover'
        }
      ]
    },
    {
      id: 'tweet-photo',
      type: 'simple-tweet',
      source: 'X Tweet',
      title: 'Tweet photo',
      excerpt: 'Tweet photo body',
      href: 'https://x.com/example/status/1',
      items: [
        {
          type: 'photo',
          photo: {
            src: 'https://example.com/tweet-hidden.jpg',
            displaySrc: 'https://example.com/tweet-visible.jpg',
            alt: 'Tweet photo'
          }
        }
      ]
    }
  ]
};

const sharedMediaRendered = renderArticleShell(sharedMediaArticle);
assertSharedFrame(
  sharedMediaRendered.querySelector('[data-block-id="body-image"]'),
  'reader-media-image',
  'https://example.com/body-visible.jpg',
  'body image'
);
assertSharedFrame(
  sharedMediaRendered.querySelector('[data-block-id="gallery"] .reader-image-gallery-item'),
  'reader-image-gallery-image',
  'https://example.com/gallery-visible.jpg',
  'gallery item'
);
assertSharedFrame(
  sharedMediaRendered.querySelector('[data-block-id="tweet-photo"] .reader-simple-tweet-photo'),
  'reader-simple-tweet-photo-image',
  'https://example.com/tweet-visible.jpg',
  'simpleTweet photo'
);

assert.match(mediaCss, /\.reader-media-frame\s*\{[\s\S]*overflow:\s*hidden/, 'shared media frame CSS should clip overflow');
assert.match(mediaCss, /\.reader-media-background\s*\{[\s\S]*background-size:\s*cover/, 'shared media background should default to X-style cover');
assert.match(mediaCss, /\.reader-media-frame > img\s*\{[\s\S]*opacity:\s*0/, 'shared media img should be a hidden load/accessibility layer');
assert.doesNotMatch(mediaCss, /\.reader-media img\s*\{[^}]*object-fit:\s*contain/, 'article images should no longer use contain rendering in the reader');
assert.match(socialCss, /reader-simple-tweet-photo-image/, 'simpleTweet CSS should target the shared media frame image class');

console.log('verify:reader-shared-media passed');

function assertSharedFrame(root, imageClassName, expectedBackgroundUrl, label) {
  assert(root, `${label} should render`);
  const frame = root.querySelector('.reader-media-frame');
  assert(frame, `${label} should use the shared media frame`);
  const background = frame.querySelector('.reader-media-background');
  assert(background, `${label} should render a shared background layer`);
  assert.equal(background.style.backgroundImage, `url("${expectedBackgroundUrl}")`, `${label} should preserve displaySrc on the background layer`);
  assert(frame.querySelector(`img.${imageClassName}`), `${label} should render the expected hidden/accessibility image class`);
}
