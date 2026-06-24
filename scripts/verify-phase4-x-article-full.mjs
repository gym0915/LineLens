import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { JSDOM } from 'jsdom';

import { xArticleAdapter } from '../dist/content/adapters/index.js';
import { getPlatformFixOrder } from '../dist/content/preprocess/apply-platform-fixes.js';
import {
  buildCleanTreePrimaryBlocks,
  CLEAN_TREE_PRIMARY_BLOCK_TYPES,
  HIGH_RISK_DUAL_TRACK_BLOCK_TYPES
} from '../dist/content/preprocess/clean-tree-main-path.js';
import { filterInlineStyle } from '../dist/content/preprocess/style-whitelist.js';

const projectRoot = resolve(import.meta.dirname, '..');
const workspaceRoot = findWorkspaceRoot(projectRoot);
const fullHtml = readFileSync(resolve(workspaceRoot, 'assets/x-article-full-html.html'), 'utf8');
const detailHtml = readFileSync(resolve(workspaceRoot, 'assets/x-article-detail.html'), 'utf8');
const codeBlockHtml = readFileSync(resolve(workspaceRoot, 'assets/x-article-codeblock.html'), 'utf8');
const imageGridHtml = readFileSync(resolve(workspaceRoot, 'assets/x-article-image-grid.html'), 'utf8');
const xDefaultSemanticFixtureHtml = [
  '<main>',
  '  <blockquote>Default X quote selector coverage</blockquote>',
  '  <table>',
  '    <tr><th>Name</th><th>Value</th></tr>',
  '    <tr><td>semanticMap</td><td>default</td></tr>',
  '  </table>',
  '</main>'
].join('');

const sourceInventory = {
  articleRoot: count(fullHtml, 'data-testid="twitterArticleReadView"'),
  title: count(fullHtml, 'data-testid="twitter-article-title"'),
  contentRoot: count(fullHtml, 'data-testid="longformRichTextComponent"'),
  paragraphs: count(fullHtml, 'data-block="true"'),
  orderedListItems: count(fullHtml, 'public-DraftStyleDefault-orderedListItem'),
  unorderedListItems: count(fullHtml, 'public-DraftStyleDefault-unorderedListItem'),
  images: count(fullHtml, 'data-testid="tweetPhoto"'),
  embeddedTweets: count(fullHtml, 'data-testid="tweet"') + count(fullHtml, 'data-testid="simpleTweet"'),
  links: count(fullHtml, '<a ') + count(fullHtml, 'role="link"'),
  hrefAttributes: count(fullHtml, 'href='),
  srcAttributes: count(fullHtml, 'src='),
  altAttributes: count(fullHtml, 'alt='),
  inlineStyleAttributes: count(fullHtml, 'style='),
  platformClassAttributes: count(fullHtml, 'class='),
  scriptLikeNodes: count(fullHtml, '<script'),
  interactiveShells: count(fullHtml, '<button') + count(fullHtml, 'role="button"'),
  boldSignals: count(fullHtml, 'font-weight: bold') + count(fullHtml, 'font-weight: 700'),
  preWrapSignals: count(fullHtml, 'white-space: pre-wrap'),
  disallowedStyleSignals: count(fullHtml, 'position: fixed') + count(fullHtml, 'background')
};

assert.equal(sourceInventory.articleRoot, 1, 'full X article fixture should contain one article read view root');
assert.equal(sourceInventory.title, 1, 'full X article fixture should contain one article title');
assert.equal(sourceInventory.contentRoot, 1, 'full X article fixture should contain one longform content root');
assert.equal(sourceInventory.paragraphs >= 100, true, 'full X article fixture should cover long paragraph extraction');
assert.equal(sourceInventory.orderedListItems > 0, true, 'full X article fixture should cover ordered list semantics');
assert.equal(sourceInventory.unorderedListItems > 0, true, 'full X article fixture should cover unordered list semantics');
assert.equal(sourceInventory.images > 0, true, 'full X article fixture should cover images');
assert.equal(sourceInventory.embeddedTweets > 0, true, 'full X article fixture should cover quote/simple-tweet candidates');
assert.equal(sourceInventory.links > 50, true, 'full X article fixture should cover link preservation');
assert.equal(sourceInventory.hrefAttributes > 0, true, 'full X article fixture should include href attributes to preserve');
assert.equal(sourceInventory.srcAttributes > 0, true, 'full X article fixture should include src attributes to preserve');
assert.equal(sourceInventory.altAttributes > 0, true, 'full X article fixture should include alt attributes to preserve');
assert.equal(sourceInventory.inlineStyleAttributes > 100, true, 'full X article fixture should include inline style pollution to filter');
assert.equal(sourceInventory.platformClassAttributes > 1000, true, 'full X article fixture should include platform classes to strip');
assert.equal(sourceInventory.scriptLikeNodes > 0, true, 'full X article fixture should include script-like shells to remove');
assert.equal(sourceInventory.interactiveShells > 0, true, 'full X article fixture should include interactive shells to remove');
assert.equal(sourceInventory.boldSignals > 0, true, 'full X article fixture should cover bold inline semantics');
assert.equal(sourceInventory.preWrapSignals > 0, true, 'full X article fixture should cover pre-wrap style semantics');
assert.equal(sourceInventory.disallowedStyleSignals > 0, true, 'full X article fixture should include style pollution to reject');

assert.deepEqual(getPlatformFixOrder(xArticleAdapter), [
  'expand-folded-tweet-text',
  'normalize-handwritten-ordered-list',
  'preserve-svg-emoji',
  'capture-x-video-hls',
  'preserve-x-media-caption',
  'preserve-x-media-layout'
]);
assert.deepEqual(CLEAN_TREE_PRIMARY_BLOCK_TYPES, ['paragraph', 'heading', 'quote', 'list', 'image', 'code', 'table', 'simple-tweet', 'image-gallery', 'embed']);
assert.deepEqual(HIGH_RISK_DUAL_TRACK_BLOCK_TYPES, ['video']);

const xDefaultCleanTreeBlockCounts = {
  full: summarizeXCleanTreeBlocks(fullHtml, 'x-full-default-semantic-map'),
  detail: summarizeXCleanTreeBlocks(detailHtml, 'x-detail-default-semantic-map'),
  code: summarizeXCleanTreeBlocks(codeBlockHtml, 'x-code-default-semantic-map'),
  imageGrid: summarizeXCleanTreeBlocks(imageGridHtml, 'x-image-grid-default-semantic-map'),
  defaultSemanticFixture: summarizeXCleanTreeBlocks(xDefaultSemanticFixtureHtml, 'x-default-semantic-map-fixture')
};
assert.equal(
  xDefaultCleanTreeBlockCounts.full.counts.heading > 0 || xDefaultCleanTreeBlockCounts.detail.counts.heading > 0,
  true,
  'X default semanticMap.headingSelector should still emit heading blocks'
);
assert.equal(
  xDefaultCleanTreeBlockCounts.full.counts.list > 0 || xDefaultCleanTreeBlockCounts.detail.counts.list > 0,
  true,
  'X default semanticMap list selectors should still emit list blocks'
);
assert.equal(
  xDefaultCleanTreeBlockCounts.full.counts.image > 0 || xDefaultCleanTreeBlockCounts.detail.counts.image > 0,
  true,
  'X default semanticMap.imageSelector should still emit image blocks'
);
assert.equal(
  xDefaultCleanTreeBlockCounts.code.counts.code,
  1,
  'X default semanticMap.codeSelector should still emit code blocks'
);
assert.equal(
  xDefaultCleanTreeBlockCounts.defaultSemanticFixture.counts.quote,
  1,
  'X default semanticMap.quoteSelector should still emit quote blocks'
);
assert.equal(
  xDefaultCleanTreeBlockCounts.defaultSemanticFixture.counts.table,
  1,
  'X default semanticMap.tableSelector should still emit table blocks'
);
assert.equal(
  xDefaultCleanTreeBlockCounts.imageGrid.counts['image-gallery'],
  1,
  'X default semanticMap.imageGallerySelector should still emit image-gallery blocks'
);
assert.equal(
  xDefaultCleanTreeBlockCounts.full.counts['simple-tweet'] > 0 || xDefaultCleanTreeBlockCounts.detail.counts['simple-tweet'] > 0,
  true,
  'X default specialComponents should still emit simpleTweet blocks during clean-tree conversion'
);
assert.equal(
  buildCleanTreePrimaryBlocks({
    sourceRoot: createDomRoot('<main></main>', 'https://x.com/example/article/video-probe'),
    adapter: xArticleAdapter,
    sourceUrl: 'https://x.com/example/article/video-probe',
    debugId: 'x-video-dual-track-probe',
    legacyBlocks: [{ id: 'legacy-video-1', type: 'video', src: 'https://video.example/x.mp4' }]
  }).highRiskBlockCount,
  1,
  'video should remain on the high-risk dual-track path in Step 1'
);

assert.equal(
  filterInlineStyle('font-weight: bold; position: fixed; background: red;', xArticleAdapter.styleWhitelist, {
    isLink: false,
    isInlineEmphasis: true,
    isPreformatted: false,
    matchesCustomColorSelector: false
  }),
  'font-weight: bold',
  'full X article whitelist gate should preserve emphasis and reject layout/theme pollution'
);
assert.equal(
  filterInlineStyle('white-space: pre-wrap; background: red;', xArticleAdapter.styleWhitelist, {
    isLink: false,
    isInlineEmphasis: false,
    isPreformatted: true,
    matchesCustomColorSelector: false
  }),
  'white-space: pre-wrap',
  'full X article whitelist gate should preserve configured pre-wrap semantics'
);
assert.equal(
  filterInlineStyle('color: rgb(29, 155, 240); font-size: 20px;', xArticleAdapter.styleWhitelist, {
    isLink: true,
    isInlineEmphasis: false,
    isPreformatted: false,
    matchesCustomColorSelector: false
  }),
  'color: rgb(29, 155, 240)',
  'full X article whitelist gate should preserve link color only in link context'
);
assert.equal(
  filterInlineStyle('color: rgb(224, 36, 94); font-size: 20px;', {
    preserveProps: [],
    preserveColorFor: ['inline-emphasis'],
    preserveWhiteSpaceValues: []
  }, {
    isLink: false,
    isInlineEmphasis: true,
    isPreformatted: false,
    matchesCustomColorSelector: false
  }),
  'color: rgb(224, 36, 94)',
  'full X article whitelist gate should preserve configured inline emphasis color'
);

const cleanTreeSource = readFileSync(resolve(projectRoot, 'src/content/preprocess/clone-content-tree.ts'), 'utf8');
const platformFixesSource = readFileSync(resolve(projectRoot, 'src/content/preprocess/apply-platform-fixes.ts'), 'utf8');
const blockConverterSource = readFileSync(resolve(projectRoot, 'src/content/preprocess/clean-tree-block-converter.ts'), 'utf8');
const mainPathSource = readFileSync(resolve(projectRoot, 'src/content/preprocess/clean-tree-main-path.ts'), 'utf8');
const configurableExtractorSource = readFileSync(
  resolve(projectRoot, 'src/content/extractors/configurable/configurable-article-extractor.ts'),
  'utf8'
);
const modularExtractorSource = readFileSync(resolve(projectRoot, 'src/content/extractors/x/article-extractor.ts'), 'utf8');
const metadataModulePath = resolve(projectRoot, 'src/content/extractors/x/article-metadata.ts');
const legacyBlocksModulePath = resolve(projectRoot, 'src/content/extractors/x/article-legacy-blocks.ts');

assert.match(cleanTreeSource, /root\.cloneNode\(true\)/, 'clean tree gate should clone before sanitizing');
assert.match(cleanTreeSource, /applyPlatformFixes\(clonedRoot, context\.adapter, context\)/, 'clean tree gate should run platform fixes before sanitizing');
assert.match(cleanTreeSource, /applyStyleWhitelistToTree\(root, adapter\.styleWhitelist\)/, 'clean tree gate should execute style whitelist');
assert.match(cleanTreeSource, /element\.remove\(\)/, 'clean tree gate should remove script and interactive shells');
assert.doesNotMatch(
  cleanTreeSource.match(/const PRESERVED_ATTRIBUTE_NAMES = new Set\(\[[\s\S]*?\]\);/)?.[0] ?? '',
  /'class'/,
  'clean tree gate should strip platform class attributes'
);
for (const attribute of ['href', 'src', 'alt', 'data-testid']) {
  assert.match(cleanTreeSource, new RegExp(`'${attribute}'`), `clean tree gate should preserve ${attribute}`);
}

assert.match(platformFixesSource, /const FIX_ORDER/, 'platform fixes gate should keep deterministic order');
assert.match(platformFixesSource, /enabledFixes/, 'platform fixes gate should keep per-fix switches');
assert.match(platformFixesSource, /data-linelens-list-kind/, 'platform fixes gate should normalize list metadata');
assert.match(platformFixesSource, /data-linelens-fix-folded-tweet-text/, 'platform fixes gate should mark folded tweet text candidates');
assert.match(platformFixesSource, /data-linelens-emoji-image-url/, 'platform fixes gate should preserve emoji metadata');
assert.match(platformFixesSource, /data-linelens-video-hls-candidate/, 'platform fixes gate should keep video HLS metadata path dual-track');

assert.match(blockConverterSource, /export function convertCleanTreeToBlocks/, 'block conversion gate should expose clean tree conversion entry');
assert.match(blockConverterSource, /'paragraph', 'heading', 'quote', 'list', 'image', 'code', 'table', 'simple-tweet', 'image-gallery'/, 'block conversion gate should include code, table, simple-tweet, and image-gallery after migration');
assert.match(blockConverterSource, /annotation\.bold = true/, 'block conversion gate should preserve bold inline semantics');
assert.match(blockConverterSource, /annotation\.href = href/, 'block conversion gate should preserve link annotations');
assert.match(blockConverterSource, /annotation\.emojiImageUrl = emojiImageUrl/, 'block conversion gate should preserve emoji annotations');
assert.match(mainPathSource, /mergeCleanTreePrimaryBlocks/, 'main path gate should keep legacy merge statistics available');
assert.match(
  mainPathSource,
  /blocks:\s*params\.legacyBlocks \? mergeStats\.blocks : cleanTreeBlocks/,
  'main path gate should merge clean-tree primary blocks with legacy high-risk blocks when legacy input is provided'
);
assert.match(mainPathSource, /id: legacyBlock\.id/, 'legacy merge helper should preserve legacy ids when its statistics path is exercised');
assert.match(mainPathSource, /fallbackBlockCount/, 'main path gate should report fallback count');
assert.match(mainPathSource, /highRiskBlockCount/, 'main path gate should report high-risk dual-track count');
assert.match(
  configurableExtractorSource,
  /export async function extractConfigurableArticleWithDiagnostics/,
  'Step 4.3 should expose configurable extraction diagnostics for clean-tree block migration'
);
assert.match(configurableExtractorSource, /cleanTreeBlocks/, 'Step 4.3 configurable extraction should return cleanTreeBlocks');
assert.match(configurableExtractorSource, /diagnostics/, 'Step 4.3 configurable extraction should return diagnostics');
assert.match(
  modularExtractorSource,
  /extractConfigurableArticleWithDiagnostics\(adapter, context/,
  'Step 4.3 should route X low-risk block extraction through configurable extraction'
);
assert.doesNotMatch(
  modularExtractorSource,
  /buildCleanTreePrimaryBlocks/,
  'X article extractor should not directly wire clean tree primary blocks after Step 4.3'
);
assert.equal(existsSync(metadataModulePath), true, 'Step 4.1 should isolate X article metadata extraction in article-metadata.ts');
assert.equal(existsSync(legacyBlocksModulePath), true, 'Step 4.1 should isolate X legacy block extraction in article-legacy-blocks.ts');
assert.match(modularExtractorSource, /extractXArticleMetadata/, 'X article extract() should delegate metadata extraction');
assert.match(modularExtractorSource, /extractXArticleLegacyBlocks/, 'X article extract() should delegate legacy block extraction');
assert.match(
  configurableExtractorSource,
  /export function locateConfigurableArticleRoots/,
  'Step 4.2 should expose configurable root/title/content location for X orchestration'
);
assert.match(
  modularExtractorSource,
  /waitUntilConfigurableArticleReady\(xArticleAdapter, context\)/,
  'Step 4.2 should delegate X readiness to configurable readiness'
);
assert.match(
  modularExtractorSource,
  /locateConfigurableArticleRoots\(xArticleAdapter, context\)/,
  'Step 4.2 should delegate X root/title/content lookup to configurable roots'
);

const report = {
  fixture: 'assets/x-article-full-html.html',
  sourceInventory,
  gates: {
    cleanTree: 'clone + fixes + sanitize + whitelist',
    whitelist: 'emphasis/link/pre-wrap preserved; layout/theme pollution rejected',
    platformFixes: getPlatformFixOrder(xArticleAdapter),
    blockConversion: CLEAN_TREE_PRIMARY_BLOCK_TYPES,
    highRiskDualTrack: HIGH_RISK_DUAL_TRACK_BLOCK_TYPES
  }
};

console.log(JSON.stringify(report, null, 2));
console.log('Phase4 full X article verification passed');

function count(source, needle) {
  return source.split(needle).length - 1;
}

function summarizeXCleanTreeBlocks(html, debugId) {
  const sourceUrl = 'https://x.com/example/article/' + debugId;
  const result = buildCleanTreePrimaryBlocks({
    sourceRoot: createDomRoot(html, sourceUrl),
    adapter: xArticleAdapter,
    sourceUrl,
    debugId
  });
  const counts = {};
  for (const block of result.cleanTreeBlocks) {
    counts[block.type] = (counts[block.type] ?? 0) + 1;
  }

  return {
    total: result.cleanTreeBlocks.length,
    counts,
    highRiskBlockCount: result.highRiskBlockCount
  };
}

function createDomRoot(html, url) {
  const dom = new JSDOM(html, { url });
  globalThis.Element = dom.window.Element;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.Node = dom.window.Node;
  globalThis.MutationObserver = dom.window.MutationObserver;
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  return dom.window.document.body;
}

function findWorkspaceRoot(startDir) {
  let current = startDir;
  for (let depth = 0; depth < 8; depth += 1) {
    if (existsSync(resolve(current, 'assets/x-article-full-html.html'))) {
      return current;
    }

    const parent = resolve(current, '..');
    if (parent === current) {
      break;
    }

    current = parent;
  }

  throw new Error(`Unable to locate x-article-full-html.html from ${startDir}`);
}
