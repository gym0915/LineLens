import { readFile } from 'node:fs/promises';

const converterPath = 'src/content/preprocess/clean-tree-block-converter.ts';
const source = await readFile(converterPath, 'utf8');

const forbiddenTerms = [
  'tweetPhoto',
  'simpleTweet',
  'twitter-article',
  'twimg',
  'data-testid="tweetPhoto"',
  'data-testid="videoPlayer"',
  'X_CODE_COLOR_THEME_PAIRS'
];

const findings = forbiddenTerms
  .filter((term) => source.includes(term))
  .map((term) => {
    const line = source.slice(0, source.indexOf(term)).split('\n').length;
    return { term, line };
  });

if (findings.length > 0) {
  console.error('Generic clean-tree converter still contains platform-private terms:');
  for (const finding of findings) {
    console.error(`- ${finding.term} at ${converterPath}:${finding.line}`);
  }
  process.exit(1);
}

console.log('Generic clean-tree converter platform-neutral verification passed');
