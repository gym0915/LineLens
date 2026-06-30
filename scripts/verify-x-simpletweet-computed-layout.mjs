import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const projectRoot = resolve(new URL('..', import.meta.url).pathname);
const workspaceRoot = findWorkspaceRoot(projectRoot);

const sourceFiles = {
  simpleTweet: readFileSync(resolve(projectRoot, 'src/content/extractors/x/simple-tweet.ts'), 'utf8'),
  platformFixes: readFileSync(resolve(projectRoot, 'src/content/preprocess/apply-platform-fixes.ts'), 'utf8'),
  cleanTree: readFileSync(resolve(projectRoot, 'src/content/preprocess/clean-tree-block-converter.ts'), 'utf8'),
  cloneTree: readFileSync(resolve(projectRoot, 'src/content/preprocess/clone-content-tree.ts'), 'utf8')
};

const fixturePaths = [
  '../assets/x-article-simpletweet-text.html',
  '../assets/x-article-simpletweet-tweet.html',
  '../assets/x-article-simpletweet-multi-photo.html',
  '../assets/x-article-simpletweet-video-tweet.html',
  '../assets/x-article-simpletweet-video-tweet-text.html'
];

for (const fixturePath of fixturePaths) {
  const fixture = readFileSync(resolve(workspaceRoot, fixturePath.replace(/^\.\.\//, '')), 'utf8');
  assert.match(fixture, /data-testid="simpleTweet"/, `${fixturePath} should contain a simpleTweet fixture`);
}

assert.match(
  sourceFiles.simpleTweet,
  /function readSimpleTweetComputedLayoutStyle\([\s\S]*?window\.getComputedStyle/,
  'simpleTweet extractor should include a component-local computed-style reader'
);
assert.match(
  sourceFiles.simpleTweet,
  /function getSimpleTweetComputedLayoutDirection\([\s\S]*?flexDirection[\s\S]*?return 'row'[\s\S]*?return 'column'/,
  'simpleTweet extractor should derive row/column direction from computed flex direction'
);
assert.match(
  sourceFiles.simpleTweet,
  /const computedDirection = getSimpleTweetComputedLayoutDirection\(root\);[\s\S]*?if \(computedDirection\)[\s\S]*?return computedDirection;[\s\S]*?const preservedDirection/,
  'computed layout direction should be preferred before preserved data attributes and raw X class fallback'
);
assert.match(
  sourceFiles.simpleTweet,
  /function getSimpleTweetComputedLayoutSize\([\s\S]*?getBoundingClientRect\([\s\S]*?parentElement[\s\S]*?widthRatio[\s\S]*?heightRatio/,
  'simpleTweet extractor should derive branch width and height ratios from DOM geometry when available'
);
assert.match(
  sourceFiles.simpleTweet,
  /const computedSize = getSimpleTweetComputedLayoutSize\(root\);[\s\S]*?const widthRatio = computedSize\.widthRatio \?\? getRatioAttribute/,
  'computed branch ratios should be preferred before preserved data attributes'
);
assert.match(
  sourceFiles.simpleTweet,
  /r-18u37iz[\s\S]*?r-eqz5dr/,
  'simpleTweet extractor should keep raw X class fallback for non-browser or legacy fixtures'
);

assert.match(
  sourceFiles.platformFixes,
  /readComputedMediaLayoutStyle\([\s\S]*?window\.getComputedStyle/,
  'platform fixes should read computed styles before clean-tree sanitization'
);
assert.match(
  sourceFiles.platformFixes,
  /getComputedMediaLayoutDirection\(element\)[\s\S]*?\?\? getClassMediaLayoutDirection\(element\)/,
  'platform fixes should prefer computed direction before class-based fallback'
);
assert.match(
  sourceFiles.platformFixes,
  /getComputedBranchRatio\(branch, element, direction\)[\s\S]*?\?\? formatRatio\(1 \/ branches\.length\)/,
  'platform fixes should preserve computed branch ratios before equal fallback ratios'
);

assert.match(sourceFiles.simpleTweet, /getSimpleTweetMediaLayoutDirection/, 'simpleTweet clean-tree conversion should continue consuming preserved layout metadata');
assert.match(sourceFiles.cloneTree, /data-linelens-media-layout-direction/, 'clean tree should whitelist preserved layout direction metadata');
assert.match(sourceFiles.cloneTree, /data-linelens-media-layout-width/, 'clean tree should whitelist preserved layout width metadata');
assert.match(sourceFiles.cloneTree, /data-linelens-media-layout-height/, 'clean tree should whitelist preserved layout height metadata');

console.log('SimpleTweet computed layout verification passed.');

function findWorkspaceRoot(startDir) {
  let current = startDir;
  for (let depth = 0; depth < 8; depth += 1) {
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
