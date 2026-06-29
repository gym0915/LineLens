import { HighlightLayer } from '../dist/reader/highlight-layer.js';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

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

const css = readReaderCss();
assert(
  /\.focus-unit\s*\{[\s\S]*?color: var\(--reader-text-muted\);[\s\S]*?cursor: pointer;/.test(css),
  'focus units should default to muted text before HighlightLayer applies is-muted'
);
assert(
  /\.focus-unit:hover\s*\{[\s\S]*?color: var\(--reader-text-hover\);[\s\S]*?\}/.test(css),
  'inactive focus units should expose a hover text color'
);
assert(
  /\.focus-unit\.is-active\s*\{[\s\S]*?color: var\(--reader-text-active\) !important;[\s\S]*?cursor: default;/.test(css),
  'active focus units should use full text color and default cursor'
);
for (const expected of [
  '.highlight-layer',
  '.highlight-focus',
  '--reader-highlight-outline',
  '--reader-highlight-shadow',
  '--reader-media-active-border',
  '--reader-media-active-padding',
  '--reader-media-active-width',
  '--reader-quote-border-active',
  '.focus-unit:hover',
  '.focus-unit.is-muted:hover',
  '.focus-unit.is-muted:not(.reader-code) *',
  '.focus-unit.is-muted:hover:not(.reader-code) *',
  '.focus-unit.is-active:not(.reader-code) *',
  'color: var(--reader-text-muted) !important',
  'color: var(--reader-text-hover) !important',
  'color: var(--reader-text-active) !important',
  '@media (prefers-reduced-motion: reduce)',
  '.reader-media.focus-unit.is-active',
  '.reader-media.focus-unit.is-active > img',
  '.reader-block[data-block-type="quote"].focus-unit.is-active',
  '.reader-block[data-block-type="heading"].focus-unit.is-active',
  '.reader-list-item.focus-unit.is-active',
  '.reader-code.focus-unit.is-muted',
  'opacity: 0.45',
  '.reader-code.focus-unit.is-muted:hover',
  'opacity: 0.62',
  '.focus-unit strong',
  'font-weight: 700',
  'padding: 9px 10px 11px',
  'padding: var(--reader-inline-highlight-padding-block) var(--reader-inline-highlight-padding-inline)',
  'width: var(--reader-media-active-width)',
  'border: 1px solid var(--reader-media-active-border)',
  'filter: none'
]) {
  assert(css.includes(expected), `missing CSS coverage for ${expected}`);
}

assert(
  getRule(css, '.highlight-layer.is-visible').includes('opacity: 1;'),
  'HighlightLayer should become visible; shared layer owns active focus visuals'
);
const highlightFocusRule = getRule(css, '.highlight-focus');
const highlightLayerRule = getRule(css, '.highlight-layer');
const readerArticleRule = getRule(css, '.reader-article');
assert(
  highlightLayerRule.includes('z-index: 0;'),
  'HighlightLayer should stay below Reader content in the stacking contract'
);
assert(
  highlightFocusRule.includes('background: var(--reader-highlight-surface);'),
  'HighlightLayer focus rect should own the active focus background'
);
assert(
  highlightFocusRule.includes('box-shadow: var(--reader-highlight-shadow);'),
  'HighlightLayer focus rect should own the active focus halo/shadow'
);
assert(
  highlightFocusRule.includes('transform: translate3d(var(--highlight-x, 0), var(--highlight-y, 0), 0);'),
  'HighlightLayer focus rect should move the halo and shadow together'
);
assert(
  highlightFocusRule.includes('transform 250ms ease') &&
    highlightFocusRule.includes('width 250ms ease') &&
    highlightFocusRule.includes('height 250ms ease'),
  'HighlightLayer focus rect should own rect transition'
);
assert(
  readerArticleRule.includes('position: relative;') && readerArticleRule.includes('z-index: 1;'),
  'Reader article content should render above the visible HighlightLayer focus surface'
);

for (const selector of [
  'p .focus-unit.is-active',
  '.reader-media.focus-unit.is-active',
  '.reader-block[data-block-type="quote"].focus-unit.is-active',
  '.reader-embed.focus-unit.is-active',
  '.reader-code.focus-unit.is-active',
  '.reader-table.focus-unit.is-active',
  '.reader-link.focus-unit.is-active',
  '.reader-simple-tweet.focus-unit.is-active',
  '.reader-list-item.focus-unit.is-active',
  '.reader-block[data-block-type="heading"].focus-unit.is-active'
]) {
  const rule = getRule(css, selector);
  assert(rule, `${selector} rule should exist`);
  assert(!rule.includes('background: var(--reader-highlight-surface);'), `${selector} should not own duplicate outer focus background`);
  assert(!rule.includes('box-shadow: var(--reader-card-shadow);'), `${selector} should not own duplicate outer card shadow`);
  assert(!rule.includes('box-shadow: var(--reader-highlight-shadow);'), `${selector} should not own duplicate focus halo shadow`);
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

function readReaderCss() {
  const publicDir = new URL('../public', import.meta.url).pathname;
  const stylesDir = join(publicDir, 'styles');
  const entryCss = readFileSync(join(publicDir, 'reader.css'), 'utf8');
  const styleCss = readdirSync(stylesDir)
    .filter((fileName) => fileName.endsWith('.css'))
    .sort()
    .map((fileName) => readFileSync(join(stylesDir, fileName), 'utf8'))
    .join('\n');
  return `${entryCss}\n${styleCss}`;
}

function getRule(css, selector) {
  const bodies = [];
  for (const match of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selectors = match[1].split(',').map((item) => item.trim());
    if (selectors.includes(selector)) bodies.push(match[2]);
  }
  return bodies.join('\n');
}
