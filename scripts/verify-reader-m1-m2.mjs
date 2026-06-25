import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderArticleShell } from '../dist/reader/block-renderer.js';
import { buildFocusUnits } from '../dist/reader/focus-unit-builder.js';
import { createReaderTextSpan } from '../dist/reader/reader-text-renderer.js';

class ClassList {
  constructor(owner) {
    this.owner = owner;
    this.values = new Set();
  }

  add(...names) {
    for (const name of this.owner.className.split(/\s+/).filter(Boolean)) {
      this.values.add(name);
    }
    for (const name of names) this.values.add(name);
    this.owner.className = [...this.values].join(' ');
  }

  remove(...names) {
    for (const name of this.owner.className.split(/\s+/).filter(Boolean)) {
      this.values.add(name);
    }
    for (const name of names) this.values.delete(name);
    this.owner.className = [...this.values].join(' ');
  }

  contains(name) {
    return this.values.has(name);
  }
}

class NodeLike {
  constructor() {
    this.children = [];
    this.parent = null;
    this.isConnected = true;
  }

  append(...nodes) {
    for (const node of nodes) {
      const normalized = typeof node === 'string' ? new TextNodeLike(node) : node;
      normalized.parent = this;
      this.children.push(normalized);
    }
  }

  replaceChildren(...nodes) {
    this.children = [];
    this.append(...nodes);
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
    this.style = {};
    this.loading = '';
    this.alt = '';
    this.src = '';
    this.scrollHeight = 0;
    this.clientHeight = 0;
  }

  set textContent(value) {
    this.children = [new TextNodeLike(value)];
  }

  get textContent() {
    return this.children.map((child) => child.textContent ?? '').join('');
  }

  setAttribute(name, value) {
    this.attributes[name] = value;
    if (name === 'class') {
      this.className = value;
      this.classList.values = new Set(value.split(/\s+/).filter(Boolean));
    }
  }

  removeAttribute(name) {
    delete this.attributes[name];
  }

  addEventListener(type, listener) {
    if (!this.eventListeners.has(type)) this.eventListeners.set(type, []);
    this.eventListeners.get(type).push(listener);
  }

  remove() {
    if (!this.parent) return;
    this.parent.children = this.parent.children.filter((child) => child !== this);
    this.parent = null;
  }

  querySelector(selector) {
    return walk(this).find((element) => matchesSelector(element, selector)) ?? null;
  }

  querySelectorAll(selector) {
    return walk(this).filter((element) => matchesSelector(element, selector));
  }
}

globalThis.requestAnimationFrame = (callback) => {
  callback();
  return 0;
};

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

const sourceRoot = resolve(import.meta.dirname, '..', 'src', 'reader');
const rendererSource = [
  readFileSync(resolve(sourceRoot, 'block-renderer.ts'), 'utf8'),
  readFileSync(resolve(sourceRoot, 'renderers/text-block-renderer.ts'), 'utf8'),
  readFileSync(resolve(sourceRoot, 'renderers/simple-tweet-renderer.ts'), 'utf8')
].join('\n');
const focusBuilderSource = readFileSync(resolve(sourceRoot, 'focus-unit-builder.ts'), 'utf8');
const focusCss = readFileSync(resolve(import.meta.dirname, '..', 'public', 'styles', 'focus.css'), 'utf8');

assert.match(rendererSource, /reader-text-renderer\.js'/, 'reader renderers should import the unified text renderer');
assert.match(focusBuilderSource, /from '\.\/reader-text-renderer\.js'/, 'focus-unit builder should import the unified text renderer');
assert.doesNotMatch(rendererSource, /function appendAnnotatedText/, 'block renderer should not keep a private annotation renderer');
assert.doesNotMatch(focusBuilderSource, /function appendAnnotatedText/, 'focus-unit builder should not keep a private annotation renderer');

const sampleSpan = createReaderTextSpan(
  'Go 😎 now',
  [
    { startOffset: 0, endOffset: 2, href: 'https://example.com', bold: true },
    { startOffset: 3, endOffset: 5, emojiImageUrl: 'https://example.com/emoji.svg' }
  ],
  { role: 'body' }
);
assert(sampleSpan.className.includes('reader-text'), 'unified text renderer should always emit the base reader-text class');
assert(sampleSpan.className.includes('reader-text--body'), 'unified text renderer should expose the role class');
assert(sampleSpan.dataset.readerTextRole === 'body', 'unified text renderer should expose role metadata');
assert(sampleSpan.dataset.readerTextStart === '0', 'unified text renderer should expose range start metadata');
assert(sampleSpan.dataset.readerTextEnd === '9', 'unified text renderer should expose range end metadata');
assert(sampleSpan.querySelector('.reader-x-emoji'), 'unified text renderer should still render X emoji nodes');
assert(sampleSpan.querySelector('a'), 'unified text renderer should still render anchor annotations');
assert(sampleSpan.querySelector('strong'), 'unified text renderer should still render strong annotations');
assert.match(
  focusCss,
  /\.focus-unit\.is-muted:not\(\.reader-code\) \.reader-x-emoji\s*\{[\s\S]*?filter:\s*grayscale\(1\) opacity\(0\.28\)/,
  'Muted focus state should visually fade X emoji background images with the surrounding text'
);
assert.match(
  focusCss,
  /\.focus-unit\.is-muted:hover:not\(\.reader-code\) \.reader-x-emoji\s*\{[\s\S]*?filter:\s*grayscale\(1\) opacity\(0\.48\)/,
  'Muted hover state should keep X emoji subdued instead of restoring full-color artwork'
);
assert.match(
  focusCss,
  /\.focus-unit\.is-active:not\(\.reader-code\) \.reader-x-emoji\s*\{[\s\S]*?filter:\s*none/,
  'Active focus state should restore X emoji background images to their real colors'
);

const article = {
  id: 'm1m2-fixture',
  source: 'fixture',
  sourceUrl: 'https://example.com/article',
  canonicalUrl: 'https://example.com/article',
  title: 'Reader migration fixture',
  extractedAt: Date.now(),
  blocks: [
    {
      id: 'p1',
      type: 'paragraph',
      text: 'First annotated sentence. Second sentence.',
      annotations: [{ startOffset: 6, endOffset: 15, href: 'https://example.com' }]
    },
    {
      id: 'q1',
      type: 'quote',
      text: 'Quoted text',
      annotations: [{ startOffset: 0, endOffset: 6, bold: true }]
    },
    {
      id: 'list1',
      type: 'list',
      kind: 'unordered',
      items: ['Alpha item', 'Beta item'],
      itemAnnotations: [[{ startOffset: 0, endOffset: 5, bold: true }], [{ startOffset: 0, endOffset: 4, href: 'https://example.com/beta' }]]
    },
    {
      id: 'tweet1',
      type: 'simple-tweet',
      coverUrl: 'https://example.com/cover.jpg',
      source: 'X Article',
      title: 'Tweet title',
      excerpt: 'Tweet excerpt body',
      href: 'https://x.com/example/status/1'
    }
  ]
};

const rendered = renderArticleShell(article);
const paragraph = rendered.querySelector('[data-block-id="p1"]');
assert(paragraph?.dataset.readerTextRole === 'body', 'paragraph block should expose unified text role metadata');
assert(paragraph?.querySelector('a'), 'paragraph block should still render annotated links');
const quote = rendered.querySelector('[data-block-id="q1"]');
assert(quote?.dataset.readerTextRole === 'quote', 'quote block should expose unified text role metadata');
assert(quote?.querySelector('strong'), 'quote block should still render strong annotations');
const listText = rendered.querySelector('.reader-list-text')?.querySelector('.reader-text');
assert(listText?.className.includes('reader-text--list-item'), 'list items should render through the unified text renderer');
const simpleTweetTitle = rendered.querySelector('.reader-simple-tweet-title')?.querySelector('.reader-text');
assert(simpleTweetTitle?.className.includes('reader-text--social-title'), 'simple tweet title should render through the unified text renderer');
const simpleTweetExcerpt = rendered.querySelector('.reader-simple-tweet-excerpt')?.querySelector('.reader-text');
assert(simpleTweetExcerpt?.className.includes('reader-text--social-excerpt'), 'simple tweet excerpt should render through the unified text renderer');

const root = new ElementLike('main');
root.append(rendered);
const { units, elements } = buildFocusUnits(article, rendered);
const paragraphUnit = units.find((unit) => unit.unitId === 'p1-u1');
assert(paragraphUnit?.type === 'reading-text', 'paragraph should still generate reading-text units');
assert(paragraphUnit?.textRole === 'body', 'paragraph reading-text units should expose the unified text role');
const paragraphElement = elements.get('p1-u1');
assert(paragraphElement?.className.includes('reader-text'), 'paragraph focus units should render through the unified text renderer');
assert(paragraphElement?.dataset.readerTextStart === '0', 'paragraph focus units should expose range metadata');
const listUnit = units.find((unit) => unit.unitId === 'list1-item-1');
assert(listUnit?.type === 'reading-text', 'list items should remain reading-text units');
assert(listUnit?.textRole === 'list-item', 'list reading-text units should expose the list-item role');

console.log('M1-M2 reader text renderer and focus metadata verification passed.');

function walk(node) {
  const elements = [];
  for (const child of node.children ?? []) {
    if (child.nodeType === 1) {
      elements.push(child);
      elements.push(...walk(child));
    }
  }
  return elements;
}

function matchesSelector(element, selector) {
  const selectors = selector.split(',').map((part) => part.trim()).filter(Boolean);
  return selectors.some((part) => matchesSingleSelector(element, part));
}

function matchesSingleSelector(element, selector) {
  let remaining = selector;
  const classMatches = [...remaining.matchAll(/\.([a-zA-Z0-9_-]+)/g)].map((match) => match[1]);
  remaining = remaining.replace(/\.([a-zA-Z0-9_-]+)/g, '');

  const attributeMatches = [...remaining.matchAll(/\[([^=\]]+)(?:="([^"]*)")?\]/g)];
  remaining = remaining.replace(/\[[^\]]+\]/g, '').trim();
  const tag = remaining.trim().toUpperCase();

  if (tag && element.tagName !== tag) return false;
  for (const className of classMatches) {
    if (!element.className.split(/\s+/).includes(className)) return false;
  }
  for (const [, rawName, value] of attributeMatches) {
    const name = rawName.trim();
    if (name.startsWith('data-')) {
      const datasetKey = name
        .slice(5)
        .replace(/-([a-z])/g, (_match, char) => char.toUpperCase());
      if (!(datasetKey in element.dataset)) return false;
      if (value !== undefined && element.dataset[datasetKey] !== value) return false;
    } else {
      if (!(name in element.attributes)) return false;
      if (value !== undefined && element.attributes[name] !== value) return false;
    }
  }
  return true;
}
