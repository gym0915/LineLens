import type { Article } from './article.js';
import type { ValidationResult } from './article-validator.js';

export type ExtractorMatch = {
  extractorId: string;
  confidence: number;
  reason: string;
};

export type ReadyResult =
  | {
      ready: true;
    }
  | {
      ready: false;
      reason: string;
    };

export type ExtractorContext = {
  url: URL;
  document?: Document;
  root?: ParentNode;
  now?: () => number;
};

export interface ArticleExtractor {
  id: string;
  platform: string;
  contentType: 'article' | 'post' | 'thread' | 'answer';
  match(context: ExtractorContext): ExtractorMatch | null;
  waitUntilReady(context: ExtractorContext): Promise<ReadyResult>;
  extract(context: ExtractorContext): Promise<Article>;
  validate(article: Article): ValidationResult;
}
