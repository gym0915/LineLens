import assert from 'node:assert/strict';

import { resolvePlatformAdapter } from '../dist/content/adapters/index.js';

const cases = [
  {
    url: 'https://substack.com/inbox/post/203490377',
    expectedAdapterId: 'substack.article'
  },
  {
    url: 'https://substack.com/home/post/p-199574024',
    expectedAdapterId: 'substack.article'
  },
  {
    url: 'https://substack.com/p/test',
    expectedAdapterId: null
  },
  {
    url: 'https://www.latent.space/p/test',
    expectedAdapterId: null
  },
  {
    url: 'https://latent.space/p/test',
    expectedAdapterId: null
  }
];

const failures = [];

for (const item of cases) {
  const adapter = resolvePlatformAdapter(new URL(item.url));
  const actualAdapterId = adapter?.id ?? null;
  console.log(`[substack-url-scope] ${item.url} -> ${actualAdapterId ?? 'null'}`);

  if (actualAdapterId !== item.expectedAdapterId) {
    failures.push({
      url: item.url,
      expected: item.expectedAdapterId,
      actual: actualAdapterId
    });
  }
}

if (failures.length > 0) {
  console.error('[substack-url-scope] URL scope contract failures:');
  for (const failure of failures) {
    console.error(`- ${failure.url}: expected ${failure.expected ?? 'null'}, got ${failure.actual ?? 'null'}`);
  }
}

assert.equal(failures.length, 0, `substack.article URL scope mismatches=${failures.length}`);

console.log('verify:substack-url-scope passed');
