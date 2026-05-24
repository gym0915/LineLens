import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;

function assertFile(relativePath) {
  const absolutePath = join(root, relativePath);
  if (!existsSync(absolutePath)) {
    throw new Error(`Missing required file: ${relativePath}`);
  }
  return absolutePath;
}

function readJson(relativePath) {
  const absolutePath = assertFile(relativePath);
  return JSON.parse(readFileSync(absolutePath, 'utf8'));
}

function assertIncludes(relativePath, text) {
  const absolutePath = assertFile(relativePath);
  const content = readFileSync(absolutePath, 'utf8');
  if (!content.includes(text)) {
    throw new Error(`${relativePath} should include ${text}`);
  }
}

const manifest = readJson('dist/manifest.json');

if (manifest.manifest_version !== 3) {
  throw new Error('manifest.json must use Manifest V3');
}

if (manifest.background?.service_worker !== 'background.js') {
  throw new Error('manifest background service worker must be background.js');
}

if (manifest.action?.default_title !== 'LineLens') {
  throw new Error('manifest action title must be LineLens');
}

const contentScript = manifest.content_scripts?.[0];
if (!contentScript?.js?.includes('content.js')) {
  throw new Error('manifest must register content.js as a content script');
}

if (!manifest.web_accessible_resources?.[0]?.resources?.includes('reader.html')) {
  throw new Error('manifest must expose reader.html as a web accessible resource');
}

assertFile('dist/background.js');
assertFile('dist/content.js');
assertFile('dist/reader.js');
assertFile('dist/reader.html');
assertFile('dist/reader.css');

assertIncludes('src/shared/article.ts', 'export type Article');
assertIncludes('src/shared/article.ts', 'export type ArticleBlock');
assertIncludes('src/shared/focus.ts', 'export type FocusUnit');
assertIncludes('src/shared/messages.ts', 'export type ExtensionMessage');
assertIncludes('src/background/index.ts', 'chrome.runtime.onMessage');
assertIncludes('src/content/index.ts', 'ARTICLE_NOT_READY');
assertIncludes('src/reader/index.ts', 'loadRequestedArticle');
assertIncludes('src/reader/article-loader.ts', 'articleId');

console.log('Stage 0 verification passed.');
