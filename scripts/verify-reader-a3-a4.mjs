import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
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
    this.style = {};
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

const root = new URL('..', import.meta.url).pathname;
const fixtureDir = resolveFixtureDir(root);
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
assert(findByClass(cover, 'reader-media-frame')?.tagName === 'SPAN', 'cover should render through the shared media frame');
assert(findByClass(cover, 'reader-media-image')?.tagName === 'IMG', 'cover should contain an image element');
assert(findByClass(cover, 'reader-media-image')?.src === mediaArticle.coverImage.src, 'cover image src should match article cover');
assert(
  findChildIndex(findByClass(rendered, 'article-header'), cover) < findChildIndex(findByClass(rendered, 'article-header'), title),
  'cover image should render above the title'
);

const linkedCoverRendered = renderArticleShell({
  ...mediaArticle,
  coverImage: {
    ...mediaArticle.coverImage,
    href: 'https://x.com/example/article/1/media/cover'
  }
});
const linkedCover = findByClass(linkedCoverRendered, 'reader-cover');
assert(linkedCover?.tagName === 'A', 'linked cover image should render as an anchor for media preview');
assert(linkedCover.attributes.href === 'https://x.com/example/article/1/media/cover', 'linked cover image should preserve its media href');

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
assert(rendered.querySelector('[data-block-id="tweet1"]')?.tagName === 'A', 'simple tweet should keep a single outer anchor');
assert(findByClass(rendered.querySelector('[data-block-id="tweet1"]'), 'reader-simple-tweet-frame')?.tagName === 'DIV', 'simple tweet should render the outer tweet frame');
assert(findByClass(rendered.querySelector('[data-block-id="tweet1"]'), 'reader-simple-tweet-avatar')?.tagName === 'IMG', 'simple tweet should render the author avatar');
assert(findByClass(rendered.querySelector('[data-block-id="tweet1"]'), 'reader-simple-tweet-display-name')?.textContent === 'karin.', 'simple tweet should render the display name');
assert(findByClass(rendered.querySelector('[data-block-id="tweet1"]'), 'reader-simple-tweet-verified-icon')?.tagName === 'SVG', 'simple tweet should render the verified badge');
assert(findByClass(rendered.querySelector('[data-block-id="tweet1"]'), 'reader-simple-tweet-grok-icon')?.tagName === 'SVG', 'simple tweet should render the Grok icon');
assert(findByClass(rendered.querySelector('[data-block-id="tweet1"]'), 'reader-simple-tweet-actions')?.tagName === 'DIV', 'simple tweet should render non-interactive action metrics');
assert(findByClass(rendered.querySelector('[data-block-id="tweet1"]'), 'reader-simple-tweet-cover')?.tagName === 'IMG', 'simple tweet should render cover image');
const simpleTweetSource = findByClass(rendered.querySelector('[data-block-id="tweet1"]'), 'reader-simple-tweet-source');
assert(simpleTweetSource?.attributes['aria-label'] === 'X Article', 'simple tweet source should keep an accessible source label');
assert(simpleTweetSource?.textContent === 'Article', 'simple tweet source should keep the Article text next to the X logo');
const simpleTweetSourceIcon = findByClass(rendered.querySelector('[data-block-id="tweet1"]'), 'reader-simple-tweet-source-icon');
assert(simpleTweetSourceIcon?.tagName === 'SVG', 'simple tweet source should render the X logo as svg');
assert(findByClass(rendered.querySelector('[data-block-id="tweet1"]'), 'reader-simple-tweet-source-text')?.textContent === 'Article', 'simple tweet source text should be separately styleable');
assert(
  simpleTweetSourceIcon?.children[0]?.attributes.d ===
    'M21.742 21.75l-7.563-11.179 7.056-8.321h-2.456l-5.691 6.714-4.54-6.714H2.359l7.29 10.776L2.25 21.75h2.456l6.035-7.118 4.818 7.118h6.191-.008zM7.739 3.818L18.81 20.182h-2.447L5.29 3.818h2.447z',
  'simple tweet source svg should use the X path'
);
assert(
  findByClass(rendered.querySelector('[data-block-id="tweet1"]'), 'reader-simple-tweet-title')?.textContent ===
    'The Science of Attention: Why Your Brain Needs Boredom',
  'simple tweet title should render'
);
const multilineSimpleTweetArticle = {
  ...mediaArticle,
  blocks: [
    {
      id: 'tweet-multiline',
      type: 'simple-tweet',
      coverUrl: '',
      source: 'X Article',
      title: 'First line',
      excerpt: 'First line\nSecond line\nThird line\nFourth line\nFifth line\nSixth line\nSeventh line',
      href: 'https://x.com/example/status/2',
      photos: [{ src: 'https://example.com/photo.jpg', alt: 'Tweet photo' }]
    }
  ]
};
const multilineSimpleTweetRendered = renderArticleShell(multilineSimpleTweetArticle);
const multilineSimpleTweet = multilineSimpleTweetRendered.querySelector('[data-block-id="tweet-multiline"]');
const multilineSimpleTweetTextContainer = findByClass(multilineSimpleTweet, 'reader-simple-tweet-text-container');
const multilineSimpleTweetText = findByClass(multilineSimpleTweet, 'reader-simple-tweet-text');
const multilineSimpleTweetShowMore = findByClass(multilineSimpleTweet, 'reader-simple-tweet-show-more');
const readerCss = readReaderCss();
assert(multilineSimpleTweetTextContainer?.className.includes('is-collapsed'), 'simple tweet text should start collapsed');
assert(
  multilineSimpleTweetText?.textContent === multilineSimpleTweetArticle.blocks[0].excerpt,
  'simple tweet text should preserve newline characters'
);
assert(multilineSimpleTweetShowMore?.textContent === 'Show more', 'simple tweet text should render a show more control');
assert(readerCss.includes('white-space: pre-wrap;'), 'simple tweet text CSS should preserve visible line breaks');
assert(readerCss.includes('-webkit-line-clamp: 6;'), 'simple tweet text CSS should clamp to six lines');
multilineSimpleTweetShowMore.eventListeners.get('click')({
  preventDefault() {},
  stopPropagation() {}
});
assert(!multilineSimpleTweetTextContainer.className.includes('is-collapsed'), 'clicking show more should expand simple tweet text');
assert(!findByClass(multilineSimpleTweet, 'reader-simple-tweet-show-more'), 'expanded simple tweet text should not render show less');
assert(rendered.querySelector('[data-block-id="list1"]')?.tagName === 'UL', 'unordered list should render as ul');
const orderedListRendered = renderArticleShell({
  ...mediaArticle,
  blocks: [{ id: 'ordered-list', type: 'list', kind: 'ordered', items: ['第一项', '第二项'] }]
});
assert(orderedListRendered.querySelector('[data-block-id="ordered-list"]')?.tagName === 'OL', 'ordered list should render as ol');
const orderedListWithOriginalMarkerRendered = renderArticleShell({
  ...mediaArticle,
  blocks: [{ id: 'ordered-list-marker', type: 'list', kind: 'ordered', items: ['2. 进阶配置'] }]
});
const orderedListWithOriginalMarker = orderedListWithOriginalMarkerRendered.querySelector('[data-block-id="ordered-list-marker"]');
assert(orderedListWithOriginalMarker?.textContent.startsWith('2. 进阶配置'), 'ordered list text should preserve original source marker');
assert(!orderedListWithOriginalMarker?.textContent.startsWith('1.2.'), 'ordered list should not duplicate generated and source markers');
assert(
  findByClass(orderedListWithOriginalMarker, 'reader-list-item--source-marker'),
  'ordered list item with source marker should remove the generated bullet column'
);
const linkRendered = renderArticleShell({
  ...mediaArticle,
  blocks: [{ id: 'link1', type: 'link', text: '原文链接', href: 'https://x.com/example/status/1', target: '_blank' }]
});
const linkElement = linkRendered.querySelector('[data-block-id="link1"]');
assert(linkElement?.tagName === 'A', 'link block should render as anchor');
assert(linkElement.attributes.href === 'https://x.com/example/status/1', 'link block should preserve href');
assert(linkElement.attributes.target === '_blank', 'link block should preserve target');
const imageLinkRendered = renderArticleShell({
  ...mediaArticle,
  blocks: [{ id: 'image-link', type: 'image', src: 'https://example.com/image.jpg', alt: 'Linked image', href: 'https://x.com/example/photo/1' }]
});
const imageLinkElement = imageLinkRendered.querySelector('[data-block-id="image-link"]');
assert(imageLinkElement?.tagName === 'A', 'image block with href should render as anchor');
assert(imageLinkElement.attributes.href === 'https://x.com/example/photo/1', 'image block should preserve href');
assert(findByClass(imageLinkElement, 'reader-media-image')?.tagName === 'IMG', 'linked image block should render an image');
const galleryRendered = renderArticleShell({
  ...mediaArticle,
  blocks: [
    {
      id: 'gallery1',
      type: 'image-gallery',
      aspectRatio: 1.7778,
      layout: {
        type: 'row',
        children: [
          { type: 'item', itemIndex: 0 },
          {
            type: 'column',
            grow: 1,
            shrink: 1,
            basis: '0%',
            children: [
              { type: 'item', itemIndex: 1 },
              { type: 'item', itemIndex: 2 }
            ]
          },
          { type: 'item', itemIndex: 3 }
        ]
      },
      items: [
        { src: 'https://example.com/1.jpg', alt: 'One', href: 'https://x.com/example/media/1', backgroundSize: 'cover', backgroundPosition: 'center center', objectFit: 'cover' },
        { src: 'https://example.com/2.jpg', alt: 'Two', href: 'https://x.com/example/media/2', backgroundSize: 'cover', backgroundPosition: 'center center', objectFit: 'cover' },
        { src: 'https://example.com/3.jpg', alt: 'Three', href: 'https://x.com/example/media/3', backgroundSize: 'cover', backgroundPosition: 'center center', objectFit: 'cover' },
        { src: 'https://example.com/4.jpg', alt: 'Four', href: 'https://x.com/example/media/4', backgroundSize: 'cover', backgroundPosition: 'center center', objectFit: 'cover' }
      ]
    }
  ]
});
const galleryElement = galleryRendered.querySelector('[data-block-id="gallery1"]');
assert(galleryElement?.tagName === 'FIGURE', 'image-gallery should render as figure');
assert(galleryElement.dataset.blockType === 'image-gallery', 'image-gallery should expose its block type');
assert(galleryElement.dataset.aspectRatio === '1.7778', 'image-gallery should expose source aspect ratio');
assert(findByClass(galleryElement, 'reader-image-gallery-grid')?.tagName === 'DIV', 'image-gallery should render a grid container');
const galleryItems = galleryElement.querySelectorAll('.reader-image-gallery-item');
assert(galleryItems.length === 4, 'image-gallery should render every item');
assert(galleryItems[0].tagName === 'A', 'image-gallery items with href should render as anchors');
assert(galleryItems[0].attributes.href === 'https://x.com/example/media/1', 'image-gallery item should preserve href');
assert(findByClass(galleryItems[0], 'reader-image-gallery-image')?.tagName === 'IMG', 'image-gallery item should render an image');
assert(findByClass(galleryItems[0], 'reader-media-background')?.style.backgroundImage === 'url("https://example.com/1.jpg")', 'image-gallery should render a tweetPhoto-style background layer');
assert(findByClass(galleryItems[0], 'reader-media-background')?.style.backgroundSize === 'cover', 'image-gallery should preserve source crop mode');
const galleryLayoutNodes = galleryElement.querySelectorAll('.reader-image-gallery-node');
assert(galleryLayoutNodes.some((node) => node.dataset.layoutType === 'row'), 'image-gallery should render layout rows');
assert(galleryLayoutNodes.some((node) => node.dataset.layoutType === 'column' && node.style.flexBasis === '0%'), 'image-gallery should render layout columns with flex sizing');
assert(galleryItems[2].dataset.itemIndex === '2', 'image-gallery layout should address items by source index');
const codeRendered = renderArticleShell({
  ...mediaArticle,
  blocks: [{ id: 'code1', type: 'code', language: 'rust', text: 'pub struct AgentLoop {\\n  config: AppConfig, // 运行配置\\n}' }]
});
const codeElement = codeRendered.querySelector('[data-block-id="code1"]');
assert(codeElement?.tagName === 'FIGURE', 'code block should render as figure');
assert(codeElement.dataset.blockType === 'code', 'code block should expose code block type');
assert(findByClass(codeElement, 'reader-code-language')?.textContent === 'rust', 'code block should render dynamic language label');
assert(findByClass(codeElement, 'reader-code-copy')?.dataset.copyCode.includes('AgentLoop'), 'code copy button should carry raw code text');
assert(findByClass(codeElement, 'reader-code-copy')?.dataset.copyCode.includes('\\n  config'), 'code copy button should preserve indentation in raw code text');
assert(
  findByClass(codeElement, 'reader-code-copy-icon')?.children[0]?.children[0]?.attributes.d ===
    'M19.5 2C20.88 2 22 3.12 22 4.5v11c0 1.21-.86 2.22-2 2.45V4.5c0-.28-.22-.5-.5-.5H6.05c.23-1.14 1.24-2 2.45-2h11zm-4 4C16.88 6 18 7.12 18 8.5v11c0 1.38-1.12 2.5-2.5 2.5h-11C3.12 22 2 20.88 2 19.5v-11C2 7.12 3.12 6 4.5 6h11zM4 19.5c0 .28.22.5.5.5h11c.28 0 .5-.22.5-.5v-11c0-.28-.22-.5-.5-.5h-11c-.28 0-.5.22-.5.5v11z',
  'code copy button should preserve the X markdown-code-block copy svg path'
);
assert(findByClass(codeElement, 'reader-code-token-keyword')?.textContent === 'pub', 'code block should render highlighted keyword tokens');
const markdownCodeRendered = renderArticleShell({
  ...mediaArticle,
  blocks: [{ id: 'markdown-code', type: 'code', language: 'markdown', text: '# Principles\n\n## How we work\n1. Flow before pixels.\n- Ship it.' }]
});
const markdownCodeElement = markdownCodeRendered.querySelector('[data-block-id="markdown-code"]');
assert(findByClass(markdownCodeElement, 'reader-code-token-punctuation')?.textContent === '#', 'markdown code block should highlight heading markers');
assert(findByClass(markdownCodeElement, 'reader-code-token-heading')?.textContent === ' Principles', 'markdown code block should highlight heading text');
const readerAppSource = readFileSync(resolve(root, 'src/reader/reader-app.ts'), 'utf8');
assert(/target instanceof Element/.test(readerAppSource), 'copy event delegation should also work when clicking svg child nodes');
assert(/button\[data-copy-code\]/.test(readerAppSource), 'copy event delegation should target the copy button from svg descendants');
assert(/copyCodeWithFallback/.test(readerAppSource), 'copy should include a fallback path when navigator.clipboard is unavailable');
const explicitHeadingRendered = renderArticleShell({
  ...mediaArticle,
  blocks: [{ id: 'explicit-h1', type: 'heading', level: 1, text: '1. 看一眼 Transformer 的 Attention Heatmap' }]
});
assert(
  explicitHeadingRendered.querySelector('[data-block-id="explicit-h1"]')?.tagName === 'H1',
  'explicit h1 source heading should render as h1'
);
const svgEmojiHeadingRendered = renderArticleShell({
  ...mediaArticle,
  blocks: [
    {
      id: 'svg-emoji-h2',
      type: 'heading',
      level: 2,
      text: '🌟🌟🌟🌟🌟',
      annotations: Array.from({ length: 5 }, (_value, index) => ({
        startOffset: index * 2,
        endOffset: index * 2 + 2,
        bold: true,
        emojiImageUrl: 'https://abs.twimg.com/emoji/v2/svg/1f31f.svg'
      }))
    }
  ]
});
const svgEmojiHeading = svgEmojiHeadingRendered.querySelector('[data-block-id="svg-emoji-h2"]');
assert(svgEmojiHeading?.tagName === 'H2', 'explicit h2 source heading should render as h2');
assert(
  walk(svgEmojiHeading).filter((element) => element.style.backgroundImage?.includes('/emoji/v2/svg/1f31f.svg')).length === 5,
  'X SVG emoji annotations should render as background-image emoji spans'
);
assert(
  walk(svgEmojiHeading).filter((element) => element.className.split(/\s+/).includes('reader-x-emoji-hidden')).length === 5,
  'X SVG emoji annotations should preserve the hidden inner glyph wrapper'
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
assert(focusBuild.units.some((unit) => unit.type === 'block' && unit.blockType === 'simple-tweet'), 'simple tweet block FocusUnit missing');
const linkFocusBuild = buildFocusUnits(linkRendered.children[0] ? { ...mediaArticle, blocks: [{ id: 'link1', type: 'link', text: '原文链接', href: 'https://x.com/example/status/1' }] } : mediaArticle, linkRendered);
assert(linkFocusBuild.units.some((unit) => unit.type === 'block' && unit.blockType === 'link'), 'link block should be a single FocusUnit');
const codeFocusBuild = buildFocusUnits({ ...mediaArticle, blocks: [{ id: 'code1', type: 'code', language: 'rust', text: 'pub struct AgentLoop {}' }] }, codeRendered);
assert(codeFocusBuild.units.some((unit) => unit.type === 'block' && unit.blockType === 'code'), 'code block should be a single FocusUnit');
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
assert(
  longUnits.every((unit) => longParagraph.text.slice(unit.startOffset, unit.endOffset) === unit.text),
  'long paragraph units should keep stable offsets even when units exceed the soft length target'
);

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
assert(
  !englishUnits.some((unit) => unit.text === 'a monokini with a prominent vertical cutout connecting the bandeau top section'),
  'Long English sentence should not be split by fallback length at plain spaces'
);
const memoryToolUnits = splitIntoReadingUnits(
  "And let's be honest, there are a LOT of memory related tools available and there are a LOT of write-ups about them. I see new articles on X every week about some new memory setup."
);
assert(
  memoryToolUnits.some((unit) => unit.text === 'there are a LOT of memory related tools available and there are a LOT of write-ups about them.'),
  'Long English clause should keep its full meaning instead of being split by fallback length'
);
assert(
  memoryToolUnits.at(-1)?.text === 'I see new articles on X every week about some new memory setup.',
  'Sentence boundary should still create the next English reading unit'
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

const quoteLinkArticle = {
  ...mediaArticle,
  blocks: [
    {
      id: 'quote-link',
      type: 'quote',
      text: '第 1 轮：LLM -> 调用 file.read(path="src/main.rs")\n-> 执行 file.read -> 返回文件内容',
      annotations: [
        {
          startOffset: '第 1 轮：LLM -> 调用 '.length,
          endOffset: '第 1 轮：LLM -> 调用 file.read'.length,
          href: '//file.read',
          target: '_blank'
        },
        {
          startOffset: '第 1 轮：LLM -> 调用 file.read(path="src/main.rs")\n-> 执行 '.length,
          endOffset: '第 1 轮：LLM -> 调用 file.read(path="src/main.rs")\n-> 执行 file.read'.length,
          href: '//file.read',
          target: '_blank'
        }
      ]
    }
  ]
};
const quoteLinkRendered = renderArticleShell(quoteLinkArticle);
buildFocusUnits(quoteLinkArticle, quoteLinkRendered);
const quoteElement = quoteLinkRendered.querySelector('blockquote');
const quoteLinks = walk(quoteElement).filter((element) => element.tagName === 'A');
assert(quoteLinks.length === 2, 'inline quote links should render inside blockquote text');
assert(quoteLinks[0].attributes.href === '//file.read', 'inline quote link should preserve href');
assert(quoteLinks[0].attributes.target === '_blank', 'inline quote link should preserve target');
assert(
  quoteElement?.textContent.includes('\n-> 执行 file.read'),
  'inline quote link rendering should preserve quote line breaks'
);

const css = readReaderCss();
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
assert(css.includes('reader-image-gallery-node'), 'reader image gallery should support recursive layout nodes');
assert(css.includes('reader-media-background'), 'reader media should use shared tweetPhoto-style background rendering');
assert(!css.includes('height: 230px'), 'reader image should not force a fixed media height');
assert(!/\.reader-media img\s*\{[^}]*object-fit:\s*contain/.test(css), 'reader image should not render through contain mode');
assert(css.includes('max-height: 100vh'), 'reader media preview should scale images against the browser height');
assert(css.includes('max-width: 100vw'), 'reader media preview should allow images to use the full browser width');
assert(css.includes('padding: 0'), 'reader media preview should not reserve horizontal layout space for nav buttons');
assert(!css.includes('max-height: min(760px'), 'reader media preview should not cap image height below the viewport');
assert(!css.includes('max-width: min(1120px'), 'reader media preview should not cap image width below the viewport');
assert(!css.includes('max-width: calc(100vw - 176px)'), 'reader media preview nav buttons should not reduce the image viewport width');
assert(css.includes('.reader-media-preview-status'), 'reader media preview should expose a loading/error status element');
assert(css.includes('.reader-media-preview.is-loading'), 'reader media preview should style loading state instead of showing the previous image');
assert(css.includes('.reader-media-preview-close:hover'), 'reader media preview close button should expose hover feedback');
assert(css.includes('.reader-media-preview-nav:not(:disabled):hover'), 'reader media preview nav buttons should expose hover feedback');
assert(css.includes('var(--reader-highlight-surface) 16%'), 'reader media preview nav buttons should use the same base color strength as the close button');
assert(/\.reader-media-preview-nav\s*\{[\s\S]*?font-size:\s*28px;[\s\S]*?font-weight:\s*300;/.test(css), 'reader media preview nav symbols should match close button icon styling');
assert(css.includes('.reader-media-preview-nav:disabled'), 'reader media preview should style unavailable nav directions');
assert(css.includes('display: none'), 'reader media preview should hide unavailable nav direction buttons');
assert(css.includes('z-index: 84'), 'reader media preview controls should render above the preview image content');
assert(css.includes('@keyframes reader-media-preview-enter-from-left'), 'reader media preview should define left-enter animation for keyboard navigation');
assert(css.includes('@keyframes reader-media-preview-enter-from-right'), 'reader media preview should define right-enter animation for keyboard navigation');
assert(css.includes('animation: reader-media-preview-enter-from-left 400ms ease-out both'), 'left preview navigation animation should use 400ms ease-out motion');
assert(css.includes('animation: reader-media-preview-enter-from-right 400ms ease-out both'), 'right preview navigation animation should use 400ms ease-out motion');
assert(css.includes('translateX(calc(-50vw - 50%))'), 'left preview navigation animation should enter from outside the browser viewport');
assert(css.includes('translateX(calc(50vw + 50%))'), 'right preview navigation animation should enter from outside the browser viewport');
assert(css.includes('transform: translateX(-8px)'), 'left preview navigation animation should add a damped slowdown before center');
assert(css.includes('transform: translateX(8px)'), 'right preview navigation animation should add a damped slowdown before center');
assert(css.includes('.reader-article a'), 'all anchors inside the reader should inherit focus color');
assert(css.includes('.focus-unit a'), 'inline paragraph links should share hyperlink styling');
assert(css.includes('.reader-list-item--source-marker'), 'source-marker ordered list items should have alignment styles');
assert(css.includes('gap: 0'), 'source-marker ordered list items should not reserve generated bullet gap');
assert(!css.includes('--reader-link'), 'reader links should not use a dedicated blue hyperlink token');
assert(css.includes('.reader-link'), 'reader link block should have explicit hyperlink styling');
assert(css.includes('.reader-link.focus-unit.is-active'), 'reader link block should use active highlight styling');
assert(css.includes('text-decoration: none'), 'simple tweet anchor should not show hyperlink underline');
assert(css.includes('.reader-simple-tweet-source-icon'), 'simple tweet source should style the X logo icon');

console.log('Reader A3/A4 verification passed.');

function readFixture(id) {
  return JSON.parse(readFileSync(join(fixtureDir, `${id}.json`), 'utf8'));
}

function readReaderCss() {
  const publicDir = join(root, 'public');
  const stylesDir = join(publicDir, 'styles');
  return [
    readFileSync(join(publicDir, 'reader.css'), 'utf8'),
    ...readdirSync(stylesDir)
      .filter((fileName) => fileName.endsWith('.css'))
      .sort()
      .map((fileName) => readFileSync(join(stylesDir, fileName), 'utf8'))
  ].join('\n');
}

function resolveFixtureDir(rootDir) {
  const candidates = [
    join(rootDir, 'fixtures', 'articles'),
    resolve(rootDir, '..', '..', 'fixtures', 'articles')
  ];
  const fixtureDir = candidates.find((candidate) => existsSync(candidate));
  if (!fixtureDir) {
    throw new Error(`Unable to locate reader fixtures from ${rootDir}`);
  }

  return fixtureDir;
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
