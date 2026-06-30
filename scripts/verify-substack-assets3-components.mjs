import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';

import { JSDOM } from 'jsdom';

import { substackArticleAdapter } from '../dist/content/adapters/index.js';

const projectRoot = resolve(import.meta.dirname, '..');
const assets3Root = findAssets3Root(projectRoot);
const fixtures = listAssets3HtmlFixtures(assets3Root);
const requiredCoverage = [
  { label: 'Twitter', componentNames: ['Twitter2ToDOM'], implementation: coversSpecialComponentName },
  { label: 'YouTube', componentNames: ['Youtube2ToDOM'], implementation: coversSpecialComponentName },
  { label: 'Video', componentNames: ['VideoEmbedPlayer'], implementation: coversSpecialComponentName },
  { label: 'Image', componentNames: ['Image2ToDOM'], implementation: coversImageComponent },
  { label: 'Footnote', componentNames: ['FootnoteAnchorToDOM', 'FootnoteToDOM'], implementation: coversSpecialComponentName },
  { label: 'Paywall', componentNames: ['Paywall'], implementation: coversPaywallComponent },
  { label: 'Subscribe', componentNames: ['SubscribeWidget'], implementation: coversSpecialComponentName }
];

assert.equal(fixtures.length, 4, `assets3/html dom should expose exactly 4 HTML fixtures, found ${fixtures.length}`);

const aggregateCounts = new Map();

console.log(`[assets3-components] assets3 root: ${assets3Root}`);

for (const fixture of fixtures) {
  const dom = new JSDOM(readFileSync(fixture.path, 'utf8'));
  const componentCounts = countComponentNames(dom.window.document);
  for (const [name, count] of componentCounts) {
    aggregateCounts.set(name, (aggregateCounts.get(name) ?? 0) + count);
  }

  console.log(`[assets3-components] ${fixture.name}`);
  for (const item of requiredCoverage) {
    const count = countRequiredComponents(componentCounts, item.componentNames);
    console.log(`  ${item.label}: ${count}`);
  }
}

const missingSourceCoverage = requiredCoverage
  .filter((item) => countRequiredComponents(aggregateCounts, item.componentNames) === 0)
  .map((item) => item.label);

assert.deepEqual(
  missingSourceCoverage,
  [],
  `assets3 fixtures should cover all required Substack component categories; missing=${missingSourceCoverage.join(', ')}`
);

const missingImplementationCoverage = requiredCoverage
  .filter((item) => countRequiredComponents(aggregateCounts, item.componentNames) > 0)
  .filter((item) => !item.implementation(substackArticleAdapter, item.componentNames))
  .map((item) => item.label);

if (missingImplementationCoverage.length > 0) {
  console.error('[assets3-components] implementation coverage gaps:');
  for (const label of missingImplementationCoverage) {
    console.error(`- ${label}`);
  }
}

assert.deepEqual(
  missingImplementationCoverage,
  [],
  `substack.article should declare handling for every assets3 component category; missing=${missingImplementationCoverage.join(', ')}`
);

console.log('verify:substack-assets3-components passed');

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

function countComponentNames(document) {
  const counts = new Map();
  for (const element of document.querySelectorAll('[data-component-name]')) {
    const name = element.getAttribute('data-component-name');
    if (name) {
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
  }
  return counts;
}

function countRequiredComponents(counts, names) {
  return names.reduce((total, name) => total + (counts.get(name) ?? 0), 0);
}

function coversSpecialComponentName(adapter, componentNames) {
  const selectorSource = (adapter.specialComponents ?? []).map((component) => component.rootSelector).join('\n');
  return componentNames.some((name) => selectorSource.includes(`data-component-name="${name}"`));
}

function coversImageComponent(adapter, componentNames) {
  return coversSpecialComponentName(adapter, componentNames) || Boolean(adapter.semanticMap?.imageSelector);
}

function coversPaywallComponent(adapter, componentNames) {
  const removedSelectors = adapter.cleanRules?.removeSelectors ?? [];
  const removesPaywall = removedSelectors.some((selector) => selector.includes('paywall'));
  if (removesPaywall) {
    return false;
  }
  return coversSpecialComponentName(adapter, componentNames) || selectorListIncludes(adapter, 'paywall');
}

function selectorListIncludes(adapter, value) {
  const selectors = [
    adapter.semanticMap?.blockSelector,
    adapter.semanticMap?.paragraphSelector,
    adapter.semanticMap?.quoteSelector,
    adapter.contentSelector,
    ...(adapter.specialComponents ?? []).map((component) => component.rootSelector)
  ].filter(Boolean);
  return selectors.some((selector) => selector.includes(value));
}
