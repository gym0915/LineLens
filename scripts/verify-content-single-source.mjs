import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const projectRoot = resolve(import.meta.dirname, '..');
const contentEntry = readFileSync(resolve(projectRoot, 'src/content/index.ts'), 'utf8');
const builtContentPath = resolve(projectRoot, 'dist/content.js');
const builtContent = existsSync(builtContentPath) ? readFileSync(builtContentPath, 'utf8') : '';

const forbiddenEntryPatterns = [
  [/^type Article\s*=/m, 'content entry should not define Article locally'],
  [/^type ArticleBlock\s*=/m, 'content entry should not define ArticleBlock locally'],
  [/^const X_ARTICLE_SELECTORS\s*=/m, 'content entry should not own X Article selectors'],
  [/^async function extractXArticle\b/m, 'content entry should not implement X Article extraction'],
  [/^async function extractBlocks\b/m, 'content entry should not implement block extraction'],
  [/^async function extractSimpleTweetBlock\b/m, 'content entry should not implement simple-tweet extraction'],
  [/^function validateArticle\b/m, 'content entry should not validate Article JSON locally']
];

for (const [pattern, message] of forbiddenEntryPatterns) {
  assert.doesNotMatch(contentEntry, pattern, message);
}

assert.match(contentEntry, /createExtractorRegistry/, 'content entry should route through the extractor registry');
assert.match(contentEntry, /xArticleExtractor/, 'content entry should register the modular X Article extractor');
assert.match(contentEntry, /chrome\.runtime\.onMessage\.addListener/, 'content entry should remain the runtime message entrypoint');

assert.ok(existsSync(builtContentPath), 'dist/content.js must exist before verifying browser output');
assert.doesNotMatch(builtContent, /^import\s/m, 'built content.js must not contain top-level imports');
assert.doesNotMatch(builtContent, /^export\s/m, 'built content.js must not contain top-level exports');
assert.match(builtContent, /chrome\.runtime\.onMessage\.addListener/, 'built content.js should register the content runtime listener');

console.log('Content single-source verification passed');
