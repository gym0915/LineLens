import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { JSDOM } from 'jsdom';

import {
  createAdapterDrivenArticleExtractor,
  extractConfigurableArticle,
  extractConfigurableArticleWithDiagnostics,
  matchConfigurableArticle,
  waitUntilConfigurableArticleReady
} from '../dist/content/extractors/configurable/index.js';
import { BUILT_IN_PLATFORM_ADAPTERS, xArticleAdapter } from '../dist/content/adapters/index.js';
import { createExtractorRegistry } from '../dist/content/extractor-registry.js';
import { xArticleExtractor } from '../dist/content/extractors/x/article-extractor.js';

const projectRoot = resolve(import.meta.dirname, '..');
const workspaceRoot = findWorkspaceRoot(projectRoot);

const genericAdapter = {
  id: 'fixture.article',
  platform: 'fixture',
  contentType: 'article',
  hosts: ['example.com'],
  urlPatterns: [/^\/story\/\d+$/],
  enabled: true,
  rootSelector: '[data-article-root]',
  titleSelector: '[data-title]',
  contentSelector: '[data-content]',
  semanticMap: {
    blockSelector: '[data-block]',
    paragraphSelector: '[data-kind="paragraph"]',
    headingSelector: '[data-kind="heading"]',
    quoteSelector: '[data-kind="quote"]',
    orderedListSelector: '[data-kind="ordered-list"]',
    unorderedListSelector: '[data-kind="unordered-list"]',
    imageSelector: '[data-kind="image"]',
    imageGallerySelector: '[data-kind="image-gallery"]',
    codeSelector: '[data-kind="code"]',
    tableSelector: '[data-kind="table"]',
    linkSelector: 'a[href]',
    textSelector: '[data-text="true"]'
  },
  cleanRules: {
    removeSelectors: ['script', 'button', '[role="button"]'],
    unwrapSelectors: [],
    preserveAttributeNames: ['href', 'src', 'alt', 'role', 'data-kind']
  },
  readiness: {
    minBlockCount: 7,
    minTextLength: 40,
    requiredSelectors: ['[data-article-root]', '[data-title]', '[data-content]']
  },
  validation: {
    minBlockCount: 7,
    minTextLength: 40,
    titleStrategy: 'required',
    emptyContentStrategy: 'reject'
  },
  fixes: [],
  enabledFixes: [],
  styleWhitelist: {
    preserveProps: ['font-weight'],
    preserveColorFor: ['link'],
    preserveWhiteSpaceValues: ['pre', 'pre-wrap']
  }
};

const genericHtml = [
  '<article data-article-root>',
  '  <h1 data-title>Configurable Article Fixture</h1>',
  '  <section data-content>',
  '    <p data-block data-kind="paragraph">Opening paragraph with <a href="https://example.com/source">link text</a> for annotations.</p>',
  '    <h2 data-block data-kind="heading" data-linelens-heading-level="2">Mapped heading</h2>',
  '    <blockquote data-block data-kind="quote">Mapped quote content.</blockquote>',
  '    <div data-block data-kind="ordered-list">Ordered item</div>',
  '    <div data-block data-kind="unordered-list">Unordered item</div>',
  '    <figure data-block data-kind="image"><img src="https://example.com/image.png" alt="Fixture image"></figure>',
  '    <section data-block data-kind="code"><pre><code class="language-ts">const answer: number = 42;</code></pre></section>',
  '    <section data-block data-kind="table"><div role="row"><span role="columnheader">Name</span><span role="columnheader">Value</span></div><div role="row"><span role="cell">kind</span><span role="cell">configurable</span></div></section>',
  '  </section>',
  '</article>'
].join('');

const genericUrl = new URL('https://example.com/story/123');
const genericDom = installDom(genericHtml, genericUrl.toString());
const runtimeRegistry = createExtractorRegistry([
  xArticleExtractor,
  createAdapterDrivenArticleExtractor(BUILT_IN_PLATFORM_ADAPTERS, {
    excludeAdapterIds: [xArticleExtractor.id]
  })
]);

const fixtureRuntimeMatch = runtimeRegistry.match({
  url: new URL('https://fixture.linelens.local/article/1'),
  root: genericDom.window.document
});
assert.equal(fixtureRuntimeMatch?.extractor.id, 'adapter.article', 'fixture.article should enter runtime through adapter.article');
assert.equal(fixtureRuntimeMatch?.result.extractorId, 'fixture.article', 'fixture.article should preserve the matched adapter id');

const substackRuntimeMatch = runtimeRegistry.match({
  url: new URL('https://substack.com/inbox/post/202529490'),
  root: genericDom.window.document
});
assert.equal(substackRuntimeMatch?.extractor.id, 'adapter.article', 'substack.article should enter runtime through adapter.article');
assert.equal(substackRuntimeMatch?.result.extractorId, 'substack.article', 'substack.article should preserve the matched adapter id');

const xRuntimeMatch = runtimeRegistry.match({
  url: new URL('https://x.com/example/article/123456789'),
  root: genericDom.window.document
});
assert.equal(xRuntimeMatch?.extractor.id, 'x.article', 'x.article should keep the X wrapper as the highest-confidence runtime match');
assert.equal(xRuntimeMatch?.result.extractorId, 'x.article', 'x.article should preserve the matched extractor id');

assert.equal(
  matchConfigurableArticle(genericAdapter, genericUrl)?.extractorId,
  'fixture.article',
  'configurable matcher should use adapter host and urlPatterns'
);
assert.equal(
  matchConfigurableArticle(genericAdapter, new URL('https://not-example.com/story/123')),
  null,
  'configurable matcher should reject unsupported hosts'
);

assert.deepEqual(
  await waitUntilConfigurableArticleReady(genericAdapter, { url: genericUrl, root: genericDom.window.document }),
  { ready: true },
  'configurable readiness should use adapter root/title/content/readiness config'
);

const stableDomAdapter = {
  ...genericAdapter,
  readiness: {
    ...genericAdapter.readiness,
    stableDomMs: 40
  }
};
const unstableDom = installDom(genericHtml, genericUrl.toString());
const unstableReady = waitUntilConfigurableArticleReady(stableDomAdapter, { url: genericUrl, root: unstableDom.window.document });
unstableDom.window.setTimeout(() => {
  const paragraph = unstableDom.window.document.createElement('p');
  paragraph.setAttribute('data-block', '');
  paragraph.setAttribute('data-kind', 'paragraph');
  paragraph.textContent = 'Late arriving paragraph inside the stable window.';
  unstableDom.window.document.querySelector('[data-content]')?.append(paragraph);
}, 5);
assert.deepEqual(
  await unstableReady,
  { ready: false, reason: 'content_not_stable' },
  'stableDomMs readiness should reject content that changes inside the stable window'
);
await new Promise((resolve) => unstableDom.window.setTimeout(resolve, 50));
assert.deepEqual(
  await waitUntilConfigurableArticleReady(stableDomAdapter, { url: genericUrl, root: unstableDom.window.document }),
  { ready: true },
  'stableDomMs readiness should pass after the content root remains stable'
);

const missingTitleDom = installDom('<article data-article-root><section data-content><p data-block>Missing title body text long enough.</p></section></article>', genericUrl.toString());
assert.deepEqual(
  await waitUntilConfigurableArticleReady(genericAdapter, { url: genericUrl, root: missingTitleDom.window.document }),
  { ready: false, reason: 'missing_title' },
  'configurable readiness should report missing title through adapter selectors'
);

installDom(genericHtml, genericUrl.toString());
const genericResult = await extractConfigurableArticleWithDiagnostics(genericAdapter, {
  url: genericUrl,
  root: globalThis.document,
  now: () => 123456789
});
const genericArticle = genericResult.article;
const genericTypes = genericArticle.blocks.map((block) => block.type);
assert.deepEqual(
  genericResult.diagnostics,
  {
    adapterId: 'fixture.article',
    platform: 'fixture',
    fallbackBlockCount: 0,
    highRiskBlockCount: 0,
    legacyOnlyBlockCount: 0,
    replacedBlockCount: 0
  },
  'fixture configurable extraction should expose zero-fallback adapter diagnostics'
);
assert.equal(genericArticle.id, 'fixture.article:https://example.com/story/123', 'configurable article should have deterministic id metadata');
assert.equal(genericArticle.source, 'fixture', 'non-X configurable article should use fixture source metadata');
assert.equal(genericArticle.sourceKind, 'fixture', 'fixture configurable article should expose generic source kind metadata');
assert.equal(genericArticle.sourceProvider, 'fixture', 'fixture configurable article should expose source provider metadata');
assert.equal(genericArticle.adapterId, 'fixture.article', 'fixture configurable article should expose adapter id metadata');
assert.equal(genericArticle.sourceUrl, genericUrl.toString(), 'configurable article should preserve sourceUrl metadata');
assert.equal(genericArticle.canonicalUrl, genericUrl.toString(), 'configurable article should use source URL as canonical URL in the skeleton');
assert.equal(genericArticle.title, 'Configurable Article Fixture', 'configurable article should use adapter title selector');
assert.equal(genericArticle.extractedAt, 123456789, 'configurable article should use context clock');
assert.deepEqual(
  genericTypes,
  ['paragraph', 'heading', 'quote', 'list', 'list', 'image', 'code', 'table'],
  'generic fixture should produce standard ArticleBlock types in DOM order'
);
assert.equal(
  genericArticle.blocks.some((block) => block.type === 'paragraph' && block.annotations?.some((annotation) => annotation.href === 'https://example.com/source')),
  true,
  'generic paragraph should preserve link annotations'
);

installDom(genericHtml, genericUrl.toString());
const genericArticleFromPublicApi = await extractConfigurableArticle(genericAdapter, {
  url: genericUrl,
  root: globalThis.document,
  now: () => 123456789
});
assert.equal(genericArticleFromPublicApi.id, genericArticle.id, 'public configurable extraction API should still return the Article JSON only');

const xHtml = readFileSync(resolve(workspaceRoot, 'assets/x-article-full-html.html'), 'utf8');
const xUrl = new URL('https://x.com/example/article/123456789');
const xDom = installDom(xHtml, xUrl.toString());
const xResult = await extractConfigurableArticleWithDiagnostics(xArticleAdapter, {
  url: xUrl,
  root: xDom.window.document,
  now: () => 987654321
});
const xArticle = xResult.article;
const xTypes = new Set(xArticle.blocks.map((block) => block.type));
assert.equal(matchConfigurableArticle(xArticleAdapter, xUrl)?.extractorId, 'x.article', 'X adapter should match through configurable matcher');
assert.equal(xArticle.source, 'x-article', 'X configurable extraction should preserve X source metadata');
assert.equal(xArticle.sourceKind, 'platform', 'X configurable extraction should expose platform source kind metadata');
assert.equal(xArticle.sourceProvider, 'x', 'X configurable extraction should expose source provider metadata');
assert.equal(xArticle.adapterId, 'x.article', 'X configurable extraction should expose adapter id metadata');
assert.equal(xArticle.title.length > 0, true, 'X configurable extraction should read title from adapter selectors');
assert.equal(xResult.diagnostics.adapterId, 'x.article', 'X configurable diagnostics should expose adapter id');
assert.equal(xResult.diagnostics.platform, 'x', 'X configurable diagnostics should expose platform id');
assert.equal(Number.isInteger(xResult.diagnostics.fallbackBlockCount), true, 'X configurable diagnostics should expose fallback count');
assert.equal(Number.isInteger(xResult.diagnostics.highRiskBlockCount), true, 'X configurable diagnostics should expose high-risk count');
assert.equal(Number.isInteger(xResult.diagnostics.legacyOnlyBlockCount), true, 'X configurable diagnostics should expose legacy-only count');
assert.equal(Number.isInteger(xResult.diagnostics.replacedBlockCount), true, 'X configurable diagnostics should expose replaced count');
for (const type of ['paragraph', 'list', 'image']) {
  assert.equal(xTypes.has(type), true, `X configurable extraction should expose low-risk ${type} blocks`);
}

const xArticleExtractorSource = readFileSync(resolve(projectRoot, 'src/content/extractors/x/article-extractor.ts'), 'utf8');
const adapterTypesSource = readFileSync(resolve(projectRoot, 'src/content/adapters/adapter-types.ts'), 'utf8');
const specialHandlersPath = resolve(projectRoot, 'src/content/extractors/configurable/special-component-handlers.ts');
const specialHandlersSource = existsSync(specialHandlersPath) ? readFileSync(specialHandlersPath, 'utf8') : '';
assert.doesNotMatch(
  xArticleExtractorSource,
  /buildCleanTreePrimaryBlocks/,
  'Step 4 should keep direct clean-tree block building inside configurable extraction'
);
assert.match(
  xArticleExtractorSource,
  /extractConfigurableArticleWithDiagnostics/,
  'Step 4 should let X delegate generic clean-tree extraction through configurable extraction'
);
assert.match(adapterTypesSource, /export type SpecialComponentHandler/, 'Step 4.4 should declare a SpecialComponentHandler type');
assert.equal(existsSync(specialHandlersPath), true, 'Step 4.4 should create configurable special-component-handlers.ts');
assert.match(specialHandlersSource, /registerSpecialComponentHandler/, 'Step 4.4 should expose code-owned handler registration');
assert.match(specialHandlersSource, /getSpecialComponentHandler/, 'Step 4.4 should resolve handlers by handlerId');
assert.match(specialHandlersSource, /return null/, 'unknown special component handlers should resolve to null instead of executing user config');

console.log('Configurable article extractor verification passed');

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

function findWorkspaceRoot(startDir) {
  let current = startDir;
  for (let depth = 0; depth < 8; depth += 1) {
    if (existsSync(resolve(current, 'assets'))) {
      return current;
    }

    const parent = resolve(current, '..');
    if (parent === current) {
      break;
    }

    current = parent;
  }

  throw new Error(`Unable to locate workspace assets directory from ${startDir}`);
}
