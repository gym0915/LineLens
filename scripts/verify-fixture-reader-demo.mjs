import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { JSDOM } from 'jsdom';

import { loadFixtureArticle } from '../dist/reader/fixtures.js';
import { mountReaderApp } from '../dist/reader/reader-app.js';

const projectRoot = resolve(import.meta.dirname, '..');
const fixtureId = 'non-x-fixture-article';
const fixturePath = resolve(projectRoot, 'dist', 'fixtures', 'articles', fixtureId + '.json');
assert.equal(existsSync(fixturePath), true, 'non-X Reader fixture JSON should be copied to dist');

installDom();
const article = await loadFixtureArticle(fixtureId);
assert.equal(article.id, fixtureId);
assert.equal(article.source, 'fixture');
assert.equal(article.adapterId, 'fixture.article');
assert.equal(article.platform, 'fixture');
assert.equal(article.contentType, 'article');

const root = document.querySelector('#reader-root');
mountReaderApp(root, article);

assert(root.querySelector('.reader-article'), 'Reader app should render the article shell');
assert(root.querySelector('[data-block-type="paragraph"]'), 'Reader app should render paragraph blocks');
assert(root.querySelector('[data-block-type="heading"]'), 'Reader app should render heading blocks');
assert(root.querySelector('[data-block-type="quote"]'), 'Reader app should render quote blocks');
assert(root.querySelector('.reader-list'), 'Reader app should render lists');
assert(root.querySelector('.reader-media'), 'Reader app should render media blocks');
assert(root.querySelector('.reader-code'), 'Reader app should render code blocks');
assert(root.querySelector('.reader-table'), 'Reader app should render table blocks');
assert(root.querySelector('a[href="https://example.com/source"]'), 'Reader app should preserve fixture link annotations');
assert(root.querySelectorAll('.focus-unit').length > 0, 'Reader app should initialize focus units');
assert(root.querySelector('.focus-unit.is-active'), 'Reader app should initialize the first active FocusUnit');
assert(root.querySelector('.reader-progress'), 'Reader app should render progress UI');

console.log('Fixture Reader demo verification passed');

function installDom() {
  const dom = new JSDOM('<!doctype html><main id="reader-root"></main>', {
    url: 'https://fixture.linelens.local/reader.html?fixture=' + fixtureId,
    pretendToBeVisual: true
  });

  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.Element = dom.window.Element;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.HTMLMediaElement = dom.window.HTMLMediaElement;
  globalThis.HTMLVideoElement = dom.window.HTMLVideoElement;
  globalThis.HTMLImageElement = dom.window.HTMLImageElement;
  globalThis.Node = dom.window.Node;
  globalThis.localStorage = dom.window.localStorage;
  dom.window.requestAnimationFrame = (callback) => {
    callback();
    return 0;
  };
  globalThis.requestAnimationFrame = dom.window.requestAnimationFrame;
  globalThis.fetch = async (url) => {
    const normalized = String(url).replace(/^\.\//, '');
    const path = resolve(projectRoot, 'dist', normalized);
    return {
      ok: existsSync(path),
      async json() {
        return JSON.parse(readFileSync(path, 'utf8'));
      }
    };
  };
}
