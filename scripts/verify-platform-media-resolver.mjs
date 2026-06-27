import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

import { cloneContentTree, createCleanTreeContext } from '../dist/content/preprocess/clone-content-tree.js';
import { convertCleanTreeToBlocks } from '../dist/content/preprocess/clean-tree-block-converter.js';
import { renderArticleShell } from '../dist/reader/block-renderer.js';

const mediaAdapter = {
  id: 'media.fixture',
  platform: 'fixture',
  contentType: 'article',
  hosts: ['media.fixture.local'],
  enabled: true,
  rootSelector: '[data-article-root]',
  titleSelector: '[data-title]',
  contentSelector: '[data-content]',
  semanticMap: {
    blockSelector: '[data-kind="paragraph"], [data-kind="gallery"], [data-kind="embed"]',
    paragraphSelector: '[data-kind="paragraph"], figcaption',
    headingSelector: '[data-kind="heading"]',
    quoteSelector: '[data-kind="quote"]',
    orderedListSelector: '[data-kind="ordered-list"]',
    unorderedListSelector: '[data-kind="unordered-list"]',
    imageSelector: 'img',
    imageGallerySelector: '[data-kind="gallery"]',
    codeSelector: '[data-kind="code"]',
    tableSelector: '[data-kind="table"]',
    linkSelector: 'a[href]',
    textSelector: '[data-text="true"]'
  },
  cleanRules: {
    removeSelectors: ['script'],
    unwrapSelectors: [],
    preserveAttributeNames: [
      'data-kind',
      'src',
      'srcset',
      'sizes',
      'data-src',
      'data-original',
      'data-poster',
      'data-thumbnail',
      'alt',
      'href',
      'title',
      'width',
      'height'
    ]
  },
  readiness: {},
  validation: {},
  fixes: [],
  enabledFixes: [],
  styleWhitelist: {
    preserveProps: [],
    preserveColorFor: [],
    preserveWhiteSpaceValues: []
  }
};

const mediaUrl = 'https://media.fixture.local/story/media';
const mediaHtml = [
  '<article data-article-root>',
  '  <h1 data-title>Media Resolver Fixture</h1>',
  '  <section data-content>',
  '    <p data-kind="paragraph">Opening paragraph before media.</p>',
  '    <figure data-kind="image">',
  '      <a href="https://example.com/direct-source">',
  '        <img src="https://cdn.example.com/direct.jpg" srcset="https://cdn.example.com/direct.jpg 1x, https://cdn.example.com/direct@2x.jpg 2x" sizes="(min-width: 800px) 720px, 100vw" alt="Direct image" width="1200" height="800">',
  '      </a>',
  '      <figcaption>Direct image caption.</figcaption>',
  '    </figure>',
  '    <figure data-kind="image">',
  '      <picture>',
  '        <source srcset="https://cdn.example.com/picture-large.avif 2x" sizes="640px" type="image/avif">',
  '        <img data-src="https://cdn.example.com/picture-fallback.jpg" data-original="https://cdn.example.com/picture-original.jpg" alt="Picture lazy image" width="640" height="360">',
  '      </picture>',
  '    </figure>',
  '    <figure data-kind="image">',
  '      <img srcset="https://cdn.example.com/srcset-small.jpg 640w, https://cdn.example.com/srcset-large.jpg 1280w" alt="Srcset only image">',
  '    </figure>',
  '    <section data-kind="gallery" data-linelens-media-aspect-ratio="1.5">',
  '      <img data-src="https://cdn.example.com/gallery-1.jpg" alt="Gallery first">',
  '      <picture>',
  '        <source srcset="https://cdn.example.com/gallery-2.webp 1x, https://cdn.example.com/gallery-2@2x.webp 2x">',
  '        <img src="https://cdn.example.com/gallery-2.jpg" alt="Gallery second">',
  '      </picture>',
  '    </section>',
  '    <section data-kind="embed" data-poster="https://img.youtube.com/vi/demo/maxresdefault.jpg">',
  '      <iframe src="https://www.youtube.com/embed/demo" title="Demo video"><script>window.evil = true;</script></iframe>',
  '    </section>',
  '  </section>',
  '</article>'
].join('');

installDom(mediaHtml, mediaUrl);

const cleanTree = cloneContentTree(
  document.querySelector(mediaAdapter.contentSelector),
  createCleanTreeContext({
    adapter: mediaAdapter,
    sourceUrl: mediaUrl,
    debugId: 'media.fixture:test'
  })
);

assert.equal(cleanTree.root.querySelector('script'), null, 'clean tree should remove scripts from embed sources');
assert.equal(cleanTree.root.querySelector('img[data-src]') !== null, true, 'clean tree should preserve lazy image data-src');
assert.equal(cleanTree.root.querySelector('source[srcset]') !== null, true, 'clean tree should preserve picture source srcset');
assert.equal(cleanTree.root.querySelector('img[sizes]') !== null, true, 'clean tree should preserve image sizes');

const blocks = convertCleanTreeToBlocks(cleanTree.root, cleanTree.context);
assert.deepEqual(
  blocks.map((block) => block.type),
  ['paragraph', 'image', 'paragraph', 'image', 'image', 'image-gallery', 'embed'],
  'media resolver should emit media blocks and captions in DOM order'
);

const directImage = blocks.find((block) => block.type === 'image' && block.alt === 'Direct image');
assert.equal(directImage?.src, 'https://cdn.example.com/direct.jpg', 'img[src] should resolve as ImageBlock.src');
assert.equal(directImage?.srcset?.includes('direct@2x.jpg'), true, 'img[srcset] should preserve ImageBlock.srcset');
assert.equal(directImage?.sizes, '(min-width: 800px) 720px, 100vw', 'img[sizes] should preserve ImageBlock.sizes');
assert.equal(directImage?.href, 'https://example.com/direct-source', 'linked images should preserve their source href');
assert.equal(directImage?.aspectRatio, 1.5, 'width and height should resolve ImageBlock.aspectRatio');

const caption = blocks.find((block) => block.type === 'paragraph' && block.text === 'Direct image caption.');
assert.equal(caption?.role, 'caption', 'figcaption should become a caption paragraph block');

const pictureImage = blocks.find((block) => block.type === 'image' && block.alt === 'Picture lazy image');
assert.equal(pictureImage?.src, 'https://cdn.example.com/picture-fallback.jpg', 'img[data-src] should resolve as ImageBlock.src');
assert.equal(pictureImage?.srcset, 'https://cdn.example.com/picture-large.avif 2x', 'picture source srcset should backfill ImageBlock.srcset');
assert.equal(pictureImage?.sizes, '640px', 'picture source sizes should backfill ImageBlock.sizes');
assert.equal(pictureImage?.aspectRatio, 1.7778, 'lazy picture dimensions should resolve ImageBlock.aspectRatio');

const srcsetOnlyImage = blocks.find((block) => block.type === 'image' && block.alt === 'Srcset only image');
assert.equal(srcsetOnlyImage?.src, 'https://cdn.example.com/srcset-small.jpg', 'img[srcset] without src should use the first candidate URL');
assert.equal(srcsetOnlyImage?.srcset?.includes('srcset-large.jpg'), true, 'srcset-only image should still preserve the full srcset');

const gallery = blocks.find((block) => block.type === 'image-gallery');
assert.equal(gallery?.items.length, 2, 'generic multi-image containers should resolve to image-gallery blocks');
assert.equal(gallery?.items[0]?.src, 'https://cdn.example.com/gallery-1.jpg', 'generic gallery should resolve lazy image items');
assert.equal(gallery?.items[1]?.src, 'https://cdn.example.com/gallery-2.jpg', 'generic gallery should resolve picture image items');
assert.equal(gallery?.items[1]?.srcset?.includes('gallery-2@2x.webp'), true, 'generic gallery should preserve picture source srcsets');
assert.equal(gallery?.aspectRatio, 1.5, 'generic gallery should preserve platform media aspect ratio metadata');

const embed = blocks.find((block) => block.type === 'embed');
assert.equal(embed?.provider, 'youtube', 'iframe src should resolve a safe embed provider');
assert.equal(embed?.href, 'https://www.youtube.com/embed/demo', 'iframe src should resolve as embed href');
assert.equal(embed?.title, 'Demo video', 'iframe title should resolve as embed title');
assert.equal(embed?.media?.[0]?.src, 'https://img.youtube.com/vi/demo/maxresdefault.jpg', 'embed poster should resolve as safe image media');
assert.equal(JSON.stringify(embed).includes('<iframe'), false, 'embed block should not serialize iframe HTML');
assert.equal(JSON.stringify(embed).includes('window.evil'), false, 'embed block should not serialize script content');

installDom('<main></main>', mediaUrl);
const rendered = renderArticleShell({
  id: 'media.fixture:story',
  source: 'fixture',
  sourceKind: 'fixture',
  sourceProvider: 'fixture',
  adapterId: 'media.fixture',
  platform: 'fixture',
  contentType: 'article',
  sourceUrl: mediaUrl,
  canonicalUrl: mediaUrl,
  title: 'Media Resolver Fixture',
  extractedAt: 246813579,
  blocks
});
assert.equal(rendered.querySelector('iframe'), null, 'Reader should render embed metadata without source iframe DOM');
assert.equal(rendered.querySelector('script'), null, 'Reader should render embed metadata without source script DOM');
assert.equal(rendered.querySelector('[data-kind="embed"]'), null, 'Reader should not render platform source DOM attributes');
assert.equal(rendered.querySelector('[data-block-type="image-gallery"] img') !== null, true, 'Reader should render generic gallery as standard Article JSON');

console.log('verify:platform-media-resolver passed');

function installDom(html, url) {
  const dom = new JSDOM(html, { url });
  globalThis.Element = dom.window.Element;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.HTMLImageElement = dom.window.HTMLImageElement;
  globalThis.HTMLPictureElement = dom.window.HTMLPictureElement;
  globalThis.HTMLSourceElement = dom.window.HTMLSourceElement;
  globalThis.Node = dom.window.Node;
  globalThis.MutationObserver = dom.window.MutationObserver;
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  return dom;
}
