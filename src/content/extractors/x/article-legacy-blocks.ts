import type { ArticleBlock } from '../../../shared/article.js';
import type { CapturedXVideo } from '../../../shared/messages.js';

export async function extractXArticleLegacyBlocks(params: {
  longform: Element;
  articleId: string;
  capturedVideos: CapturedXVideo[];
  extractBlocks: (longform: Element, articleId: string, capturedVideos: CapturedXVideo[]) => Promise<ArticleBlock[]>;
}): Promise<ArticleBlock[]> {
  return params.extractBlocks(params.longform, params.articleId, params.capturedVideos);
}
