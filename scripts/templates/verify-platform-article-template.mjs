#!/usr/bin/env node

const usage = `Usage:
  cp scripts/templates/verify-platform-article-template.mjs scripts/verify-<platform>-article-fixture.mjs
  node scripts/verify-<platform>-article-fixture.mjs

Template placeholders to replace:
  ADAPTER_ID        e.g. medium.article
  FIXTURE_URL       e.g. https://medium.com/@author/story
  FIXTURE_HTML      source fixture HTML string or file read
  EXPECTED_TITLE    expected extracted article title
  EXPECTED_BLOCKS   expected ArticleBlock type sequence

Required assertions for each copied verifier:
  - adapter resolves and matches the fixture URL
  - root/title/content selectors are present
  - readiness passes before extraction
  - extraction emits standard Article JSON blocks
  - expected order anchors remain in DOM order
  - special components are emitted in source position
  - Reader rendering consumes Article JSON only, not source DOM`;

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(usage);
  process.exit(0);
}

console.log(usage);
console.log('\nCopy this template before filling platform-specific values.');
