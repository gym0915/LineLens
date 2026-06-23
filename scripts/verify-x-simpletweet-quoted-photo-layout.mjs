import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { JSDOM } from 'jsdom';

const projectRoot = resolve(new URL('..', import.meta.url).pathname);
const fixturePath = resolve(projectRoot, 'assets2/how i make AI videos (a beginner’s breakdown).html');

const sourceDom = new JSDOM(readFileSync(fixturePath, 'utf8'), {
  url: 'https://x.com/0xileri/article/2058611697187782908'
});
installDomGlobals(sourceDom.window);

const { extractSimpleTweetBlockFromRoot } = await import('../dist/content/extractors/x/simple-tweet.js');
const simpleTweet = await extractSimpleTweetBlockFromRoot(
  sourceDom.window.document.querySelector('[data-testid="simpleTweet"]'),
  '2058611697187782908-b2'
);

assert.equal(simpleTweet.type, 'simple-tweet');
const quotedItem = simpleTweet.items.find((item) => item.type === 'quoted-tweet');
assert.ok(quotedItem, 'fixture simpleTweet should contain a quoted role=link tweet');

const quotedPhoto = quotedItem.tweet.items.find((item) => item.type === 'photo');
const quotedText = quotedItem.tweet.items.find((item) => item.type === 'text');
assert.ok(quotedPhoto, 'quoted role=link tweet should extract its thumbnail photo');
assert.ok(quotedText, 'quoted role=link tweet should extract its text');
assert.equal(quotedPhoto.layout, 'condensed', 'quoted role=link thumbnail photo should preserve condensed layout metadata');
assert.equal(quotedPhoto.shape, 'rounded-square', 'quoted role=link thumbnail photo should preserve rounded-square shape metadata');
assert.equal(quotedText.text, 'hey 👋🏻', 'quoted role=link tweet text should include inline X emoji alt text');
assert.ok(
  quotedText.annotations?.some((annotation) => annotation.emojiImageUrl?.includes('abs.twimg.com/emoji/v2/svg/1f44b-1f3fb.svg')),
  'quoted role=link tweet text should preserve inline X emoji image metadata'
);

const renderDom = new JSDOM('<!doctype html><main></main>', {
  url: 'chrome-extension://linelens/reader.html'
});
installDomGlobals(renderDom.window);

const { renderArticleShell } = await import('../dist/reader/block-renderer.js');
const shell = renderArticleShell({
  id: '2058611697187782908',
  source: 'x-article',
  sourceUrl: 'https://x.com/0xileri/article/2058611697187782908',
  canonicalUrl: 'https://x.com/0xileri/article/2058611697187782908',
  title: 'how i make AI videos (a beginner’s breakdown)',
  extractedAt: Date.now(),
  blocks: [simpleTweet]
});

const quoted = shell.querySelector('.reader-simple-tweet-quoted');
assert.ok(quoted, 'reader should render the quoted tweet');
const condensed = quoted.querySelector('.reader-simple-tweet-condensed');
assert.ok(condensed, 'quoted photo/text tweet should render as a condensed media/text layout');
assert.ok(
  condensed.querySelector(':scope > .reader-simple-tweet-condensed-media .reader-simple-tweet-photo-grid'),
  'condensed media slot should contain the quoted photo thumbnail'
);
assert.ok(
  condensed.querySelector(':scope > .reader-simple-tweet-condensed-text [data-testid="tweetText"]')?.textContent?.includes('hey 👋🏻'),
  'condensed text slot should contain the quoted tweet text with inline emoji alt text'
);
assert.ok(
  condensed.querySelector(':scope > .reader-simple-tweet-condensed-text .reader-x-emoji')?.style.backgroundImage.includes('/emoji/v2/svg/1f44b-1f3fb.svg'),
  'condensed text slot should render inline X emoji as an emoji image span'
);

const css = readFileSync(resolve(projectRoot, 'public/styles/social-card.css'), 'utf8');
assert.match(
  css,
  /\.reader-simple-tweet-condensed-media \.reader-simple-tweet-photo-grid\s*\{[\s\S]*?width: var\(--reader-social-condensed-media-size\);[\s\S]*?min-height: var\(--reader-social-condensed-media-size\);[\s\S]*?aspect-ratio: 1 \/ 1;/,
  'condensed photo thumbnails should share the same tokenized square media sizing as video previews'
);

console.log('SimpleTweet quoted photo layout verification passed.');

function installDomGlobals(window) {
  globalThis.window = window;
  globalThis.document = window.document;
  globalThis.Element = window.Element;
  globalThis.HTMLElement = window.HTMLElement;
  globalThis.HTMLMediaElement = window.HTMLMediaElement;
  globalThis.Node = window.Node;
}
