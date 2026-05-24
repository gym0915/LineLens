import { getRequestedFixtureId, loadFixtureArticle } from './fixtures.js';
import { mountReaderApp } from './reader-app.js';

const root = document.querySelector<HTMLElement>('#reader-root');
const articleId = getRequestedFixtureId(window.location.search);

if (!root) {
  throw new Error('缺少 Reader root 节点。');
}

try {
  const article = await loadFixtureArticle(articleId);
  mountReaderApp(root, article);
} catch (error) {
  root.textContent = error instanceof Error ? error.message : 'Reader 加载失败。';
}
