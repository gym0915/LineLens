import type { ExtensionMessage } from '../shared/messages';

const bootMessage: ExtensionMessage = {
  type: 'ARTICLE_NOT_READY',
  reason: 'extractor_not_registered'
};

void chrome.runtime.sendMessage(bootMessage).catch(() => {
  // The page can outlive the extension context during reloads.
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'EXTRACT_CURRENT_ARTICLE') {
    const response: ExtensionMessage = {
      type: 'ARTICLE_EXTRACT_FAILED',
      reason: 'extractor_not_registered'
    };
    sendResponse(response);
  }
});

export {};
