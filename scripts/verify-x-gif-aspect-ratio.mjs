import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { JSDOM } from 'jsdom';

const projectRoot = resolve(new URL('..', import.meta.url).pathname);
const fixtureName = 'How to make stunning HTML slides (for complete beginners).html';
const fixturePath = resolve(projectRoot, 'assets2', fixtureName);
const html = readFileSync(fixturePath, 'utf8');
const sourceUrl = 'https://x.com/i/article/2053918629835469276';
const dom = new JSDOM(html, {
  url: sourceUrl,
  pretendToBeVisual: true
});
installDomGlobals(dom.window);

const { xArticleExtractor } = await import('../dist/content/extractors/x/article-extractor.js');

const article = await xArticleExtractor.extract({
  url: new URL(sourceUrl),
  root: dom.window.document,
  now: () => 1710000000000
});

const targetGif = article.blocks.find(
  (block) => block.type === 'gif' && block.src === 'https://video.twimg.com/tweet_video/HIEZa5nagAEzviN.mp4'
);
assert.ok(targetGif, 'fixture should extract the target X GIF block');
assert.equal(
  targetGif.aspectRatio,
  1.4197,
  'X GIF aspect ratio should come from the nearest padding-bottom frame, not unrelated 100% shell styles'
);

const renderedDom = new JSDOM('<!doctype html><main></main>', {
  url: 'http://127.0.0.1/reader.html'
});
installDomGlobals(renderedDom.window);
const { renderArticleShell } = await import('../dist/reader/block-renderer.js');
const shell = renderArticleShell(article);
const renderedGif = shell.querySelector(`.reader-gif[data-block-id="${targetGif.id}"]`);
assert.ok(renderedGif, 'Reader should render the target GIF block');
assert.equal(
  renderedGif.getAttribute('style'),
  '--reader-media-aspect-ratio: 1.4197;',
  'Reader GIF frame should receive the extracted source aspect ratio'
);

console.log('X GIF aspect ratio verification passed.');

function installDomGlobals(window) {
  globalThis.window = window;
  globalThis.document = window.document;
  globalThis.localStorage = window.localStorage;
  globalThis.Element = window.Element;
  globalThis.HTMLElement = window.HTMLElement;
  globalThis.HTMLImageElement = window.HTMLImageElement;
  globalThis.HTMLMediaElement = window.HTMLMediaElement;
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
  window.HTMLMediaElement.prototype.play = () => Promise.resolve();
  window.HTMLMediaElement.prototype.pause = () => undefined;
}
