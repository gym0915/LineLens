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
  sentMessages: [],
  executedScripts: [],
  webRequestFilters: []
};

let runtimeMessageListener;
let actionClickedListener;
let tabsUpdatedListener;
let tabsActivatedListener;
let historyStateUpdatedListener;
let webRequestListener;
const mockTabs = new Map();
const sendMessageFailures = new Map();

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
    onUpdated: {
      addListener(callback) {
        tabsUpdatedListener = callback;
      }
    },
    onActivated: {
      addListener(callback) {
        tabsActivatedListener = callback;
      }
    },
    async create(details) {
      calls.createdTabs.push(details);
      return { id: 99, url: details.url };
    },
    async get(tabId) {
      return mockTabs.get(tabId) ?? { id: tabId };
    },
    async sendMessage(tabId, message) {
      calls.sentMessages.push({ tabId, message });
      const remainingFailures = sendMessageFailures.get(tabId) ?? 0;
      if (remainingFailures > 0) {
        sendMessageFailures.set(tabId, remainingFailures - 1);
        throw new Error('Receiving end does not exist.');
      }
      if (message.type === 'LINELENS_ROUTE_CHANGED') {
        return { ok: true };
      }
      return { type: 'ARTICLE_EXTRACTED', article };
    }
  },
  scripting: {
    async executeScript(details) {
      calls.executedScripts.push(details);
      return [];
    }
  },
  webNavigation: {
    onHistoryStateUpdated: {
      addListener(callback) {
        historyStateUpdatedListener = callback;
      }
    }
  },
  webRequest: {
    onBeforeRequest: {
      addListener(callback, filter) {
        webRequestListener = callback;
        calls.webRequestFilters.push(filter);
      }
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
assert.equal(typeof tabsUpdatedListener, 'function', 'background should register tab update listener');
assert.equal(typeof historyStateUpdatedListener, 'function', 'background should register SPA history listener');
assert.equal(typeof tabsActivatedListener, 'function', 'background should register tab activation listener');
assert.equal(typeof webRequestListener, 'function', 'background should register webRequest listener');
assert.deepEqual(calls.webRequestFilters, [{ urls: ['https://video.twimg.com/*'] }]);
assert.deepEqual(calls.disabledTabs, [], 'toolbar action should stay enabled so clicks reach onClicked');

await tabsUpdatedListener(43, { status: 'complete' }, {
  id: 43,
  url: 'https://x.com/dotey/article/2058421725256171718'
});
assert.deepEqual(calls.enabledTabs, [43], 'normal article page load should refresh action as clickable');
assert.equal(calls.icons.at(-1).tabId, 43);

await historyStateUpdatedListener({
  tabId: 44,
  frameId: 0,
  url: 'https://x.com/AlchainHust/article/2058732869363827129'
});
assert.deepEqual(calls.enabledTabs, [43, 44], 'SPA route into an X article should refresh action as clickable');
assert.equal(calls.icons.at(-1).tabId, 44);
assert.deepEqual(calls.sentMessages.at(-1), {
  tabId: 44,
  message: {
    type: 'LINELENS_ROUTE_CHANGED',
    url: 'https://x.com/AlchainHust/article/2058732869363827129'
  }
});

await historyStateUpdatedListener({
  tabId: 45,
  frameId: 1,
  url: 'https://x.com/AlchainHust/article/2058732869363827129'
});
assert.deepEqual(calls.enabledTabs, [43, 44], 'subframe history updates should be ignored');

mockTabs.set(46, {
  id: 46,
  url: 'https://twitter.com/dotey/article/2058421725256171718'
});
await tabsActivatedListener({ tabId: 46 });
assert.deepEqual(calls.enabledTabs, [43, 44, 46], 'switching to an article tab should refresh action as clickable');
assert.equal(calls.icons.at(-1).tabId, 46);

mockTabs.set(47, {
  id: 47,
  url: 'https://example.com/not-supported'
});
await tabsActivatedListener({ tabId: 47 });
assert.equal(calls.titles.at(-1).tabId, 47);
assert.equal(calls.titles.at(-1).title, 'LineLens: unsupported page');

await actionClickedListener({ id: 41, url: article.sourceUrl });
assert.deepEqual(calls.sentMessages.at(-1), {
  tabId: 41,
  message: { type: 'EXTRACT_CURRENT_ARTICLE' }
});

const messagesBeforeSecondClick = calls.sentMessages.length;

runtimeMessageListener(
  {
    type: 'ARTICLE_READY',
    extractorId: 'x.article'
  },
  { tab: { id: 42, url: article.sourceUrl } },
  () => {}
);
assert.equal(calls.enabledTabs.at(-1), 42);
assert.equal(calls.icons.at(-1).tabId, 42);
assert.deepEqual(Object.keys(calls.icons.at(-1).path).sort(), ['128', '16', '32', '48']);
assert.deepEqual(Object.values(calls.icons.at(-1).path).sort(), [
  'icons/linelens-dark-128.png',
  'icons/linelens-dark-16.png',
  'icons/linelens-dark-32.png',
  'icons/linelens-dark-48.png'
]);

webRequestListener({
  tabId: 42,
  url: 'https://video.twimg.com/amplify_video/2053916866964590592/pl/playlist.m3u8'
});
webRequestListener({
  tabId: 42,
  url: 'https://video.twimg.com/amplify_video/2053916866964590592/pl/avc1/1280x720/demo.m3u8'
});
webRequestListener({
  tabId: 42,
  url: 'https://video.twimg.com/amplify_video/2053916866964590592/pl/avc1/480x270/demo-low.m3u8'
});
runtimeMessageListener(
  {
    type: 'UPSERT_X_VIDEO_POSTERS',
    posters: {
      '2053916866964590592': 'https://pbs.twimg.com/amplify_video_thumb/2053916866964590592/img/demo.jpg'
    }
  },
  { tab: { id: 42, url: article.sourceUrl } },
  () => {}
);

let capturedVideosResponse;
runtimeMessageListener(
  {
    type: 'GET_CAPTURED_X_VIDEOS'
  },
  { tab: { id: 42, url: article.sourceUrl } },
  (response) => {
    capturedVideosResponse = response;
  }
);
assert.deepEqual(capturedVideosResponse, {
  videos: [
    {
      videoId: '2053916866964590592',
      poster: 'https://pbs.twimg.com/amplify_video_thumb/2053916866964590592/img/demo.jpg',
      masterPlaylistUrl: 'https://video.twimg.com/amplify_video/2053916866964590592/pl/playlist.m3u8',
      videoPlaylists: {
        '1280x720': 'https://video.twimg.com/amplify_video/2053916866964590592/pl/avc1/1280x720/demo.m3u8',
        '480x270': 'https://video.twimg.com/amplify_video/2053916866964590592/pl/avc1/480x270/demo-low.m3u8'
      }
    }
  ]
});

await actionClickedListener({ id: 42, url: article.sourceUrl });
assert.deepEqual(calls.sentMessages.slice(messagesBeforeSecondClick), [
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

sendMessageFailures.set(48, 1);
await actionClickedListener({ id: 48, url: article.sourceUrl });
assert.deepEqual(calls.executedScripts.at(-1), {
  target: { tabId: 48 },
  files: ['content.js']
});
assert.deepEqual(calls.sentMessages.slice(-2), [
  {
    tabId: 48,
    message: { type: 'EXTRACT_CURRENT_ARTICLE' }
  },
  {
    tabId: 48,
    message: { type: 'EXTRACT_CURRENT_ARTICLE' }
  }
]);
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
assert.match(contentSource, /LINELENS_ROUTE_CHANGED/);
assert.match(contentSource, /monitorArticleState/);
assert.match(contentSource, /MutationObserver/);
assert.match(contentSource, /UPSERT_X_VIDEO_POSTERS/);
assert.match(contentSource, /GET_CAPTURED_X_VIDEOS/);
assert.match(contentSource, /startPosterMonitor/);
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
assert.match(backgroundSource, /chrome\.webRequest\.onBeforeRequest/);
assert.match(backgroundSource, /UPSERT_X_VIDEO_POSTERS/);
assert.match(backgroundSource, /GET_CAPTURED_X_VIDEOS/);
assert.match(backgroundSource, /READER_MEDIA_LINK_CLICKED/);
assert.match(backgroundSource, /reader media link clicked/);
assert.match(backgroundSource, /imageUrl: message\.src/);
assert.match(backgroundSource, /resolvedImageUrl: message\.resolvedImageUrl/);
assert.match(backgroundSource, /lookupSource: message\.lookupSource/);
assert.match(backgroundSource, /tabVideoMap/);

console.log('B10-B15 X Article chain verification passed.');
