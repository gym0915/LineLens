import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { filterInlineStyle } from '../dist/content/preprocess/style-whitelist.js';
import { renderArticleShell } from '../dist/reader/block-renderer.js';

class ClassList {
  constructor(owner) {
    this.owner = owner;
    this.values = new Set();
  }

  add(...names) {
    for (const name of names) {
      this.values.add(name);
    }
    this.owner.className = [...new Set([...this.owner.className.split(/\s+/).filter(Boolean), ...this.values])].join(' ');
  }

  contains(name) {
    return this.owner.className.split(/\s+/).includes(name);
  }
}

class NodeLike {
  constructor() {
    this.children = [];
    this.parent = null;
  }

  append(...nodes) {
    for (const node of nodes) {
      const normalized = typeof node === 'string' ? new TextNodeLike(node) : node;
      normalized.parent = this;
      this.children.push(normalized);
    }
  }
}

class TextNodeLike extends NodeLike {
  constructor(text) {
    super();
    this.nodeType = 3;
    this.textContent = text;
  }
}

class ElementLike extends NodeLike {
  constructor(tagName) {
    super();
    this.nodeType = 1;
    this.tagName = tagName.toUpperCase();
    this.dataset = {};
    this.attributes = {};
    this.className = '';
    this.classList = new ClassList(this);
    this.eventListeners = new Map();
    this.style = {
      setProperty(name, value) {
        this[name] = value;
      }
    };
  }

  set textContent(value) {
    this.children = [new TextNodeLike(value)];
  }

  get textContent() {
    return this.children.map((child) => child.textContent ?? '').join('');
  }

  addEventListener(type, listener) {
    this.eventListeners.set(type, listener);
  }

  setAttribute(name, value) {
    this.attributes[name] = value;
    if (name === 'class') {
      this.className = value;
    }
  }

  querySelector(selector) {
    return querySelector(this, selector);
  }

  querySelectorAll(selector) {
    return walk(this).filter((element) => matchesSelector(element, selector));
  }
}

globalThis.document = {
  createElement(tagName) {
    return new ElementLike(tagName);
  },
  createElementNS(_namespace, tagName) {
    return new ElementLike(tagName);
  },
  createTextNode(text) {
    return new TextNodeLike(text);
  }
};

const projectRoot = resolve(import.meta.dirname, '..');
const sourceFiles = {
  types: readFileSync(resolve(projectRoot, 'src/shared/article.ts'), 'utf8'),
  modularExtractor: readFileSync(resolve(projectRoot, 'src/content/extractors/x/article-extractor.ts'), 'utf8'),
  liveExtractor: readFileSync(resolve(projectRoot, 'src/content/index.ts'), 'utf8'),
  cleanTree: readFileSync(resolve(projectRoot, 'src/content/preprocess/clean-tree-block-converter.ts'), 'utf8'),
  renderer: readFileSync(resolve(projectRoot, 'src/reader/block-renderer.ts'), 'utf8'),
  textRenderer: readFileSync(resolve(projectRoot, 'src/reader/reader-text-renderer.ts'), 'utf8'),
  css: readFileSync(resolve(projectRoot, 'public/styles/blocks.css'), 'utf8'),
  focusCss: readFileSync(resolve(projectRoot, 'public/styles/focus.css'), 'utf8')
};

assert.match(sourceFiles.types, /export type CodeBlockStyle = \{[\s\S]*?preBackgroundColor\?: string[\s\S]*?codeColor\?: string/, 'CodeBlock should carry source code block colors');
assert.match(sourceFiles.types, /export type CodeToken = \{[\s\S]*?color\?: string[\s\S]*?fontStyle\?: string/, 'CodeBlock should carry source token colors');
assert.match(sourceFiles.types, /export type TableBlock = \{[\s\S]*?columnCount\?: number[\s\S]*?tableStyle\?: TableStyle/, 'Article model should include dynamic table blocks');
assert.match(sourceFiles.types, /export type TextAnnotation = \{[\s\S]*?color\?: string[\s\S]*?fontSize\?: string/, 'Text annotations should carry inline text color and size');
assert.match(sourceFiles.types, /export type TextStyle = \{[\s\S]*?textAlign\?: string[\s\S]*?fontWeight\?: string/, 'Block and table text styles should carry alignment and weight');

for (const [name, source] of [
  ['modular extractor', sourceFiles.modularExtractor],
  ['live extractor', sourceFiles.liveExtractor],
  ['clean-tree converter', sourceFiles.cleanTree]
]) {
  assert.match(source, /extractCodeBlockStyle/, `${name} should extract code block surface styles`);
  assert.match(source, /extractCodeTokens/, `${name} should extract per-token code styles`);
  assert.match(source, /extractTextAnnotationStyle/, `${name} should extract inline text styles`);
  assert.match(source, /hasTextAnnotationSignal/, `${name} should keep style-only text annotations`);
  assert.match(source, /extractTableBlock|convertTableElement/, `${name} should convert table DOM into table blocks`);
  assert.match(source, /columnCount:\s*Math\.max/, `${name} should derive dynamic table column count`);
  assert.match(source, /textAlign:\s*getStyleValue\(element, 'textAlign'\)/, `${name} should preserve table/body text alignment`);
}

assert.match(sourceFiles.cleanTree, /DEFAULT_ENABLED_BLOCK_TYPES[\s\S]*'table'/, 'clean-tree path should enable table conversion');
assert.match(sourceFiles.cleanTree, /querySelectorAll\('[^']*table,\s*\[role="table"\],\s*\[role="grid"\]/, 'clean-tree path should scan table roots directly');
assert.match(sourceFiles.renderer, /function renderArticleHeaderAuthorMeta[\s\S]*return null/, 'Reader should be able to omit the article author row');
assert.match(sourceFiles.renderer, /const authorMeta = renderArticleHeaderAuthorMeta\(article\)[\s\S]*const metrics = renderArticleHeaderMetrics\(article\)/, 'Reader should render interaction row independently from author row');
assert.match(sourceFiles.renderer, /function renderTableBlock\(block: TableBlock\)/, 'Reader should render table blocks');
assert.match(sourceFiles.renderer, /appendExtractedCodeTokens/, 'Reader should render extracted code tokens instead of forcing local highlighting');
assert.match(sourceFiles.textRenderer, /annotation\.color \|\| annotation\.fontSize/, 'Reader text metadata should retain style-only annotations');
assert.match(sourceFiles.textRenderer, /applyInlineTextStyle/, 'Reader text renderer should apply inline DOM text styles');
assert.doesNotMatch(
  sourceFiles.focusCss,
  /\.focus-unit\.is-active \*\s*\{\s*color:\s*var\(--reader-text-active\)\s*!important;/,
  'Active focus state should not override extracted inline code token colors'
);
assert.match(sourceFiles.css, /\.reader-table[\s\S]*overflow-x: auto/, 'Reader CSS should provide a table surface');
assert.match(sourceFiles.css, /\.reader-table-cell[\s\S]*white-space: pre-wrap/, 'Reader table cells should preserve source line breaks');

const whitelistConfig = { preserveProps: ['font-weight'], preserveColorFor: ['link'], preserveWhiteSpaceValues: ['pre', 'pre-wrap'] };
assert.equal(
  filterInlineStyle(
    'color: rgb(15, 20, 25); font-size: 17px; line-height: 24px; text-align: center; position: absolute; width: 100px; transform: scale(1)',
    whitelistConfig,
    {
      isCodeLike: false,
      isInlineEmphasis: false,
      isLink: false,
      isPreformatted: false,
      isReadableText: true,
      isTableLike: false,
      matchesCustomColorSelector: false
    }
  ),
  'color: rgb(15, 20, 25); font-size: 17px; line-height: 24px; text-align: center',
  'Whitelist should keep readable text color and size while rejecting layout pollution'
);
assert.equal(
  filterInlineStyle(
    'background: rgb(247, 249, 249); color: rgb(56, 58, 66); font-size: 13px; line-height: 1.5; tab-size: 2; margin: 0px',
    whitelistConfig,
    {
      isCodeLike: true,
      isInlineEmphasis: false,
      isLink: false,
      isPreformatted: true,
      isReadableText: false,
      isTableLike: false,
      matchesCustomColorSelector: false
    }
  ),
  'background: rgb(247, 249, 249); color: rgb(56, 58, 66); font-size: 13px; line-height: 1.5; tab-size: 2',
  'Whitelist should keep code block colors and sizing'
);
assert.equal(
  filterInlineStyle(
    'background-color: rgb(247, 249, 249); border-color: rgb(207, 217, 222); color: rgb(83, 100, 113); font-size: 14px; text-align: right; letter-spacing: 2px',
    whitelistConfig,
    {
      isCodeLike: false,
      isInlineEmphasis: false,
      isLink: false,
      isPreformatted: false,
      isReadableText: false,
      isTableLike: true,
      matchesCustomColorSelector: false
    }
  ),
  'background-color: rgb(247, 249, 249); border-color: rgb(207, 217, 222); color: rgb(83, 100, 113); font-size: 14px; text-align: right',
  'Whitelist should keep table colors and text alignment'
);

const article = {
  id: 'dynamic-style-fixture',
  source: 'x-article',
  sourceUrl: 'https://x.com/example/article/1',
  canonicalUrl: 'https://x.com/example/article/1',
  title: 'Dynamic style fixture',
  extractedAt: 1,
  metrics: {
    replies: '12',
    reposts: '3',
    likes: '45',
    views: '1.2万'
  },
  blocks: [
    {
      id: 'p1',
      type: 'paragraph',
      text: '正文 watch.sh 继续',
      textStyle: { color: 'rgb(15, 20, 25)', fontSize: '17px', lineHeight: '24px' },
      annotations: [
        {
          startOffset: 3,
          endOffset: 11,
          href: '//watch.sh',
          target: '_blank',
          color: 'rgb(15, 20, 25)',
          fontSize: '17px'
        }
      ]
    },
    {
      id: 'code1',
      type: 'code',
      language: 'python',
      text: 'from smolagents import tool\n# comment\nprint("ok")',
      codeStyle: {
        headerBackgroundColor: 'rgb(229, 234, 236)',
        headerColor: 'rgb(15, 20, 25)',
        copyColor: 'rgb(15, 20, 25)',
        preBackgroundColor: 'rgb(247, 249, 249)',
        codeBackgroundColor: 'rgb(250, 250, 250)',
        codeColor: 'rgb(56, 58, 66)',
        fontSize: '13px',
        lineHeight: '1.5'
      },
      tokens: [
        { text: 'from', color: 'rgb(166, 38, 164)' },
        { text: ' smolagents import tool\n' },
        { text: '# comment', color: 'rgb(160, 161, 167)', fontStyle: 'italic' },
        { text: '\nprint(' },
        { text: '"ok"', color: 'rgb(80, 161, 79)' },
        { text: ')' }
      ]
    },
    {
      id: 'table1',
      type: 'table',
      columnCount: 3,
      tableStyle: { backgroundColor: 'rgb(247, 249, 249)', borderColor: 'rgb(207, 217, 222)' },
      rows: [
        {
          cells: [
            { text: 'A', header: true, textStyle: { color: 'rgb(15, 20, 25)', fontSize: '15px', textAlign: 'left', fontWeight: '700' } },
            { text: 'B', header: true, textStyle: { color: 'rgb(15, 20, 25)', fontSize: '15px', textAlign: 'center', fontWeight: '700' } },
            { text: 'C', header: true, textStyle: { color: 'rgb(15, 20, 25)', fontSize: '15px', textAlign: 'right', fontWeight: '700' } }
          ]
        },
        {
          cells: [
            { text: '1', textStyle: { color: 'rgb(83, 100, 113)', fontSize: '14px', textAlign: 'left' } },
            { text: '2', textStyle: { color: 'rgb(83, 100, 113)', fontSize: '14px', textAlign: 'center' } },
            { text: '3', textStyle: { color: 'rgb(83, 100, 113)', fontSize: '14px', textAlign: 'right' } }
          ]
        }
      ]
    }
  ]
};

const rendered = renderArticleShell(article);
assert.equal(rendered.querySelector('.article-meta-author'), null, 'Author row should be absent when author metadata is missing');
const metricsRow = rendered.querySelector('.article-meta-metrics');
assert(metricsRow, 'Interaction row should still render when metrics exist');
assert.equal(metricsRow.href, article.canonicalUrl, 'Interaction row should use the unified article click target');
assert.equal(metricsRow.querySelectorAll('.article-meta-metric').length, 6, 'Interaction row should render four primary icons plus bookmark/share');

const paragraph = rendered.querySelector('[data-block-id="p1"]');
assert.equal(paragraph.style.color, 'rgb(15, 20, 25)', 'Paragraph should apply source text color');
assert.equal(paragraph.style.fontSize, '17px', 'Paragraph should apply source font size');
const paragraphLink = paragraph.querySelector('a');
assert.equal(paragraphLink.attributes.href, '//watch.sh', 'Inline link should preserve source href');
assert.equal(paragraphLink.style.color, 'rgb(15, 20, 25)', 'Inline link should apply source text color');
assert.equal(paragraphLink.style.fontSize, '17px', 'Inline link should apply source font size');

const code = rendered.querySelector('[data-block-id="code1"]');
assert.equal(code.querySelector('.reader-code-header').style.background, 'rgb(229, 234, 236)', 'Code header should apply source background');
assert.equal(code.querySelector('.reader-code-pre').style.background, 'rgb(247, 249, 249)', 'Code pre should apply source background');
assert.equal(code.querySelector('code').style.color, 'rgb(56, 58, 66)', 'Code element should apply default source color');
const codeTokenSpans = code.querySelector('code').children.filter((child) => child.tagName === 'SPAN');
assert(codeTokenSpans.some((span) => span.textContent === 'from' && span.style.color === 'rgb(166, 38, 164)'), 'Code keyword token should keep source color');
assert(codeTokenSpans.some((span) => span.textContent === '# comment' && span.style.color === 'rgb(160, 161, 167)' && span.style.fontStyle === 'italic'), 'Code comment token should keep source color and italic style');

const table = rendered.querySelector('[data-block-id="table1"]');
assert.equal(table.dataset.blockType, 'table', 'Table block should render with table block type');
assert.equal(table.querySelectorAll('.reader-table-cell').length, 6, 'Table should render all cells across dynamic column count');
assert.equal(table.querySelector('.reader-table-grid').style['--reader-table-columns'], '3', 'Table should expose dynamic column count');
const tableCells = table.querySelectorAll('.reader-table-cell');
assert.equal(tableCells[0].tagName, 'TH', 'Header cells should render as th');
assert.equal(tableCells[1].style.textAlign, 'center', 'Table cell should preserve source text alignment');
assert.equal(tableCells[2].style.textAlign, 'right', 'Table cell should preserve source right alignment');
assert.equal(tableCells[4].style.color, 'rgb(83, 100, 113)', 'Table body cell should preserve source text color');

console.log('X Article dynamic style and table verification passed.');

function querySelector(root, selector) {
  return root.querySelectorAll(selector)[0] ?? null;
}

function walk(root) {
  const result = [];
  const visit = (node) => {
    if (node.nodeType === 1) {
      result.push(node);
    }
    for (const child of node.children ?? []) {
      visit(child);
    }
  };
  visit(root);
  return result;
}

function matchesSelector(element, selector) {
  const selectors = selector.split(',').map((part) => part.trim());
  return selectors.some((singleSelector) => matchesSingleSelector(element, singleSelector));
}

function matchesSingleSelector(element, selector) {
  if (selector.startsWith('.')) {
    return element.className.split(/\s+/).includes(selector.slice(1));
  }

  const attributeMatch = /^\[([^=\]]+)(?:="([^"]+)")?\]$/.exec(selector);
  if (attributeMatch) {
    const [, name, value] = attributeMatch;
    const actual = name.startsWith('data-') ? element.dataset[toDatasetKey(name.slice(5))] : element.attributes[name];
    return value === undefined ? actual !== undefined : actual === value;
  }

  return element.tagName.toLowerCase() === selector.toLowerCase();
}

function toDatasetKey(name) {
  return name.replace(/-([a-z])/g, (_match, char) => char.toUpperCase());
}
