import type { Article } from './article';

export type CapturedXVideo = {
  videoId: string;
  poster?: string;
  masterPlaylistUrl?: string;
  videoPlaylists?: Record<string, string>;
  audioPlaylists?: Record<string, string>;
};

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
    }
  | {
      type: 'UPSERT_X_VIDEO_POSTERS';
      posters: Record<string, string>;
    }
  | {
      type: 'GET_CAPTURED_X_VIDEOS';
    }
  | {
      type: 'READER_MEDIA_LINK_CLICKED';
      articleId: string;
      blockId?: string;
      blockType?: string;
      unitId?: string;
      href: string;
      src: string;
      resolvedImageUrl: string;
      lookupSource: 'article';
    };
