import type { Article } from '../shared/article-schema.js';
import { getArticle } from '../shared/article-store.js';
import { getRequestedFixtureId, loadFixtureArticle } from './fixtures.js';

export async function loadRequestedArticle(search: string): Promise<Article> {
  const params = new URLSearchParams(search);
  const explicitFixture = params.get('fixture');
  const articleId = params.get('articleId');

  if (explicitFixture || !articleId) {
    return loadFixtureArticle(getRequestedFixtureId(search));
  }

  const article = await getArticle(articleId);
  if (!article) {
    throw new Error(`无法加载文章：${articleId}`);
  }

  return article;
}
