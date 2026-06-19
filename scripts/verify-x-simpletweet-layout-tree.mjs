import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const repoRoot = resolve(import.meta.dirname, '..');
const workspaceRoot = findWorkspaceRoot(repoRoot);

function read(path) {
  return readFileSync(resolve(repoRoot, path), 'utf8');
}

function readWorkspace(path) {
  return readFileSync(resolve(workspaceRoot, path), 'utf8');
}

const files = {
  types: read('src/shared/article.ts'),
  parser: read('src/content/extractors/x/block-layout-tree.ts'),
  extractor: read('src/content/extractors/x/simple-tweet.ts'),
  renderer: read('src/reader/block-renderer.ts')
};

const fixtures = {
  text: readWorkspace('assets/x-article-simpletweet-text.html'),
  tweet: readWorkspace('assets/x-article-simpletweet-tweet.html'),
  multiPhoto: readWorkspace('assets/x-article-simpletweet-multi-photo.html'),
  videoTweet: readWorkspace('assets/x-article-simpletweet-video-tweet.html'),
  videoTweetText: readWorkspace('assets/x-article-simpletweet-video-tweet-text.html')
};

assert.match(files.types, /export type SimpleTweetLayoutNode/, 'shared article types should export SimpleTweetLayoutNode');
assert.match(files.types, /layoutTree\?:\s*SimpleTweetLayoutNode/, 'SimpleTweetBlock should expose optional layoutTree');
assert.match(files.types, /aspectRatio\?:\s*number/, 'layout containers should preserve whitelisted aspectRatio');

assert.match(files.parser, /export function extractSimpleTweetLayoutTree/, 'simpleTweet layout parser should export extractSimpleTweetLayoutTree');
assert.match(files.parser, /window\.getComputedStyle/, 'layout parser should read computed style from the original DOM');
assert.match(files.parser, /display.*flexDirection.*gridTemplateColumns.*gapPx/s, 'layout parser should whitelist core layout fields');
assert.doesNotMatch(files.parser, /className\s*:|classList\s*:/, 'layout parser should not serialize X atomic classes into payload');
assert.match(files.parser, /case 'photo-group':[\s\S]*?kind:\s*'leaf',[\s\S]*?role:\s*'photo',[\s\S]*?contentRef/, 'photo groups should stay whole so Reader can reuse photoGroupLayout');
assert.match(files.parser, /role:\s*'quotedTweet'/, 'layout parser should preserve quoted tweet as a container');

assert.match(files.extractor, /extractSimpleTweetLayoutTree\(tweetRoot, tweet, card\.items\)/, 'module extractor should attach layoutTree from DOM before returning simpleTweet block');
assert.match(files.extractor, /\.\.\.\(layoutTree \? \{ layoutTree \} : \{\}\)/, 'module extractor should serialize layoutTree only when available');

assert.match(files.renderer, /function renderSimpleTweetLayoutTree/, 'Reader should include a layoutTree renderer');
assert.match(files.renderer, /block\.layoutTree\s*&&\s*!options\.compact\s*\?\s*renderSimpleTweetLayoutTree/, 'Reader should prefer layoutTree for non-compact simpleTweet content');
assert.match(files.renderer, /resolveSimpleTweetLayoutContent/, 'Reader should resolve layout leaves from extracted content refs');
assert.doesNotMatch(files.renderer, /innerHTML\s*=/, 'Reader layoutTree renderer should not trust source HTML');

assert.match(fixtures.text, /data-testid="simpleTweet"[\s\S]*data-testid="tweetText"/, 'text fixture should contain simpleTweet text');
assert.doesNotMatch(fixtures.text, /data-testid="tweetPhoto"|data-testid="videoPlayer"/, 'text fixture should be text-only');
assert.match(fixtures.tweet, /role="link"[\s\S]*data-testid="tweetText"/, 'tweet fixture should contain a quoted/link tweet');
assert.match(fixtures.multiPhoto, /data-testid="tweetPhoto"[\s\S]*data-testid="tweetPhoto"[\s\S]*data-testid="tweetPhoto"/, 'multi-photo fixture should contain at least three photos');
assert.match(fixtures.videoTweet, /data-testid="tweetText"[\s\S]*data-testid="videoPlayer"/, 'video tweet fixture should preserve text before video');
assert.match(fixtures.videoTweetText, /data-testid="videoPlayer"[\s\S]*(role="link"|data-testid="simpleTweet")[\s\S]*data-testid="tweetText"/, 'video+text fixture should include nested quoted text');

const sourceDom = new JSDOM(fixtures.multiPhoto, {
  url: 'https://x.com/ShishirShelke1/status/2056643158986162589'
});
installDomGlobals(sourceDom.window);
const { extractSimpleTweetBlockFromRoot } = await import('../dist/content/extractors/x/simple-tweet.js');
const simpleTweet = await extractSimpleTweetBlockFromRoot(
  sourceDom.window.document.querySelector('[data-testid="simpleTweet"]'),
  'simpletweet-multi-photo-layout'
);
assert.ok(simpleTweet, 'multi-photo fixture should extract a simpleTweet block');
assert.ok(simpleTweet.layoutTree, 'multi-photo simpleTweet should keep its component layoutTree');

const renderDom = new JSDOM('<!doctype html><main></main>', {
  url: 'chrome-extension://linelens/reader.html'
});
installDomGlobals(renderDom.window);
const { renderArticleShell } = await import('../dist/reader/block-renderer.js');
const shell = renderArticleShell({
  id: 'simpletweet-multi-photo-layout',
  source: 'x-article',
  sourceUrl: 'https://x.com/ShishirShelke1/status/2056643158986162589',
  canonicalUrl: 'https://x.com/ShishirShelke1/status/2056643158986162589',
  title: 'simpleTweet multi-photo layout',
  extractedAt: Date.now(),
  blocks: [simpleTweet]
});

const photoLayout = shell.querySelector('.reader-simple-tweet-photo-layout-row');
assert.ok(photoLayout, 'layoutTree rendering should reuse the parsed photoGroupLayout row');
assert.ok(
  photoLayout.querySelector('.reader-simple-tweet-photo-layout-column'),
  'layoutTree rendering should preserve nested photoGroupLayout columns'
);
assert.equal(
  shell.querySelectorAll('.reader-simple-tweet-layout-media .reader-simple-tweet-photo-grid.reader-simple-tweet-photo-count-1').length,
  0,
  'layoutTree rendering should not flatten a photo-group into stacked single-photo grids'
);

console.log('verify:x-simpletweet-layout-tree passed');

function installDomGlobals(window) {
  globalThis.window = window;
  globalThis.document = window.document;
  globalThis.Element = window.Element;
  globalThis.HTMLElement = window.HTMLElement;
  globalThis.HTMLMediaElement = window.HTMLMediaElement;
  globalThis.Node = window.Node;
}

function findWorkspaceRoot(startDir) {
  let current = startDir;
  while (true) {
    if (existsSync(resolve(current, 'assets/x-article-simpletweet-text.html'))) {
      return current;
    }

    const parent = resolve(current, '..');
    if (parent === current) {
      break;
    }
    current = parent;
  }

  throw new Error(`Unable to locate workspace assets directory from ${startDir}`);
}
