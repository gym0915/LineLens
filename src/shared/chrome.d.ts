import type { ExtensionMessage } from './messages';

type RuntimeMessageCallback = (
  message: ExtensionMessage,
  sender: ChromeRuntime.MessageSender,
  sendResponse: (response?: unknown) => void
) => boolean | void;

declare namespace ChromeRuntime {
  type MessageSender = {
    tab?: chrome.tabs.Tab;
  };
}

declare global {
namespace chrome {
  namespace action {
    function disable(tabId?: number): Promise<void>;
    function enable(tabId?: number): Promise<void>;
    function setTitle(details: { tabId?: number; title: string }): Promise<void>;
  }

  namespace runtime {
    const onInstalled: {
      addListener(callback: () => void): void;
    };

    const onMessage: {
      addListener(callback: RuntimeMessageCallback): void;
    };

    function sendMessage(message: ExtensionMessage): Promise<unknown>;
    function getURL(path: string): string;
  }

  namespace tabs {
    type Tab = {
      id?: number;
      url?: string;
    };

    function create(details: { url: string; active?: boolean }): Promise<Tab>;
  }
}
}

export {};
