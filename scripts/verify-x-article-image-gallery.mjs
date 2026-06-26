import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { mergeCleanTreePrimaryBlocks } from '../dist/content/preprocess/clean-tree-main-path.js';

const repoRoot = resolve(import.meta.dirname, '..');

function read(path) {
  return readFileSync(resolve(repoRoot, path), 'utf8');
}

const extractor = read('src/content/extractors/x/article-extractor.ts');
const articleTypes = read('src/shared/article.ts');
const simpleTweetExtractor = read('src/content/extractors/x/simple-tweet.ts');
const cleanTreeConverter = read('src/content/preprocess/clean-tree-block-converter.ts');
const renderer = [
  read('src/reader/block-renderer.ts'),
  read('src/reader/renderers/gallery-renderer.ts'),
  read('src/reader/renderers/media-frame.ts'),
  read('src/reader/renderers/simple-tweet-renderer.ts')
].join('\n');
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
}
assert.match(extractor, /function getImageGalleryAspectRatio\(element: Element\): number \| undefined \{\s*const descendantRatio = getDescendantPaddingBottomAspectRatio\(element\)/, 'legacy gallery aspect ratio should prefer the component-local ratio placeholder before walking ancestors');
assert.match(cleanTreeConverter, /function getDescendantPreservedMediaAspectRatio/, 'clean-tree gallery aspect ratio should inspect preserved platform media ratios');
assert.match(cleanTreeConverter, /querySelectorAll<HTMLElement>\('\[data-linelens-media-aspect-ratio\]'\)/, 'clean-tree gallery aspect ratio should search nested preserved media ratio metadata');
assert.match(cleanTreeConverter, /const descendantPreservedRatio = getDescendantPreservedMediaAspectRatio\(element\)/, 'clean-tree gallery aspect ratio should prefer preserved media ratio metadata before padding fallback');
assert.match(cleanTreeConverter, /const descendantRatio = getDescendantPaddingBottomAspectRatio\(element\)/, 'clean-tree gallery aspect ratio should keep padding-bottom fallback after preserved metadata');

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

const legacyGalleryLayout = {
  type: 'row',
  children: [
    { type: 'item', itemIndex: 0, grow: 1, shrink: 1, basis: '0%' },
    {
      type: 'column',
      grow: 1,
      shrink: 1,
      children: [
        { type: 'item', itemIndex: 1, grow: 1, shrink: 1, basis: '0%' },
        { type: 'item', itemIndex: 2, grow: 1, shrink: 1, basis: '0%' }
      ]
    }
  ]
};
const galleryMergeProbe = mergeCleanTreePrimaryBlocks(
  [
    {
      id: 'legacy-gallery',
      type: 'image-gallery',
      items: [
        { src: 'https://example.com/1.jpg' },
        { src: 'https://example.com/2.jpg' },
        { src: 'https://example.com/3.jpg' }
      ],
      layout: legacyGalleryLayout
    }
  ],
  [
    {
      id: 'clean-gallery',
      type: 'image-gallery',
      items: [
        { src: 'https://example.com/1.jpg', displaySrc: 'https://example.com/1-display.jpg' },
        { src: 'https://example.com/2.jpg', displaySrc: 'https://example.com/2-display.jpg' },
        { src: 'https://example.com/3.jpg', displaySrc: 'https://example.com/3-display.jpg' }
      ]
    }
  ]
);
assert.deepEqual(
  galleryMergeProbe.blocks[0]?.layout,
  legacyGalleryLayout,
  'clean-tree replacement should preserve legacy image-gallery layout so Reader does not flatten X galleries'
);
assert.equal(
  galleryMergeProbe.blocks[0]?.items?.[0]?.displaySrc,
  'https://example.com/1-display.jpg',
  'clean-tree replacement should still keep clean-tree media item fields'
);

console.log('verify:x-article-image-gallery passed');
