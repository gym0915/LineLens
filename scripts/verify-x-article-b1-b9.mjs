import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { createExtractorRegistry } from '../dist/content/extractor-registry.js';
import { xArticleExtractor } from '../dist/content/extractors/x/article-extractor.js';
import { X_ARTICLE_SELECTORS } from '../dist/content/extractors/x/article-selectors.js';
import { validateArticle } from '../dist/shared/article-validator.js';
import { normalizeText } from '../dist/shared/text.js';
import { getXArticleIdFromUrl, isXArticleUrl } from '../dist/shared/url.js';

const projectRoot = resolve(import.meta.dirname, '..');
const workspaceRoot = findWorkspaceRoot(projectRoot);
const detailSnapshot = readFileSync(
  resolve(workspaceRoot, 'assets/x-article-detail.html'),
  'utf8'
);
const detail2Snapshot = readFileSync(
  resolve(workspaceRoot, 'assets/x-article-detail2.html'),
  'utf8'
);
const statusSnapshot = readFileSync(
  resolve(workspaceRoot, 'assets/x-article-status.html'),
  'utf8'
);
const mainSnapshot = readFileSync(
  resolve(workspaceRoot, 'assets/x-article-main.html'),
  'utf8'
);
const picTweetSnapshot = readFileSync(
  resolve(workspaceRoot, 'assets/x-article-pic-tweet.html'),
  'utf8'
);
const videoGifSnapshot = readFileSync(
  resolve(workspaceRoot, 'assets/x-article-video-gif.html'),
  'utf8'
);
const codeBlockSnapshot = readFileSync(
  resolve(workspaceRoot, 'assets/x-article-codeblock.html'),
  'utf8'
);
const imageGridSnapshot = readFileSync(
  resolve(workspaceRoot, 'assets/x-article-image-grid.html'),
  'utf8'
);
const completeDomLinkBlock = `<div class="longform-unstyled-narrow" data-block="true" data-editor="2vhgc" data-offset-key="5upd3-0-0"><div data-offset-key="5upd3-0-0" class="public-DraftStyleDefault-block public-DraftStyleDefault-ltr"><div class="css-175oi2r r-1loqt21 r-1471scf r-o7ynqc r-6416eg r-1ny4l3l"><a href="https://kvcache.ai/tools/kv-cache-calculator/" dir="ltr" rel="noopener noreferrer nofollow" target="_blank" role="link" class="css-146c3p1 r-bcqeeo r-1ttztb7 r-qvutc0 r-37j5jr r-1inkyih r-rjixqe r-16dba41 r-1ddef8g r-tjvw6i r-1loqt21" style="color: rgb(15, 20, 25);"><span data-offset-key="5upd3-0-0"><span data-text="true">https://kvcache.ai/tools/kv-cache-calculator/</span></span></a></div></div></div>`;
const svgEmojiHeadingBlock = `<h2 class="longform-header-two" data-block="true" data-editor="eles4" data-offset-key="6k6fl-0-0"><div data-offset-key="6k6fl-0-0" class="public-DraftStyleDefault-block public-DraftStyleDefault-ltr"><span style="background-image: url(&quot;https://abs.twimg.com/emoji/v2/svg/1f31f.svg&quot;); background-size: 1em 1em; padding: 0.15em; background-position: center center; background-repeat: no-repeat; -webkit-text-fill-color: transparent;"><span style="clip-path: circle(0% at 50% 50%);"><span data-offset-key="6k6fl-0-0" style="font-weight: bold;"><span data-text="true">🌟</span></span></span></span><span style="background-image: url(&quot;https://abs.twimg.com/emoji/v2/svg/1f31f.svg&quot;); background-size: 1em 1em; padding: 0.15em; background-position: center center; background-repeat: no-repeat; -webkit-text-fill-color: transparent;"><span style="clip-path: circle(0% at 50% 50%);"><span data-offset-key="6k6fl-1-0" style="font-weight: bold;"><span data-text="true">🌟</span></span></span></span><span style="background-image: url(&quot;https://abs.twimg.com/emoji/v2/svg/1f31f.svg&quot;); background-size: 1em 1em; padding: 0.15em; background-position: center center; background-repeat: no-repeat; -webkit-text-fill-color: transparent;"><span style="clip-path: circle(0% at 50% 50%);"><span data-offset-key="6k6fl-2-0" style="font-weight: bold;"><span data-text="true">🌟</span></span></span></span><span style="background-image: url(&quot;https://abs.twimg.com/emoji/v2/svg/1f31f.svg&quot;); background-size: 1em 1em; padding: 0.15em; background-position: center center; background-repeat: no-repeat; -webkit-text-fill-color: transparent;"><span style="clip-path: circle(0% at 50% 50%);"><span data-offset-key="6k6fl-3-0" style="font-weight: bold;"><span data-text="true">🌟</span></span></span></span><span style="background-image: url(&quot;https://abs.twimg.com/emoji/v2/svg/1f31f.svg&quot;); background-size: 1em 1em; padding: 0.15em; background-position: center center; background-repeat: no-repeat; -webkit-text-fill-color: transparent;"><span style="clip-path: circle(0% at 50% 50%);"><span data-offset-key="6k6fl-4-0" style="font-weight: bold;"><span data-text="true">🌟</span></span></span></span></div></h2>`;

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
  videoPoster: 'https://pbs.twimg.com/amplify_video_thumb/2053916866964590592/img/3pE8XJrlgNBM7EQC.jpg',
  videoPreload: 'none',
  videoPlaysInline: true,
  videoTabIndex: '-1',
  videoAriaLabel: 'Embedded video',
  videoSourceType: 'video/mp4',
  videoStyleHasFullSize: true
});
assert.deepEqual(extractSnapshotImageGrid(imageGridSnapshot), {
  photoCount: 4,
  aspectRatio: 1.7778,
  photoSrcs: [
    'https://pbs.twimg.com/media/HJT4PuvasAAnMDP?format=jpg&name=small',
    'https://pbs.twimg.com/media/HJT4Puyb0AID_FJ?format=jpg&name=small',
    'https://pbs.twimg.com/media/HJT4PuwbgAABeir?format=jpg&name=small',
    'https://pbs.twimg.com/media/HJT4PuxbwAAsV4e?format=jpg&name=small'
  ],
  hrefs: [
    '/underwoodxie96/article/2059544500486463940/media/2059543878743797760',
    '/underwoodxie96/article/2059544500486463940/media/2059543878756454402',
    '/underwoodxie96/article/2059544500486463940/media/2059543878748045312',
    '/underwoodxie96/article/2059544500486463940/media/2059543878752256000'
  ]
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
assert.deepEqual(extractSvgEmojiHeadingFixture(svgEmojiHeadingBlock), {
  tag: 'h2',
  level: 2,
  text: '🌟🌟🌟🌟🌟',
  textCount: 5,
  emojiImageUrlCount: 5,
  emojiImageUrl: 'https://abs.twimg.com/emoji/v2/svg/1f31f.svg'
});

const modularExtractorSource = readFileSync(
  resolve(projectRoot, 'src/content/extractors/x/article-extractor.ts'),
  'utf8'
);
const articleModelSource = readFileSync(resolve(projectRoot, 'src/shared/article.ts'), 'utf8');
const readerRendererSource = readFileSync(resolve(projectRoot, 'src/reader/block-renderer.ts'), 'utf8');
const cleanTreeBlockConverterSource = readFileSync(resolve(projectRoot, 'src/content/preprocess/clean-tree-block-converter.ts'), 'utf8');
const platformFixesSource = readFileSync(resolve(projectRoot, 'src/content/preprocess/apply-platform-fixes.ts'), 'utf8');
for (const source of [modularExtractorSource]) {
  assert.match(source, /X_CANONICAL_ORIGIN/, 'extractor should use a dedicated X canonical origin constant');
  assert.match(source, /function getListKind/, 'extractor should detect Draft.js list items and preserve list kind');
  assert.match(source, /function extractHandwrittenOrderedListItem/, 'extractor should normalize handwritten ordered list markers');
  assert.match(source, /getHandwrittenOrderedListMarker/, 'extractor should detect handwritten ordered list markers');
  assert.match(source, /annotations: extracted\.annotations/, 'extractor should preserve handwritten ordered list marker annotations');
  assert.doesNotMatch(source, /slice\(marker\.length\)/, 'extractor should keep handwritten ordered list markers in item text');
  assert.doesNotMatch(source, /function shiftAnnotations/, 'extractor should not shift annotations after stripping handwritten markers');
  assert.match(source, /\[ivxlcdm\]/, 'extractor should recognize handwritten roman numeral list markers');
  assert.match(source, /[一二三四五六七八九十百千]/, 'extractor should recognize handwritten Chinese numeral list markers');
  assert.match(source, /hasNonTextContent/, 'handwritten list detection should skip media, code, tweets, and link-like rich blocks');
  assert.match(source, /flushPendingList/, 'extractor should group consecutive list items');
  assert.match(source, /function extractCoverImage/, 'extractor should have dedicated cover extraction');
  assert.match(source, /findImageBeforeTitle/, 'cover extraction should be constrained to images before the title');
  assert.match(source, /image\.closest\('a\[href\]'\)\?\.getAttribute\('href'\)/, 'cover image extraction should preserve the wrapping media href');
  assert.match(source, /function isHeadingBlock/, 'extractor should preserve explicit X heading tags');
  assert.match(source, /function getHeadingLevel/, 'extractor should preserve explicit X heading levels');
  assert.match(source, /function extractTextWithAnnotations/, 'extractor should preserve bold text annotations');
  assert.match(source, /fontWeight === 'bold'/, 'extractor should read inline bold styles');
  assert.doesNotMatch(source, /guessTextBlockType/, 'extractor should not infer headings from short text');
  assert.match(source, /function extractSimpleTweetBlock/, 'extractor should parse embedded simple tweet cards');
  assert.match(source, /data-testid="article-cover-image"/, 'extractor should target article cover cards');
  assert.match(source, /function extractLinkBlock/, 'extractor should preserve text links as clickable blocks');
  assert.match(source, /linkAnnotations/, 'extractor should preserve inline links as annotations');
  assert.match(source, /background-image/, 'extractor should include X emoji spans rendered with background-image SVGs');
  assert.match(source, /emojiImageUrl/, 'extractor should preserve emoji SVG background URLs as text annotations');
  assert.match(source, /role="link"/, 'extractor should inspect role=link anchors');
  assert.match(source, /pendingListKind/, 'extractor should preserve ordered versus unordered lists');
  assert.match(source, /function extractTweetRefBlock/, 'extractor should parse data-testid tweet reference blocks');
  assert.match(source, /function extractCodeBlock/, 'extractor should parse X markdown code blocks');
  assert.match(source, /markdown-code-block/, 'extractor should target markdown-code-block DOM');
  assert.match(source, /normalizeCodeText/, 'code block extraction should preserve line-leading indentation');
  assert.match(source, /tweetBlock/, 'extractor should use the tweet data-testid selector');
  assert.match(source, /function extractTweetSummaryBlock/, 'tweet references should build a summary without collapsing author, date, body, and metrics');
  assert.match(source, /function extractTweetBodyText/, 'tweet references should extract the tweet body without appending engagement metrics');
  assert.match(source, /tweet-text-show-more-link/, 'tweet body extraction should detect X show-more controls before reading text');
  assert.match(source, /getTweetShowMoreButtonLabel/, 'tweet show-more detection should read the localized button text');
  assert.match(source, /await expandTweetTextIfNeeded/, 'tweet extraction should await DOM expansion before reading tweetText');
  assert.match(source, /const explicitTweetText = normalizePreWrapText\(tweet\.querySelector\('\[data-testid="tweetText"\]'\)\?\.textContent \?\? ''\)/, 'simpleTweet text extraction should preserve source line breaks');
  assert.match(source, /MutationObserver/, 'tweet show-more expansion should observe the asynchronous DOM update');
  assert.match(source, /Promise\.race/, 'tweet show-more expansion should not hang if X fails to update the DOM');
  assert.doesNotMatch(source, /title: text \|\| 'X Tweet'/, 'tweet references should not collapse full tweet textContent into a single title');
  assert.match(source, /function getSimpleTweetHref/, 'simple tweets should use a dedicated href extractor');
  assert.match(source, /function extractSimpleTweetImageCard/, 'simple tweets should parse image-card tweets without article covers');
  assert.match(source, /function extractImageGalleryFromElement/, 'extractor should parse X article image grid blocks');
  assert.match(source, /function getImageGalleryLayout/, 'extractor should parse nested image gallery layouts');
  assert.match(source, /function buildImageGalleryLayoutNode/, 'image gallery layout parsing should walk component-internal DOM structure');
  assert.match(source, /function getGalleryFlexMetrics/, 'image gallery layout parsing should preserve component flex sizing');
  assert.match(source, /backgroundSize/, 'image gallery items should preserve source crop mode');
  assert.match(source, /backgroundPosition/, 'image gallery items should preserve source alignment');
  assert.match(source, /objectFit/, 'image gallery items should preserve image fit semantics');
  assert.match(source, /r-eqz5dr/, 'image gallery layout parsing should preserve X column flex direction');
  assert.match(source, /r-18u37iz/, 'image gallery layout parsing should preserve X row flex direction');
  assert.match(source, /function extractGifFromElement/, 'extractor should parse GIF media inside tweetPhoto videoPlayer');
  assert.match(source, /function extractVideoFromElement/, 'extractor should parse video media inside tweetPhoto videoPlayer');
  assert.match(source, /function getCapturedVideos/, 'extractor should ask background for captured network video groups');
  assert.match(source, /function matchCapturedVideo/, 'extractor should match DOM videos back to captured network groups');
  assert.match(source, /function chooseCapturedVideoSource/, 'extractor should choose a real playback URL from the captured group');
  assert.match(source, /data-testid="videoPlayer"/, 'GIF extraction should branch on the videoPlayer marker under tweetPhoto');
  assert.match(source, /source\[src\^="blob:"\]/, 'GIF extraction should exclude real videos that expose blob sources');
  assert.match(
    source,
    /const video = extractVideoFromElement\(block, blockId\(articleId, index\), capturedVideos\);[\s\S]*?const gif = extractGifFromElement/,
    'real videos should be extracted before GIF fallback'
  );
  assert.match(source, /type: 'video'/, 'extractor should emit dedicated video blocks');
  assert.match(source, /source\.type/, 'video extraction should preserve source type');
  assert.match(source, /video\.preload/, 'video extraction should preserve preload');
  assert.match(source, /video\.playsInline/, 'video extraction should preserve playsinline');
  assert.match(source, /video\.tabIndex/, 'video extraction should preserve tabindex');
  assert.match(source, /aria-label/, 'video extraction should preserve aria-label');
  assert.match(source, /video\.src/, 'GIF extraction should read the direct video src');
  assert.match(source, /GET_CAPTURED_X_VIDEOS/, 'video extraction should request captured videos from background');
  assert.match(source, /masterPlaylistUrl/, 'video extraction should prefer the captured master playlist when available');
  assert.match(source, /Object\.entries\(video\.videoPlaylists \?\? \{\}\)/, 'video extraction should fall back to grouped video playlists');
  assert.match(source, /Object\.entries\(video\.audioPlaylists \?\? \{\}\)/, 'video extraction should keep grouped audio playlists available for later playback');
  assert.match(source, /application\/x-mpegURL/, 'video extraction should set HLS MIME when source is m3u8');
  assert.match(source, /function isSimpleTweetCard/, 'image-card simple tweet parsing should be gated by data-testid simpleTweet');
  assert.match(source, /querySelectorAll<HTMLElement>\(X_ARTICLE_SELECTORS\.tweetPhoto\)/, 'image-card simple tweets should enumerate tweetPhoto containers');
  assert.match(source, /function getTweetPhotoBackgroundUrl/, 'image-card simple tweets should keep the lazy background-image fallback');
  assert.match(
    source,
    /const simpleTweet = await extractSimpleTweetBlock\(block, blockId\(articleId, index\), capturedVideos\);[\s\S]*?const video = extractVideoFromElement/,
    'simpleTweet cards should be resolved before standalone video blocks so embedded tweet videos stay inside the tweet card'
  );
  assert.match(
    source,
    /function extractSimpleTweetVideoCard/,
    'simple tweets should parse embedded video-card tweets without duplicating standalone video extraction logic'
  );
  assert.match(source, /function extractTweetProfile/, 'simple tweets should extract dynamic author profile fields');
  assert.match(source, /function extractTweetMetrics/, 'simple tweets should extract dynamic action metrics');
  assert.match(source, /status\/(?!.*analytics)/, 'simple tweet href extraction should prefer tweet status links over profile or analytics links');
  assert.match(source, /new URL\(href, X_CANONICAL_ORIGIN\)\.toString\(\)/, 'simple tweet href extraction should normalize relative X hrefs to absolute x.com URLs');
  assert.doesNotMatch(source, /section\[data-block="true"\]\[contenteditable="false"\]/, 'image detection should not rely on contenteditable=false section blocks');
}
assert.match(articleModelSource, /kind\?: 'ordered' \| 'unordered'/, 'list model should include ordered/unordered kind');
assert.match(cleanTreeBlockConverterSource, /function getOrderedListMarker/, 'clean-tree conversion should extract handwritten ordered-list markers');
assert.match(cleanTreeBlockConverterSource, /kind === 'ordered' && markerLength > 0 \? rawText/, 'clean-tree conversion should keep handwritten ordered-list markers in item text');
assert.doesNotMatch(platformFixesSource, /isHandwrittenOrderedListItem/, 'platform fixes should not convert handwritten ordered marker text into list blocks');
assert.doesNotMatch(platformFixesSource, /querySelectorAll\('\[data-block="true"\]'\)[\s\S]*data-linelens-list-kind', 'ordered'/, 'platform fixes should only mark real Draft.js ordered list items');
assert.match(modularExtractorSource, /legacyBlocks = await extractXArticleLegacyBlocks/, 'X article browser path should preserve legacy high-risk blocks through the Step 4 legacy boundary until clean-tree video migration is complete');
assert.match(articleModelSource, /photos\?: TweetPhoto\[\]/, 'simple tweet model should include optional photo cards');
assert.match(articleModelSource, /authorName\?: string/, 'simple tweet model should include dynamic author name');
assert.match(articleModelSource, /metrics\?: TweetMetrics/, 'simple tweet model should include dynamic action metrics');
assert.match(articleModelSource, /type: 'code'/, 'article model should include code blocks');
assert.match(articleModelSource, /GifBlock/, 'article model should include GIF blocks');
assert.match(articleModelSource, /type: 'gif'/, 'GIF model should use a dedicated block type');
assert.match(articleModelSource, /VideoBlock/, 'article model should include video blocks');
assert.match(articleModelSource, /type: 'video'/, 'video model should use a dedicated block type');
assert.match(articleModelSource, /type: 'image-gallery'/, 'article model should include image gallery blocks');
assert.match(articleModelSource, /ImageGalleryLayoutNode/, 'image gallery model should support component-internal layout nodes');
assert.match(articleModelSource, /backgroundSize\?: 'cover' \| 'contain' \| 'auto'/, 'image gallery model should preserve media crop mode');
assert.match(articleModelSource, /objectPosition\?: string/, 'image gallery model should preserve media alignment');
assert.match(articleModelSource, /sourceType\?: string/, 'video model should preserve source MIME type');
assert.match(articleModelSource, /hls\?: \{/, 'video model should preserve HLS playback metadata');
assert.match(articleModelSource, /audioPlaylistUrl\?: string/, 'video model should preserve separated audio playlist metadata');
assert.match(articleModelSource, /videoPlaylists\?: Array<\{/, 'video model should preserve grouped video rendition metadata');
assert.match(articleModelSource, /preload\?: 'auto' \| 'metadata' \| 'none' \| ''/, 'video model should preserve preload');
assert.match(articleModelSource, /playsInline\?: boolean/, 'video model should preserve playsinline');
assert.match(articleModelSource, /tabIndex\?: number/, 'video model should preserve tabindex');
assert.match(articleModelSource, /ariaLabel\?: string/, 'video model should preserve aria-label');
assert.match(articleModelSource, /backgroundColor\?: string/, 'GIF model should preserve media background color');
assert.match(readerRendererSource, /renderSimpleTweetBlock\(block\)/, 'reader should render simple tweets from the complete block data');
assert.match(readerRendererSource, /renderCodeBlock\(block\)/, 'reader should render code blocks with dynamic language');
assert.match(readerRendererSource, /renderGifBlock\(block\)/, 'reader should render GIF blocks');
assert.match(readerRendererSource, /renderImageGalleryBlock\(block\)/, 'reader should render image gallery blocks');
assert.match(readerRendererSource, /renderVideoBlock\(block\)/, 'reader should render video blocks');
assert.match(readerRendererSource, /createElement\('source'\)/, 'reader should render video sources');
assert.match(readerRendererSource, /video\.preload = block\.preload/, 'reader should preserve video preload');
assert.match(readerRendererSource, /video\.playsInline = block\.playsInline/, 'reader should preserve video playsinline');
assert.match(readerRendererSource, /video\.tabIndex = block\.tabIndex/, 'reader should preserve video tabindex');
assert.match(readerRendererSource, /setAttribute\('aria-label', block\.ariaLabel\)/, 'reader should preserve video aria-label');
assert.match(readerRendererSource, /video\.controls = true/, 'reader should enable native video controls');
assert.match(readerRendererSource, /video\.autoplay = true/, 'reader should autoplay extracted videos');
assert.match(readerRendererSource, /video\.muted = true/, 'reader should mute autoplay videos by default');
assert.match(readerRendererSource, /window\.Hls/, 'reader should access hls.js for HLS playback');
assert.match(readerRendererSource, /URL\.createObjectURL/, 'reader should support generated master playlist blob URLs');
assert.match(readerRendererSource, /cleanupRenderedMedia/, 'reader should expose media cleanup hooks');
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
    videoPoster: decodeHtml(videoTag.match(/\bposter="([^"]+)"/)?.[1] ?? ''),
    videoPreload: decodeHtml(videoTag.match(/\bpreload="([^"]+)"/)?.[1] ?? ''),
    videoPlaysInline: /\bplaysinline(?:=""|\b)/.test(videoTag),
    videoTabIndex: decodeHtml(videoTag.match(/\btabindex="([^"]+)"/)?.[1] ?? ''),
    videoAriaLabel: decodeHtml(videoTag.match(/\baria-label="([^"]+)"/)?.[1] ?? ''),
    videoSourceType: decodeHtml(video.match(/<source\b[^>]+\btype="([^"]+)"/)?.[1] ?? ''),
    videoStyleHasFullSize:
      /width:\s*100%/.test(videoTag) &&
      /height:\s*100%/.test(videoTag) &&
      /position:\s*absolute/.test(videoTag) &&
      /background-color:\s*black/.test(videoTag) &&
      /top:\s*0%/.test(videoTag) &&
      /left:\s*0%/.test(videoTag)
  };
}

function extractSnapshotImageGrid(html) {
  const paddingBottom = Number(html.match(/padding-bottom:\s*([0-9.]+)%/)?.[1] ?? 0);
  const photos = [...html.matchAll(/<a\b[^>]*href="([^"]+)"[\s\S]*?data-testid="tweetPhoto"[\s\S]*?<img[^>]+src="([^"]+)"/g)];
  return {
    photoCount: countMatches(html, 'data-testid="tweetPhoto"'),
    aspectRatio: Math.round((100 / paddingBottom) * 10000) / 10000,
    photoSrcs: photos.map((match) => decodeHtml(match[2])),
    hrefs: photos.map((match) => decodeHtml(match[1]))
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

function extractSvgEmojiHeadingFixture(html) {
  const tag = html.match(/^<([a-z0-9]+)/i)?.[1].toLowerCase();
  const level = Number(tag?.replace(/^h/i, ''));
  const textItems = [...html.matchAll(/<span[^>]*data-text="true"[^>]*>([\s\S]*?)<\/span>/g)]
    .map((match) => normalizeText(decodeHtml(match[1].replace(/<[^>]+>/g, ''))))
    .filter(Boolean);
  const emojiImageUrls = [...html.matchAll(/background-image:\s*url\(&quot;([^&]+)&quot;\)/g)].map((match) =>
    decodeHtml(match[1])
  );
  return {
    tag,
    level,
    text: textItems.join(''),
    textCount: textItems.length,
    emojiImageUrlCount: emojiImageUrls.length,
    emojiImageUrl: emojiImageUrls[0] ?? ''
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

function findWorkspaceRoot(startDir) {
  let current = startDir;
  for (let depth = 0; depth < 8; depth += 1) {
    if (existsSync(resolve(current, 'assets/x-article-detail.html'))) {
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
