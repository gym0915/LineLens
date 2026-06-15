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

  removeAttribute(name) {
    this.attributes.delete(name);
    if (name === 'href') this.href = '';
    if (name === 'src') this.src = '';
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
const runtimeMessages = [];
const imagePreloadRequests = [];
const documentBody = new ElementLike('body');

class ImagePreloadLike {
  constructor() {
    this.onload = null;
    this.onerror = null;
    this.alt = '';
    this.complete = false;
    this._src = '';
  }

  set src(value) {
    this._src = value;
    this.complete = false;
    imagePreloadRequests.push(this);
  }

  get src() {
    return this._src;
  }

  triggerLoad() {
    this.complete = true;
    this.onload?.({ target: this });
  }

  triggerError() {
    this.complete = false;
    this.onerror?.({ target: this });
  }
}

globalThis.Element = ElementLike;
globalThis.HTMLElement = ElementLike;
globalThis.Image = ImagePreloadLike;
globalThis.document = {
  body: documentBody,
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
  querySelector(selector) {
    return documentBody.querySelector(selector);
  },
  querySelectorAll(selector) {
    return documentBody.querySelectorAll(selector);
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
globalThis.chrome = {
  runtime: {
    sendMessage(message) {
      runtimeMessages.push(message);
      return Promise.resolve({ ok: true });
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
    {
      id: 'image-click-block',
      type: 'image',
      src: 'https://pbs.twimg.com/media/IMAGE123?format=jpg&name=large',
      alt: 'Linked image',
      href: 'https://x.com/example/photo/1'
    }
  ]
};
const coverClickArticle = {
  ...article,
  id: 'cover-click',
  coverImage: {
    id: 'cover-click-block',
    type: 'image',
    src: 'https://pbs.twimg.com/media/COVER123?format=jpg&name=large',
    alt: 'Linked cover',
    href: 'https://x.com/example/article/cover/media/1'
  },
  blocks: [{ id: 'cover-body', type: 'paragraph', text: 'Cover body paragraph' }]
};
const coverClickRoot = new ElementLike('main');
imagePreloadRequests.length = 0;
mountReaderApp(coverClickRoot, coverClickArticle);
assert(
  findPreloadRequest('https://pbs.twimg.com/media/COVER123?format=jpg&name=orig'),
  'Reader should preload high-res cover media when the article mounts'
);
findPreloadRequest('https://pbs.twimg.com/media/COVER123?format=jpg&name=orig')?.triggerLoad();
await flushAsyncWork();
const coverClickListener = coverClickRoot.eventListeners.get('click')?.at(-1);
const coverLink = findByClass(coverClickRoot, 'reader-cover');
assert(coverLink?.tagName === 'A', 'linked cover image should remain an anchor in Reader');
let preventedCoverClick = false;
coverClickListener?.({
  target: coverLink,
  preventDefault() {
    preventedCoverClick = true;
  },
  stopPropagation() {}
});
assert(preventedCoverClick, 'Cover image click should intercept default browser behavior');
assert(findByClass(documentBody, 'reader-media-preview')?.classList.contains('is-visible'), 'Cover image click should show the media preview in the current page');
assert(findByClass(documentBody, 'reader-media-preview')?.dataset.href === 'https://x.com/example/article/cover/media/1', 'Cover image preview should keep the source anchor href');
assert(
  findByClass(documentBody, 'reader-media-preview-image')?.getAttribute('src') === 'https://pbs.twimg.com/media/COVER123?format=jpg&name=orig',
  'Cover image preview should upgrade the article cover image URL to the original X image'
);
findByClass(documentBody, 'reader-media-preview-close')?.eventListeners.get('click')?.at(-1)?.({
  target: findByClass(documentBody, 'reader-media-preview-close'),
  preventDefault() {},
  stopPropagation() {}
});

const imageClickRoot = new ElementLike('main');
imagePreloadRequests.length = 0;
mountReaderApp(imageClickRoot, imageClickArticle);
assert(
  findPreloadRequest('https://pbs.twimg.com/media/IMAGE123?format=jpg&name=orig'),
  'Reader should preload high-res image block media when the article mounts'
);
findPreloadRequest('https://pbs.twimg.com/media/IMAGE123?format=jpg&name=orig')?.triggerLoad();
await flushAsyncWork();
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
const openCountBeforeActiveImageClick = openCalls.length;
imageClickListener?.({
  target: imageLink,
  preventDefault() {
    preventedActiveImageClick = true;
  },
  stopPropagation() {}
});
assert(preventedActiveImageClick, 'Active image link click should intercept default browser behavior');
assert(openCalls.length === openCountBeforeActiveImageClick, 'Active image link click should not navigate away');
assert(findByClass(documentBody, 'reader-media-preview')?.classList.contains('is-visible'), 'Active image link click should show the media preview in the current page');
assert(findByClass(documentBody, 'reader-media-preview')?.dataset.href === 'https://x.com/example/photo/1', 'Active image preview should keep the source anchor href');
assert(
  findByClass(documentBody, 'reader-media-preview-image')?.getAttribute('src') === 'https://pbs.twimg.com/media/IMAGE123?format=jpg&name=orig',
  'Active image preview should upgrade the article image URL to the original X image'
);
assert(runtimeMessages.at(-1)?.type === 'READER_MEDIA_LINK_CLICKED', 'Active image click should log the media href through runtime messaging');
assert(runtimeMessages.at(-1)?.href === 'https://x.com/example/photo/1', 'Active image click should log the image anchor href');
assert(runtimeMessages.at(-1)?.resolvedImageUrl === 'https://pbs.twimg.com/media/IMAGE123?format=jpg&name=orig', 'Active image click should log the final article-resolved image URL');
assert(runtimeMessages.at(-1)?.lookupSource === 'article', 'Active image click should log that the final URL came from article data lookup');
assert(runtimeMessages.at(-1)?.blockId === 'image-click-block', 'Active image click should log the source block id');
const secondImageClickArticle = {
  ...article,
  id: 'image-click-switch',
  blocks: [
    {
      id: 'image-click-switch-a',
      type: 'image',
      src: 'https://pbs.twimg.com/media/SWITCHA?format=jpg&name=large',
      alt: 'Switch image A',
      href: 'https://x.com/example/photo/a'
    },
    {
      id: 'image-click-switch-b',
      type: 'image',
      src: 'https://pbs.twimg.com/media/SWITCHB?format=jpg&name=small',
      alt: 'Switch image B',
      href: 'https://x.com/example/photo/b'
    }
  ]
};
const secondImageClickRoot = new ElementLike('main');
imagePreloadRequests.length = 0;
mountReaderApp(secondImageClickRoot, secondImageClickArticle);
assert(
  findPreloadRequest('https://pbs.twimg.com/media/SWITCHA?format=jpg&name=orig') &&
    findPreloadRequest('https://pbs.twimg.com/media/SWITCHB?format=jpg&name=orig'),
  'Reader should preload all high-res image block media when the article mounts'
);
const secondImageClickListener = secondImageClickRoot.eventListeners.get('click')?.at(-1);
const switchingImageLinks = walk(secondImageClickRoot).filter((element) => element.className.split(/\s+/).includes('reader-media'));
assert(switchingImageLinks.length === 2, 'Switching image fixture should render two image anchors');
findPreloadRequest('https://pbs.twimg.com/media/SWITCHA?format=jpg&name=orig')?.triggerLoad();
await flushAsyncWork();
secondImageClickListener?.({ target: switchingImageLinks[0], preventDefault() {}, stopPropagation() {} });
secondImageClickListener?.({ target: switchingImageLinks[0], preventDefault() {}, stopPropagation() {} });
assert(
  findByClass(documentBody, 'reader-media-preview-image')?.getAttribute('src') === 'https://pbs.twimg.com/media/SWITCHA?format=jpg&name=orig',
  'Active image preview should show the first clicked image source'
);
secondImageClickListener?.({ target: switchingImageLinks[1], preventDefault() {}, stopPropagation() {} });
secondImageClickListener?.({ target: switchingImageLinks[1], preventDefault() {}, stopPropagation() {} });
assert(findByClass(documentBody, 'reader-media-preview')?.dataset.href === 'https://x.com/example/photo/b', 'Active image preview should update to the second clicked image href');
assert(findByClass(documentBody, 'reader-media-preview')?.classList.contains('is-loading'), 'Active image preview should enter loading state when the clicked image is not ready');
assert(
  !findByClass(documentBody, 'reader-media-preview-image')?.getAttribute('src'),
  'Active image preview should clear the previous image while the clicked image is loading'
);
assert(
  !findByClass(documentBody, 'reader-media-preview-image')?.getAttribute('alt'),
  'Active image preview should not expose broken image alt text while loading'
);
assert(
  findByClass(documentBody, 'reader-media-preview-status')?.textContent === 'Loading...',
  'Active image preview should show plain English loading text'
);
findPreloadRequest('https://pbs.twimg.com/media/SWITCHB?format=jpg&name=orig')?.triggerLoad();
await flushAsyncWork();
assert(
  findByClass(documentBody, 'reader-media-preview-image')?.getAttribute('src') === 'https://pbs.twimg.com/media/SWITCHB?format=jpg&name=orig',
  `Active image preview should update the reused viewer image to the second clicked image source, got ${findByClass(documentBody, 'reader-media-preview-image')?.getAttribute('src')}`
);
assert(!findByClass(documentBody, 'reader-media-preview')?.classList.contains('is-loading'), 'Active image preview should leave loading state after the clicked image loads');
const previewCloseButton = findByClass(documentBody, 'reader-media-preview-close');
assert(previewCloseButton?.tagName === 'BUTTON', 'Media preview should expose a close button');
previewCloseButton.eventListeners.get('click')?.at(-1)?.({
  target: previewCloseButton,
  preventDefault() {},
  stopPropagation() {}
});
assert(!findByClass(documentBody, 'reader-media-preview')?.classList.contains('is-visible'), 'Clicking the close button should close the media preview');

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
        { src: 'https://pbs.twimg.com/media/GALLERY1?format=jpg&name=medium', alt: 'One', href: 'https://x.com/example/media/1' },
        { src: 'https://example.com/2.jpg', alt: 'Two', href: 'https://x.com/example/media/2' }
      ]
    }
  ]
};
const galleryClickRoot = new ElementLike('main');
imagePreloadRequests.length = 0;
mountReaderApp(galleryClickRoot, galleryClickArticle);
assert(
  findPreloadRequest('https://pbs.twimg.com/media/GALLERY1?format=jpg&name=orig') && findPreloadRequest('https://example.com/2.jpg'),
  'Reader should preload all high-res image-gallery media when the article mounts'
);
findPreloadRequest('https://pbs.twimg.com/media/GALLERY1?format=jpg&name=orig')?.triggerLoad();
findPreloadRequest('https://example.com/2.jpg')?.triggerLoad();
await flushAsyncWork();
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
const openCountBeforeActiveGalleryClick = openCalls.length;
galleryClickListener?.({
  target: galleryItemLink,
  preventDefault() {
    preventedActiveGalleryClick = true;
  },
  stopPropagation() {}
});
assert(preventedActiveGalleryClick, 'Active image-gallery link click should intercept default browser behavior');
assert(openCalls.length === openCountBeforeActiveGalleryClick, 'Active image-gallery link click should not navigate away');
assert(findByClass(documentBody, 'reader-media-preview')?.classList.contains('is-visible'), 'Active image-gallery link click should show the media preview in the current page');
assert(findByClass(documentBody, 'reader-media-preview')?.dataset.href === 'https://x.com/example/media/1', 'Active image-gallery preview should keep the source anchor href');
assert(findByClass(documentBody, 'reader-media-preview-prev')?.disabled, 'First preview image should not expose an enabled left navigation button');
assert(
  findByClass(documentBody, 'reader-media-preview-image')?.getAttribute('src') === 'https://pbs.twimg.com/media/GALLERY1?format=jpg&name=orig',
  'Active image-gallery preview should upgrade the matched gallery item URL to the original X image'
);
assert(runtimeMessages.at(-1)?.type === 'READER_MEDIA_LINK_CLICKED', 'Active image-gallery click should log the media href through runtime messaging');
assert(runtimeMessages.at(-1)?.href === 'https://x.com/example/media/1', 'Active image-gallery click should log the gallery item anchor href');
assert(runtimeMessages.at(-1)?.resolvedImageUrl === 'https://pbs.twimg.com/media/GALLERY1?format=jpg&name=orig', 'Active image-gallery click should log the final article-resolved image URL');
assert(runtimeMessages.at(-1)?.lookupSource === 'article', 'Active image-gallery click should log that the final URL came from article data lookup');
assert(runtimeMessages.at(-1)?.blockId === 'gallery-click-block', 'Active image-gallery click should log the source block id');
const secondGalleryItemLink = walk(galleryClickRoot).filter((element) => element.className.split(/\s+/).includes('reader-image-gallery-item')).at(1);
assert(secondGalleryItemLink?.tagName === 'A', 'Second linked gallery item should remain an anchor');
let preventedSecondActiveGalleryClick = false;
galleryClickListener?.({
  target: secondGalleryItemLink,
  preventDefault() {
    preventedSecondActiveGalleryClick = true;
  },
  stopPropagation() {}
});
assert(preventedSecondActiveGalleryClick, 'Active image-gallery click should intercept the second item without navigation');
assert(findByClass(documentBody, 'reader-media-preview')?.dataset.href === 'https://x.com/example/media/2', 'Active image-gallery preview should update to the clicked item href');
assert(findByClass(documentBody, 'reader-media-preview-next')?.disabled, 'Last preview image should not expose an enabled right navigation button');
assert(
  findByClass(documentBody, 'reader-media-preview-image')?.getAttribute('src') === 'https://example.com/2.jpg',
  'Active image-gallery preview should update the reused viewer image to the clicked item source'
);
assert(runtimeMessages.at(-1)?.href === 'https://x.com/example/media/2', 'Second active image-gallery click should log the clicked item anchor href');
assert(runtimeMessages.at(-1)?.resolvedImageUrl === 'https://example.com/2.jpg', 'Second active image-gallery click should log the clicked item final URL');
let preventedGalleryArrowLeft = false;
windowListeners.get('keydown')?.at(-1)?.({
  key: 'ArrowLeft',
  target: documentBody,
  preventDefault() {
    preventedGalleryArrowLeft = true;
  }
});
await flushAsyncWork();
assert(preventedGalleryArrowLeft, 'ArrowLeft should be intercepted while media preview is open');
assert(findByClass(documentBody, 'reader-media-preview')?.dataset.href === 'https://x.com/example/media/1', 'ArrowLeft should switch to the previous preview image');
assert(findByClass(documentBody, 'reader-media-preview')?.classList.contains('is-entering-from-left'), 'ArrowLeft should apply the left-enter preview animation');
assert(
  findByClass(documentBody, 'reader-media-preview-image')?.getAttribute('src') === 'https://pbs.twimg.com/media/GALLERY1?format=jpg&name=orig',
  'ArrowLeft should display the previous preview image source'
);
let preventedGalleryArrowRight = false;
windowListeners.get('keydown')?.at(-1)?.({
  key: 'ArrowRight',
  target: documentBody,
  preventDefault() {
    preventedGalleryArrowRight = true;
  }
});
await flushAsyncWork();
assert(preventedGalleryArrowRight, 'ArrowRight should be intercepted while media preview is open');
assert(findByClass(documentBody, 'reader-media-preview')?.dataset.href === 'https://x.com/example/media/2', 'ArrowRight should switch to the next preview image');
assert(findByClass(documentBody, 'reader-media-preview')?.classList.contains('is-entering-from-right'), 'ArrowRight should apply the right-enter preview animation');
let preventedPreviewEscape = false;
windowListeners.get('keydown')?.at(-1)?.({
  key: 'Escape',
  target: documentBody,
  preventDefault() {
    preventedPreviewEscape = true;
  }
});
assert(preventedPreviewEscape, 'Escape should be intercepted while media preview is open');
assert(!findByClass(documentBody, 'reader-media-preview')?.classList.contains('is-visible'), 'Escape should close the media preview');
const visiblePreview = findByClass(documentBody, 'reader-media-preview');
galleryClickListener?.({ target: secondGalleryItemLink, preventDefault() {}, stopPropagation() {} });
visiblePreview.eventListeners.get('click')?.at(-1)?.({
  target: visiblePreview,
  preventDefault() {},
  stopPropagation() {}
});
assert(!visiblePreview.classList.contains('is-visible'), 'Clicking the media preview scrim should close the preview');

const savedProgress = JSON.parse(storage.get('linelens:fixture-progress:simple-chinese'));
assert(savedProgress.unitId === 'p1-u2', 'Focus changes should save progress');
assert(typeof savedProgress.updatedAt === 'number', 'Saved progress should include updatedAt');

const progress = walk(root).find((element) => element.className.split(/\s+/).includes('reader-progress'));
assert(progress, 'Reader should render progress element; classes: ' + walk(root).map((element) => element.className).filter(Boolean).join(', '));
assert(progress?.style.values.get('--reader-progress-value')?.endsWith('%'), 'Reader progress should update the progress bar CSS value');
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

function findPreloadRequest(src) {
  return imagePreloadRequests.find((request) => request.src === src) ?? null;
}

async function flushAsyncWork() {
  for (let index = 0; index < 6; index += 1) {
    await Promise.resolve();
  }
}

function textUnit(unitId) {
  return { id: unitId, type: 'reading-text', blockId: unitId.split('-u')[0], unitId, text: unitId, startOffset: 0, endOffset: unitId.length };
}

function matchesSelector(element, selector) {
  if (selector === 'img') return element.tagName === 'IMG';

  const tagClassMatch = selector.match(/^([a-z]+)\.([A-Za-z0-9_-]+)$/);
  if (tagClassMatch) {
    return element.tagName === tagClassMatch[1].toUpperCase() && element.className.split(/\s+/).includes(tagClassMatch[2]);
  }

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

  const classVisibleMatch = selector.match(/^\.([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)$/);
  if (classVisibleMatch) {
    const classes = element.className.split(/\s+/);
    return classes.includes(classVisibleMatch[1]) && classes.includes(classVisibleMatch[2]);
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
