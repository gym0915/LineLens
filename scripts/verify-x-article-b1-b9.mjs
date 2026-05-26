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
const statusSnapshot = readFileSync(
  resolve(rootDir, 'assets/x-article-status.html'),
  'utf8'
);
const mainSnapshot = readFileSync(
  resolve(rootDir, 'assets/x-article-main.html'),
  'utf8'
);
const picTweetSnapshot = readFileSync(
  resolve(rootDir, 'assets/x-article-pic-tweet.html'),
  'utf8'
);
const videoGifSnapshot = readFileSync(
  resolve(rootDir, 'assets/x-article-video-gif.html'),
  'utf8'
);
const codeBlockSnapshot = readFileSync(
  resolve(rootDir, 'assets/x-article-codeblock.html'),
  'utf8'
);
const completeDomLinkBlock = `<div class="longform-unstyled-narrow" data-block="true" data-editor="2vhgc" data-offset-key="5upd3-0-0"><div data-offset-key="5upd3-0-0" class="public-DraftStyleDefault-block public-DraftStyleDefault-ltr"><div class="css-175oi2r r-1loqt21 r-1471scf r-o7ynqc r-6416eg r-1ny4l3l"><a href="https://kvcache.ai/tools/kv-cache-calculator/" dir="ltr" rel="noopener noreferrer nofollow" target="_blank" role="link" class="css-146c3p1 r-bcqeeo r-1ttztb7 r-qvutc0 r-37j5jr r-1inkyih r-rjixqe r-16dba41 r-1ddef8g r-tjvw6i r-1loqt21" style="color: rgb(15, 20, 25);"><span data-offset-key="5upd3-0-0"><span data-text="true">https://kvcache.ai/tools/kv-cache-calculator/</span></span></a></div></div></div>`;

assert.equal(isXArticleUrl('https://x.com/dotey/article/2058421725256171718'), true);
assert.equal(isXArticleUrl('https://twitter.com/dotey/article/2058421725256171718'), true);
assert.equal(isXArticleUrl('https://x.com/hwwaanng/status/2056919573778292757'), true);
assert.equal(isXArticleUrl('https://example.com/dotey/article/2058421725256171718'), false);
assert.equal(getXArticleIdFromUrl('https://x.com/dotey/article/2058421725256171718'), '2058421725256171718');
assert.equal(getXArticleIdFromUrl('https://x.com/hwwaanng/status/2056919573778292757'), '2056919573778292757');

assert.equal(normalizeText('  DeepSeek\n\t  的战略  '), 'DeepSeek 的战略');

const registry = createExtractorRegistry([xArticleExtractor]);
const match = registry.match({
  url: new URL('https://x.com/dotey/article/2058421725256171718')
});
assert.equal(match?.extractor.id, 'x.article');
assert.equal(match?.result.reason, 'x_article_url');
const statusMatch = registry.match({
  url: new URL('https://x.com/hwwaanng/status/2056919573778292757')
});
assert.equal(statusMatch?.extractor.id, 'x.article');
assert.equal(statusMatch?.result.reason, 'x_article_url');

assert.equal(X_ARTICLE_SELECTORS.readView, '[data-testid="twitterArticleReadView"]');
assert.equal(X_ARTICLE_SELECTORS.title, '[data-testid="twitter-article-title"]');
assert.equal(X_ARTICLE_SELECTORS.longform, '[data-testid="longformRichTextComponent"]');
assert.equal(X_ARTICLE_SELECTORS.tweetBlock, '[data-testid="tweet"]');
assert.equal(X_ARTICLE_SELECTORS.codeBlock, '[data-testid="markdown-code-block"]');
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
const picTweetText = extractSnapshotPicTweet(picTweetSnapshot);
assert.equal(picTweetText.hasArticleCoverImage, false, 'pic tweet fixture should represent the non-article simple tweet card path');
assert.equal(picTweetText.tweetText, "Got the new Gemini UI, it's very beautiful!");
assert.equal(picTweetText.photoCount, 2, 'pic tweet fixture should expose two tweetPhoto containers');
assert.equal(
  picTweetText.photoSrcs.join(' '),
  'https://pbs.twimg.com/media/HIq4IqNbEAADZQM?format=jpg&amp;name=small https://pbs.twimg.com/media/HIq4IrAa4AAyVGC?format=jpg&amp;name=small',
  'pic tweet fixture should expose both image card sources'
);
assert.deepEqual(extractSnapshotCodeBlock(codeBlockSnapshot), {
  language: 'xml',
  classLanguage: 'xml',
  textIncludesToolView: true,
  preservesIndentedListLines: true,
  copyPath:
    'M19.5 2C20.88 2 22 3.12 22 4.5v11c0 1.21-.86 2.22-2 2.45V4.5c0-.28-.22-.5-.5-.5H6.05c.23-1.14 1.24-2 2.45-2h11zm-4 4C16.88 6 18 7.12 18 8.5v11c0 1.38-1.12 2.5-2.5 2.5h-11C3.12 22 2 20.88 2 19.5v-11C2 7.12 3.12 6 4.5 6h11zM4 19.5c0 .28.22.5.5.5h11c.28 0 .5-.22.5-.5v-11c0-.28-.22-.5-.5-.5h-11c-.28 0-.5.22-.5.5v11z'
});
assert.deepEqual(extractSnapshotVideoGif(videoGifSnapshot), {
  mediaCount: 2,
  gifSrc: 'https://video.twimg.com/tweet_video/HID76EIbYAItygh.mp4',
  gifPoster: 'https://pbs.twimg.com/tweet_video_thumb/HID76EIbYAItygh.jpg',
  gifLabel: 'GIF',
  gifPausedLabel: 'Pause',
  gifBackgroundColor: 'black',
  gifTop: '0%',
  gifLeft: '0%',
  gifTransformIncludesScale: true,
  gifAspectRatio: 1.7771,
  videoHasBlobSource: true,
  videoPoster: 'https://pbs.twimg.com/amplify_video_thumb/2053916866964590592/img/3pE8XJrlgNBM7EQC.jpg'
});

const detail2Text = extractSnapshotLongformText(detail2Snapshot);
assert.equal(detail2Text.title, '为什么 AI 会“忘记”中间的信息');
assert.equal(
  detail2Text.coverImageSrc,
  'https://pbs.twimg.com/media/HDXifRZWgAAB29S?format=jpg&amp;name=medium',
  'detail2 should expose the cover image before the article title'
);
assert.equal(detail2Text.headingOneCount > 0, true, 'detail2 should include X article h1 content blocks');
assert.equal(detail2Text.boldSpanCount > 0, true, 'detail2 should include bold text spans');
const statusText = extractSnapshotLongformText(statusSnapshot);
assert.equal(statusText.title, '为啥 Gemini 新 UI 和 ChatGPT 几乎一模一样？');
assert.equal(statusText.textLength > 200, true, 'status article snapshot should expose stable longform text');
assert.equal(statusText.blockCount >= 3, true, 'status article snapshot should expose enough Draft.js blocks');
assert.equal(
  statusText.hasReadView && statusText.hasTitle && statusText.hasRichTextView && statusText.hasLongform,
  true,
  'status article snapshot should expose the core X article DOM selectors'
);
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
const readerRendererSource = readFileSync(resolve(rootDir, 'LineLens/src/reader/block-renderer.ts'), 'utf8');
for (const source of [modularExtractorSource, liveExtractorSource]) {
  assert.match(source, /X_CANONICAL_ORIGIN/, 'extractor should use a dedicated X canonical origin constant');
  assert.match(source, /function getListKind/, 'extractor should detect Draft.js list items and preserve list kind');
  assert.match(source, /function extractHandwrittenOrderedListItem/, 'extractor should normalize handwritten ordered list markers');
  assert.match(source, /getHandwrittenOrderedListMarker/, 'extractor should strip handwritten ordered list markers from item text');
  assert.match(source, /\[ivxlcdm\]/, 'extractor should recognize handwritten roman numeral list markers');
  assert.match(source, /[一二三四五六七八九十百千]/, 'extractor should recognize handwritten Chinese numeral list markers');
  assert.match(source, /hasNonTextContent/, 'handwritten list detection should skip media, code, tweets, and link-like rich blocks');
  assert.match(source, /flushPendingList/, 'extractor should group consecutive list items');
  assert.match(source, /function extractCoverImage/, 'extractor should have dedicated cover extraction');
  assert.match(source, /findImageBeforeTitle/, 'cover extraction should be constrained to images before the title');
  assert.match(source, /function isHeadingBlock/, 'extractor should preserve explicit X heading tags');
  assert.match(source, /function getHeadingLevel/, 'extractor should preserve explicit X heading levels');
  assert.match(source, /function extractTextWithAnnotations/, 'extractor should preserve bold text annotations');
  assert.match(source, /fontWeight === 'bold'/, 'extractor should read inline bold styles');
  assert.doesNotMatch(source, /guessTextBlockType/, 'extractor should not infer headings from short text');
  assert.match(source, /function extractSimpleTweetBlock/, 'extractor should parse embedded simple tweet cards');
  assert.match(source, /data-testid="article-cover-image"/, 'extractor should target article cover cards');
  assert.match(source, /function extractLinkBlock/, 'extractor should preserve text links as clickable blocks');
  assert.match(source, /linkAnnotations/, 'extractor should preserve inline links as annotations');
  assert.match(source, /clip-path: circle/, 'extractor should include emoji spans hidden by clip-path circle');
  assert.match(source, /role="link"/, 'extractor should inspect role=link anchors');
  assert.match(source, /pendingListKind/, 'extractor should preserve ordered versus unordered lists');
  assert.match(source, /function extractTweetRefBlock/, 'extractor should parse data-testid tweet reference blocks');
  assert.match(source, /function extractCodeBlock/, 'extractor should parse X markdown code blocks');
  assert.match(source, /markdown-code-block/, 'extractor should target markdown-code-block DOM');
  assert.match(source, /normalizeCodeText/, 'code block extraction should preserve line-leading indentation');
  assert.match(source, /tweetBlock/, 'extractor should use the tweet data-testid selector');
  assert.match(source, /function extractTweetSummaryBlock/, 'tweet references should build a summary without collapsing author, date, body, and metrics');
  assert.match(source, /function extractTweetBodyText/, 'tweet references should extract the tweet body without appending engagement metrics');
  assert.doesNotMatch(source, /title: text \|\| 'X Tweet'/, 'tweet references should not collapse full tweet textContent into a single title');
  assert.match(source, /function getSimpleTweetHref/, 'simple tweets should use a dedicated href extractor');
  assert.match(source, /function extractSimpleTweetImageCard/, 'simple tweets should parse image-card tweets without article covers');
  assert.match(source, /function extractGifFromElement/, 'extractor should parse GIF media inside tweetPhoto videoPlayer');
  assert.match(source, /data-testid="videoPlayer"/, 'GIF extraction should branch on the videoPlayer marker under tweetPhoto');
  assert.match(source, /source\[src\^="blob:"\]/, 'GIF extraction should exclude real videos that expose blob sources');
  assert.match(source, /video\.src/, 'GIF extraction should read the direct video src');
  assert.match(source, /function isSimpleTweetCard/, 'image-card simple tweet parsing should be gated by data-testid simpleTweet');
  assert.match(
    source,
    /const image = extractImageFromElement\(block, blockId\(articleId, index\)\);[\s\S]*?const simpleTweet = extractSimpleTweetBlock/,
    'plain section tweetPhoto image blocks should be extracted before simpleTweet fallback'
  );
  assert.match(source, /querySelectorAll<HTMLElement>\(X_ARTICLE_SELECTORS\.tweetPhoto\)/, 'image-card simple tweets should enumerate tweetPhoto containers');
  assert.match(source, /function getTweetPhotoBackgroundUrl/, 'image-card simple tweets should keep the lazy background-image fallback');
  assert.match(source, /function extractTweetProfile/, 'simple tweets should extract dynamic author profile fields');
  assert.match(source, /function extractTweetMetrics/, 'simple tweets should extract dynamic action metrics');
  assert.match(source, /status\/(?!.*analytics)/, 'simple tweet href extraction should prefer tweet status links over profile or analytics links');
  assert.match(source, /new URL\(href, X_CANONICAL_ORIGIN\)\.toString\(\)/, 'simple tweet href extraction should normalize relative X hrefs to absolute x.com URLs');
  assert.doesNotMatch(source, /section\[data-block="true"\]\[contenteditable="false"\]/, 'image detection should not rely on contenteditable=false section blocks');
}
assert.match(articleModelSource, /kind\?: 'ordered' \| 'unordered'/, 'list model should include ordered/unordered kind');
assert.match(articleModelSource, /photos\?: TweetPhoto\[\]/, 'simple tweet model should include optional photo cards');
assert.match(articleModelSource, /authorName\?: string/, 'simple tweet model should include dynamic author name');
assert.match(articleModelSource, /metrics\?: TweetMetrics/, 'simple tweet model should include dynamic action metrics');
assert.match(articleModelSource, /type: 'code'/, 'article model should include code blocks');
assert.match(articleModelSource, /GifBlock/, 'article model should include GIF blocks');
assert.match(articleModelSource, /type: 'gif'/, 'GIF model should use a dedicated block type');
assert.match(articleModelSource, /backgroundColor\?: string/, 'GIF model should preserve media background color');
assert.match(readerRendererSource, /renderSimpleTweetBlock\(block\)/, 'reader should render simple tweets from the complete block data');
assert.match(readerRendererSource, /renderCodeBlock\(block\.id, block\.text, block\.language\)/, 'reader should render code blocks with dynamic language');
assert.match(readerRendererSource, /renderGifBlock\(block\)/, 'reader should render GIF blocks');
assert.match(readerRendererSource, /reader-gif-badge/, 'reader should render the GIF badge overlay');
assert.match(readerRendererSource, /reader-gif-pause-icon/, 'reader should render the GIF pause overlay icon');
assert.match(readerRendererSource, /renderSimpleTweetPhotoGrid/, 'reader should render simple tweet image cards as a photo grid');
assert.match(readerRendererSource, /renderSimpleTweetAvatar\(block\)/, 'reader should use dynamic avatar data');
assert.match(readerRendererSource, /renderSimpleTweetActions\(block\.metrics\)/, 'reader should use dynamic action metrics');
assert.match(readerRendererSource, /createElement\('a'\)/, 'reader should render linked simple tweets as anchors');

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
    hasReadView: html.includes('data-testid="twitterArticleReadView"'),
    hasTitle: html.includes('data-testid="twitter-article-title"'),
    hasRichTextView: html.includes('data-testid="twitterArticleRichTextView"'),
    hasLongform: html.includes('data-testid="longformRichTextComponent"'),
    blockCount: countMatches(longform, 'data-block="true"'),
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

function extractSnapshotPicTweet(html) {
  const tweetText = normalizeText(decodeHtml(
    html
      .slice(html.indexOf('data-testid="tweetText"'))
      .match(/<span[^>]*>([\s\S]*?)<\/span>/)?.[1] ?? ''
  ));
  const photos = [...html.matchAll(/data-testid="tweetPhoto"[\s\S]*?<img[^>]+src="([^"]+)"/g)];
  return {
    hasArticleCoverImage: html.includes('data-testid="article-cover-image"'),
    tweetText,
    photoCount: countMatches(html, 'data-testid="tweetPhoto"'),
    photoSrcs: photos.map((match) => match[1])
  };
}

function extractSnapshotCodeBlock(html) {
  const language = normalizeText(decodeHtml(html.match(/data-testid="markdown-code-block"[\s\S]*?<span[^>]*>(.*?)<\/span>/)?.[1] ?? ''));
  const classLanguage = html.match(/class="language-([^"]+)"/)?.[1] ?? '';
  const codeText = decodeHtml(html.match(/<code[^>]*>([\s\S]*?)<\/code>/)?.[1]?.replace(/<[^>]+>/g, '') ?? '');
  const copyPath = html.match(/<path d="([^"]+)"/)?.[1] ?? '';
  return {
    language,
    classLanguage,
    textIncludesToolView: codeText.includes('<tool_view>') && codeText.includes('</tool_view>'),
    preservesIndentedListLines: codeText.includes('\n  - shell.exec') && codeText.includes('\n  - file.read'),
    copyPath
  };
}

function extractSnapshotVideoGif(html) {
  const gifSection = html.slice(html.indexOf('GIF'), html.indexOf('VIDEO'));
  const videoSection = html.slice(html.indexOf('VIDEO'));
  const media = [...html.matchAll(/data-testid="videoPlayer"/g)];
  const gif = gifSection;
  const video = videoSection;
  const gifVideo = gif.match(/<video\b([^>]*)>/)?.[1] ?? '';
  const videoTag = video.match(/<video\b([^>]*)>/)?.[1] ?? '';
  const gifStyle = gifVideo.match(/\bstyle="([\s\S]*?)"/)?.[1] ?? '';
  const paddingBottom = Number(gif.match(/padding-bottom:\s*([0-9.]+)%/)?.[1] ?? 0);

  return {
    mediaCount: media.length,
    gifSrc: decodeHtml(gifVideo.match(/\bsrc="([^"]+)"/)?.[1] ?? ''),
    gifPoster: decodeHtml(gifVideo.match(/\bposter="([^"]+)"/)?.[1] ?? ''),
    gifLabel: gif.includes('>GIF</span') ? 'GIF' : '',
    gifPausedLabel: decodeHtml(gif.match(/<button[^>]+\baria-label="([^"]+)"/)?.[1] ?? ''),
    gifBackgroundColor: gifStyle.match(/background-color:\s*([^;]+)/)?.[1]?.trim() ?? '',
    gifTop: gifStyle.match(/top:\s*([^;]+)/)?.[1]?.trim() ?? '',
    gifLeft: gifStyle.match(/left:\s*([^;]+)/)?.[1]?.trim() ?? '',
    gifTransformIncludesScale: /transform:[\s\S]*scale\(/.test(gifStyle),
    gifAspectRatio: Math.round((100 / paddingBottom) * 10000) / 10000,
    videoHasBlobSource: /<source\b[^>]+\bsrc="blob:/.test(video),
    videoPoster: decodeHtml(videoTag.match(/\bposter="([^"]+)"/)?.[1] ?? '')
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
