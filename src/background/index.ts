import type { Article } from '../shared/article';
import { saveArticle } from '../shared/article-store.js';
import type { CapturedXVideo, ExtensionMessage } from '../shared/messages';
import { BUILT_IN_PLATFORM_ADAPTERS, resolvePlatformAdapter } from '../content/adapters/index.js';

const readyTabs = new Map<number, string>();
const tabVideoMap = new Map<number, Map<string, CapturedXVideo>>();
const LOG_PREFIX = '[LineLens SW]';
const READY_ICON_PATH = {
  16: 'icons/linelens-active-16.png',
  32: 'icons/linelens-active-32.png',
  48: 'icons/linelens-active-48.png',
  128: 'icons/linelens-active-128.png'
};
const IDLE_ICON_PATH = {
  16: 'icons/linelens-disabled-16.png',
  32: 'icons/linelens-disabled-32.png',
  48: 'icons/linelens-disabled-48.png',
  128: 'icons/linelens-disabled-128.png'
};
const ROUTE_CHANGE_HOST_FILTERS = [
  { hostSuffix: 'x.com' },
  { hostSuffix: 'twitter.com' },
  { hostSuffix: 'substack.com' }
];
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
    url: ROUTE_CHANGE_HOST_FILTERS
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
    tabId,
    ...(message.type === 'READER_MEDIA_LINK_CLICKED'
      ? {
          href: message.href,
          imageUrl: message.src,
          resolvedImageUrl: message.resolvedImageUrl,
          lookupSource: message.lookupSource,
          blockId: message.blockId,
          blockType: message.blockType,
          unitId: message.unitId
        }
      : {})
  });

  if (message.type === 'ARTICLE_READY') {
    if (typeof tabId === 'number') {
      readyTabs.set(tabId, message.extractorId);
      void chrome.action.enable(tabId);
      void setActionIcon(tabId, READY_ICON_PATH);
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
      void setActionIcon(tabId, IDLE_ICON_PATH);
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

  if (message.type === 'READER_MEDIA_LINK_CLICKED') {
    console.info(LOG_PREFIX, 'reader media link clicked', {
      tabId,
      articleId: message.articleId,
      blockId: message.blockId,
      blockType: message.blockType,
      unitId: message.unitId,
      href: message.href,
      imageUrl: message.src,
      resolvedImageUrl: message.resolvedImageUrl,
      lookupSource: message.lookupSource
    });
    sendResponse({ ok: true });
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
  const match = resolveArticleUrl(url);
  if (!match) {
    readyTabs.delete(tabId);
    await setActionIcon(tabId, IDLE_ICON_PATH);
    await chrome.action.setTitle({ tabId, title: 'LineLens: unsupported page' });
    console.info(LOG_PREFIX, 'action refreshed: unsupported tab', {
      tabId,
      url
    });
    return;
  }

  readyTabs.set(tabId, match.extractorId);
  await chrome.action.enable(tabId);
  await setActionIcon(tabId, READY_ICON_PATH);
  await chrome.action.setTitle({ tabId, title: 'Open in LineLens' });
  await notifyRouteChanged(tabId, match.url);
  console.info(LOG_PREFIX, 'action refreshed: supported article tab', {
    tabId,
    url: match.url,
    extractorId: match.extractorId
  });
}

function resolveArticleUrl(url: string | undefined): { extractorId: string; url: string } | null {
  if (!url) {
    return null;
  }

  try {
    const adapter = resolvePlatformAdapter(new URL(url), BUILT_IN_PLATFORM_ADAPTERS);
    return adapter ? { extractorId: adapter.id, url } : null;
  } catch {
    return null;
  }
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
  const url = readerUrl.toString();
  const existingReaderTabs = await chrome.tabs.query({ url: `${chrome.runtime.getURL('reader.html')}*` });
  const existingReaderTab = existingReaderTabs.find((tab) => tab.url === url && typeof tab.id === 'number');

  if (typeof existingReaderTab?.id === 'number') {
    await chrome.tabs.update(existingReaderTab.id, { active: true });
    return;
  }

  await chrome.tabs.create({ url, active: true });
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

async function setActionIcon(tabId: number, paths: Record<string, string>) {
  await chrome.action.setIcon({
    tabId,
    path: paths
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

export {};
