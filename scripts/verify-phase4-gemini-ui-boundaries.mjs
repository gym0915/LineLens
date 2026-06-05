import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { JSDOM } from 'jsdom';

import { xArticleAdapter } from '../dist/content/adapters/index.js';
import { extractXArticleLegacyBlocksForDebug } from '../dist/content/extractors/x/article-extractor.js';
import { X_ARTICLE_SELECTORS } from '../dist/content/extractors/x/article-selectors.js';
import { buildCleanTreePrimaryBlocks } from '../dist/content/preprocess/clean-tree-main-path.js';

const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const workspaceRoot = resolve(projectRoot, '..', '..', '..');
const sampleName = '为啥 Gemini 新 UI 和 ChatGPT 几乎一模一样？.html';
const html = readFileSync(resolve(workspaceRoot, 'assets2', sampleName), 'utf8');
const dom = new JSDOM(html, {
  url: 'https://x.com/hwwaanng/article/2056919573778292757'
});

globalThis.Element = dom.window.Element;
globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.Node = dom.window.Node;
globalThis.MutationObserver = dom.window.MutationObserver;
globalThis.window = dom.window;
globalThis.document = dom.window.document;

const readView = dom.window.document.querySelector(X_ARTICLE_SELECTORS.readView);
const longform = readView?.querySelector(X_ARTICLE_SELECTORS.longform);

assert.ok(readView, 'fixture should contain the X article read view');
assert.ok(longform, 'fixture should contain the X article longform root');

const legacyBlocks = await extractXArticleLegacyBlocksForDebug({
  longform,
  articleId: 'phase4-gemini-ui'
});
const result = buildCleanTreePrimaryBlocks({
  sourceRoot: longform,
  adapter: xArticleAdapter,
  sourceUrl: dom.window.location.href,
  debugId: 'phase4-gemini-ui',
  legacyBlocks
});

const cleanParagraphs = result.cleanTreeBlocks.filter((block) => block.type === 'paragraph');
const cleanImages = result.cleanTreeBlocks.filter((block) => block.type === 'image');
const cleanSimpleTweets = result.cleanTreeBlocks.filter((block) => block.type === 'simple-tweet');

assert.equal(cleanParagraphs.length, 18, 'simple-tweet text should not leak into paragraph blocks');
assert.equal(cleanImages.length, 2, 'simple-tweet avatars and photos should not leak into standalone image blocks');
assert.equal(cleanSimpleTweets.length, 2, 'clean tree should emit the two embedded simple-tweet blocks');
assert.equal(result.highRiskBlockCount, 0, 'simple-tweet should no longer count as high risk after clean tree migration');
assert.equal(result.fallbackBlockCount, 0, 'Gemini UI sample should not need legacy fallback after simple-tweet migration');
assert.equal(result.replacedBlockCount, 27, 'all Gemini UI sample blocks should be replaced by clean tree equivalents');

const [firstTweet, secondTweet] = cleanSimpleTweets;
assert.equal(firstTweet?.title, 'Pixel Updates @pixel_updates · 5月19日');
assert.equal(firstTweet?.excerpt, '得到了新的 Gemini 界面，它非常漂亮！');
assert.equal(firstTweet?.photos?.length, 2);
assert.equal(secondTweet?.title, 'Shishir @ShishirShelke1 · 5月19日');
assert.equal(secondTweet?.excerpt, '终于收到了新版 Gemini 应用 UI。\n\n看起来很不错，触觉反馈的实现也感觉更好。');
assert.equal(secondTweet?.photos?.length, 3);

console.log(
  JSON.stringify(
    {
      sample: sampleName,
      cleanTreeBlocks: result.cleanTreeBlocks.length,
      cleanParagraphs: cleanParagraphs.length,
      cleanImages: cleanImages.length,
      cleanSimpleTweets: cleanSimpleTweets.length,
      replaced: result.replacedBlockCount,
      fallback: result.fallbackBlockCount,
      highRisk: result.highRiskBlockCount
    },
    null,
    2
  )
);
