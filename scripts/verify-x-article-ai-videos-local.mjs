import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { JSDOM } from 'jsdom';

const projectRoot = resolve(new URL('..', import.meta.url).pathname);
const fixtureName = 'how i make AI videos (a beginner’s breakdown).html';
const fixturePath = resolve(projectRoot, 'assets2', fixtureName);
const sourceUrl = 'https://x.com/0xileri/article/2058611697187782908';

assert.equal(existsSync(fixturePath), true, 'local AI videos X article fixture should exist');

const html = readFileSync(fixturePath, 'utf8');
const dom = new JSDOM(html, {
  url: sourceUrl,
  pretendToBeVisual: true
});
installDomGlobals(dom.window);

const { xArticleExtractor } = await import('../dist/content/extractors/x/article-extractor.js');
const { validateArticle } = await import('../dist/shared/article-validator.js');

const context = {
  url: new URL(sourceUrl),
  root: dom.window.document,
  now: () => 1710000000000
};

const match = xArticleExtractor.match(context);
assert.equal(match?.extractorId, 'x.article', 'X article extractor should match the local AI videos article URL');

const readiness = await xArticleExtractor.waitUntilReady(context);
assert.equal(readiness.ready, true, `local AI videos X article should be ready, got ${readiness.reason}`);

const article = await xArticleExtractor.extract(context);
const validation = validateArticle(article);
assert.equal(validation.valid, true, `local AI videos X article should validate, got ${validation.reason}`);
assert.equal(article.id, '2058611697187782908');
assert.equal(article.source, 'x-article');
assert.equal(article.sourceUrl, sourceUrl);
assert.equal(article.canonicalUrl, sourceUrl);
assert.equal(article.title, 'how i make AI videos (a beginner’s breakdown)');

const counts = article.blocks.reduce((acc, block) => {
  acc[block.type] = (acc[block.type] ?? 0) + 1;
  return acc;
}, {});

assert.deepEqual(
  article.blocks.slice(0, 4).map((block) => block.type),
  ['paragraph', 'simple-tweet', 'heading', 'paragraph'],
  'local AI videos article should preserve the opening block order'
);
assert.equal(article.blocks.length, 43, 'local AI videos article should keep the expected block count');
assert.equal(counts.paragraph, 27, 'local AI videos article should extract paragraph blocks');
assert.equal(counts.heading, 6, 'local AI videos article should extract heading blocks');
assert.equal(counts.image, 4, 'local AI videos article should extract image blocks');
assert.equal(counts.quote, 2, 'local AI videos article should extract quote blocks');
assert.equal(counts['image-gallery'], 2, 'local AI videos article should extract image gallery blocks');
assert.equal(counts.list, 1, 'local AI videos article should extract list blocks');
assert.equal(counts['simple-tweet'], 1, 'local AI videos article should extract the embedded simpleTweet block');
assert.ok(
  article.blocks.some((block) => block.annotations?.length),
  'local AI videos article should preserve inline annotations'
);
assert.ok(
  JSON.stringify(article.blocks).includes('hey 👋🏻'),
  'local AI videos article should preserve quoted simpleTweet text with emoji alt text'
);

console.log(
  JSON.stringify(
    {
      fixture: fixtureName,
      title: article.title,
      id: article.id,
      source: article.source,
      blockCount: article.blocks.length,
      counts,
      firstBlocks: article.blocks.slice(0, 8).map((block) => ({
        id: block.id,
        type: block.type,
        text: block.text?.slice?.(0, 80)
      }))
    },
    null,
    2
  )
);

function installDomGlobals(window) {
  globalThis.window = window;
  globalThis.document = window.document;
  globalThis.localStorage = window.localStorage;
  globalThis.Element = window.Element;
  globalThis.HTMLElement = window.HTMLElement;
  globalThis.HTMLImageElement = window.HTMLImageElement;
  globalThis.HTMLVideoElement = window.HTMLVideoElement;
  globalThis.HTMLAnchorElement = window.HTMLAnchorElement;
  globalThis.Node = window.Node;
  globalThis.MutationObserver = window.MutationObserver;
  globalThis.getComputedStyle = window.getComputedStyle.bind(window);
  globalThis.chrome = {
    runtime: {
      sendMessage: async () => ({ videos: [] })
    }
  };
}
