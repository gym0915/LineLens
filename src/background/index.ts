import type { Article } from '../shared/article';
import { saveArticle } from '../shared/article-store.js';
import type { ExtensionMessage } from '../shared/messages';

const readyTabs = new Map<number, string>();
const LOG_PREFIX = '[LineLens SW]';
const READY_ICON_COLOR = '#22c55e';
const IDLE_ICON_COLOR = '#6b7280';

chrome.runtime.onInstalled.addListener(() => {
  console.info(LOG_PREFIX, 'installed; action click listener active');
  void chrome.action.setTitle({ title: 'Open in LineLens' });
});

chrome.action.onClicked.addListener((tab) => {
  console.info(LOG_PREFIX, 'toolbar icon clicked', {
    tabId: tab.id,
    url: tab.url
  });
  void extractCurrentTabArticle(tab);
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

  sendResponse({ ok: false, reason: 'unsupported_message' });
});

function getMessageTabId(message: ExtensionMessage) {
  if (message.type === 'ARTICLE_READY' || message.type === 'ARTICLE_NOT_READY') {
    return message.tabId;
  }
  return undefined;
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
  const response = await chrome.tabs
    .sendMessage(tab.id, {
      type: 'EXTRACT_CURRENT_ARTICLE'
    })
    .catch((error) => {
      console.warn(LOG_PREFIX, 'content script did not respond', {
        tabId: tab.id,
        error: error instanceof Error ? error.message : String(error)
      });
      return null;
    });

  console.info(LOG_PREFIX, 'extract response received', {
    tabId: tab.id,
    type: response?.type ?? 'no_response',
    reason: response?.type === 'ARTICLE_EXTRACT_FAILED' ? response.reason : undefined
  });

  if (response?.type === 'ARTICLE_EXTRACTED') {
    await saveAndOpenReader(response.article);
  }
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
