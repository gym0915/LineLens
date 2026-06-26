import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

import { fixtureArticleAdapter } from '../dist/content/adapters/index.js';
import {
  extractConfigurableArticle,
  waitUntilConfigurableArticleReady
} from '../dist/content/extractors/configurable/index.js';
import { renderArticleShell } from '../dist/reader/block-renderer.js';

const fixtureUrl = new URL('https://fixture.linelens.local/article/template');
const fixtureHtml = [
  '<article data-article-root>',
  '  <h1 data-article-title>Platform Template Fixture</h1>',
  '  <section data-article-content>',
  '    <p data-block data-kind="paragraph">First paragraph with <a href="https://example.com/template">template link</a>.</p>',
  '    <h2 data-block data-kind="heading" data-linelens-heading-level="2">Template heading</h2>',
  '    <blockquote data-block data-kind="quote">Template quote anchor.</blockquote>',
  '    <div data-block data-kind="ordered-list">Template list item</div>',
  '    <figure data-block data-kind="image"><img src="https://example.com/template.jpg" alt="Template image"></figure>',
  '    <pre data-block data-kind="code"><code class="language-js">const template = true;</code></pre>',
  '    <table data-block data-kind="table"><tr><th>Field</th><th>Value</th></tr><tr><td>adapter</td><td>fixture</td></tr></table>',
  '  </section>',
  '</article>'
].join('');

const dom = installDom(fixtureHtml, fixtureUrl.toString());
const context = { url: fixtureUrl, root: dom.window.document, now: () => 246813579 };

assert.ok(dom.window.document.querySelector(fixtureArticleAdapter.rootSelector), 'template verifier should assert adapter root selector');
assert.ok(dom.window.document.querySelector(fixtureArticleAdapter.titleSelector), 'template verifier should assert adapter title selector');
assert.ok(dom.window.document.querySelector(fixtureArticleAdapter.contentSelector), 'template verifier should assert adapter content selector');
assert.deepEqual(await waitUntilConfigurableArticleReady(fixtureArticleAdapter, context), { ready: true }, 'template verifier should assert adapter readiness');

const article = await extractConfigurableArticle(fixtureArticleAdapter, context);
assert.equal(article.adapterId, 'fixture.article');
assert.equal(article.title, 'Platform Template Fixture');
assert.deepEqual(
  article.blocks.map((block) => block.type),
  ['paragraph', 'heading', 'quote', 'list', 'image', 'code', 'table'],
  'template verifier should assert expected block order'
);
assert.equal(
  article.blocks.some((block) => block.type === 'paragraph' && block.annotations?.some((annotation) => annotation.href === 'https://example.com/template')),
  true,
  'template verifier should assert link annotation preservation'
);
assert.equal(article.blocks.some((block) => block.type === 'image' && block.alt === 'Template image'), true, 'template verifier should assert image metadata');
assert.equal(article.blocks.some((block) => block.type === 'code' && /template = true/.test(block.text)), true, 'template verifier should assert code metadata');
assert.equal(article.blocks.some((block) => block.type === 'table' && block.rows.length === 2), true, 'template verifier should assert table metadata');

const rendered = renderArticleShell(article);
assert.equal(rendered.querySelector('[data-block-id="title"]')?.textContent, article.title, 'template verifier should assert Reader consumes Article JSON title');
assert.equal(rendered.querySelector('[data-block-type="paragraph"]')?.textContent?.includes('First paragraph'), true, 'template verifier should assert Reader consumes Article JSON blocks');
assert.equal(rendered.querySelector('[data-article-root]'), null, 'template verifier should assert Reader does not render source DOM selectors');

console.log('verify:platform-template-fixture passed');

function installDom(html, url) {
  const dom = new JSDOM(html, { url });
  globalThis.Element = dom.window.Element;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.HTMLImageElement = dom.window.HTMLImageElement;
  globalThis.Node = dom.window.Node;
  globalThis.MutationObserver = dom.window.MutationObserver;
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  return dom;
}
