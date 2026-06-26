import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><body></body>');
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.SVGSVGElement = dom.window.SVGSVGElement;

const { renderArticleShell } = await import('../dist/reader/block-renderer.js');

const article = {
  id: 'medium-neutral-header',
  source: 'medium-article',
  sourceKind: 'platform',
  sourceProvider: 'medium',
  adapterId: 'medium.article',
  platform: 'medium',
  contentType: 'article',
  sourceUrl: 'https://medium.example/p/platform-neutral-header',
  canonicalUrl: 'https://medium.example/p/platform-neutral-header',
  title: 'A platform neutral article header',
  authorName: 'Ada Lovelace',
  publishedAtText: 'Jun 26, 2026',
  extractedAt: Date.now(),
  blocks: [
    {
      id: 'p1',
      type: 'paragraph',
      text: 'Reader header metadata should not assume an X article.'
    },
    {
      id: 'p2',
      type: 'paragraph',
      text: 'Generic platforms may provide source, author, and date without handles or engagement metrics.'
    },
    {
      id: 'p3',
      type: 'paragraph',
      text: 'The header should degrade naturally and avoid X-only controls.'
    }
  ]
};

const rendered = renderArticleShell(article);

assert.equal(rendered.querySelector('.article-title')?.textContent, article.title, 'Reader header should render title');
assert.equal(rendered.querySelector('.article-meta-author-name')?.textContent, article.authorName, 'Reader header should render generic author name');
assert.equal(rendered.querySelector('.article-meta-author-secondary')?.textContent?.includes(article.publishedAtText), true, 'Reader header should render generic publication date');
assert.equal(rendered.querySelector('.article-meta-source')?.textContent?.toLowerCase().includes('medium'), true, 'Reader header should render source provider label');
assert.equal(rendered.querySelector('.reader-simple-tweet-grok-icon'), null, 'Non-X header should not render Grok icon');
assert.equal(rendered.querySelector('.article-meta-metrics'), null, 'Non-X header with no metrics should not render X action metrics row');
assert.equal(rendered.querySelector('.article-meta-metric-icon'), null, 'Non-X header should not render reply/retweet/like/views icons without metrics');

console.log('verify:reader-platform-neutral-header passed');
