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
    function setIcon(details: {
      tabId?: number;
      imageData?: Record<string, ImageData>;
      path?: string | Record<string, string>;
    }): Promise<void>;
    function setTitle(details: { tabId?: number; title: string }): Promise<void>;
    const onClicked: {
      addListener(callback: (tab: chrome.tabs.Tab) => void | Promise<void>): void;
    };
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

    type TabChangeInfo = {
      status?: string;
      url?: string;
    };

    type TabActiveInfo = {
      tabId: number;
      windowId?: number;
    };

    const onUpdated: {
      addListener(callback: (tabId: number, changeInfo: TabChangeInfo, tab: Tab) => void | Promise<void>): void;
    };

    const onActivated: {
      addListener(callback: (activeInfo: TabActiveInfo) => void | Promise<void>): void;
    };

    function create(details: { url: string; active?: boolean }): Promise<Tab>;
    function get(tabId: number): Promise<Tab>;
    function sendMessage(tabId: number, message: ExtensionMessage): Promise<ExtensionMessage>;
  }

  namespace scripting {
    function executeScript(details: { target: { tabId: number }; files: string[] }): Promise<unknown[]>;
  }

  namespace webNavigation {
    type HistoryStateUpdatedDetails = {
      tabId: number;
      frameId: number;
      url: string;
    };

    const onHistoryStateUpdated: {
      addListener(
        callback: (details: HistoryStateUpdatedDetails) => void | Promise<void>,
        filters?: {
          url?: Array<{
            hostSuffix?: string;
          }>;
        }
      ): void;
    };
  }

  namespace storage {
    namespace local {
      function set(values: Record<string, unknown>): Promise<void>;
      function get(key: string | string[]): Promise<Record<string, unknown>>;
      function remove(key: string): Promise<void>;
    }
  }
}
}

export {};
