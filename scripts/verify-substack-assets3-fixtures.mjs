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

const projectRoot = resolve(import.meta.dirname, '..');
const assets3Root = findAssets3Root(projectRoot);
const fixtures = listAssets3HtmlFixtures(assets3Root);
const sourceUrls = [
  'https://substack.com/home/post/p-199574024',
  'https://substack.com/inbox/post/203490377'
].map((url) => new URL(url));

assert.equal(fixtures.length, 4, `assets3/html dom should expose exactly 4 HTML fixtures, found ${fixtures.length}`);

console.log(`[assets3-fixtures] assets3 root: ${assets3Root}`);
console.log(`[assets3-fixtures] HTML fixtures: ${fixtures.length}`);

const implementationFailures = [];

for (const [index, fixture] of fixtures.entries()) {
  const sourceUrl = sourceUrls[index % sourceUrls.length];
  const dom = installDom(readFileSync(fixture.path, 'utf8'), sourceUrl.toString());
  const { document } = dom.window;
  const articleCount = document.querySelectorAll('article').length;
  const contentRoot = document.querySelector('.available-content .body.markup');

  assert.ok(articleCount > 0, `${fixture.name} should contain at least one <article>`);
  assert.ok(contentRoot, `${fixture.name} should contain .available-content .body.markup`);

  const adapter = resolvePlatformAdapter(sourceUrl);
  assert.equal(adapter?.id, 'substack.article', `${sourceUrl.toString()} should resolve to substack.article`);

  const roots = locateConfigurableArticleRoots(adapter, { url: sourceUrl, root: document });
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
