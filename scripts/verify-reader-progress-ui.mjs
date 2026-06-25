import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const repoRoot = resolve(import.meta.dirname, '..');

function read(path) {
  return readFileSync(resolve(repoRoot, path), 'utf8');
}

const readerApp = [read('src/reader/reader-app.ts'), read('src/reader/controllers/progress-ui.ts')].join('\n');
const tokensCss = read('public/styles/tokens.css');
const overlaysCss = read('public/styles/overlays.css');

assert(readerApp.includes('createReaderProgress('), 'Reader should build a dedicated top progress component');
assert(readerApp.includes('updateReaderProgress('), 'Reader should update progress through a dedicated function');
assert(readerApp.includes('reader-progress-bar'), 'Reader progress should expose a fill bar element');
assert(readerApp.includes("aria-label', '阅读进度'"), 'Reader progress should be named for assistive tech without visible text');
assert(readerApp.includes('aria-valuenow'), 'Reader progress should expose the current value to assistive tech');
assert(!readerApp.includes("status.className = 'reader-status'"), 'Old bottom reader-status progress footer should not be mounted');
assert(!readerApp.includes('formatReadingStatus('), 'Top progress bar should not render visible progress copy');

for (const token of [
  '--reader-progress-track',
  '--reader-progress-fill',
  '--reader-progress-height'
]) {
  assert(tokensCss.includes(token + ':'), token + ' should live in reader design tokens');
}

for (const selector of [
  '.reader-progress',
  '.reader-progress-track',
  '.reader-progress-bar'
]) {
  assert(overlaysCss.includes(selector + ' {'), selector + ' should be styled in overlays.css');
}

assert(overlaysCss.includes('position: fixed;') && overlaysCss.includes('top: 0;'), 'Reader progress should be fixed to the top of the reading viewport');
assert(overlaysCss.includes('height: var(--reader-progress-height);'), 'Reader progress height should use a token');
assert(overlaysCss.includes('width: var(--reader-progress-value, 0%);'), 'Reader progress fill should use a CSS custom property value');
assert(overlaysCss.includes('transition: width 350ms ease;'), 'Reader progress should animate width changes like the prototype');

console.log('verify:reader-progress-ui passed');
