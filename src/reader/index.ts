import { loadRequestedArticle } from './article-loader.js';
import { mountReaderApp } from './reader-app.js';

const root = document.querySelector<HTMLElement>('#reader-root');

if (!root) {
  throw new Error('缺少 Reader root 节点。');
}

try {
  const article = await loadRequestedArticle(window.location.search);
  mountReaderApp(root, article);
} catch (error) {
  root.textContent = error instanceof Error ? error.message : 'Reader 加载失败。';
}
