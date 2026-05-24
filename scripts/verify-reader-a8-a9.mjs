import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { FocusEngine } from '../dist/reader/focus-engine.js';
import { mountReaderApp } from '../dist/reader/reader-app.js';

class ClassList {
  constructor(owner) {
    this.owner = owner;
    this.values = new Set();
  }

  add(...names) {
    for (const name of this.owner.className.split(/\s+/).filter(Boolean)) this.values.add(name);
    for (const name of names) this.values.add(name);
    this.owner.className = [...this.values].join(' ');
  }

  remove(...names) {
    for (const name of this.owner.className.split(/\s+/).filter(Boolean)) this.values.add(name);
    for (const name of names) this.values.delete(name);
    this.owner.className = [...this.values].join(' ');
  }

  contains(name) {
    return this.values.has(name);
  }
}

class StyleLike {
  constructor() {
    this.values = new Map();
  }

  setProperty(name, value) {
    this.values.set(name, value);
  }

  getPropertyValue(name) {
    return this.values.get(name) ?? '';
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
  constructor(tagName, rect = { left: 10, top: 20, width: 100, height: 20 }) {
    super();
    this.nodeType = 1;
    this.tagName = tagName.toUpperCase();
    this.dataset = {};
    this.className = '';
    this.classList = new ClassList(this);
    this.style = new StyleLike();
    this.eventListeners = new Map();
    this.attributes = new Map();
    this.rect = rect;
    this.scrollCalls = [];
    this.isContentEditable = false;
  }

  set textContent(value) {
    this.children = [new TextNodeLike(value)];
  }

  get textContent() {
    return this.children.map((child) => child.textContent ?? '').join('');
  }

  addEventListener(type, listener) {
    if (!this.eventListeners.has(type)) this.eventListeners.set(type, []);
    this.eventListeners.get(type).push(listener);
  }

  setAttribute(name, value) {
    this.attributes.set(name, value);
  }

  remove() {
    if (!this.parent) return;
    this.parent.children = this.parent.children.filter((child) => child !== this);
    this.parent = null;
  }

  closest(selector) {
    let current = this;
    while (current) {
      if (matchesSelector(current, selector)) return current;
      current = current.parent;
    }
    return null;
  }

  querySelector(selector) {
    return walk(this).find((element) => matchesSelector(element, selector)) ?? null;
  }

  querySelectorAll(selector) {
    return walk(this).filter((element) => matchesSelector(element, selector));
  }

  getBoundingClientRect() {
    return this.rect;
  }

  scrollIntoView(options) {
    this.scrollCalls.push(options);
  }
}

const windowListeners = new Map();
const documentListeners = new Map();
const storage = new Map();
let visibilityState = 'visible';

globalThis.HTMLElement = ElementLike;
globalThis.document = {
  visibilityState,
  fonts: { ready: Promise.resolve() },
  createElement(tagName) {
    return new ElementLike(tagName);
  },
  createTextNode(text) {
    return new TextNodeLike(text);
  },
  addEventListener(type, listener) {
    if (!documentListeners.has(type)) documentListeners.set(type, []);
    documentListeners.get(type).push(listener);
  }
};
globalThis.window = {
  addEventListener(type, listener) {
    if (!windowListeners.has(type)) windowListeners.set(type, []);
    windowListeners.get(type).push(listener);
  },
  requestAnimationFrame(callback) {
    callback();
    return 0;
  },
  matchMedia() {
    return { matches: false };
  },
  getSelection() {
    return { toString: () => '' };
  }
};
globalThis.localStorage = {
  getItem(key) {
    return storage.get(key) ?? null;
  },
  setItem(key, value) {
    storage.set(key, value);
  }
};

const units = [textUnit('p1-u1'), textUnit('p1-u2')];
const changes = [];
const engine = new FocusEngine(units, (unit, index) => changes.push([unit.unitId, index]));
engine.start();
assert(engine.state?.anchorMode === 'free', 'FocusEngine should expose default free anchor mode');
engine.setAnchorMode('anchored');
assert(engine.state?.anchorMode === 'anchored', 'FocusEngine should reserve anchored mode state');
engine.alignActiveToViewport({ behavior: 'auto', block: 'center' });

const article = JSON.parse(
  readFileSync(join(new URL('..', import.meta.url).pathname, 'fixtures/articles/media-and-quote.json'), 'utf8')
);
const root = new ElementLike('main');
mountReaderApp(root, article);

const activeBefore = findByClass(root, 'is-active');
const overlay = findByClass(root, 'highlight-layer');
const focus = findByClass(root, 'highlight-focus');
assert(activeBefore?.dataset.unitId === 'h1-block', 'Reader should start on first block FocusUnit');
assert(focus?.style.getPropertyValue('--highlight-y') === '20px', 'Initial highlight rect should be set');

activeBefore.rect = { left: 30, top: 140, width: 320, height: 44 };
const scrollCountBeforeResize = activeBefore.scrollCalls.length;
windowListeners.get('resize')?.at(-1)?.();
assert(findByClass(root, 'is-active')?.dataset.unitId === 'h1-block', 'Resize should preserve active unit');
assert(focus.style.getPropertyValue('--highlight-y') === '140px', 'Resize should refresh highlight rect');
assert(activeBefore.scrollCalls.length === scrollCountBeforeResize, 'Resize refresh should not force scroll');

const image = walk(root).find((element) => element.tagName === 'IMG');
assert(image, 'media fixture should render image');
image.rect = { left: 50, top: 240, width: 480, height: 260 };
image.eventListeners.get('load')?.at(-1)?.();
assert(overlay.dataset.activeUnitId === 'h1-block', 'Image load refresh should preserve active id');

globalThis.document.visibilityState = 'hidden';
documentListeners.get('visibilitychange')?.at(-1)?.();
assert(focus.style.getPropertyValue('--highlight-y') === '140px', 'Hidden tab should not refresh');
activeBefore.rect = { left: 31, top: 180, width: 321, height: 45 };
globalThis.document.visibilityState = 'visible';
documentListeners.get('visibilitychange')?.at(-1)?.();
assert(focus.style.getPropertyValue('--highlight-y') === '180px', 'Visible tab should refresh active rect');

await globalThis.document.fonts.ready;
activeBefore.rect = { left: 31, top: 220, width: 321, height: 45 };
windowListeners.get('resize')?.at(-1)?.();
assert(focus.style.getPropertyValue('--highlight-y') === '220px', 'Font/style layout refresh path should keep rect sync');

const css = readFileSync(join(new URL('..', import.meta.url).pathname, 'public/reader.css'), 'utf8');
assert(css.includes('--reader-page-padding-bottom: 50vh'), 'Reader should reserve at least 50vh bottom padding');

console.log('Reader A8/A9 verification passed.');

function textUnit(unitId) {
  return { id: unitId, type: 'reading-text', blockId: unitId.split('-u')[0], unitId, text: unitId, startOffset: 0, endOffset: unitId.length };
}

function matchesSelector(element, selector) {
  if (selector === 'img') return element.tagName === 'IMG';

  const dataMatch = selector.match(/^\[data-([a-z-]+)(?:="([^"]+)")?\]$/);
  if (dataMatch) {
    const [, rawName, value] = dataMatch;
    const key = rawName.replace(/-([a-z])/g, (_, char) => char.toUpperCase());
    if (value === undefined) return element.dataset?.[key] !== undefined;
    return element.dataset?.[key] === value;
  }

  const classMatch = selector.match(/^\.([A-Za-z0-9_-]+)$/);
  if (classMatch) return element.className.split(/\s+/).includes(classMatch[1]);

  return false;
}

function findByClass(rootElement, className) {
  return walk(rootElement).find((element) => element.className.split(/\s+/).includes(className)) ?? null;
}

function walk(rootElement) {
  const result = [];
  const stack = [rootElement];
  while (stack.length > 0) {
    const current = stack.shift();
    if (current instanceof ElementLike) result.push(current);
    stack.unshift(...current.children);
  }
  return result;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
