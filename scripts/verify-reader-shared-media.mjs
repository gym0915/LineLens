import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const repoRoot = resolve(import.meta.dirname, '..');

function read(path) {
  return readFileSync(resolve(repoRoot, path), 'utf8');
}

const renderer = read('src/reader/block-renderer.ts');
const mediaCss = read('public/styles/media.css');
const socialCss = read('public/styles/social-card.css');
const articleTypes = read('src/shared/article.ts');
const extractor = read('src/content/extractors/x/article-extractor.ts');
const bundledContent = read('src/content/index.ts');
const cleanTreeConverter = read('src/content/preprocess/clean-tree-block-converter.ts');

assert.match(articleTypes, /type ImageBlock = \{[\s\S]*displaySrc\?: string/, 'single image blocks should preserve the visible X background-image URL');
assert.match(articleTypes, /type ImageBlock = \{[\s\S]*backgroundSize\?:/, 'single image blocks should carry media frame background sizing');
assert.match(articleTypes, /type ImageBlock = \{[\s\S]*objectFit\?:/, 'single image blocks should carry media frame object-fit');

for (const source of [extractor, bundledContent]) {
  assert.match(source, /function tweetPhotoElementToImageBlock/, 'X article single-image extraction should use the tweetPhoto container, not only the hidden img');
  assert.match(source, /getTweetPhotoBackgroundLayer/, 'single-image extraction should inspect the visible tweetPhoto background layer');
  assert.match(source, /displaySrc = getTweetPhotoBackgroundUrl\(element\)/, 'single-image extraction should preserve the X visible background image');
  assert.match(source, /const frameAspectRatio = getImageGalleryAspectRatio\(ratioRoot\)/, 'single-image extraction should read the X media frame ratio');
  assert.match(source, /const aspectRatio = frameAspectRatio \?\? \(image \? getImageAspectRatio\(image\) : undefined\)/, 'single-image extraction should prefer frame ratio over natural image ratio');
}

assert.match(cleanTreeConverter, /function tweetPhotoElementToImageBlock/, 'clean-tree single-image extraction should use the tweetPhoto container');
assert.match(cleanTreeConverter, /getImageGalleryAspectRatio\(element\)/, 'clean-tree single-image extraction should preserve X padding-bottom media frame ratios');
assert.match(cleanTreeConverter, /objectFit:\s*'cover'/, 'clean-tree single-image extraction should preserve X cover cropping');
assert.match(cleanTreeConverter, /const frameAspectRatio = getImageGalleryAspectRatio\(ratioRoot\)/, 'clean-tree single-image extraction should read the X media frame ratio');
assert.match(cleanTreeConverter, /const aspectRatio = frameAspectRatio \?\? \(image \? getImageAspectRatio\(image\) : undefined\)/, 'clean-tree single-image extraction should prefer frame ratio over natural image ratio');

assert.match(renderer, /function renderMediaFrame/, 'reader should have one shared media frame renderer');
assert.match(renderer, /className = 'reader-media-frame'/, 'shared media frame should expose a common frame class');
assert.match(renderer, /className = 'reader-media-background'/, 'shared media frame should render the visible background layer');
assert.match(renderer, /renderMediaFrame\(\{[\s\S]*imageClassName: 'reader-media-image'/, 'article image blocks should render through the shared media frame');
assert.match(renderer, /renderMediaFrame\(\{[\s\S]*imageClassName: 'reader-image-gallery-image'/, 'gallery items should render through the shared media frame');
assert.match(renderer, /renderMediaFrame\(\{[\s\S]*imageClassName: 'reader-simple-tweet-photo-image'/, 'simpleTweet photo cells should render through the shared media frame');

assert.match(mediaCss, /\.reader-media-frame\s*\{[\s\S]*overflow:\s*hidden/, 'shared media frame CSS should clip overflow');
assert.match(mediaCss, /\.reader-media-background\s*\{[\s\S]*background-size:\s*cover/, 'shared media background should default to X-style cover');
assert.match(mediaCss, /\.reader-media-frame > img\s*\{[\s\S]*opacity:\s*0/, 'shared media img should be a hidden load/accessibility layer');
assert.doesNotMatch(mediaCss, /\.reader-media img\s*\{[^}]*object-fit:\s*contain/, 'article images should no longer use contain rendering in the reader');
assert.match(socialCss, /reader-simple-tweet-photo-image/, 'simpleTweet CSS should target the shared media frame image class');

console.log('verify:reader-shared-media passed');
