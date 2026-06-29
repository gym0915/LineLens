import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { relative, resolve } from 'node:path';

const projectRoot = resolve(import.meta.dirname, '..');
const contentEntry = readFileSync(resolve(projectRoot, 'src/content/index.ts'), 'utf8');
const sharedSourceDir = resolve(projectRoot, 'src/shared');
const builtContentPath = resolve(projectRoot, 'dist/content.js');
const builtContent = existsSync(builtContentPath) ? readFileSync(builtContentPath, 'utf8') : '';

const forbiddenEntryPatterns = [
  [/^type Article\s*=/m, 'content entry should not define Article locally'],
  [/^type ArticleBlock\s*=/m, 'content entry should not define ArticleBlock locally'],
  [/^const X_ARTICLE_SELECTORS\s*=/m, 'content entry should not own X Article selectors'],
  [/^async function extractXArticle\b/m, 'content entry should not implement X Article extraction'],
  [/^async function extractBlocks\b/m, 'content entry should not implement block extraction'],
  [/^async function extractSimpleTweetBlock\b/m, 'content entry should not implement simple-tweet extraction'],
  [/^function validateArticle\b/m, 'content entry should not validate Article JSON locally'],
  [/twitterArticleReadView/, 'content entry should not know X article root selectors'],
  [/longformRichTextComponent/, 'content entry should not know X article content selectors'],
  [/Twitter2ToDOM/, 'content entry should not know Substack embed DOM details'],
  [/simpleTweet/, 'content entry should not know X simpleTweet selector details']
];

for (const [pattern, message] of forbiddenEntryPatterns) {
  assert.doesNotMatch(contentEntry, pattern, message);
}

for (const sourcePath of collectTypeScriptFiles(sharedSourceDir)) {
  const source = readFileSync(sourcePath, 'utf8');
  assert.doesNotMatch(
    source,
    /(?:import|export)\s+(?:type\s+)?(?:[\s\S]*?\s+from\s+)?['"](?:\.\.\/)+content(?:\/[^'"]*)?['"]/,
    `shared source must not import content modules: ${relative(projectRoot, sourcePath)}`
  );
}

assert.match(contentEntry, /createExtractorRegistry/, 'content entry should route through the extractor registry');
assert.match(contentEntry, /xArticleExtractor/, 'content entry should register the modular X Article extractor');
assert.match(contentEntry, /createAdapterDrivenArticleExtractor/, 'content entry should register the adapter-driven extractor');
assert.match(contentEntry, /BUILT_IN_PLATFORM_ADAPTERS/, 'content entry should consume the adapter registry');
assert.match(contentEntry, /chrome\.runtime\.onMessage\.addListener/, 'content entry should remain the runtime message entrypoint');

assert.ok(existsSync(builtContentPath), 'dist/content.js must exist before verifying browser output');
assert.doesNotMatch(builtContent, /^import\s/m, 'built content.js must not contain top-level imports');
assert.doesNotMatch(builtContent, /^export\s/m, 'built content.js must not contain top-level exports');
assert.match(builtContent, /chrome\.runtime\.onMessage\.addListener/, 'built content.js should register the content runtime listener');

console.log('Content single-source verification passed');

function collectTypeScriptFiles(directory) {
  return readdirSync(directory).flatMap((entry) => {
    const entryPath = resolve(directory, entry);
    if (statSync(entryPath).isDirectory()) {
      return collectTypeScriptFiles(entryPath);
    }

    return entryPath.endsWith('.ts') ? [entryPath] : [];
  });
}
