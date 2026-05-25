import type { Article } from './article';

export type ExtensionMessage =
  | {
      type: 'ARTICLE_READY';
      tabId?: number;
      extractorId: string;
    }
  | {
      type: 'ARTICLE_NOT_READY';
      tabId?: number;
      reason: string;
    }
  | {
      type: 'EXTRACT_CURRENT_ARTICLE';
    }
  | {
      type: 'LINELENS_ROUTE_CHANGED';
      url: string;
    }
  | {
      type: 'ARTICLE_EXTRACTED';
      article: Article;
    }
  | {
      type: 'ARTICLE_EXTRACT_FAILED';
      reason: string;
    };
