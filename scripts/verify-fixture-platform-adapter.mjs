import assert from 'node:assert/strict';

import { JSDOM } from 'jsdom';

import {
  fixtureArticleAdapter,
  resolvePlatformAdapter
} from '../dist/content/adapters/index.js';
import {
  createAdapterDrivenArticleExtractor,
  extractConfigurableArticle,
  waitUntilConfigurableArticleReady
} from '../dist/content/extractors/configurable/index.js';
import {
  cloneContentTree,
  createCleanTreeContext
} from '../dist/content/preprocess/clone-content-tree.js';

const fixtureUrl = new URL('https://fixture.linelens.local/article/1');
const fixtureHtml = [
  '<article data-article-root>',
  '  <h1 data-article-title>Fixture News Article</h1>',
  '  <section data-article-content>',
  '    <div class="ad">should be removed</div>',
  '    <div class="content-wrapper">',
  '      <p data-block data-kind="paragraph" data-text="true">Opening paragraph with <a href="https://example.com/source">source link</a> for annotation checks.</p>',
  '    </div>',
  '    <h2 data-block data-kind="heading" data-linelens-heading-level="2">Section heading</h2>',
  '    <blockquote data-block data-kind="quote">Quote content for the fixture adapter.</blockquote>',
  '    <div data-block data-kind="ordered-list">First ordered item</div>',
  '    <div data-block data-kind="ordered-list">Second ordered item</div>',
  '    <figure data-block data-kind="image"><img src="https://example.com/image.jpg" alt="Fixture image"></figure>',
  '    <pre data-block data-kind="code"><code class="language-js">const ok = true;</code></pre>',
  '    <table data-block data-kind="table"><tr><th>Name</th><th>Value</th></tr><tr><td>kind</td><td>fixture</td></tr></table>',
  '    <section class="comments">should be removed</section>',
  '  </section>',
  '</article>'
].join('');

const dom = installDom(fixtureHtml, fixtureUrl.toString());

assert.equal(
  resolvePlatformAdapter(fixtureUrl)?.id,
  'fixture.article',
  'fixture URL should resolve to the built-in fixture adapter'
);

const genericExtractor = createAdapterDrivenArticleExtractor([fixtureArticleAdapter]);
assert.equal(
  genericExtractor.match({ url: fixtureUrl })?.extractorId,
  'fixture.article',
  'adapter-driven extractor should match the fixture adapter'
);

const context = { url: fixtureUrl, root: dom.window.document, now: () => 246813579 };
assert.deepEqual(
  await waitUntilConfigurableArticleReady(fixtureArticleAdapter, context),
  { ready: true },
  'fixture adapter should be ready through root/title/content/readiness config'
);

const cleanTree = cloneContentTree(
  dom.window.document.querySelector(fixtureArticleAdapter.contentSelector),
  createCleanTreeContext({
    adapter: fixtureArticleAdapter,
    sourceUrl: fixtureUrl.toString(),
    debugId: 'fixture.article:test'
  })
);
assert.equal(cleanTree.root.querySelector('.ad'), null, 'cleanRules.removeSelectors should remove ad nodes');
assert.equal(cleanTree.root.querySelector('.comments'), null, 'cleanRules.removeSelectors should remove comment nodes');
assert.equal(cleanTree.root.querySelector('.content-wrapper'), null, 'cleanRules.unwrapSelectors should unwrap wrapper nodes');
assert.match(cleanTree.root.textContent, /Opening paragraph/, 'unwrapped content should remain in the clean tree');

const article = await extractConfigurableArticle(fixtureArticleAdapter, context);
assert.equal(article.id, 'fixture.article:https://fixture.linelens.local/article/1');
assert.equal(article.source, 'fixture');
assert.equal(article.adapterId, 'fixture.article');
assert.equal(article.platform, 'fixture');
assert.equal(article.contentType, 'article');
assert.equal(article.title, 'Fixture News Article');
assert.equal(article.extractedAt, 246813579);
assert.deepEqual(
  article.blocks.map((block) => block.type),
  ['paragraph', 'heading', 'quote', 'list', 'image', 'code', 'table'],
  'fixture extraction should produce standard ArticleBlock types in DOM order'
);
assert.equal(
  article.blocks.some((block) => block.type === 'paragraph' && block.annotations?.some((annotation) => annotation.href === 'https://example.com/source')),
  true,
  'fixture paragraph should preserve link annotation'
);

const fallbackTitleAdapter = {
  ...fixtureArticleAdapter,
  titleSelector: '[data-missing-title]',
  readiness: {
    ...fixtureArticleAdapter.readiness,
    requiredSelectors: ['[data-article-root]', '[data-article-content]'],
    minBlockCount: 3,
    minTextLength: 40
  },
  validation: {
    ...fixtureArticleAdapter.validation,
    minBlockCount: 3,
    minTextLength: 40,
    titleStrategy: 'fallback-from-h1'
  }
};
const fallbackDom = installDom(
  '<article data-article-root><h1>Fallback Fixture Title</h1><section data-article-content><p data-block data-kind="paragraph">Long enough fallback content for validation.</p><p data-block data-kind="paragraph">Second fallback content paragraph.</p><p data-block data-kind="paragraph">Third fallback content paragraph.</p></section></article>',
  fixtureUrl.toString()
);
assert.deepEqual(
  await waitUntilConfigurableArticleReady(fallbackTitleAdapter, { url: fixtureUrl, root: fallbackDom.window.document }),
  { ready: true },
  'titleStrategy=fallback-from-h1 should allow h1 fallback readiness'
);
const fallbackArticle = await extractConfigurableArticle(fallbackTitleAdapter, {
  url: fixtureUrl,
  root: fallbackDom.window.document
});
assert.equal(fallbackArticle.title, 'Fallback Fixture Title', 'titleStrategy=fallback-from-h1 should extract h1 title');

const requiredTitleAdapter = {
  ...fixtureArticleAdapter,
  titleSelector: '[data-missing-title]',
  readiness: {
    ...fixtureArticleAdapter.readiness,
    requiredSelectors: ['[data-article-root]', '[data-article-content]'],
    minBlockCount: 3,
    minTextLength: 40
  },
  validation: {
    ...fixtureArticleAdapter.validation,
    titleStrategy: 'required'
  }
};
assert.deepEqual(
  await waitUntilConfigurableArticleReady(requiredTitleAdapter, { url: fixtureUrl, root: fallbackDom.window.document }),
  { ready: false, reason: 'missing_title' },
  'titleStrategy=required should reject missing title selector'
);

console.log('Fixture platform adapter verification passed');

function installDom(html, url) {
  const dom = new JSDOM(html, { url });
  globalThis.Element = dom.window.Element;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.Node = dom.window.Node;
  globalThis.MutationObserver = dom.window.MutationObserver;
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  return dom;
}
