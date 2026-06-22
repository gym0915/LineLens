import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { JSDOM } from 'jsdom';

import { xArticleAdapter } from '../dist/content/adapters/index.js';
import { extractXArticleLegacyBlocksForDebug } from '../dist/content/extractors/x/article-extractor.js';
import { X_ARTICLE_SELECTORS } from '../dist/content/extractors/x/article-selectors.js';
import { buildCleanTreePrimaryBlocks } from '../dist/content/preprocess/clean-tree-main-path.js';

const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const workspaceRoot = findWorkspaceRoot(projectRoot);
const sampleName = "The web wasn't built for browser agents, here's how we built a harness to make it work. .html";
const samplePath = resolve(workspaceRoot, 'assets2', sampleName);
const html = readFileSync(samplePath, 'utf8');
const dom = new JSDOM(html, {
  url: 'https://x.com/kylejeong/article/2061882958651474268'
});

globalThis.Element = dom.window.Element;
globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.Node = dom.window.Node;
globalThis.MutationObserver = dom.window.MutationObserver;
globalThis.window = dom.window;
globalThis.document = dom.window.document;

const { document } = dom.window;
const readView = document.querySelector(X_ARTICLE_SELECTORS.readView);
const longform = readView?.querySelector(X_ARTICLE_SELECTORS.longform);

assert.ok(readView, 'fixture should contain the X article read view');
assert.ok(longform, 'fixture should contain the X article longform root');

const legacyBlocks = await extractXArticleLegacyBlocksForDebug({
  longform,
  articleId: 'phase4-boundaries'
});
const result = buildCleanTreePrimaryBlocks({
  sourceRoot: longform,
  adapter: xArticleAdapter,
  sourceUrl: dom.window.location.href,
  debugId: 'phase4-boundaries',
  legacyBlocks
});

const cleanParagraphs = result.cleanTreeBlocks.filter((block) => block.type === 'paragraph');
const cleanLists = result.cleanTreeBlocks.filter((block) => block.type === 'list');
const cleanCodes = result.cleanTreeBlocks.filter((block) => block.type === 'code');

const paragraphText = cleanParagraphs.map((block) => block.text).join('\n');
const listText = cleanLists.flatMap((block) => block.items).join('\n');

assert.equal(
  cleanParagraphs.some((block) => /^1\. Tools shaped to pre-training knowledge\.$/.test(block.text)),
  false,
  'ordered list item headings should not be emitted as paragraph blocks'
);
assert.match(
  listText,
  /Tools shaped to pre-training knowledge\./,
  'ordered list item headings should be preserved in list blocks'
);
assert.equal(
  cleanLists.some((block) => block.kind === 'ordered' && block.items.some((item) => /^\d+\.\s+/.test(item))),
  false,
  'ordered list item markers should not be duplicated inside clean tree list text'
);
assert.equal(
  /typescript\s*import\s*\{\s*chromium\s*\}\s*from\s*"playwright"/.test(paragraphText),
  false,
  'typescript code blocks should not leak into paragraph blocks'
);
assert.equal(
  /bash\s*# verify it yourself:/.test(paragraphText),
  false,
  'bash code blocks should not leak into paragraph blocks'
);
assert.equal(cleanCodes.length, 4, 'clean tree should emit the four code blocks in this article');
assert.deepEqual(
  cleanCodes.map((block) => block.language),
  ['typescript', 'bash', 'markdown', 'bash'],
  'clean tree code blocks should preserve normalized languages'
);
assert.match(
  cleanCodes[0]?.text ?? '',
  /import \{ chromium \} from "playwright"\n\n\/\/ Connect to an existing Chromium instance/,
  'typescript code block should preserve blank lines and line breaks'
);
assert.match(
  cleanCodes[2]?.text ?? '',
  /Does the agent need credentials it can't see\?\n├── yes → harness/,
  'markdown decision-tree code block should preserve tree line breaks'
);
assert.equal(result.highRiskBlockCount, 0, 'code should no longer count as high risk after clean tree migration');

console.log(
  JSON.stringify(
    {
      sample: sampleName,
      cleanTreeBlocks: result.cleanTreeBlocks.length,
      cleanParagraphs: cleanParagraphs.length,
      cleanLists: cleanLists.length,
      cleanCodes: cleanCodes.length,
      replaced: result.replacedBlockCount,
      fallback: result.fallbackBlockCount,
      highRisk: result.highRiskBlockCount
    },
    null,
    2
  )
);

function findWorkspaceRoot(startDir) {
  let current = startDir;
  for (let depth = 0; depth < 8; depth += 1) {
    if (existsSync(resolve(current, 'assets2'))) {
      return current;
    }

    const parent = resolve(current, '..');
    if (parent === current) {
      break;
    }

    current = parent;
  }

  throw new Error(`Unable to locate workspace assets2 directory from ${startDir}`);
}
