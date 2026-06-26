import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const cleanTreeConverter = await readFile('src/content/preprocess/clean-tree-block-converter.ts', 'utf8');
const xAdapter = await readFile('src/content/adapters/x-article-adapter.ts', 'utf8');
const substackAdapter = await readFile('src/content/adapters/substack-article-adapter.ts', 'utf8');
const handlersSource = await readFile('src/content/extractors/configurable/special-component-handlers.ts', 'utf8');

assert.doesNotMatch(
  cleanTreeConverter,
  /simple-tweet-clean-tree-converter\.js/,
  'generic clean-tree converter must not import the X simpleTweet clean-tree converter'
);
assert.doesNotMatch(
  cleanTreeConverter,
  /isSimpleTweetElement|convertXSimpleTweetElement/,
  'generic clean-tree converter must route special components through handlerId, not X simpleTweet functions'
);

assert.match(xAdapter, /id:\s*'x\.simple-tweet'[\s\S]*handlerId:\s*'x\.simple-tweet'/, 'x.article.specialComponents must declare x.simple-tweet');
assert.match(substackAdapter, /id:\s*'substack\.twitter-embed'[\s\S]*handlerId:\s*'substack\.twitter-embed'/, 'substack.article.specialComponents must declare substack.twitter-embed');
assert.match(handlersSource, /registeredHandlers\.get\(handlerId\)/, 'special component handlers must resolve only registered code-owned handlers');

const { getSpecialComponentHandler } = await import('../dist/content/extractors/configurable/special-component-handlers.js');
assert.equal(getSpecialComponentHandler('unknown.platform-handler'), null, 'unknown special component handlerId should resolve to null');

console.log('verify:special-components-platform-boundary passed');
