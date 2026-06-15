import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const repoRoot = resolve(import.meta.dirname, '..');
const focusCss = readFileSync(resolve(repoRoot, 'public/styles/focus.css'), 'utf8');
const tokensCss = readFileSync(resolve(repoRoot, 'public/styles/tokens.css'), 'utf8');
const focusBuilderSource = readFileSync(resolve(repoRoot, 'src/reader/focus-unit-builder.ts'), 'utf8');

for (const expected of [
  '--reader-inline-highlight-padding-block: 2px;',
  '--reader-inline-highlight-padding-inline: 6px;',
  '--reader-inline-highlight-transition: all 250ms ease;'
]) {
  assert(tokensCss.includes(expected), 'missing inline highlight token: ' + expected);
}

const activeRule = getRule(focusCss, 'p .focus-unit.is-active');
assert(activeRule, 'p .focus-unit.is-active rule should exist');
const defaultParagraphRule = getRule(focusCss, 'p .focus-unit');
assert(defaultParagraphRule, 'p .focus-unit rule should exist');

for (const expected of [
  'padding: var(--reader-inline-highlight-padding-block) var(--reader-inline-highlight-padding-inline);',
  'border-radius: var(--reader-radius-card);',
  '-webkit-box-decoration-break: clone;',
  'box-decoration-break: clone;'
]) {
  assert(defaultParagraphRule.includes(expected), 'paragraph focus default state should reserve highlight layout: ' + expected);
}

for (const expected of [
  'box-shadow: var(--reader-highlight-shadow);',
  'transition: var(--reader-inline-highlight-transition);'
]) {
  assert(activeRule.includes(expected), 'paragraph inline highlight should include: ' + expected);
}

assert(!activeRule.includes('padding:'), 'paragraph active highlight should not introduce a focus-only padding delta');
assert(!activeRule.includes('0 0 0 4px var(--reader-highlight-surface)'), 'paragraph inline highlight should not use the old white spread shadow');
assert(!tokensCss.includes('--reader-inline-highlight-animation'), 'inline highlight animation token should be removed');
assert(!activeRule.includes('animation:'), 'paragraph inline highlight should not animate on selection');
assert(!focusCss.includes('@keyframes reader-inline-highlight-enter'), 'inline highlight selected-state animation should be removed');
assert(focusBuilderSource.includes('resolveParagraphReservedInlinePadding'), 'focus builder should resolve reserved paragraph inline padding before measuring semantic merges');
assert(
  focusBuilderSource.includes('maxLineWidth: Math.max(0, maxLineWidth - reservedInlinePadding * 2)'),
  'focus builder should subtract both sides of reserved inline highlight padding from semantic merge width'
);

console.log('verify:reader-inline-highlight-clean-style passed');

function getRule(css, selector) {
  for (const match of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selectors = match[1].split(',').map((item) => item.trim());
    if (selectors.includes(selector)) return match[2];
  }
  return '';
}
