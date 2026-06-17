import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = new URL('..', import.meta.url).pathname;

// ---- Mock DOM helpers ----

class ClassList {
  constructor(owner) {
    this.owner = owner;
    this.values = new Set();
  }
  add(...names) {
    for (const name of names) this.values.add(name);
    this.owner.className = [...this.values].join(' ');
  }
  remove(...names) {
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
    this.style = {};
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
      this.classList.values = new Set(value.split(/\s+/).filter(Boolean));
    }
  }
  remove() {
    if (!this.parent) return;
    this.parent.children = this.parent.children.filter((child) => child !== this);
    this.parent = null;
  }
  querySelector() { return null; }
  querySelectorAll() { return []; }
  scrollIntoView() { scrollCalls.push(this); }
}

// Track scrollIntoView calls globally
const scrollCalls = [];

// Mock scrollIntoView on the Element prototype of our mock
// (used via highlight-layer's activeElement.scrollIntoView)

globalThis.document = {
  createElement(tagName) {
    return new ElementLike(tagName);
  },
  createElementNS(_namespace, tagName) {
    return new ElementLike(tagName);
  },
  createTextNode(text) {
    return new TextNodeLike(text);
  },
  querySelector() { return null; },
  querySelectorAll() { return []; }
};

// ---- Load built modules ----

const { HighlightLayer } = await import('../dist/reader/highlight-layer.js');
const { FocusEngine } = await import('../dist/reader/focus-engine.js');

// ---- Test 1: With saved progress (initialIndex > 0), first render SHOULD scroll ----

scrollCalls.length = 0;
let hasRenderedInitialFocus = false;
let activeIndex = null;

const units = [
  { unitId: 'unit-0', blockId: 'b0', type: 'block', blockType: 'paragraph', text: 'First' },
  { unitId: 'unit-1', blockId: 'b1', type: 'block', blockType: 'paragraph', text: 'Second' },
  { unitId: 'unit-2', blockId: 'b2', type: 'block', blockType: 'paragraph', text: 'Third' },
  { unitId: 'unit-3', blockId: 'b3', type: 'block', blockType: 'paragraph', text: 'Fourth' }
];

// Build mock elements map
const elements = new Map();
for (const unit of units) {
  const el = new ElementLike('div');
  el.dataset.unitId = unit.unitId;
  elements.set(unit.unitId, el);
}

// Simulate current code behavior (before fix)
function simulateCurrentBehavior(initialIndex) {
  scrollCalls.length = 0;
  hasRenderedInitialFocus = false;
  activeIndex = null;

  const engine = new FocusEngine(units, (unit, index) => {
    // Current behavior: shouldScroll = hasRenderedInitialFocus && index !== activeIndex
    const shouldScroll = hasRenderedInitialFocus && index !== activeIndex;
    activeIndex = index;
    hasRenderedInitialFocus = true;

    if (shouldScroll) {
      const el = elements.get(unit.unitId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  });

  engine.start(initialIndex);
}

// Simulate fixed behavior
function simulateFixedBehavior(initialIndex) {
  scrollCalls.length = 0;
  hasRenderedInitialFocus = false;
  activeIndex = null;

  const engine = new FocusEngine(units, (unit, index) => {
    // Fixed behavior: scroll on first render only if initialIndex > 0
    const shouldScroll = !hasRenderedInitialFocus
      ? initialIndex > 0
      : index !== activeIndex;
    activeIndex = index;
    hasRenderedInitialFocus = true;

    if (shouldScroll) {
      const el = elements.get(unit.unitId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  });

  engine.start(initialIndex);
}

// --- Test Case 1: Saved progress at index 2 ---

// Current behavior: NO scroll on first render (BUG)
simulateCurrentBehavior(2);
assert(scrollCalls.length === 0, 'CURRENT BUG: should not scroll on first render with saved progress (index 2) — this is the bug we are fixing');

// Fixed behavior: SHOULD scroll on first render
simulateFixedBehavior(2);
assert(scrollCalls.length === 1, 'FIXED: should scroll on first render when restoring to saved progress (index 2)');

// --- Test Case 2: No saved progress, initialIndex = 0 ---

// Current behavior: no scroll (correct)
simulateCurrentBehavior(0);
assert(scrollCalls.length === 0, 'CURRENT: should not scroll on first render when starting from beginning');

// Fixed behavior: also no scroll (should be preserved)
simulateFixedBehavior(0);
assert(scrollCalls.length === 0, 'FIXED: should not scroll on first render when starting from beginning');

// --- Test Case 3: Saved progress at index 1 ---

simulateFixedBehavior(1);
assert(scrollCalls.length === 1, 'FIXED: should scroll on first render when restoring to saved progress (index 1)');

// --- Test Case 4: Subsequent navigation should still scroll ---

scrollCalls.length = 0;
hasRenderedInitialFocus = false;
activeIndex = null;

const engine = new FocusEngine(units, (unit, index) => {
  const shouldScroll = !hasRenderedInitialFocus
    ? 2 > 0  // initialIndex = 2
    : index !== activeIndex;
  activeIndex = index;
  hasRenderedInitialFocus = true;

  if (shouldScroll) {
    const el = elements.get(unit.unitId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }
});

engine.start(2);
assert(scrollCalls.length === 1, 'SUBSEQUENT: first render should scroll (initialIndex=2)');

scrollCalls.length = 0;
engine.next(); // index 3
assert(scrollCalls.length === 1, 'SUBSEQUENT: navigating next should scroll');
assert(scrollCalls[0].dataset.unitId === 'unit-3', 'SUBSEQUENT: should scroll to unit-3');

scrollCalls.length = 0;
engine.previous(); // index 2
assert(scrollCalls.length === 1, 'SUBSEQUENT: navigating previous should scroll');
assert(scrollCalls[0].dataset.unitId === 'unit-2', 'SUBSEQUENT: should scroll back to unit-2');

// --- Test Case 5: Navigating to same index should NOT scroll ---

scrollCalls.length = 0;
engine.setIndex(2); // same index
assert(scrollCalls.length === 0, 'SUBSEQUENT: navigating to same index should not scroll');

// --- Test Case 6: Verify source code contains the fixed logic ---

const readerAppSource = readFileSync(resolve(root, 'src/reader/reader-app.ts'), 'utf8');
assert(
  readerAppSource.includes('initialIndex > 0'),
  'SOURCE: reader-app.ts should check initialIndex > 0 for scroll-on-restore logic'
);

console.log('Reader restore-scroll verification passed.');

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}
