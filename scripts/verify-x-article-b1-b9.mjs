import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { createExtractorRegistry } from '../dist/content/extractor-registry.js';
import { xArticleExtractor } from '../dist/content/extractors/x/article-extractor.js';
import { X_ARTICLE_SELECTORS } from '../dist/content/extractors/x/article-selectors.js';
import { validateArticle } from '../dist/shared/article-validator.js';
import { normalizeText } from '../dist/shared/text.js';
import { getXArticleIdFromUrl, isXArticleUrl } from '../dist/shared/url.js';

const rootDir = resolve(import.meta.dirname, '..', '..');
const detailSnapshot = readFileSync(
  resolve(rootDir, 'assets/x-article-detail.html'),
  'utf8'
);
const detail2Snapshot = readFileSync(
  resolve(rootDir, 'assets/x-article-detail2.html'),
  'utf8'
);
const mainSnapshot = readFileSync(
  resolve(rootDir, 'assets/x-article-main.html'),
  'utf8'
);
const completeDomLinkBlock = `<div class="longform-unstyled-narrow" data-block="true" data-editor="2vhgc" data-offset-key="5upd3-0-0"><div data-offset-key="5upd3-0-0" class="public-DraftStyleDefault-block public-DraftStyleDefault-ltr"><div class="css-175oi2r r-1loqt21 r-1471scf r-o7ynqc r-6416eg r-1ny4l3l"><a href="https://kvcache.ai/tools/kv-cache-calculator/" dir="ltr" rel="noopener noreferrer nofollow" target="_blank" role="link" class="css-146c3p1 r-bcqeeo r-1ttztb7 r-qvutc0 r-37j5jr r-1inkyih r-rjixqe r-16dba41 r-1ddef8g r-tjvw6i r-1loqt21" style="color: rgb(15, 20, 25);"><span data-offset-key="5upd3-0-0"><span data-text="true">https://kvcache.ai/tools/kv-cache-calculator/</span></span></a></div></div></div>`;

assert.equal(isXArticleUrl('https://x.com/dotey/article/2058421725256171718'), true);
assert.equal(isXArticleUrl('https://twitter.com/dotey/article/2058421725256171718'), true);
assert.equal(isXArticleUrl('https://x.com/dotey/status/2058421725256171718'), false);
assert.equal(isXArticleUrl('https://example.com/dotey/article/2058421725256171718'), false);
assert.equal(getXArticleIdFromUrl('https://x.com/dotey/article/2058421725256171718'), '2058421725256171718');

assert.equal(normalizeText('  DeepSeek\n\t  的战略  '), 'DeepSeek 的战略');

const registry = createExtractorRegistry([xArticleExtractor]);
const match = registry.match({
  url: new URL('https://x.com/dotey/article/2058421725256171718')
});
assert.equal(match?.extractor.id, 'x.article');
assert.equal(match?.result.reason, 'x_article_url');

assert.equal(X_ARTICLE_SELECTORS.readView, '[data-testid="twitterArticleReadView"]');
assert.equal(X_ARTICLE_SELECTORS.title, '[data-testid="twitter-article-title"]');
assert.equal(X_ARTICLE_SELECTORS.longform, '[data-testid="longformRichTextComponent"]');
assert.equal(X_ARTICLE_SELECTORS.tweetBlock, '[data-testid="tweet"]');
assert.equal(X_ARTICLE_SELECTORS.tweetPhoto, '[data-testid="tweetPhoto"]');

const detailText = extractSnapshotLongformText(detailSnapshot);
const mainText = extractSnapshotLongformText(mainSnapshot);
assert.equal(detailText.hash, mainText.hash);
assert.equal(detailText.title, 'DeepSeek 的 10 万亿美元大战略【译】');
assert.ok(detailText.textLength > 8000);
assert.equal(detailText.textCount, 157);
assert.equal(detailText.unorderedListItemCount > 0, true, 'snapshot should include Draft.js unordered list items');
assert.equal(detailText.orderedListItemCount > 0, true, 'snapshot should include Draft.js ordered list items');
assert.equal(
  detailText.coverImageSrc,
  'https://pbs.twimg.com/media/HJD4tg6WcAEYzqi?format=jpg&amp;name=medium',
  'snapshot should expose the cover image before the article title'
);
assert.equal(detailText.boldSpanCount > 0, true, 'snapshot should include bold text spans');
assert.equal(detailText.simpleTweetCount > 0, true, 'snapshot should include embedded simple tweets');
assert.equal(detailText.tweetCount > 0, true, 'snapshot should include data-testid tweet source links');
assert.equal(detailText.articleCoverImageCount > 0, true, 'snapshot should include embedded X article cards');

const detail2Text = extractSnapshotLongformText(detail2Snapshot);
assert.equal(detail2Text.title, '为什么 AI 会“忘记”中间的信息');
assert.equal(
  detail2Text.coverImageSrc,
  'https://pbs.twimg.com/media/HDXifRZWgAAB29S?format=jpg&amp;name=medium',
  'detail2 should expose the cover image before the article title'
);
assert.equal(detail2Text.headingOneCount > 0, true, 'detail2 should include X article h1 content blocks');
assert.equal(detail2Text.boldSpanCount > 0, true, 'detail2 should include bold text spans');
assert.deepEqual(extractStandaloneLinkBlockFixture(completeDomLinkBlock), {
  text: 'https://kvcache.ai/tools/kv-cache-calculator/',
  href: 'https://kvcache.ai/tools/kv-cache-calculator/',
  target: '_blank'
});

const modularExtractorSource = readFileSync(
  resolve(rootDir, 'LineLens/src/content/extractors/x/article-extractor.ts'),
  'utf8'
);
const liveExtractorSource = readFileSync(resolve(rootDir, 'LineLens/src/content/index.ts'), 'utf8');
const articleModelSource = readFileSync(resolve(rootDir, 'LineLens/src/shared/article.ts'), 'utf8');
for (const source of [modularExtractorSource, liveExtractorSource]) {
  assert.match(source, /function getListKind/, 'extractor should detect Draft.js list items and preserve list kind');
  assert.match(source, /flushPendingList/, 'extractor should group consecutive list items');
  assert.match(source, /function extractCoverImage/, 'extractor should have dedicated cover extraction');
  assert.match(source, /findImageBeforeTitle/, 'cover extraction should be constrained to images before the title');
  assert.match(source, /function isHeadingBlock/, 'extractor should preserve explicit X heading tags');
  assert.match(source, /function getHeadingLevel/, 'extractor should preserve explicit X heading levels');
  assert.match(source, /function extractTextWithAnnotations/, 'extractor should preserve bold text annotations');
  assert.match(source, /fontWeight === 'bold'/, 'extractor should read inline bold styles');
  assert.doesNotMatch(source, /guessTextBlockType/, 'extractor should not infer headings from short text');
  assert.match(source, /function extractRefCardBlock/, 'extractor should parse embedded X article cards');
  assert.match(source, /data-testid="article-cover-image"/, 'extractor should target article cover cards');
  assert.match(source, /function extractLinkBlock/, 'extractor should preserve text links as clickable blocks');
  assert.match(source, /linkAnnotations/, 'extractor should preserve inline links as annotations');
  assert.match(source, /clip-path: circle/, 'extractor should include emoji spans hidden by clip-path circle');
  assert.match(source, /role="link"/, 'extractor should inspect role=link anchors');
  assert.match(source, /pendingListKind/, 'extractor should preserve ordered versus unordered lists');
  assert.match(source, /function extractTweetRefBlock/, 'extractor should parse data-testid tweet reference blocks');
  assert.match(source, /tweetBlock/, 'extractor should use the tweet data-testid selector');
  assert.doesNotMatch(source, /section\[data-block="true"\]\[contenteditable="false"\]/, 'image detection should not rely on contenteditable=false section blocks');
}
assert.match(articleModelSource, /kind\?: 'ordered' \| 'unordered'/, 'list model should include ordered/unordered kind');

const validation = validateArticle({
  id: '2058421725256171718',
  source: 'x-article',
  sourceUrl: 'https://x.com/dotey/article/2058421725256171718',
  canonicalUrl: 'https://x.com/dotey/article/2058421725256171718',
  title: detailText.title,
  extractedAt: Date.now(),
  blocks: [
    { id: 'p1', type: 'paragraph', text: detailText.firstParagraph },
    { id: 'p2', type: 'paragraph', text: detailText.secondParagraph },
    { id: 'p3', type: 'paragraph', text: detailText.thirdParagraph }
  ]
});
assert.equal(validation.valid, true, validation.reason);

const invalidValidation = validateArticle({
  id: '2058421725256171718',
  source: 'x-article',
  sourceUrl: 'https://x.com/dotey/article/2058421725256171718',
  canonicalUrl: 'https://x.com/dotey/article/2058421725256171718',
  title: '',
  extractedAt: Date.now(),
  blocks: []
});
assert.deepEqual(invalidValidation, {
  valid: false,
  reason: 'missing_title'
});

console.log('B1-B9 X Article verification passed.');

function extractSnapshotLongformText(html) {
  const title = normalizeText(decodeHtml(
    html
      .slice(html.indexOf('data-testid="twitter-article-title"'))
      .match(/<span[^>]*>(.*?)<\/span>/)?.[1] ?? ''
  ));
  const titleStart = html.indexOf('data-testid="twitter-article-title"');
  const preTitle = html.slice(0, titleStart);
  const start = html.indexOf('data-testid="longformRichTextComponent"');
  const end = html.indexOf('</main>', start);
  const longform = html.slice(start, end);
  const textItems = [...longform.matchAll(/<span[^>]*data-text="true"[^>]*>([\s\S]*?)<\/span>/g)]
    .map((match) => normalizeText(decodeHtml(match[1].replace(/<[^>]+>/g, ''))))
    .filter(Boolean);
  const text = textItems.join('\\n');
  return {
    title,
    textCount: textItems.length,
    textLength: text.length,
    hash: createHash('sha256').update(text).digest('hex'),
    unorderedListItemCount: countMatches(longform, 'public-DraftStyleDefault-unorderedListItem'),
    orderedListItemCount: countMatches(longform, 'public-DraftStyleDefault-orderedListItem'),
    coverImageSrc: preTitle.match(/data-testid="tweetPhoto"[\s\S]*?<img[^>]+src="([^"]+)"/)?.[1] ?? '',
    headingOneCount: countMatches(longform, 'longform-header-one'),
    boldSpanCount: countMatches(longform, 'font-weight: bold'),
    simpleTweetCount: countMatches(longform, 'data-testid="simpleTweet"'),
    tweetCount: countMatches(longform, 'data-testid="tweet"'),
    articleCoverImageCount: countMatches(longform, 'data-testid="article-cover-image"'),
    firstParagraph: textItems[5],
    secondParagraph: textItems[7],
    thirdParagraph: textItems[9]
  };
}

function extractStandaloneLinkBlockFixture(html) {
  const anchor = html.match(/<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/);
  const blockText = normalizeText(decodeHtml(html.replace(/<[^>]+>/g, '')));
  if (!anchor) {
    return null;
  }

  const text = normalizeText(decodeHtml(anchor[2].replace(/<[^>]+>/g, '')));
  if (!text || text !== blockText) {
    return null;
  }

  const target = anchor[0].match(/\btarget="([^"]+)"/)?.[1];
  return {
    text,
    href: decodeHtml(anchor[1]),
    ...(target ? { target } : {})
  };
}

function countMatches(value, pattern) {
  return value.split(pattern).length - 1;
}

function decodeHtml(value) {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ');
}
