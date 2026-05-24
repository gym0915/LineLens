import assert from 'node:assert/strict';

const article = {
  id: '2058421725256171718',
  source: 'x-article',
  sourceUrl: 'https://x.com/dotey/article/2058421725256171718',
  canonicalUrl: 'https://x.com/dotey/article/2058421725256171718',
  authorHandle: 'dotey',
  title: 'DeepSeek 的 10 万亿美元大战略【译】',
  extractedAt: 1779616800000,
  blocks: [
    {
      id: '2058421725256171718-b1',
      type: 'paragraph',
      text: '他们没有像智谱、月之暗面和 MiniMax 那样推出有竞争力的编程订阅计划。'
    },
    {
      id: '2058421725256171718-b2',
      type: 'paragraph',
      text: '在这里，我想聊聊我对他们至今所作所为的观察，以及他们似乎正在践行的战略。'
    },
    {
      id: '2058421725256171718-b3',
      type: 'image',
      src: 'https://pbs.twimg.com/media/HJD4tg6WcAEYzqi?format=jpg&name=medium',
      alt: 'Image'
    }
  ]
};

const storage = new Map();

globalThis.ImageData = class ImageData {
  constructor(data, width, height) {
    this.data = data;
    this.width = width;
    this.height = height;
  }
};

globalThis.OffscreenCanvas = class OffscreenCanvas {
  constructor(width, height) {
    this.width = width;
    this.height = height;
  }

  getContext() {
    return {
      clearRect() {},
      beginPath() {},
      roundRect() {},
      fill() {},
      fillText() {},
      getImageData: (_x, _y, width, height) =>
        new ImageData(new Uint8ClampedArray(width * height * 4), width, height),
      set fillStyle(_value) {},
      set font(_value) {},
      set textAlign(_value) {},
      set textBaseline(_value) {}
    };
  }
};

const calls = {
  disabledTabs: [],
  enabledTabs: [],
  icons: [],
  titles: [],
  createdTabs: [],
  sentMessages: []
};

let runtimeMessageListener;
let actionClickedListener;

globalThis.chrome = {
  action: {
    disable(tabId) {
      calls.disabledTabs.push(tabId);
      return Promise.resolve();
    },
    enable(tabId) {
      calls.enabledTabs.push(tabId);
      return Promise.resolve();
    },
    setIcon(details) {
      calls.icons.push(details);
      return Promise.resolve();
    },
    setTitle(details) {
      calls.titles.push(details);
      return Promise.resolve();
    },
    onClicked: {
      addListener(callback) {
        actionClickedListener = callback;
      }
    }
  },
  runtime: {
    onInstalled: {
      addListener() {}
    },
    onMessage: {
      addListener(callback) {
        runtimeMessageListener = callback;
      }
    },
    sendMessage() {
      return Promise.resolve({ ok: true });
    },
    getURL(path) {
      return `chrome-extension://linelens/${path}`;
    }
  },
  storage: {
    local: {
      async set(values) {
        for (const [key, value] of Object.entries(values)) {
          storage.set(key, value);
        }
      },
      async get(key) {
        if (Array.isArray(key)) {
          return Object.fromEntries(key.map((item) => [item, storage.get(item)]));
        }
        if (typeof key === 'string') {
          return { [key]: storage.get(key) };
        }
        return {};
      },
      async remove(key) {
        storage.delete(key);
      }
    }
  },
  tabs: {
    async create(details) {
      calls.createdTabs.push(details);
      return { id: 99, url: details.url };
    },
    async sendMessage(tabId, message) {
      calls.sentMessages.push({ tabId, message });
      return { type: 'ARTICLE_EXTRACTED', article };
    }
  }
};

const { saveArticle, getArticle } = await import('../dist/shared/article-store.js');

await saveArticle(article);
assert.deepEqual(await getArticle(article.id), article);

const { loadRequestedArticle } = await import('../dist/reader/article-loader.js');
const loaded = await loadRequestedArticle(`?articleId=${article.id}`);
assert.deepEqual(loaded, article);

await import('../dist/background/index.js');
assert.equal(typeof runtimeMessageListener, 'function', 'background should register runtime message listener');
assert.equal(typeof actionClickedListener, 'function', 'background should register action click listener');
assert.deepEqual(calls.disabledTabs, [], 'toolbar action should stay enabled so clicks reach onClicked');

await actionClickedListener({ id: 41, url: article.sourceUrl });
assert.deepEqual(calls.sentMessages, [
  {
    tabId: 41,
    message: { type: 'EXTRACT_CURRENT_ARTICLE' }
  }
]);

runtimeMessageListener(
  {
    type: 'ARTICLE_READY',
    extractorId: 'x.article'
  },
  { tab: { id: 42, url: article.sourceUrl } },
  () => {}
);
assert.deepEqual(calls.enabledTabs, [42]);
assert.equal(calls.icons.at(-1).tabId, 42);
assert.deepEqual(Object.keys(calls.icons.at(-1).imageData).sort(), ['16', '32', '48']);

await actionClickedListener({ id: 42, url: article.sourceUrl });
assert.deepEqual(calls.sentMessages, [
  {
    tabId: 41,
    message: { type: 'EXTRACT_CURRENT_ARTICLE' }
  },
  {
    tabId: 42,
    message: { type: 'EXTRACT_CURRENT_ARTICLE' }
  }
]);
assert.deepEqual(await getArticle(article.id), article);
assert.equal(
  calls.createdTabs.at(-1).url,
  'chrome-extension://linelens/reader.html?articleId=2058421725256171718'
);

const contentSource = await import('node:fs').then((fs) =>
  fs.readFileSync(new URL('../src/content/index.ts', import.meta.url), 'utf8')
);
assert.match(contentSource, /extractXArticle/);
assert.match(contentSource, /ARTICLE_READY/);
assert.match(contentSource, /ARTICLE_NOT_READY/);
assert.match(contentSource, /EXTRACT_CURRENT_ARTICLE/);
assert.match(contentSource, /MutationObserver/);
assert.match(contentSource, /MAX_READY_CHECKS/);
assert.match(contentSource, /LineLens Content/);
assert.doesNotMatch(contentSource, /extractor_not_registered/);

const contentBundle = await import('node:fs').then((fs) =>
  fs.readFileSync(new URL('../dist/content.js', import.meta.url), 'utf8')
);
assert.doesNotMatch(contentBundle, /^import\s/m);
assert.doesNotMatch(contentBundle, /^export\s/m);

const backgroundSource = await import('node:fs').then((fs) =>
  fs.readFileSync(new URL('../src/background/index.ts', import.meta.url), 'utf8')
);
assert.doesNotMatch(backgroundSource, /chrome\.action\.disable/);
assert.match(backgroundSource, /LineLens SW/);
assert.match(backgroundSource, /chrome\.action\.setIcon/);

console.log('B10-B15 X Article chain verification passed.');
