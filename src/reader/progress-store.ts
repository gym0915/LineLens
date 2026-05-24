import type { ReadingProgress } from '../shared/article-schema.js';

const STORAGE_KEY_PREFIX = 'linelens:fixture-progress:';

export class ProgressStore {
  get(articleId: string): ReadingProgress | null {
    const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}${articleId}`);
    if (!raw) {
      return null;
    }

    try {
      return JSON.parse(raw) as ReadingProgress;
    } catch {
      return null;
    }
  }

  save(progress: ReadingProgress): void {
    localStorage.setItem(
      `${STORAGE_KEY_PREFIX}${progress.articleId}`,
      JSON.stringify(progress)
    );
  }
}
