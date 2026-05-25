import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderArticleShell } from '../dist/reader/block-renderer.js';
import { buildFocusUnits } from '../dist/reader/focus-unit-builder.js';
import { splitIntoReadingUnits } from '../dist/reader/semantic-splitter.js';

class ClassList {
  constructor(owner) {
    this.owner = owner;
    this.values = new Set();
  }

  add(...names) {
    for (const name of names) {
      this.values.add(name);
    }
    this.owner.className = [...this.values].join(' ');
  }

  remove(...names) {
    for (const name of names) {
      this.values.delete(name);
    }
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
    this.loading = '';
    this.alt = '';
    this.src = '';
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
  }

  remove() {
    if (!this.parent) return;
    this.parent.children = this.parent.children.filter((child) => child !== this);
    this.parent = null;
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
  createTextNode(text) {
    return new TextNodeLike(text);
  }
};

const root = new URL('..', import.meta.url).pathname;
const fixtureDir = join(root, 'fixtures', 'articles');
const mediaArticle = readFixture('media-and-quote');
const longArticle = readFixture('long-paragraphs');
const mixedArticle = readFixture('mixed-content');

const rendered = renderArticleShell(mediaArticle);
assert(rendered.dataset.articleId === 'media-and-quote', 'article id should be rendered');

const title = findByClass(rendered, 'article-title');
assert(title?.tagName === 'H1', 'title should render as h1');
assert(title.textContent === mediaArticle.title, 'title text should match article title');
assert(title.dataset.blockId === 'title', 'title should have data-block-id');
assert(!title.dataset.unitId, 'title should not be an active FocusUnit before A4');
assert(findByClass(rendered, 'reader-kicker')?.textContent === 'LineLens', 'reader brand should not include Reader suffix');
const cover = findByClass(rendered, 'reader-cover');
assert(cover?.tagName === 'FIGURE', 'cover image should render as figure');
assert(cover.dataset.blockId === mediaArticle.coverImage.id, 'cover image should keep its block id');
assert(cover.dataset.blockType === 'cover', 'cover image should use cover block type');
assert(cover.children[0]?.tagName === 'IMG', 'cover should contain an image element');
assert(cover.children[0]?.src === mediaArticle.coverImage.src, 'cover image src should match article cover');
assert(
  findChildIndex(findByClass(rendered, 'article-header'), cover) < findChildIndex(findByClass(rendered, 'article-header'), title),
  'cover image should render above the title'
);

for (const block of mediaArticle.blocks) {
  const element = rendered.querySelector(`[data-block-id="${block.id}"]`);
  assert(element, `block ${block.id} should have data-block-id`);
  assert(element.dataset.blockType === block.type, `block ${block.id} should have block type`);
}

assert(rendered.querySelector('[data-block-id="h1"]')?.tagName === 'H2', 'heading should render as h2');
assert(rendered.querySelector('[data-block-id="q1"]')?.tagName === 'BLOCKQUOTE', 'quote should render as blockquote');
assert(rendered.querySelector('[data-block-id="img1"]')?.tagName === 'FIGURE', 'image should render as figure');
assert(
  rendered.querySelector('[data-block-id="img1"]')?.dataset.aspectRatio === String(mediaArticle.blocks.find((block) => block.id === 'img1')?.aspectRatio),
  'image should expose source aspect ratio for proportional rendering'
);
assert(rendered.querySelector('[data-block-id="embed1"]')?.tagName === 'ASIDE', 'embed should render as aside');
assert(rendered.querySelector('[data-block-id="ref1"]')?.tagName === 'ASIDE', 'ref card should render as aside');
assert(findByClass(rendered.querySelector('[data-block-id="ref1"]'), 'reader-ref-card-cover')?.tagName === 'IMG', 'ref card should render cover image');
assert(findByClass(rendered.querySelector('[data-block-id="ref1"]'), 'reader-ref-card-source')?.textContent === 'X Article', 'ref card source should render');
assert(
  findByClass(rendered.querySelector('[data-block-id="ref1"]'), 'reader-ref-card-title')?.textContent ===
    'The Science of Attention: Why Your Brain Needs Boredom',
  'ref card title should render'
);
assert(rendered.querySelector('[data-block-id="list1"]')?.tagName === 'UL', 'unordered list should render as ul');
const orderedListRendered = renderArticleShell({
  ...mediaArticle,
  blocks: [{ id: 'ordered-list', type: 'list', kind: 'ordered', items: ['第一项', '第二项'] }]
});
assert(orderedListRendered.querySelector('[data-block-id="ordered-list"]')?.tagName === 'OL', 'ordered list should render as ol');
const linkRendered = renderArticleShell({
  ...mediaArticle,
  blocks: [{ id: 'link1', type: 'link', text: '原文链接', href: 'https://x.com/example/status/1', target: '_blank' }]
});
const linkElement = linkRendered.querySelector('[data-block-id="link1"]');
assert(linkElement?.tagName === 'A', 'link block should render as anchor');
assert(linkElement.attributes.href === 'https://x.com/example/status/1', 'link block should preserve href');
assert(linkElement.attributes.target === '_blank', 'link block should preserve target');
const explicitHeadingRendered = renderArticleShell({
  ...mediaArticle,
  blocks: [{ id: 'explicit-h1', type: 'heading', level: 1, text: '1. 看一眼 Transformer 的 Attention Heatmap' }]
});
assert(
  explicitHeadingRendered.querySelector('[data-block-id="explicit-h1"]')?.tagName === 'H1',
  'explicit h1 source heading should render as h1'
);
const shortParagraphRendered = renderArticleShell({
  ...mediaArticle,
  blocks: [{ id: 'short-p', type: 'paragraph', text: '例如：' }]
});
assert(
  shortParagraphRendered.querySelector('[data-block-id="short-p"]')?.tagName === 'P',
  'short plain text should render as paragraph'
);

const focusBuild = buildFocusUnits(mediaArticle, rendered);
assert(focusBuild.units.length >= mediaArticle.blocks.length, 'FocusUnit list should be built');
assert(!focusBuild.units.some((unit) => unit.blockId === 'title'), 'title should not be first active unit');
assert(focusBuild.units.some((unit) => unit.type === 'block' && unit.blockType === 'heading'), 'heading block FocusUnit missing');
assert(focusBuild.units.some((unit) => unit.type === 'block' && unit.blockType === 'quote'), 'quote block FocusUnit missing');
assert(focusBuild.units.some((unit) => unit.type === 'block' && unit.blockType === 'image'), 'image block FocusUnit missing');
assert(focusBuild.units.some((unit) => unit.type === 'block' && unit.blockType === 'embed'), 'embed block FocusUnit missing');
assert(focusBuild.units.some((unit) => unit.type === 'block' && unit.blockType === 'ref-card'), 'ref card block FocusUnit missing');
const linkFocusBuild = buildFocusUnits(linkRendered.children[0] ? { ...mediaArticle, blocks: [{ id: 'link1', type: 'link', text: '原文链接', href: 'https://x.com/example/status/1' }] } : mediaArticle, linkRendered);
assert(linkFocusBuild.units.some((unit) => unit.type === 'block' && unit.blockType === 'link'), 'link block should be a single FocusUnit');
const listUnits = focusBuild.units.filter((unit) => unit.type === 'reading-text' && unit.blockId === 'list1');
assert(listUnits.length === 3, 'list items should become individual FocusUnits');

for (const unit of focusBuild.units) {
  const element = focusBuild.elements.get(unit.unitId);
  assert(element, `missing DOM mapping for ${unit.unitId}`);
  if (unit.type === 'reading-text') {
    assert(['SPAN', 'LI'].includes(element.tagName), `${unit.unitId} should render as inline span or list item`);
  }
}

const longParagraph = longArticle.blocks.find((block) => block.type === 'paragraph');
assert(longParagraph, 'long paragraph fixture should have paragraph');
const longUnits = splitIntoReadingUnits(longParagraph.text);
assert(longUnits.length > 1, 'long paragraph should split into multiple units');
assert(longUnits.every((unit) => unit.text.length <= 80), 'long units should be capped at 80 chars');

const englishUnits = splitIntoReadingUnits(
  'A vibrant outdoor portrait of a smiling woman on a sunny beach. She is wearing a uniquely designed swimsuit, a monokini with a prominent vertical cutout connecting the bandeau top section and the high-waisted bottom section, resembling the shape of katakana "エ".'
);
assert(
  englishUnits[0]?.text === 'A vibrant outdoor portrait of a smiling woman on a sunny beach.',
  'English period should split at sentence boundary before fallback length splitting'
);
assert(
  englishUnits[1]?.text.startsWith('She is wearing a uniquely designed swimsuit'),
  'English sentence after period should start a new reading unit'
);

const mixedParagraph = mixedArticle.blocks.find((block) => block.type === 'paragraph' && block.text.includes('https://example.com'));
assert(mixedParagraph, 'mixed fixture should include URL paragraph');
const mixedUnits = splitIntoReadingUnits(mixedParagraph.text);
assert(mixedUnits.some((unit) => unit.text.includes('https://example.com/very-long-path?foo=bar')), 'URL should not be split apart');
assert(mixedUnits.every((unit) => mixedParagraph.text.slice(unit.startOffset, unit.endOffset) === unit.text), 'offsets should map back to original text');
assert(!mixedUnits.some((unit) => /\bType$|^Script\b/.test(unit.text)), 'English words should not be split apart');

const firstMixedParagraph = mixedArticle.blocks.find((block) => block.type === 'paragraph' && block.text.includes('中文解释'));
assert(firstMixedParagraph, 'mixed fixture should include list-like weak punctuation paragraph');
const firstMixedUnits = splitIntoReadingUnits(firstMixedParagraph.text);
assert(
  !firstMixedUnits.some((unit) => unit.text === '中文解释、'),
  'weak punctuation should not create a tiny isolated unit'
);
assert(
  firstMixedUnits.some((unit) => unit.text.includes('中文解释、') && unit.text.includes('数字指标和产品名')),
  'short list items should be merged into a natural reading unit'
);
const mixedRendered = renderArticleShell(mixedArticle);
buildFocusUnits(mixedArticle, mixedRendered);
const boldTexts = mixedRendered.querySelectorAll('strong').map((element) => element.textContent);
assert(boldTexts.includes('English terms'), 'bold annotation should render English terms as strong');
assert(
  boldTexts.some((text) => text.includes('GPT-5、Claude、TypeScript 5')),
  'bold annotation should preserve styled text across semantic units'
);
const annotatedUnit = walk(mixedRendered).find((element) => element.dataset.unitId === 'p1-u2');
assert(
  annotatedUnit?.textContent.includes('GPT-5、Claude、TypeScript 5'),
  'bold annotations should not change FocusUnit text content'
);
const protectedDotUnits = splitIntoReadingUnits(
  'V3.2-Exp 时，DeepSeek 已经在 V3.1-Terminus 的基础上引入了 DSA。DeepSeek-V2 报告了 93.3% 的 KV Cache 减少和最高 5.76 倍的生成吞吐提升。'
);
assert(
  !protectedDotUnits.some((unit) => ['V3.', '2-Exp 时，', '3% 的 KV Cache 减少和最高 5.', '76 倍的生成吞吐提升。'].includes(unit.text)),
  'version numbers and decimals should not be split at periods'
);
assert(
  protectedDotUnits.some((unit) => unit.text.includes('V3.2-Exp')) &&
    protectedDotUnits.some((unit) => unit.text.includes('93.3%')) &&
    protectedDotUnits.some((unit) => unit.text.includes('5.76 倍')),
  'semantic splitter should keep version numbers and decimal metrics intact'
);
const emojiUnits = splitIntoReadingUnits('由此，现在你已经走完了一半啦，马上就完成了✅，再坚持一下。 。 😊');
assert(
  emojiUnits.some((unit) => unit.text.includes('。 。 😊')),
  'trailing repeated periods and emoji should stay with the same reading unit'
);
const draftEmojiUnits = splitIntoReadingUnits('⚠️⚠️⚠️输入= 后面的，不要带等于号。😮‍💨');
assert(
  JSON.stringify(draftEmojiUnits.map((unit) => unit.text)) === JSON.stringify(['⚠️⚠️⚠️输入= 后面的，不要带等于号。😮‍💨']),
  'Draft.js inline emoji before and after sentence text should stay inside one FocusUnit'
);
const inlineLinkArticle = {
  ...mediaArticle,
  blocks: [
    {
      id: 'inline-link-p',
      type: 'paragraph',
      text: '你可以参考这篇博客：https://www.lmsys.org/blog/2025-09-25-gb200-part-2/ 。下面继续解释。',
      annotations: [
        {
          startOffset: '你可以参考这篇博客：'.length,
          endOffset: '你可以参考这篇博客：https://www.lmsys.org/blog/2025-09-25-gb200-part-2/'.length,
          href: 'https://www.lmsys.org/blog/2025-09-25-gb200-part-2/',
          target: '_blank'
        }
      ]
    }
  ]
};
const inlineLinkRendered = renderArticleShell(inlineLinkArticle);
buildFocusUnits(inlineLinkArticle, inlineLinkRendered);
const inlineLink = inlineLinkRendered.querySelector('a');
assert(inlineLink?.tagName === 'A', 'inline paragraph link should render as anchor');
assert(inlineLink.attributes.href === 'https://www.lmsys.org/blog/2025-09-25-gb200-part-2/', 'inline paragraph link should preserve href');
assert(inlineLink.attributes.target === '_blank', 'inline paragraph link should preserve target');
assert(
  walk(inlineLinkRendered).some((element) => element.dataset.unitId && element.textContent.includes('https://www.lmsys.org/blog/2025-09-25-gb200-part-2/')),
  'inline paragraph link should stay inside a FocusUnit instead of becoming Embedded content'
);

const css = readFileSync(join(root, 'public', 'reader.css'), 'utf8');
for (const token of [
  '--reader-column-width',
  '--reader-canvas',
  '--reader-body-line-height',
  '--reader-paragraph-gap',
  '--reader-media-gap',
  'Playfair Display',
  'Lora',
  'DM Sans',
  '.reader-list-item.focus-unit.is-active'
]) {
  assert(css.includes(token), `missing visual token ${token}`);
}
assert(css.includes('aspect-ratio: var(--reader-media-aspect-ratio)'), 'reader image should use extracted aspect ratio');
assert(!css.includes('height: 230px'), 'reader image should not force a fixed media height');
assert(css.includes('object-fit: contain'), 'reader image should preserve the complete source image');
assert(css.includes('.reader-article a'), 'all anchors inside the reader should inherit focus color');
assert(css.includes('.focus-unit a'), 'inline paragraph links should share hyperlink styling');
assert(!css.includes('--reader-link'), 'reader links should not use a dedicated blue hyperlink token');
assert(css.includes('.reader-link'), 'reader link block should have explicit hyperlink styling');
assert(css.includes('.reader-link.focus-unit.is-active'), 'reader link block should use active highlight styling');

console.log('Reader A3/A4 verification passed.');

function readFixture(id) {
  return JSON.parse(readFileSync(join(fixtureDir, `${id}.json`), 'utf8'));
}

function querySelector(rootElement, selector) {
  return walk(rootElement).find((element) => matchesSelector(element, selector)) ?? null;
}

function matchesSelector(element, selector) {
  const dataMatch = selector.match(/^\[data-([a-z-]+)="([^"]+)"\]$/);
  if (dataMatch) {
    const [, rawName, value] = dataMatch;
    const key = rawName.replace(/-([a-z])/g, (_, char) => char.toUpperCase());
    return element.dataset?.[key] === value;
  }

  const classMatch = selector.match(/^\.([A-Za-z0-9_-]+)$/);
  if (classMatch) return element.className.split(/\s+/).includes(classMatch[1]);

  if (/^[a-z]+$/i.test(selector)) return element.tagName === selector.toUpperCase();

  return false;
}

function findByClass(rootElement, className) {
  return walk(rootElement).find((element) => element.className.split(/\s+/).includes(className)) ?? null;
}

function findChildIndex(parent, child) {
  return parent?.children.indexOf(child) ?? -1;
}

function walk(rootElement) {
  const result = [];
  const stack = [rootElement];
  while (stack.length > 0) {
    const current = stack.shift();
    if (current instanceof ElementLike) {
      result.push(current);
    }
    stack.unshift(...current.children);
  }
  return result;
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}
