import { HighlightLayer } from '../dist/reader/highlight-layer.js';

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

class ElementLike {
  constructor(tagName, rect = { left: 0, top: 0, width: 0, height: 0 }) {
    this.tagName = tagName.toUpperCase();
    this.children = [];
    this.parent = null;
    this.dataset = {};
    this.className = '';
    this.classList = new ClassList(this);
    this.style = new StyleLike();
    this.attributes = new Map();
    this.rect = rect;
    this.scrollCalls = [];
  }

  append(...children) {
    for (const child of children) {
      child.parent = this;
      this.children.push(child);
    }
  }

  setAttribute(name, value) {
    this.attributes.set(name, value);
  }

  getBoundingClientRect() {
    return this.rect;
  }

  scrollIntoView(options) {
    this.scrollCalls.push(options);
  }
}

globalThis.document = {
  createElement(tagName) {
    return new ElementLike(tagName);
  }
};

globalThis.window = {
  matchMedia() {
    return { matches: false };
  }
};

const root = new ElementLike('main');
const first = new ElementLike('span', { left: 10, top: 20, width: 120, height: 24 });
const second = new ElementLike('span', { left: 12, top: 52, width: 180, height: 24 });
const image = new ElementLike('figure', { left: 40, top: 100, width: 520, height: 280 });
const elements = new Map([
  ['p1-u1', first],
  ['p1-u2', second],
  ['img1-block', image]
]);

const layer = new HighlightLayer();
layer.mount(root);
assert(root.children.length === 1, 'HighlightLayer should mount a layer');

layer.update(unit('p1-u1', 'reading-text'), elements);
const overlay = root.children[0];
const focus = overlay.children[0];
assert(overlay.classList.contains('is-visible'), 'highlight layer should become visible');
assert(overlay.dataset.activeUnitId === 'p1-u1', 'active unit id should be recorded on layer');
assert(focus.style.getPropertyValue('--highlight-x') === '10px', 'highlight x should come from DOMRect');
assert(focus.style.getPropertyValue('--highlight-y') === '20px', 'highlight y should come from DOMRect');
assert(focus.style.getPropertyValue('--highlight-width') === '120px', 'highlight width should come from DOMRect');
assert(focus.style.getPropertyValue('--highlight-height') === '24px', 'highlight height should come from DOMRect');
assert(first.classList.contains('is-active'), 'active element should get is-active');
assert(!first.classList.contains('is-muted'), 'active element should not be muted');
assert(second.classList.contains('is-muted'), 'inactive element should be muted');

layer.update(unit('p1-u2', 'reading-text'), elements);
assert(!first.classList.contains('is-active'), 'previous active should be cleared after quick update');
assert(first.classList.contains('is-muted'), 'previous active should become muted after quick update');
assert(second.classList.contains('is-active'), 'latest active should win after quick update');
assert(overlay.dataset.activeUnitId === 'p1-u2', 'layer should track latest active id');
assert(focus.style.getPropertyValue('--highlight-y') === '52px', 'highlight rect should update to latest active');

layer.update(unit('img1-block', 'block', 'image'), elements, { scroll: true });
assert(image.classList.contains('is-active'), 'image block should be active as a whole element');
assert(focus.style.getPropertyValue('--highlight-width') === '520px', 'image highlight should use whole block width');
assert(focus.style.getPropertyValue('--highlight-height') === '280px', 'image highlight should use whole block height');
assert(image.scrollCalls.at(-1)?.behavior === 'smooth', 'normal motion should use smooth scroll');

globalThis.window = {
  matchMedia() {
    return { matches: true };
  }
};
layer.update(unit('p1-u1', 'reading-text'), elements, { scroll: true });
assert(first.scrollCalls.at(-1)?.behavior === 'auto', 'reduced motion should use auto scroll');

layer.hide();
assert(!overlay.classList.contains('is-visible'), 'hide should remove visible state');
assert(layer.activeId === null, 'hide should clear active id');

const css = await import('node:fs').then(({ readFileSync }) =>
  readFileSync(new URL('../public/reader.css', import.meta.url), 'utf8')
);
for (const expected of [
  '.highlight-layer',
  '.highlight-focus',
  '--reader-highlight-outline',
  '--reader-media-active-border',
  '--reader-media-active-padding',
  '--reader-media-active-width',
  '--reader-card-shadow',
  '--reader-quote-border-active',
  '.focus-unit.is-muted:hover',
  '@media (prefers-reduced-motion: reduce)',
  '.reader-media.focus-unit.is-active',
  '.reader-media.focus-unit.is-active img',
  '.reader-block[data-block-type="quote"].focus-unit.is-active',
  '.reader-block[data-block-type="heading"].focus-unit.is-active',
  '.reader-list-item.focus-unit.is-active',
  '.focus-unit strong',
  'font-weight: 700',
  'padding: 9px 10px 11px',
  '0 0 0 4px var(--reader-highlight-surface)',
  'background: var(--reader-highlight-surface)',
  'width: var(--reader-media-active-width)',
  'border: 1px solid var(--reader-media-active-border)',
  'filter: none'
]) {
  assert(css.includes(expected), `missing CSS coverage for ${expected}`);
}

console.log('Reader A5 verification passed.');

function unit(unitId, type, blockType) {
  if (type === 'block') {
    return { id: unitId, unitId, type, blockId: unitId.replace('-block', ''), blockType };
  }
  return {
    id: unitId,
    unitId,
    type,
    blockId: unitId.split('-u')[0],
    text: 'fixture',
    startOffset: 0,
    endOffset: 7
  };
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}
