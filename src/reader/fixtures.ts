import type { Article, ArticleBlock } from '../shared/article-schema.js';

const DEFAULT_FIXTURE_ID = 'simple-chinese';
const FIXTURE_BASE_PATH = './fixtures/articles';

export function getRequestedFixtureId(locationSearch: string): string {
  const params = new URLSearchParams(locationSearch);
  return params.get('fixture') ?? params.get('articleId') ?? DEFAULT_FIXTURE_ID;
}

export async function loadFixtureArticle(articleId: string): Promise<Article> {
  const response = await fetch(`${FIXTURE_BASE_PATH}/${articleId}.json`);

  if (!response.ok) {
    throw new Error(`无法加载 fixture：${articleId}`);
  }

  const article = (await response.json()) as Article;
  assertArticleShape(article, articleId);
  return article;
}

function assertArticleShape(article: Article, requestedId: string): void {
  if (!article.id || !article.title || !Array.isArray(article.blocks)) {
    throw new Error(`fixture 结构不完整：${requestedId}`);
  }

  for (const block of article.blocks) {
    assertBlockShape(block, article.id);
  }
}

function assertBlockShape(block: ArticleBlock, articleId: string): void {
  if (!block.id || !block.type) {
    throw new Error(`fixture block 结构不完整：${articleId}`);
  }
}
