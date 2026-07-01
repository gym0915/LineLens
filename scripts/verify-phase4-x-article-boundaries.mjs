import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { JSDOM } from 'jsdom';

import { xArticleAdapter } from '../dist/content/adapters/index.js';
import { extractXArticleLegacyBlocksForDebug } from '../dist/content/extractors/x/article-legacy-blocks.js';
import { getSpecialComponentHandler } from '../dist/content/extractors/configurable/special-component-handlers.js';
import { X_ARTICLE_SELECTORS } from '../dist/content/extractors/x/article-selectors.js';
import {
  buildCleanTreePrimaryBlocks,
  CLEAN_TREE_PRIMARY_BLOCK_TYPES,
  HIGH_RISK_DUAL_TRACK_BLOCK_TYPES,
  LEGACY_ONLY_BLOCK_TYPES
} from '../dist/content/preprocess/clean-tree-main-path.js';

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

assert.deepEqual(
  CLEAN_TREE_PRIMARY_BLOCK_TYPES,
  ['paragraph', 'divider', 'heading', 'quote', 'list', 'image', 'code', 'table', 'simple-tweet', 'image-gallery', 'embed'],
  'clean tree primary block types should include migrated low-risk and embed blocks'
);
assert.deepEqual(
  HIGH_RISK_DUAL_TRACK_BLOCK_TYPES,
  ['video', 'gif'],
  'video and gif should stay on the high-risk dual-track path in this refactor'
);
assert.deepEqual(
  LEGACY_ONLY_BLOCK_TYPES,
  ['link'],
  'standalone link blocks should stay on the legacy-only path until clean tree has a LinkBlock converter'
);
assert.ok(getSpecialComponentHandler('x.simple-tweet'), 'x.simple-tweet should be registered as a code-owned special component handler');
assert.equal(
  xArticleAdapter.specialComponents?.some((component) => component.id === 'x.video-or-gif' || component.handlerId === 'x.video-or-gif'),
  false,
  'x.video-or-gif should not be declared as a special component until a dedicated handler is registered'
);
assert.equal(
  getSpecialComponentHandler('x.video-or-gif'),
  null,
  'x.video-or-gif should remain an explicit high-risk dual-track boundary until a dedicated handler is implemented'
);

const cleanParagraphs = result.cleanTreeBlocks.filter((block) => block.type === 'paragraph');
const cleanLists = result.cleanTreeBlocks.filter((block) => block.type === 'list');
const cleanCodes = result.cleanTreeBlocks.filter((block) => block.type === 'code');

assert.deepEqual(
  result.blocks.map((block) => block.id),
  legacyBlocks.map((block) => block.id),
  'clean-tree merge should preserve legacy block id and order for FocusUnit restore stability'
);
assert.equal(
  result.replacedBlockCount > 0,
  true,
  'fixture should exercise low-risk clean-tree replacement rather than legacy-only output'
);

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
assert.equal(Number.isInteger(result.legacyOnlyBlockCount), true, 'merge diagnostics should expose legacy-only block count');

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
      highRisk: result.highRiskBlockCount,
      legacyOnly: result.legacyOnlyBlockCount
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
