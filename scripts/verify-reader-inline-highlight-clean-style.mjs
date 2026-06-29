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
const defaultListItemRule = getRule(focusCss, '.reader-list-item.focus-unit');
assert(defaultListItemRule, '.reader-list-item.focus-unit rule should exist');
const activeListItemRule = getRule(focusCss, '.reader-list-item.focus-unit.is-active');
assert(activeListItemRule, '.reader-list-item.focus-unit.is-active rule should exist');
const defaultQuoteRule = getRule(focusCss, '.reader-block[data-block-type="quote"].focus-unit');
assert(defaultQuoteRule, '.reader-block[data-block-type="quote"].focus-unit rule should exist');
const activeQuoteRule = getRule(focusCss, '.reader-block[data-block-type="quote"].focus-unit.is-active');
assert(activeQuoteRule, '.reader-block[data-block-type="quote"].focus-unit.is-active rule should exist');

for (const expected of [
  'padding: var(--reader-inline-highlight-padding-block) var(--reader-inline-highlight-padding-inline);',
  'border-radius: var(--reader-radius-card);',
  '-webkit-box-decoration-break: clone;',
  'box-decoration-break: clone;'
]) {
  assert(defaultParagraphRule.includes(expected), 'paragraph focus default state should reserve highlight layout: ' + expected);
}

for (const expected of [
  'transition: var(--reader-inline-highlight-transition);'
]) {
  assert(activeRule.includes(expected), 'paragraph inline highlight should include: ' + expected);
}

assert(!activeRule.includes('padding:'), 'paragraph active highlight should not introduce a focus-only padding delta');
assert(!activeRule.includes('box-shadow:'), 'paragraph active highlight should not own the outer focus shadow');
assert(!activeRule.includes('background:'), 'paragraph active highlight should not own the outer focus background');
assert(!activeRule.includes('backdrop-filter'), 'paragraph inline highlight should not use backdrop-filter because it changes the rendering mechanism between themes');
assert(!activeRule.includes('-webkit-backdrop-filter'), 'paragraph inline highlight should not use webkit backdrop-filter because it can create a covering composited layer');
for (const expected of [
  'display: flex;',
  'padding: 7px 10px;',
  'border-radius: var(--reader-radius-card);'
]) {
  assert(defaultListItemRule.includes(expected), 'list item focus default state should reserve active layout: ' + expected);
}
assert(!activeListItemRule.includes('padding:'), 'list item active highlight should not introduce a focus-only padding delta');
assert(!activeListItemRule.includes('background:'), 'list item active highlight should not own the outer focus background');
assert(!activeListItemRule.includes('box-shadow:'), 'list item active highlight should not own the outer focus shadow');
for (const expected of [
  'display: block;',
  'padding: 10px 14px 10px 18px;',
  'border-radius: 0 var(--reader-radius-card) var(--reader-radius-card) 0;'
]) {
  assert(defaultQuoteRule.includes(expected), 'quote focus default state should reserve active layout: ' + expected);
}
for (const expected of [
  'border-left-color: var(--reader-quote-border-active);'
]) {
  assert(activeQuoteRule.includes(expected), 'quote active focus should include visual styling: ' + expected);
}
assert(!activeQuoteRule.includes('padding:'), 'quote active highlight should not introduce a focus-only padding delta');
assert(!activeQuoteRule.includes('background:'), 'quote active highlight should not own the outer focus background');
assert(!activeQuoteRule.includes('box-shadow:'), 'quote active highlight should not own the outer focus shadow');
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
  const bodies = [];
  for (const match of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selectors = match[1].split(',').map((item) => item.trim());
    if (selectors.includes(selector)) bodies.push(match[2]);
  }
  return bodies.join('\n');
}
