import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { JSDOM } from 'jsdom';

import { xArticleAdapter } from '../dist/content/adapters/index.js';
import { extractXArticleLegacyBlocksForDebug } from '../dist/content/extractors/x/article-extractor.js';
import { X_ARTICLE_SELECTORS } from '../dist/content/extractors/x/article-selectors.js';
import { buildCleanTreePrimaryBlocks } from '../dist/content/preprocess/clean-tree-main-path.js';
import { cloneContentTree, createCleanTreeContext } from '../dist/content/preprocess/clone-content-tree.js';

const requestedName = process.argv.slice(2).join(' ').trim();
if (!requestedName) {
  throw new Error('Usage: node scripts/dump-phase4-clean-tree-content.mjs "<sample file name>"');
}

const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const workspaceRoot = findWorkspaceRoot(projectRoot);
const inputPath = resolve(workspaceRoot, 'assets2', requestedName);
const outputDir = resolve(workspaceRoot, 'docs', 'reports', `phase4-clean-tree-${slugify(requestedName)}`);

const html = readFileSync(inputPath, 'utf8');
const dom = new JSDOM(html, {
  url: syntheticUrl(requestedName)
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
const title = normalizeText(readView?.querySelector(X_ARTICLE_SELECTORS.title)?.textContent ?? '');

if (!readView || !longform || !title) {
  throw new Error(`Missing core selectors for ${requestedName}`);
}

const articleId = stableId(requestedName);
const debugId = `assets2:${slugify(requestedName)}`;
const rawClone = longform.cloneNode(true);
if (!(rawClone instanceof dom.window.Element)) {
  throw new Error('Expected longform clone to be an Element');
}

const legacyBlocks = await extractXArticleLegacyBlocksForDebug({
  longform,
  articleId
});
const context = createCleanTreeContext({
  adapter: xArticleAdapter,
  sourceUrl: dom.window.location.href,
  debugId
});
const cleanTree = cloneContentTree(longform, context);
const mainPath = buildCleanTreePrimaryBlocks({
  sourceRoot: longform,
  adapter: xArticleAdapter,
  sourceUrl: dom.window.location.href,
  debugId,
  legacyBlocks
});

mkdirSync(outputDir, { recursive: true });

const clonePath = resolve(outputDir, '01-longform-cloneNode.outerHTML.html');
const cleanTreePath = resolve(outputDir, '02-cleanTree.outerHTML.html');
const cleanTreeBlocksPath = resolve(outputDir, '03-cleanTreeBlocks.json');
const reportPath = resolve(outputDir, 'README.md');

writeFileSync(clonePath, rawClone.outerHTML, 'utf8');
writeFileSync(cleanTreePath, cleanTree.root.outerHTML, 'utf8');
writeFileSync(cleanTreeBlocksPath, JSON.stringify(mainPath.cleanTreeBlocks, null, 2), 'utf8');
writeFileSync(reportPath, renderReport({
  requestedName,
  title,
  inputPath,
  clonePath,
  cleanTreePath,
  cleanTreeBlocksPath,
  rawCloneHtml: rawClone.outerHTML,
  cleanTreeHtml: cleanTree.root.outerHTML,
  cleanTreeBlocks: mainPath.cleanTreeBlocks
}), 'utf8');

console.log(JSON.stringify({
  reportPath,
  clonePath,
  cleanTreePath,
  cleanTreeBlocksPath,
  title,
  outputBlockCount: mainPath.cleanTreeBlocks.length
}, null, 2));

function renderReport(params) {
  const cloneContentTreeSource = readFileSync(resolve(projectRoot, 'src/content/preprocess/clone-content-tree.ts'), 'utf8');
  const styleWhitelistSource = readFileSync(resolve(projectRoot, 'src/content/preprocess/style-whitelist.ts'), 'utf8');
  const adapterSource = readFileSync(resolve(projectRoot, 'src/content/adapters/x-article-adapter.ts'), 'utf8');
  const mainPathSource = readFileSync(resolve(projectRoot, 'src/content/preprocess/clean-tree-main-path.ts'), 'utf8');

  return [
    `# Phase4 CleanTree Dump: ${params.requestedName}`,
    '',
    `Title: ${params.title}`,
    '',
    '## Files',
    '',
    `- Input HTML: \`${params.inputPath}\``,
    `- cloneNode outerHTML: \`${params.clonePath}\``,
    `- cleanTree outerHTML: \`${params.cleanTreePath}\``,
    `- cleanTreeBlocks JSON: \`${params.cleanTreeBlocksPath}\``,
    '',
    '## 1. CloneNode 具体内容是什么',
    '',
    '运行时取的是 X Article longform 根节点：',
    '',
    '```ts',
    "const readView = document.querySelector(X_ARTICLE_SELECTORS.readView);",
    "const longform = readView?.querySelector(X_ARTICLE_SELECTORS.longform);",
    'const rawClone = longform.cloneNode(true);',
    '```',
    '',
    '当前样本的完整 cloneNode 内容已写入 `01-longform-cloneNode.outerHTML.html`。下面是文件开头片段：',
    '',
    fenced('html', head(params.rawCloneHtml, 6000)),
    '',
    '对应实现代码：',
    '',
    fenced('ts', pickFunction(cloneContentTreeSource, 'export function cloneContentTree')),
    '',
    '## 2. 白名单有哪些',
    '',
    'X Article adapter 的白名单配置：',
    '',
    fenced('ts', pickObject(adapterSource, 'styleWhitelist')),
    '',
    '属性保留白名单：',
    '',
    fenced('ts', pickConst(cloneContentTreeSource, 'PRESERVED_ATTRIBUTE_NAMES')),
    '',
    'data 属性保留白名单：',
    '',
    fenced('ts', pickConst(cloneContentTreeSource, 'PRESERVED_DATA_ATTRIBUTES')),
    '',
    '节点移除名单：',
    '',
    fenced('ts', pickConst(cloneContentTreeSource, 'REMOVED_TAG_NAMES')),
    '',
    '互动元素移除名单：',
    '',
    fenced('ts', pickConst(cloneContentTreeSource, 'INTERACTIVE_TEST_IDS')),
    '',
    'style 白名单执行代码：',
    '',
    fenced('ts', [
      pickFunction(styleWhitelistSource, 'export function applyStyleWhitelistToTree'),
      pickFunction(styleWhitelistSource, 'export function shouldPreserveStyleProperty'),
      pickFunction(styleWhitelistSource, 'function getStyleWhitelistContext')
    ].join('\n\n')),
    '',
    '## 3. cleanTree 的具体内容',
    '',
    'cleanTree 是 `cloneNode(true)` 之后，按平台 fixes、节点删除、属性保留、style whitelist 处理后的 DOM：',
    '',
    fenced('ts', pickFunction(cloneContentTreeSource, 'function sanitizeElementTree')),
    '',
    '主路径现在仍保留 legacy merge 统计，但浏览器输出直接使用 cleanTreeBlocks：',
    '',
    fenced('ts', pickFunction(mainPathSource, 'export function buildCleanTreePrimaryBlocks')),
    '',
    '当前样本完整 cleanTree 内容已写入 `02-cleanTree.outerHTML.html`。下面是文件开头片段：',
    '',
    fenced('html', head(params.cleanTreeHtml, 6000)),
    '',
    '## 4. cleanTreeBlocks 具体内容',
    '',
    '当前样本完整 cleanTreeBlocks 已写入 `03-cleanTreeBlocks.json`。下面是前 8 个 block：',
    '',
    fenced('json', JSON.stringify(params.cleanTreeBlocks.slice(0, 8), null, 2)),
    ''
  ].join('\n');
}

function pickConst(source, name) {
  const pattern = new RegExp(`const ${name} = new Set\\(\\[[\\s\\S]*?\\]\\);`);
  return source.match(pattern)?.[0] ?? `// ${name} not found`;
}

function pickObject(source, propertyName) {
  const pattern = new RegExp(`${propertyName}: \\{[\\s\\S]*?\\n  \\}`);
  return source.match(pattern)?.[0] ?? `// ${propertyName} not found`;
}

function pickFunction(source, signatureStart) {
  const start = source.indexOf(signatureStart);
  if (start === -1) {
    return `// ${signatureStart} not found`;
  }

  const bodyStart = findFunctionBodyStart(source, start);
  if (bodyStart === -1) {
    return `// body for ${signatureStart} not found`;
  }

  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    const char = source[index];
    if (char === '{') {
      depth += 1;
    } else if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        return source.slice(start, index + 1);
      }
    }
  }

  return source.slice(start);
}

function findFunctionBodyStart(source, start) {
  const paramsStart = source.indexOf('(', start);
  if (paramsStart === -1) {
    return -1;
  }

  let parenDepth = 0;
  let paramsEnd = -1;
  for (let index = paramsStart; index < source.length; index += 1) {
    const char = source[index];
    if (char === '(') {
      parenDepth += 1;
    } else if (char === ')') {
      parenDepth -= 1;
      if (parenDepth === 0) {
        paramsEnd = index;
        break;
      }
    }
  }

  if (paramsEnd === -1) {
    return -1;
  }

  let index = paramsEnd + 1;
  while (/\s/.test(source[index] ?? '')) {
    index += 1;
  }

  if (source[index] !== ':') {
    return source.indexOf('{', index);
  }

  index += 1;
  while (/\s/.test(source[index] ?? '')) {
    index += 1;
  }

  if (source[index] !== '{') {
    return source.indexOf('{', index);
  }

  let returnTypeBraceDepth = 0;
  for (; index < source.length; index += 1) {
    if (source[index] === '{') {
      returnTypeBraceDepth += 1;
      continue;
    }

    if (source[index] === '}') {
      returnTypeBraceDepth -= 1;
      if (returnTypeBraceDepth === 0) {
        return source.indexOf('{', index + 1);
      }
    }
  }

  return -1;
}

function fenced(language, content) {
  return ['```' + language, content, '```'].join('\n');
}

function head(content, length) {
  if (content.length <= length) {
    return content;
  }

  return `${content.slice(0, length)}\n<!-- truncated in README; see full artifact file -->`;
}

function syntheticUrl(fileName) {
  return `https://x.com/i/article/${stableId(fileName)}`;
}

function stableId(input) {
  let hash = 0;
  for (const char of input) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return String(hash || 1);
}

function slugify(input) {
  return basename(input)
    .replace(/\.[^.]+$/, '')
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function normalizeText(text) {
  return text.replace(/\s+/g, ' ').trim();
}

function findWorkspaceRoot(startDir) {
  let current = startDir;
  for (let depth = 0; depth < 8; depth += 1) {
    try {
      readFileSync(resolve(current, 'assets2', requestedName), 'utf8');
      return current;
    } catch {
      const parent = resolve(current, '..');
      if (parent === current) {
        break;
      }
      current = parent;
    }
  }

  throw new Error(`Unable to locate assets2/${requestedName} from ${startDir}`);
}
