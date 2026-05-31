import type { Article } from '../shared/article';
import { saveArticle } from '../shared/article-store.js';
import type { CapturedXVideo, ExtensionMessage } from '../shared/messages';
import { isXArticleUrl } from '../shared/url.js';

const readyTabs = new Map<number, string>();
const tabVideoMap = new Map<number, Map<string, CapturedXVideo>>();
const LOG_PREFIX = '[LineLens SW]';
const READY_ICON_COLOR = '#22c55e';
const IDLE_ICON_COLOR = '#6b7280';
const AMPLIFY_VIDEO_ID_PATTERN = /amplify_video\/(\d+)\//;

chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    const { tabId, url } = details;
    if (tabId < 0) {
      return;
    }

    const match = url.match(AMPLIFY_VIDEO_ID_PATTERN);
    if (!match) {
      return;
    }

    const videoId = match[1];
    const videoData = getOrCreateVideoEntry(tabId, videoId);

    if (!url.includes('.m3u8')) {
      return;
    }

    if (url.includes('/pl/playlist.m3u8')) {
      videoData.masterPlaylistUrl = url;
      console.info(LOG_PREFIX, 'captured X video master playlist', {
        tabId,
        videoId,
        url
      });
      return;
    }

    if (url.includes('/pl/avc1/')) {
      const resolutionMatch = url.match(/\/(\d+x\d+)\//);
      if (resolutionMatch) {
        videoData.videoPlaylists ??= {};
        videoData.videoPlaylists[resolutionMatch[1]] = url;
        console.info(LOG_PREFIX, 'captured X video playlist', {
          tabId,
          videoId,
          resolution: resolutionMatch[1],
          url
        });
      }
      return;
    }

    if (url.includes('/pl/mp4a/')) {
      const bitrateMatch = url.match(/\/pl\/mp4a\/([^/]+)\//);
      if (bitrateMatch) {
        videoData.audioPlaylists ??= {};
        videoData.audioPlaylists[bitrateMatch[1]] = url;
        console.info(LOG_PREFIX, 'captured X audio playlist', {
          tabId,
          videoId,
          bitrate: bitrateMatch[1],
          url
        });
      }
    }
  },
  { urls: ['https://video.twimg.com/*'] }
);

chrome.runtime.onInstalled.addListener(() => {
  console.info(LOG_PREFIX, 'installed; action click listener active');
  void chrome.action.setTitle({ title: 'Open in LineLens' });
});

chrome.action.onClicked.addListener(async (tab) => {
  console.info(LOG_PREFIX, 'toolbar icon clicked', {
    tabId: tab.id,
    url: tab.url
  });
  await extractCurrentTabArticle(tab);
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'loading' || changeInfo.url) {
    tabVideoMap.delete(tabId);
  }

  const url = changeInfo.url ?? tab.url;
  if (changeInfo.status !== 'complete' && !changeInfo.url) {
    return;
  }

  await refreshActionStateForTab(tabId, url);
});

chrome.webNavigation.onHistoryStateUpdated.addListener(
  async (details) => {
    if (details.frameId !== 0) {
      return;
    }

    await refreshActionStateForTab(details.tabId, details.url);
  },
  {
    url: [{ hostSuffix: 'x.com' }, { hostSuffix: 'twitter.com' }]
  }
);

chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    await refreshActionStateForTab(activeInfo.tabId, tab.url);
  } catch (error) {
    console.warn(LOG_PREFIX, 'failed to inspect activated tab', {
      tabId: activeInfo.tabId,
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const tabId = sender.tab?.id ?? getMessageTabId(message);
  console.info(LOG_PREFIX, 'runtime message received', {
    type: message.type,
    tabId
  });

  if (message.type === 'ARTICLE_READY') {
    if (typeof tabId === 'number') {
      readyTabs.set(tabId, message.extractorId);
      void chrome.action.enable(tabId);
      void setActionIcon(tabId, READY_ICON_COLOR);
      void chrome.action.setTitle({ tabId, title: 'Open in LineLens' });
      console.info(LOG_PREFIX, 'article ready; icon set to green', {
        tabId,
        extractorId: message.extractorId
      });
    }
    sendResponse({ ok: true });
    return;
  }

  if (message.type === 'ARTICLE_NOT_READY') {
    if (typeof tabId === 'number') {
      readyTabs.delete(tabId);
      void setActionIcon(tabId, IDLE_ICON_COLOR);
      void chrome.action.setTitle({ tabId, title: 'LineLens: unsupported page' });
      console.info(LOG_PREFIX, 'article not ready', {
        tabId,
        reason: message.reason
      });
    }
    sendResponse({ ok: true });
    return;
  }

  if (message.type === 'ARTICLE_EXTRACTED') {
    void saveAndOpenReader(message.article);
    sendResponse({ ok: true });
    return;
  }

  if (message.type === 'ARTICLE_EXTRACT_FAILED') {
    sendResponse({ ok: false, reason: message.reason });
    return;
  }

  if (message.type === 'UPSERT_X_VIDEO_POSTERS') {
    if (typeof tabId === 'number') {
      mergeVideoPosters(tabId, message.posters);
      sendResponse({ ok: true });
      return;
    }

    sendResponse({ ok: false, reason: 'missing_tab_id' });
    return;
  }

  if (message.type === 'GET_CAPTURED_X_VIDEOS') {
    sendResponse({
      videos: typeof tabId === 'number' ? listCapturedVideos(tabId) : []
    });
    return;
  }

  sendResponse({ ok: false, reason: 'unsupported_message' });
});

function getMessageTabId(message: ExtensionMessage) {
  if (message.type === 'ARTICLE_READY' || message.type === 'ARTICLE_NOT_READY') {
    return message.tabId;
  }
  return undefined;
}

async function refreshActionStateForTab(tabId: number, url: string | undefined) {
  if (!url || !isXArticleUrl(url)) {
    readyTabs.delete(tabId);
    await setActionIcon(tabId, IDLE_ICON_COLOR);
    await chrome.action.setTitle({ tabId, title: 'LineLens: unsupported page' });
    console.info(LOG_PREFIX, 'action refreshed: unsupported tab', {
      tabId,
      url
    });
    return;
  }

  readyTabs.set(tabId, 'x.article');
  await chrome.action.enable(tabId);
  await setActionIcon(tabId, READY_ICON_COLOR);
  await chrome.action.setTitle({ tabId, title: 'Open in LineLens' });
  await notifyRouteChanged(tabId, url);
  console.info(LOG_PREFIX, 'action refreshed: X article tab', {
    tabId,
    url
  });
}

async function notifyRouteChanged(tabId: number, url: string) {
  await sendTabMessage(tabId, {
    type: 'LINELENS_ROUTE_CHANGED',
    url
  });
}

async function openReader(article: Article) {
  const readerUrl = new URL(chrome.runtime.getURL('reader.html'));
  readerUrl.searchParams.set('articleId', article.id);
  await chrome.tabs.create({ url: readerUrl.toString(), active: true });
}

async function extractCurrentTabArticle(tab: chrome.tabs.Tab) {
  if (typeof tab.id !== 'number') {
    console.info(LOG_PREFIX, 'click ignored because tab id is missing');
    return;
  }

  console.info(LOG_PREFIX, 'requesting article extraction', {
    tabId: tab.id
  });
  const response = await sendExtractMessage(tab.id);

  console.info(LOG_PREFIX, 'extract response received', {
    tabId: tab.id,
    type: response?.type ?? 'no_response',
    reason: response?.type === 'ARTICLE_EXTRACT_FAILED' ? response.reason : undefined
  });

  if (response?.type === 'ARTICLE_EXTRACTED') {
    await saveAndOpenReader(response.article);
  }
}

async function sendExtractMessage(tabId: number): Promise<ExtensionMessage | null> {
  const message: ExtensionMessage = {
    type: 'EXTRACT_CURRENT_ARTICLE'
  };
  const firstResponse = await sendTabMessage(tabId, message);
  if (firstResponse) {
    return firstResponse;
  }

  await injectContentScript(tabId);
  return sendTabMessage(tabId, message);
}

async function sendTabMessage(tabId: number, message: ExtensionMessage): Promise<ExtensionMessage | null> {
  return chrome.tabs.sendMessage(tabId, message).catch((error) => {
    console.warn(LOG_PREFIX, 'content script did not respond', {
      tabId,
      type: message.type,
      error: error instanceof Error ? error.message : String(error)
    });
    return null;
  });
}

async function injectContentScript(tabId: number) {
  console.info(LOG_PREFIX, 'injecting content script fallback', {
    tabId
  });
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ['content.js']
  });
}

async function saveAndOpenReader(article: Article) {
  console.info(LOG_PREFIX, 'saving article and opening reader', {
    articleId: article.id,
    title: article.title
  });
  await saveArticle(article);
  await openReader(article);
}

async function setActionIcon(tabId: number, color: string) {
  await chrome.action.setIcon({
    tabId,
    imageData: {
      16: createIconImageData(16, color),
      32: createIconImageData(32, color),
      48: createIconImageData(48, color)
    }
  });
}

function getOrCreateVideoEntry(tabId: number, videoId: string): CapturedXVideo {
  let videoMap = tabVideoMap.get(tabId);
  if (!videoMap) {
    videoMap = new Map<string, CapturedXVideo>();
    tabVideoMap.set(tabId, videoMap);
  }

  let entry = videoMap.get(videoId);
  if (!entry) {
    entry = {
      videoId
    };
    videoMap.set(videoId, entry);
  }

  return entry;
}

function mergeVideoPosters(tabId: number, posters: Record<string, string>) {
  for (const [videoId, poster] of Object.entries(posters)) {
    if (!videoId || !poster) {
      continue;
    }
    getOrCreateVideoEntry(tabId, videoId).poster = poster;
  }
}

function listCapturedVideos(tabId: number): CapturedXVideo[] {
  return Array.from(tabVideoMap.get(tabId)?.values() ?? []).map((video) => ({
    videoId: video.videoId,
    ...(video.poster ? { poster: video.poster } : {}),
    ...(video.masterPlaylistUrl ? { masterPlaylistUrl: video.masterPlaylistUrl } : {}),
    ...(video.videoPlaylists ? { videoPlaylists: { ...video.videoPlaylists } } : {}),
    ...(video.audioPlaylists ? { audioPlaylists: { ...video.audioPlaylists } } : {})
  }));
}

function createIconImageData(size: number, color: string): ImageData {
  const canvas = new OffscreenCanvas(size, size);
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('icon_canvas_unavailable');
  }

  context.clearRect(0, 0, size, size);
  context.fillStyle = color;
  context.beginPath();
  context.roundRect(0, 0, size, size, Math.max(3, size * 0.2));
  context.fill();

  context.fillStyle = '#ffffff';
  context.font = `700 ${Math.floor(size * 0.58)}px sans-serif`;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText('L', size / 2, size / 2 + size * 0.03);

  return context.getImageData(0, 0, size, size);
}

export {};
