import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const repoRoot = resolve(import.meta.dirname, '..');

function read(path) {
  return readFileSync(resolve(repoRoot, path), 'utf8');
}

const extractor = read('src/content/extractors/x/article-extractor.ts');
const articleTypes = read('src/shared/article.ts');
const simpleTweetExtractor = read('src/content/extractors/x/simple-tweet.ts');
const cleanTreeConverter = read('src/content/preprocess/clean-tree-block-converter.ts');
const renderer = read('src/reader/block-renderer.ts');
const mediaCss = read('public/styles/media.css');

const userGalleryFixture = [
  '<section data-block="true" contenteditable="false">',
  '<div style="padding-bottom: 56.25%;"></div>',
  '<div class="r-18u37iz">',
  '<div class="r-1iusvr4 r-16y2uox r-bnwqim"><div data-testid="tweetPhoto"><div style="background-image: url(&quot;https://example.com/1.jpg&quot;);"></div><img src="https://example.com/1.jpg"></div></div>',
  '<div class="r-1iusvr4 r-16y2uox r-eqz5dr">',
  '<div class="r-1iusvr4 r-16y2uox r-bnwqim"><div data-testid="tweetPhoto"><div style="background-image: url(&quot;https://example.com/2.jpg&quot;);"></div><img src="https://example.com/2.jpg"></div></div>',
  '<div class="r-1iusvr4 r-16y2uox r-bnwqim"><div data-testid="tweetPhoto"><div style="background-image: url(&quot;https://example.com/3.jpg&quot;);"></div><img src="https://example.com/3.jpg"></div></div>',
  '</div></div></section>'
].join('');

const paddingBottom = Number(userGalleryFixture.match(/padding-bottom:\s*([0-9.]+)%/)?.[1] ?? 0);
assert.equal((userGalleryFixture.match(/data-testid="tweetPhoto"/g) ?? []).length, 3, 'fixture should model a three-photo X gallery');
assert.equal(Math.round((100 / paddingBottom) * 10000) / 10000, 1.7778, 'fixture should model the source 16:9 ratio placeholder');
assert.equal(userGalleryFixture.includes('r-18u37iz'), true, 'fixture should contain the X row flex marker');
assert.equal(userGalleryFixture.includes('r-eqz5dr'), true, 'fixture should contain the X column flex marker');
assert.equal((userGalleryFixture.match(/background-image: url/g) ?? []).length, 3, 'fixture should model tweetPhoto background layers');

for (const source of [extractor, cleanTreeConverter]) {
  assert.match(source, /function getDescendantPaddingBottomAspectRatio/, 'gallery aspect ratio should inspect descendant padding-bottom nodes');
  assert.match(source, /querySelectorAll<HTMLElement>\('\[style\*="padding-bottom"\]'\)/, 'gallery aspect ratio should search nested ratio placeholders');
  assert.match(source, /return roundAspectRatio\(100 \/ paddingBottom\)/, 'gallery aspect ratio should convert padding-bottom percent to width divided by height');
  assert.match(source, /function getImageGalleryAspectRatio\(element: Element\): number \| undefined \{\s*const descendantRatio = getDescendantPaddingBottomAspectRatio\(element\)/, 'gallery aspect ratio should prefer the component-local ratio placeholder before walking ancestors');
}

assert.match(articleTypes, /displaySrc\?: string/, 'tweetPhoto-backed media types should preserve a visible background-image URL');
assert.match(simpleTweetExtractor, /const displaySrc = getTweetPhotoBackgroundUrl\(element\)/, 'simpleTweet tweetPhoto extraction should read the X background-image URL separately');
assert.match(renderer, /function renderImageGalleryLayoutNode/, 'Reader should recursively render image-gallery layout nodes');
assert.match(renderer, /function renderImageGalleryItem/, 'Reader should render image-gallery items through a shared helper');
assert.match(renderer, /reader-media-background/, 'Reader should render tweetPhoto-style background layers through the shared media frame');
assert.match(renderer, /renderMediaFrame\(\{[\s\S]*imageClassName: 'reader-image-gallery-image'/, 'Reader should render gallery items through the shared media frame');
assert.match(renderer, /frame\.remove\(\)/, 'Reader should remove gallery media frame on image load error');
assert.match(renderer, /dataset\.itemIndex = String\(index\)/, 'Reader should expose item indexes for nested gallery layout');
assert.match(renderer, /function applyImageGalleryFlexMetrics/, 'Reader should apply source flex grow/shrink/basis metrics');
assert.match(renderer, /options\.displaySrc \?\? options\.src/, 'shared media frame background should prefer the X visible background-image URL');
assert.match(renderer, /displaySrc: item\.displaySrc/, 'gallery items should pass visible background URLs into the shared media frame');
assert.match(renderer, /displaySrc: photo\.displaySrc/, 'simpleTweet photos should pass visible background URLs into the shared media frame');

assert.match(mediaCss, /\.reader-image-gallery-grid\s*\{[\s\S]*display:\s*flex/, 'gallery grid should use flex layout');
assert.match(mediaCss, /aspect-ratio:\s*var\(--reader-media-aspect-ratio, 16 \/ 9\)/, 'gallery grid should use extracted aspect ratio');
assert.match(mediaCss, /\.reader-image-gallery-node\[data-layout-type="column"\]/, 'gallery CSS should support nested column nodes');
assert.match(mediaCss, /\.reader-media-background/, 'gallery CSS should use the shared background layer');
assert.match(mediaCss, /\.reader-media-frame > img\s*\{[\s\S]*opacity:\s*0/, 'gallery img should be load/accessibility layer behind the visible background');

console.log('verify:x-article-image-gallery passed');
