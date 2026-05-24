import type { Article } from '../shared/article';
import type { ExtensionMessage } from '../shared/messages';

const readyTabs = new Map<number, string>();

chrome.runtime.onInstalled.addListener(() => {
  void chrome.action.disable();
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const tabId = sender.tab?.id ?? getMessageTabId(message);

  if (message.type === 'ARTICLE_READY') {
    if (typeof tabId === 'number') {
      readyTabs.set(tabId, message.extractorId);
      void chrome.action.enable(tabId);
      void chrome.action.setTitle({ tabId, title: 'Open in LineLens' });
    }
    sendResponse({ ok: true });
    return;
  }

  if (message.type === 'ARTICLE_NOT_READY') {
    if (typeof tabId === 'number') {
      readyTabs.delete(tabId);
      void chrome.action.disable(tabId);
      void chrome.action.setTitle({ tabId, title: 'LineLens: unsupported page' });
    }
    sendResponse({ ok: true });
    return;
  }

  if (message.type === 'ARTICLE_EXTRACTED') {
    void openReader(message.article);
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

export {};
