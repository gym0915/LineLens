import type { Article } from './article.js';

const ARTICLE_KEY_PREFIX = 'linelens:article:';

export async function saveArticle(article: Article): Promise<void> {
  await chrome.storage.local.set({
    [getArticleStorageKey(article.id)]: article
  });
}

export async function getArticle(articleId: string): Promise<Article | null> {
  const key = getArticleStorageKey(articleId);
  const values = await chrome.storage.local.get(key);
  return (values[key] as Article | undefined) ?? null;
}

export async function deleteArticle(articleId: string): Promise<void> {
  await chrome.storage.local.remove(getArticleStorageKey(articleId));
}

function getArticleStorageKey(articleId: string): string {
  return `${ARTICLE_KEY_PREFIX}${articleId}`;
}
