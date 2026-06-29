import { readFile } from 'node:fs/promises';

const converterPath = 'src/content/preprocess/clean-tree-block-converter.ts';
const semanticSelectorsPath = 'src/content/preprocess/semantic-map-selectors.ts';
const scannedSources = [
  {
    label: 'Generic clean-tree converter',
    path: converterPath,
    source: await readFile(converterPath, 'utf8')
  },
  {
    label: 'Default semantic selectors',
    path: semanticSelectorsPath,
    source: await readFile(semanticSelectorsPath, 'utf8')
  }
];

const forbiddenTerms = [
  'data-testid="tweet"',
  'tweetPhoto',
  'markdown-code-block',
  'simpleTweet',
  'twitter-article',
  'twimg',
  'data-testid="tweetPhoto"',
  'data-testid="videoPlayer"',
  'X_CODE_COLOR_THEME_PAIRS'
];

const findings = scannedSources.flatMap(({ label, path, source }) =>
  forbiddenTerms
    .filter((term) => source.includes(term))
    .map((term) => {
      const line = source.slice(0, source.indexOf(term)).split('\n').length;
      return { label, path, term, line };
    })
);

if (findings.length > 0) {
  console.error('Generic conversion defaults still contain platform-private terms:');
  for (const finding of findings) {
    console.error(`- ${finding.term} in ${finding.label} at ${finding.path}:${finding.line}`);
  }
  process.exit(1);
}

console.log('Generic converter and default semantic selector platform-neutral verification passed');
