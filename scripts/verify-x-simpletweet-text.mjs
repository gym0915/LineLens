import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const rootDir = resolve(import.meta.dirname, '..');
const workspaceRoot = findWorkspaceRoot(rootDir);

const articleModelSource = readFileSync(resolve(rootDir, 'src/shared/article.ts'), 'utf8');
const extractorSource = readFileSync(resolve(rootDir, 'src/content/extractors/x/article-extractor.ts'), 'utf8');
const simpleTweetSource = readFileSync(resolve(rootDir, 'src/content/extractors/x/simple-tweet.ts'), 'utf8');
const mirroredExtractorSource = readFileSync(resolve(rootDir, 'src/content/index.ts'), 'utf8');
const readerRendererSource = readFileSync(resolve(rootDir, 'src/reader/block-renderer.ts'), 'utf8');
const readerCss = readReaderCss();
const packageJson = JSON.parse(readFileSync(resolve(rootDir, 'package.json'), 'utf8'));
const simpleTweetTextFixture = readFileSync(resolve(workspaceRoot, 'assets/x-article-simpletweet-text.html'), 'utf8');

assert.match(
  simpleTweetTextFixture,
  /data-testid="simpleTweet"[\s\S]*data-testid="tweetText"/,
  'fixture should represent a simpleTweet that contains tweetText'
);
assert.doesNotMatch(
  simpleTweetTextFixture,
  /data-testid="(?:article-cover-image|tweetPhoto|videoPlayer)"/,
  'fixture should represent a text-only simpleTweet with no cover, photo, or video media'
);
assert.match(
  simpleTweetTextFixture,
  /data-testid="icon-verified"/,
  'fixture should expose an optional verified badge'
);
assert.match(
  simpleTweetTextFixture,
  /profile_images\/2031733558952464384\/ERrHv3jK_bigger\.jpg/,
  'fixture should expose an optional square source/avatar badge next to the author'
);
assert.match(
  simpleTweetTextFixture,
  /data-testid="tweetText"[\s\S]*为了替微软稍作辩解[\s\S]*程序合成是一种可扩展搜索的形式/,
  'fixture should expose the full text-only tweet body'
);

assert.match(articleModelSource, /authorBadgeAvatarUrl\?: string/, 'SimpleTweetBlock should support the optional square source/avatar badge');
assert.match(articleModelSource, /replyContextText\?: string/, 'SimpleTweetBlock should support the localized reply context line');
assert.match(articleModelSource, /replyToHandle\?: string/, 'SimpleTweetBlock should support the reply-to line for text tweets');
assert.match(articleModelSource, /translationSourceText\?: string/, 'SimpleTweetBlock should support the translated-from line');
assert.match(articleModelSource, /translationActionText\?: string/, 'SimpleTweetBlock should support the localized show-original action text');

assert.match(
  articleModelSource,
  /export type SimpleTweetTextItem = \{[\s\S]*?type:\s*'text';[\s\S]*?text: string;/,
  'SimpleTweet content flow should represent text-only tweets as text items'
);
assert.match(
  articleModelSource,
  /items: SimpleTweetContentItem\[\]/,
  'SimpleTweet card data should expose ordered content items'
);

assert.match(
  extractorSource,
  /simpleTweetModel\.extractSimpleTweetBlockFromRoot\(block, id, capturedVideos\)/,
  'article extractor should delegate simpleTweet parsing to the dedicated model extractor'
);
assertTextExtractorContract(simpleTweetSource, 'dedicated simpleTweet model extractor');
assertTextExtractorContract(mirroredExtractorSource, 'mirrored content extractor');

assert.match(
  readerRendererSource,
  /case 'text':\s*return renderExpandableSimpleTweetText\(item\.text, item\.annotations\);/,
  'reader should render text-only simpleTweets through ordered text items'
);
assert.match(
  readerRendererSource,
  /block\.authorBadgeAvatarUrl[\s\S]*reader-simple-tweet-author-badge/,
  'reader should render the optional square source/avatar badge only when present'
);
assert.match(
  readerRendererSource,
  /reader-simple-tweet-reply-context[\s\S]*block\.replyContextText/,
  'reader should render the localized reply context line from extracted data'
);
assert.match(
  readerRendererSource,
  /block\.translationSourceText[\s\S]*reader-simple-tweet-translation/,
  'reader should render the translated-from line from extracted data'
);
assert.match(
  readerRendererSource,
  /block\.translationActionText \?\? 'Show original'/,
  'reader should render the localized show-original action when extracted'
);
assert.match(
  readerRendererSource,
  /renderExpandableSimpleTweetText\(block\.excerpt \|\| block\.title\)/,
  'text-only simpleTweet should render tweetText through the same expandable text path'
);
assert.match(
  readerCss,
  /\.reader-simple-tweet-author-badge/,
  'reader CSS should style the optional square source/avatar badge'
);
assert.match(
  readerCss,
  /\.reader-simple-tweet-translation/,
  'reader CSS should style the translated-from line'
);
assert.match(
  readerCss,
  /\.reader-simple-tweet-frame\s*\{[\s\S]*?display: grid;[\s\S]*?grid-template-columns: 48px minmax\(0, 1fr\);/,
  'reader CSS should use the original-style left avatar plus right content layout'
);
assert.match(
  readerCss,
  /\.reader-simple-tweet-content-column\s*\{[\s\S]*?grid-column: 2;[\s\S]*?display: flex;[\s\S]*?flex-direction: column;/,
  'reader CSS should stack author, reply, translation, body, and actions in one right-side column'
);
assert.equal(
  packageJson.scripts['verify:x-simpletweet-text'],
  'npm run build && node scripts/verify-x-simpletweet-text.mjs',
  'package.json should expose the simpleTweet text verification command'
);

console.log('B46-B52 simpleTweet text verification passed.');

function assertTextExtractorContract(source, label) {
  assert.match(
    source,
    /extractSimpleTweetBlockFromRoot/,
    `${label} should expose the shared simpleTweet extraction entry point`
  );
  assert.match(
    source,
    /const richText = await (?:simpleTweetModel\.)?extractTweetBodyRichText\(tweet\);[\s\S]*?(?:candidates\.set\(textElement, \{|items: body[\s\S]*?\[[\s\S]*?\{)[\s\S]*?type: 'text',[\s\S]*?text(?:: body)?,[\s\S]*?annotations: richText\.annotations/,
    `${label} should emit tweetText as an ordered rich text item`
  );
  assert.match(
    source,
    /emojiImageUrl/,
    `${label} should preserve inline X emoji metadata from tweetText`
  );
  assert.match(
    source,
    /authorBadgeAvatarUrl: extractTweetAuthorBadgeAvatarUrl\(tweet\)/,
    `${label} should dynamically extract the optional square source/avatar badge`
  );
  assert.match(
    source,
    /\.\.\.\(tweet\.querySelector\('\[data-testid="icon-verified"\], \[aria-label="Verified account"\]'\) \? \{ authorVerified: true \} : \{\}\)/,
    `${label} should dynamically detect the optional verified badge`
  );
  assert.match(
    source,
    /replyContextText: extractTweetReplyContextText\(tweet\)/,
    `${label} should dynamically extract the localized reply context line`
  );
  assert.match(
    source,
    /replyToHandle: extractTweetReplyToHandle\(tweet\)/,
    `${label} should dynamically extract the reply-to handle`
  );
  assert.match(
    source,
    /translationSourceText: extractTweetTranslationSourceText\(tweet\)/,
    `${label} should dynamically extract the translated-from line`
  );
  assert.match(
    source,
    /translationActionText: extractTweetTranslationActionText\(tweet\)/,
    `${label} should dynamically extract the localized show-original action text`
  );
}

function readReaderCss() {
  const publicDir = resolve(rootDir, 'public');
  const stylesDir = resolve(publicDir, 'styles');
  return [
    readFileSync(resolve(publicDir, 'reader.css'), 'utf8'),
    ...readdirSync(stylesDir)
      .filter((fileName) => fileName.endsWith('.css'))
      .sort()
      .map((fileName) => readFileSync(resolve(stylesDir, fileName), 'utf8'))
  ].join('\n');
}

function findWorkspaceRoot(startDir) {
  let current = startDir;
  for (let depth = 0; depth < 8; depth += 1) {
    if (existsSync(resolve(current, 'assets/x-article-simpletweet-text.html'))) {
      return current;
    }

    const parent = resolve(current, '..');
    if (parent === current) {
      break;
    }

    current = parent;
  }

  throw new Error(`Unable to locate workspace assets directory from ${startDir}`);
}
