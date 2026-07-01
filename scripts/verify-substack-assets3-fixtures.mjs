import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';

import { JSDOM } from 'jsdom';

import { resolvePlatformAdapter } from '../dist/content/adapters/index.js';
import {
  extractConfigurableArticleWithDiagnostics,
  locateConfigurableArticleRoots,
  waitUntilConfigurableArticleReady
} from '../dist/content/extractors/configurable/index.js';
import { renderArticleShell } from '../dist/reader/block-renderer.js';
import { buildFocusUnits } from '../dist/reader/focus-unit-builder.js';

const projectRoot = resolve(import.meta.dirname, '..');
const assets3Root = findAssets3Root(projectRoot);
const fixtures = listAssets3HtmlFixtures(assets3Root);
const sourceUrls = [
  'https://substack.com/home/post/p-199574024',
  'https://substack.com/inbox/post/203490377'
].map((url) => new URL(url));
const bodySelector = '.available-content .body.markup';
const assets3ComponentRootSelector = [
  '[data-component-name="Image2ToDOM"]',
  '[data-component-name="Youtube2ToDOM"]',
  '[data-component-name="VideoEmbedPlayer"]',
  'audio[src]',
  '[data-component-name="FootnoteToDOM"]',
  '[data-component-name="Paywall"]',
  '[data-component-name="SubscribeWidget"]'
].join(', ');
const preservedSubstackComponentAttributes = ['data-component-name', 'data-href', 'data-native'];

assert.equal(fixtures.length, 4, `assets3/html dom should expose exactly 4 HTML fixtures, found ${fixtures.length}`);

console.log(`[assets3-fixtures] assets3 root: ${assets3Root}`);
console.log(`[assets3-fixtures] HTML fixtures: ${fixtures.length}`);

const implementationFailures = [];

for (const [index, fixture] of fixtures.entries()) {
  const sourceUrl = sourceUrls[index % sourceUrls.length];
  const dom = installDom(readFileSync(fixture.path, 'utf8'), sourceUrl.toString());
  const { document } = dom.window;
  const articleCount = document.querySelectorAll('article').length;
  const bodyRoots = document.querySelectorAll(bodySelector);
  const bodyRoot = document.querySelector(bodySelector);
  const articleRoot = document.querySelector('article.newsletter-post.post-viewer-post, article.podcast-post.post-viewer-post');

  assert.ok(articleCount > 0, `${fixture.name} should contain at least one <article>`);
  assert.equal(bodyRoots.length, 1, `${fixture.name} should expose exactly one ${bodySelector} body root`);
  assert.ok(articleRoot, `${fixture.name} should contain a Substack article root`);
  assert.ok(bodyRoot, `${fixture.name} should contain ${bodySelector}`);
  assert.equal(articleRoot.contains(bodyRoot), true, `${fixture.name} article root should contain ${bodySelector}`);

  const adapter = resolvePlatformAdapter(sourceUrl);
  assert.equal(adapter?.id, 'substack.article', `${sourceUrl.toString()} should resolve to substack.article`);
  assert.equal(adapter.contentSelector, undefined, 'Substack adapter should use the article root so out-of-body assets3 components can be mapped');
  assert.equal(
    adapter.cleanRules?.removeSelectors?.includes('.paywall'),
    false,
    'Substack clean rules should preserve Paywall roots for component handlers'
  );
  for (const attributeName of preservedSubstackComponentAttributes) {
    assert.ok(
      adapter.cleanRules?.preserveAttributeNames?.includes(attributeName),
      `Substack clean rules should preserve ${attributeName} for assets3 component handlers`
    );
  }

  const roots = locateConfigurableArticleRoots(adapter, { url: sourceUrl, root: document });
  assert.equal(roots.contentRoot, articleRoot, `${fixture.name} should extract from the Substack article root`);
  assertAssets3ComponentRootsCovered(adapter, articleRoot, fixture.name);

  const readiness = await waitUntilConfigurableArticleReady(adapter, { url: sourceUrl, root: document });

  console.log(
    [
      `[assets3-fixtures] ${fixture.name}`,
      `article=${articleCount}`,
      `body=true`,
      `adapterRoot=${Boolean(roots.articleRoot)}`,
      `adapterTitle=${Boolean(roots.titleElement?.textContent?.trim())}`,
      `ready=${readiness.ready ? 'true' : readiness.reason}`
    ].join(' ')
  );

  if (!readiness.ready) {
    implementationFailures.push({
      fixture: fixture.name,
      reason: readiness.reason,
      adapterRoot: Boolean(roots.articleRoot),
      adapterTitle: Boolean(roots.titleElement?.textContent?.trim()),
      contentRoot: Boolean(roots.contentRoot),
      articleClass: document.querySelector('article')?.getAttribute('class') ?? ''
    });
    continue;
  }

  try {
    const result = await extractConfigurableArticleWithDiagnostics(adapter, {
      url: sourceUrl,
      root: document,
      now: () => 1782220000000
    });
    assert.equal(result.article.adapterId, 'substack.article', `${fixture.name} should extract through substack.article`);
    assert.equal(result.article.source, 'substack-article', `${fixture.name} should keep substack article source`);
    assert.ok(result.article.title.trim().length > 0, `${fixture.name} should extract a non-empty title`);
    assert.ok(result.article.blocks.length >= 10, `${fixture.name} should extract a substantial Article block set`);
    assertReaderRendering(result.article, fixture.name);
  } catch (error) {
    implementationFailures.push({
      fixture: fixture.name,
      reason: error instanceof Error ? error.message : String(error),
      adapterRoot: Boolean(roots.articleRoot),
      adapterTitle: Boolean(roots.titleElement?.textContent?.trim()),
      contentRoot: Boolean(roots.contentRoot),
      articleClass: document.querySelector('article')?.getAttribute('class') ?? ''
    });
  }
}

if (implementationFailures.length > 0) {
  console.error('[assets3-fixtures] implementation contract failures:');
  for (const failure of implementationFailures) {
    console.error(
      `- ${failure.fixture}: ${failure.reason}; ` +
        `adapterRoot=${failure.adapterRoot}; adapterTitle=${failure.adapterTitle}; ` +
        `contentRoot=${failure.contentRoot}; articleClass="${failure.articleClass}"`
    );
  }
}

assert.equal(
  implementationFailures.length,
  0,
  `substack.article should be ready to extract all assets3 HTML fixtures; failures=${implementationFailures.length}`
);

console.log('verify:substack-assets3-fixtures passed');

function findAssets3Root(startDir) {
  let current = startDir;
  for (let depth = 0; depth < 12; depth += 1) {
    const candidate = resolve(current, 'assets3');
    if (existsSync(resolve(candidate, 'html dom'))) {
      return candidate;
    }

    const parent = resolve(current, '..');
    if (parent === current) {
      break;
    }
    current = parent;
  }

  throw new Error(`Unable to locate outer assets3/ from ${startDir}`);
}

function listAssets3HtmlFixtures(assetsRoot) {
  const htmlRoot = resolve(assetsRoot, 'html dom');
  return readdirSync(htmlRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .flatMap((entry) => {
      const dir = resolve(htmlRoot, entry.name);
      return readdirSync(dir, { withFileTypes: true })
        .filter((file) => file.isFile() && file.name.endsWith('.html'))
        .map((file) => ({
          name: basename(file.name, '.html'),
          path: resolve(dir, file.name)
        }));
    })
    .sort((left, right) => left.path.localeCompare(right.path));
}

function installDom(html, url) {
  const jsdom = new JSDOM(html, { url });
  globalThis.Element = jsdom.window.Element;
  globalThis.HTMLElement = jsdom.window.HTMLElement;
  globalThis.HTMLImageElement = jsdom.window.HTMLImageElement;
  globalThis.HTMLVideoElement = jsdom.window.HTMLVideoElement;
  globalThis.Node = jsdom.window.Node;
  globalThis.MutationObserver = jsdom.window.MutationObserver;
  globalThis.window = jsdom.window;
  globalThis.document = jsdom.window.document;
  return jsdom;
}

function assertAssets3ComponentRootsCovered(adapter, contentRoot, fixtureName) {
  const blockSelector = adapter.semanticMap?.blockSelector ?? '';
  assert.ok(blockSelector, 'Substack adapter should expose semanticMap.blockSelector');

  const componentRoots = Array.from(contentRoot.querySelectorAll(assets3ComponentRootSelector));
  const blockCandidates = new Set(Array.from(contentRoot.querySelectorAll(blockSelector)));

  for (const componentRoot of componentRoots) {
    assert.equal(
      blockCandidates.has(componentRoot),
      true,
      `${fixtureName} should include ${describeComponentRoot(componentRoot)} in semanticMap.blockSelector`
    );
  }
}

function describeComponentRoot(element) {
  return element.getAttribute('data-component-name') ?? element.tagName.toLowerCase();
}

function assertReaderRendering(article, fixtureName) {
  document.body.innerHTML = '';
  const shell = renderArticleShell(article);
  document.body.append(shell);

  const focusResult = buildFocusUnits(article, shell);
  const blockTypes = new Map(article.blocks.map((block) => [block.id, block.type]));
  for (const unit of focusResult.units.filter((candidate) => candidate.type === 'block')) {
    assert.equal(unit.blockType, blockTypes.get(unit.blockId), `${fixtureName} FocusUnit should preserve block type for ${unit.blockId}`);
  }

  const paywallBlock = article.blocks.find((block) => block.type === 'embed' && block.provider === 'substack' && /paid subscribers/i.test(`${block.title ?? ''} ${block.text ?? ''}`));
  if (paywallBlock) {
    const paywallElement = shell.querySelector(`[data-block-id="${paywallBlock.id}"]`);
    assert.ok(paywallElement, `${fixtureName} Reader should render Paywall embed`);
    assert.equal(paywallElement.querySelector('.reader-social-embed-text strong') !== null, true, `${fixtureName} Reader should render Paywall bold annotation`);
    assert.equal(paywallElement.querySelector('.reader-social-embed-text a[href]') !== null, true, `${fixtureName} Reader should render Paywall link annotation`);
  }

  const subscribeBlock = article.blocks.find((block) => block.type === 'embed' && block.provider === 'substack' && /subscribe|subscribed|upgrade/i.test(`${block.title ?? ''} ${block.text ?? ''}`));
  if (subscribeBlock) {
    const subscribeElement = shell.querySelector(`[data-block-id="${subscribeBlock.id}"]`);
    assert.ok(subscribeElement, `${fixtureName} Reader should render SubscribeWidget embed`);
    assert.equal(subscribeElement.querySelector('.reader-social-embed-text a[href]') !== null, true, `${fixtureName} Reader should render SubscribeWidget link annotation`);
  }

  const youtubeBlocks = article.blocks.filter((block) => block.type === 'embed' && block.provider === 'youtube');
  for (const block of youtubeBlocks) {
    const element = shell.querySelector(`[data-block-id="${block.id}"]`);
    assert.ok(element, `${fixtureName} Reader should render YouTube embed`);
    assert.match(element.textContent ?? '', /YouTube/i, `${fixtureName} Reader should not render blank YouTube fallback`);
  }

  const substackMediaEmbeds = article.blocks.filter(
    (block) => block.type === 'embed' && block.provider === 'substack' && block.media?.length
  );
  for (const block of substackMediaEmbeds) {
    const element = shell.querySelector(`[data-block-id="${block.id}"]`);
    assert.ok(element, `${fixtureName} Reader should render Substack media embed`);
    assert.equal(element.querySelector('.reader-social-embed-media-image') !== null, true, `${fixtureName} Reader should render Substack media fallback image`);
  }

  for (const block of article.blocks.filter((candidate) => candidate.type === 'embed' || candidate.type === 'video')) {
    const unit = focusResult.units.find((candidate) => candidate.blockId === block.id);
    assert.equal(unit?.type, 'block', `${fixtureName} FocusUnit should treat ${block.type} as a block unit`);
  }
}
