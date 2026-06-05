import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { FocusEngine } from '../dist/reader/focus-engine.js';
import { ProgressStore } from '../dist/reader/progress-store.js';
import { mountReaderApp } from '../dist/reader/reader-app.js';

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

class StyleLike {
  constructor() {
    this.values = new Map();
  }

  setProperty(name, value) {
    this.values.set(name, value);
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
    this.textContent = text;
    this.nodeType = 3;
  }
}

class ElementLike extends NodeLike {
  constructor(tagName, rect = { left: 0, top: 0, width: 100, height: 20 }) {
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

  getAttribute(name) {
    return this.attributes.get(name) ?? null;
  }

  get parentElement() {
    return this.parent instanceof ElementLike ? this.parent : null;
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

  play() {
    this.paused = false;
    return Promise.resolve();
  }

  pause() {
    this.paused = true;
  }

  load() {}
}

const windowListeners = new Map();
const documentListeners = new Map();
const storage = new Map();
let selectedText = '';
const openCalls = [];

globalThis.Element = ElementLike;
globalThis.HTMLElement = ElementLike;
globalThis.document = {
  visibilityState: 'visible',
  fonts: { ready: Promise.resolve() },
  createElement(tagName) {
    return new ElementLike(tagName);
  },
  createElementNS(_namespace, tagName) {
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
    return { toString: () => selectedText };
  },
  open(href, target) {
    openCalls.push({ href, target });
    return {};
  },
  location: {
    assign(href) {
      openCalls.push({ href, target: 'assign' });
    }
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

const units = [textUnit('p1-u1'), textUnit('p1-u2'), textUnit('p1-u3')];
const focusChanges = [];
const engine = new FocusEngine(units, (unit, index) => focusChanges.push([unit.unitId, index]));
engine.start(1);
engine.next();
engine.next();
engine.next();
engine.previous();
engine.first();
engine.previous();
engine.last();
assert(focusChanges.map(([, index]) => index).join(',') === '1,2,2,2,1,0,0,2', 'FocusEngine boundary behavior failed');

const progressStore = new ProgressStore();
progressStore.save({
  articleId: 'fixture-a',
  unitId: 'p1-u2',
  focusIndex: 1,
  updatedAt: 123,
  completed: false
});
assert(progressStore.get('fixture-a')?.unitId === 'p1-u2', 'ProgressStore should restore saved unit id');
storage.set('linelens:fixture-progress:broken', '{');
assert(progressStore.get('broken') === null, 'ProgressStore should tolerate invalid JSON');

const article = JSON.parse(
  readFileSync(join(resolveFixtureDir(new URL('..', import.meta.url).pathname), 'simple-chinese.json'), 'utf8')
);
const root = new ElementLike('main');
mountReaderApp(root, article);

const keydown = windowListeners.get('keydown')?.at(-1);
assert(keydown, 'ReaderApp should register keydown listener');

const firstActive = findByClass(root, 'is-active');
assert(firstActive?.dataset.unitId === 'p1-u1', 'Reader should start at first FocusUnit without saved progress');

dispatchKey(keydown, 'ArrowRight');
assert(findByClass(root, 'is-active')?.dataset.unitId === 'p1-u2', 'ArrowRight should move to next FocusUnit');
dispatchKey(keydown, 'ArrowLeft');
assert(findByClass(root, 'is-active')?.dataset.unitId === 'p1-u1', 'ArrowLeft should move to previous FocusUnit');
dispatchKey(keydown, 'End');
const lastUnitId = findByClass(root, 'is-active')?.dataset.unitId;
assert(lastUnitId?.startsWith('p3-'), 'End should move to last FocusUnit');
dispatchKey(keydown, 'Home');
assert(findByClass(root, 'is-active')?.dataset.unitId === 'p1-u1', 'Home should move to first FocusUnit');
dispatchKey(keydown, 'e');
assert(findByClass(root, 'is-active')?.dataset.unitId === lastUnitId, 'E should move to last FocusUnit');
const firstUnit = walk(root).find((element) => element.dataset.unitId === 'p1-u1');
const firstScrollCountBeforeHomeShortcut = firstUnit?.scrollCalls.length ?? 0;
dispatchKey(keydown, 'h');
assert(findByClass(root, 'is-active')?.dataset.unitId === 'p1-u1', 'H should move to first FocusUnit');
assert(
  (firstUnit?.scrollCalls.length ?? 0) === firstScrollCountBeforeHomeShortcut + 1,
  'H should scroll the first FocusUnit into view after jumping from the end'
);
assert(firstUnit?.scrollCalls.at(-1)?.block === 'center', 'H should center the first FocusUnit');

const beforeArrowDown = findByClass(root, 'is-active')?.dataset.unitId;
dispatchKey(keydown, 'ArrowDown');
assert(findByClass(root, 'is-active')?.dataset.unitId === beforeArrowDown, 'ArrowDown should not change active FocusUnit');
assert(dispatchKey(keydown, ' ') === false, 'Space should remain unhandled by Reader navigation');
assert(findByClass(root, 'is-active')?.dataset.unitId === beforeArrowDown, 'Space should not change active FocusUnit');
assert(dispatchKey(keydown, 'Enter') === false, 'Enter should remain unhandled by Reader navigation');
assert(findByClass(root, 'is-active')?.dataset.unitId === beforeArrowDown, 'Enter should not change active FocusUnit');

selectedText = 'selected';
dispatchKey(keydown, 'ArrowRight');
assert(findByClass(root, 'is-active')?.dataset.unitId === beforeArrowDown, 'Text selection should suppress reader navigation');
selectedText = '';

const input = new ElementLike('input');
dispatchKey(keydown, 'ArrowRight', input);
assert(findByClass(root, 'is-active')?.dataset.unitId === beforeArrowDown, 'Input focus should suppress reader navigation');

const clickable = walk(root).find((element) => element.dataset.unitId === 'p1-u2');
const clickListeners = root.eventListeners.get('click') ?? [];
clickListeners.at(-1)?.({ target: clickable });
assert(findByClass(root, 'is-active')?.dataset.unitId === 'p1-u2', 'Clicking FocusUnit should set active unit');

const tweetArticle = {
  ...article,
  id: 'simple-tweet-click',
  blocks: [
    { id: 'intro', type: 'paragraph', text: 'Intro paragraph' },
    {
      id: 'tweet-click',
      type: 'simple-tweet',
      coverUrl: '',
      source: 'X Tweet',
      title: 'Amjad Masad @amasad · 1月15日',
      excerpt: '为了替微软稍作辩解：世界才刚刚意识到，编码代理本质上是通用代理。',
      href: 'https://x.com/amasad/status/2011475533369131424',
      authorName: 'Amjad Masad',
      authorHandle: '@amasad',
      publishedAtText: '1月15日',
      replyContextText: '回复 @GavinSBaker',
      replyToHandle: '@GavinSBaker'
    }
  ]
};
const tweetRoot = new ElementLike('main');
mountReaderApp(tweetRoot, tweetArticle);
const tweetClickListener = tweetRoot.eventListeners.get('click')?.at(-1);
const tweetLink = walk(tweetRoot).find((element) => element.dataset.blockId === 'tweet-click');
assert(tweetLink?.tagName === 'A', 'simpleTweet text cards should remain links once active');
let preventedTweetClick = false;
tweetClickListener?.({
  target: tweetLink,
  preventDefault() {
    preventedTweetClick = true;
  },
  stopPropagation() {}
});
assert(preventedTweetClick, 'Inactive simpleTweet link click should be intercepted before navigation');
assert(findByClass(tweetRoot, 'is-active')?.dataset.blockId === 'tweet-click', 'Inactive simpleTweet link click should first select the card');
let preventedActiveTweetClick = false;
tweetClickListener?.({
  target: tweetLink,
  preventDefault() {
    preventedActiveTweetClick = true;
  },
  stopPropagation() {}
});
assert(!preventedActiveTweetClick, 'Active simpleTweet link click should be allowed to navigate');

const tweetVideoArticle = {
  ...article,
  id: 'simple-tweet-video-click',
  blocks: [
    { id: 'intro-video', type: 'paragraph', text: 'Intro paragraph' },
    {
      id: 'tweet-video-click',
      type: 'simple-tweet',
      source: 'X Tweet',
      title: 'Portrait clip',
      excerpt: 'Portrait clip',
      href: 'https://x.com/example/status/999',
      authorName: 'Jackywine',
      authorHandle: '@Jackywine',
      publishedAtText: '2月11日',
      items: [
        { type: 'text', text: 'Portrait clip' },
        {
          type: 'video',
          video: {
            id: 'tweet-video',
            type: 'video',
            src: 'https://example.com/video.mp4',
            aspectRatio: 0.564,
            poster: 'https://example.com/poster.jpg'
          }
        }
      ]
    }
  ]
};
const tweetVideoRoot = new ElementLike('main');
mountReaderApp(tweetVideoRoot, tweetVideoArticle);
const tweetVideoClickListener = tweetVideoRoot.eventListeners.get('click')?.at(-1);
const tweetVideoCard = walk(tweetVideoRoot).find((element) => element.dataset.blockId === 'tweet-video-click');
const tweetVideoPlayer = walk(tweetVideoRoot).find((element) => element.className.split(/\s+/).includes('reader-video-player'));
assert(tweetVideoCard?.tagName === 'DIV', 'simpleTweet with video should render as div-backed card with data-href navigation');
assert(tweetVideoCard?.dataset.href === 'https://x.com/example/status/999', 'simpleTweet with video should preserve href on data-href');
let preventedInactiveTweetVideoClick = false;
tweetVideoClickListener?.({
  target: tweetVideoCard,
  preventDefault() {
    preventedInactiveTweetVideoClick = true;
  },
  stopPropagation() {}
});
assert(preventedInactiveTweetVideoClick, 'Inactive simpleTweet video card click should be intercepted before navigation');
assert(findByClass(tweetVideoRoot, 'is-active')?.dataset.blockId === 'tweet-video-click', 'Inactive simpleTweet video card click should first select the card');
const openCountBeforeVideoClick = openCalls.length;
let preventedVideoControlClick = false;
tweetVideoClickListener?.({
  target: tweetVideoPlayer,
  preventDefault() {
    preventedVideoControlClick = true;
  },
  stopPropagation() {}
});
assert(!preventedVideoControlClick, 'Clicking the embedded video should keep video controls interactive');
assert(openCalls.length === openCountBeforeVideoClick, 'Clicking the embedded video should not navigate away');
let preventedActiveTweetVideoCardClick = false;
tweetVideoClickListener?.({
  target: tweetVideoCard,
  preventDefault() {
    preventedActiveTweetVideoCardClick = true;
  },
  stopPropagation() {}
});
assert(preventedActiveTweetVideoCardClick, 'Active simpleTweet video card click should intercept default browser behavior before manual navigation');
assert(openCalls.at(-1)?.href === 'https://x.com/example/status/999', 'Active simpleTweet video card click should navigate using the preserved href');

const imageClickArticle = {
  ...article,
  id: 'image-click',
  blocks: [
    { id: 'intro-image', type: 'paragraph', text: 'Intro paragraph' },
    { id: 'image-click-block', type: 'image', src: 'https://example.com/image.jpg', alt: 'Linked image', href: 'https://x.com/example/photo/1' }
  ]
};
const imageClickRoot = new ElementLike('main');
mountReaderApp(imageClickRoot, imageClickArticle);
const imageClickListener = imageClickRoot.eventListeners.get('click')?.at(-1);
const imageLink = walk(imageClickRoot).find((element) => element.dataset.blockId === 'image-click-block');
assert(imageLink?.tagName === 'A', 'linked image block should remain an anchor');
let preventedImageClick = false;
imageClickListener?.({
  target: imageLink,
  preventDefault() {
    preventedImageClick = true;
  },
  stopPropagation() {}
});
assert(preventedImageClick, 'Inactive image link click should be intercepted before navigation');
assert(findByClass(imageClickRoot, 'is-active')?.dataset.blockId === 'image-click-block', 'Inactive image link click should first select the image');
let preventedActiveImageClick = false;
imageClickListener?.({
  target: imageLink,
  preventDefault() {
    preventedActiveImageClick = true;
  },
  stopPropagation() {}
});
assert(!preventedActiveImageClick, 'Active image link click should be allowed to navigate');

const galleryClickArticle = {
  ...article,
  id: 'gallery-click',
  blocks: [
    { id: 'intro-gallery', type: 'paragraph', text: 'Intro paragraph' },
    {
      id: 'gallery-click-block',
      type: 'image-gallery',
      aspectRatio: 1.7778,
      items: [
        { src: 'https://example.com/1.jpg', alt: 'One', href: 'https://x.com/example/media/1' },
        { src: 'https://example.com/2.jpg', alt: 'Two', href: 'https://x.com/example/media/2' }
      ]
    }
  ]
};
const galleryClickRoot = new ElementLike('main');
mountReaderApp(galleryClickRoot, galleryClickArticle);
const galleryClickListener = galleryClickRoot.eventListeners.get('click')?.at(-1);
const galleryItemLink = walk(galleryClickRoot).find((element) => element.className.split(/\s+/).includes('reader-image-gallery-item'));
assert(galleryItemLink?.tagName === 'A', 'linked gallery items should remain anchors');
let preventedGalleryClick = false;
galleryClickListener?.({
  target: galleryItemLink,
  preventDefault() {
    preventedGalleryClick = true;
  },
  stopPropagation() {}
});
assert(preventedGalleryClick, 'Inactive image-gallery link click should be intercepted before navigation');
assert(findByClass(galleryClickRoot, 'is-active')?.dataset.blockId === 'gallery-click-block', 'Inactive image-gallery link click should first select the gallery');
let preventedActiveGalleryClick = false;
galleryClickListener?.({
  target: galleryItemLink,
  preventDefault() {
    preventedActiveGalleryClick = true;
  },
  stopPropagation() {}
});
assert(!preventedActiveGalleryClick, 'Active image-gallery link click should be allowed to navigate');

const savedProgress = JSON.parse(storage.get('linelens:fixture-progress:simple-chinese'));
assert(savedProgress.unitId === 'p1-u2', 'Focus changes should save progress');
assert(typeof savedProgress.updatedAt === 'number', 'Saved progress should include updatedAt');

const status = findByClass(root, 'reader-status');
assert(/\d+% · \d+ min remaining/.test(status?.textContent ?? ''), 'Reader should show Clean-style progress status');
const hint = findByClass(root, 'reader-hint');
assert(hint?.classList.contains('is-hidden'), 'Reader hint should hide after first user action');

storage.set(
  'linelens:fixture-progress:simple-chinese',
  JSON.stringify({ articleId: 'simple-chinese', unitId: 'p2-u1', focusIndex: 2, updatedAt: 456 })
);
const restoredRoot = new ElementLike('main');
mountReaderApp(restoredRoot, article);
assert(findByClass(restoredRoot, 'is-active')?.dataset.unitId === 'p2-u1', 'Reader should restore saved progress by unitId');

storage.set(
  'linelens:fixture-progress:simple-chinese',
  JSON.stringify({ articleId: 'simple-chinese', unitId: 'missing-unit', focusIndex: 9, updatedAt: 789 })
);
const fallbackRoot = new ElementLike('main');
mountReaderApp(fallbackRoot, article);
assert(findByClass(fallbackRoot, 'is-active')?.dataset.unitId === 'p1-u1', 'Invalid progress should fall back to first FocusUnit');

console.log('Reader A6/A7 verification passed.');

function dispatchKey(listener, key, target = new ElementLike('body')) {
  let prevented = false;
  listener({
    key,
    target,
    preventDefault() {
      prevented = true;
    }
  });
  return prevented;
}

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

  const anchorClassHrefMatch = selector.match(/^a\.([A-Za-z0-9_-]+)\[href\]$/);
  if (anchorClassHrefMatch) {
    return element.tagName === 'A' && element.className.split(/\s+/).includes(anchorClassHrefMatch[1]) && element.attributes.has('href');
  }

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
