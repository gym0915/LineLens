import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const projectRoot = resolve(new URL('..', import.meta.url).pathname);
const assetRoot = findAssetRoot(projectRoot);

const sourceFiles = {
  article: readFileSync(resolve(projectRoot, 'src/content/extractors/x/article-extractor.ts'), 'utf8'),
  articleMetadata: readFileSync(resolve(projectRoot, 'src/content/extractors/x/article-metadata.ts'), 'utf8'),
  simpleTweet: readFileSync(resolve(projectRoot, 'src/content/extractors/x/simple-tweet.ts'), 'utf8'),
  simpleTweetCleanTree: readFileSync(resolve(projectRoot, 'src/content/extractors/x/simple-tweet-clean-tree-converter.ts'), 'utf8'),
  simpleTweetHandler: readFileSync(resolve(projectRoot, 'src/content/extractors/x/simple-tweet-handler.ts'), 'utf8'),
  builtInHandlers: readFileSync(resolve(projectRoot, 'src/content/extractors/configurable/register-built-in-special-handlers.ts'), 'utf8'),
  cleanTree: readFileSync(resolve(projectRoot, 'src/content/preprocess/clean-tree-block-converter.ts'), 'utf8'),
  platformFixes: readFileSync(resolve(projectRoot, 'src/content/preprocess/apply-platform-fixes.ts'), 'utf8'),
  cloneTree: readFileSync(resolve(projectRoot, 'src/content/preprocess/clone-content-tree.ts'), 'utf8'),
  adapterTypes: readFileSync(resolve(projectRoot, 'src/content/adapters/adapter-types.ts'), 'utf8'),
  xAdapter: readFileSync(resolve(projectRoot, 'src/content/adapters/x-article-adapter.ts'), 'utf8'),
  renderer: [
    readFileSync(resolve(projectRoot, 'src/reader/block-renderer.ts'), 'utf8'),
    readFileSync(resolve(projectRoot, 'src/reader/renderers/article-header-renderer.ts'), 'utf8'),
    readFileSync(resolve(projectRoot, 'src/reader/renderers/simple-tweet-renderer.ts'), 'utf8'),
    readFileSync(resolve(projectRoot, 'src/reader/renderers/icons.ts'), 'utf8'),
    readFileSync(resolve(projectRoot, 'src/reader/renderers/video-renderer.ts'), 'utf8'),
    readFileSync(resolve(projectRoot, 'src/reader/renderers/media-frame.ts'), 'utf8')
  ].join('\n'),
  comparator: readFileSync(resolve(projectRoot, 'src/content/preprocess/clean-tree-main-path.ts'), 'utf8'),
  types: readFileSync(resolve(projectRoot, 'src/shared/article.ts'), 'utf8'),
  tokensCss: readFileSync(resolve(projectRoot, 'public/styles/tokens.css'), 'utf8'),
  layoutCss: readFileSync(resolve(projectRoot, 'public/styles/layout.css'), 'utf8'),
  css: readFileSync(resolve(projectRoot, 'public/styles/social-card.css'), 'utf8'),
  responsiveCss: readFileSync(resolve(projectRoot, 'public/styles/responsive.css'), 'utf8')
};

const articleFixture = readFileSync(resolve(assetRoot, 'assets2/我们还要被“AI智障客服”折磨多久？.html'), 'utf8');
const quotedTweetFixture = readFileSync(resolve(assetRoot, 'assets/x-article-simpletweet-tweet.html'), 'utf8');

assert.match(sourceFiles.types, /type:\s*'quoted-tweet'/, 'simpleTweet types should define quoted-tweet items');
assert.match(sourceFiles.types, /type:\s*'video-preview'/, 'simpleTweet types should define video-preview items');
assert.match(sourceFiles.types, /export type Article = \{[\s\S]*?authorName\?:\s*string[\s\S]*?metrics\?:\s*TweetMetrics/, 'article model should preserve header author and interaction metadata');
assert.match(sourceFiles.types, /aiGeneratedText\?:\s*string/, 'simpleTweet card data should preserve the AI-generated badge text');
assert.match(sourceFiles.types, /type:\s*'article-cover'[\s\S]*authorName\?:\s*string[\s\S]*metrics\?:\s*TweetMetrics/, 'article-cover items should preserve author and interaction metadata');
assert.match(sourceFiles.types, /type:\s*'article-cover'[\s\S]*sourceLabel\?:\s*string[\s\S]*sourceColor\?:\s*string[\s\S]*titleTextStyle\?:\s*TextStyle[\s\S]*excerptTextStyle\?:\s*TextStyle/, 'article-cover items should preserve source badge and text style metadata');
assert.match(sourceFiles.types, /type:\s*'article-cover'[\s\S]*aspectRatio\?:\s*number/, 'article-cover items should preserve the source cover aspect ratio');
assert.match(sourceFiles.types, /layout\?:\s*'condensed'/, 'video-preview items should expose condensed layout parsed from DOM');
assert.match(sourceFiles.types, /shape\?:\s*'rounded-square'/, 'video-preview items should expose rounded-square shape parsed from DOM');
assert.match(sourceFiles.types, /export type SimpleTweetPhotoLayout =[\s\S]*kind:\s*'row' \| 'column'/, 'photo-group should expose a layout tree instead of only a flat photo array');
assert.match(sourceFiles.types, /widthRatio\?:\s*number/, 'photo layout nodes should preserve DOM-derived width ratios');
assert.match(sourceFiles.types, /heightRatio\?:\s*number/, 'photo layout nodes should preserve DOM-derived height ratios');
assert.match(sourceFiles.types, /aspectRatio\?:\s*number/, 'photo-group should preserve the source media container aspect ratio');
assert.match(sourceFiles.article, /extractSimpleTweetBlockFromRoot/, 'article extractor should route simpleTweet parsing through the content-flow helper');
assert.match(sourceFiles.simpleTweet, /getSimpleTweetPhotoLayoutRoot/, 'simpleTweet extractor should derive photo grouping from shared wrapper containers');
assert.match(sourceFiles.simpleTweet, /extractArticleCoverSourceBadge/, 'simpleTweet extractor should detect the X Article badge from the source cover DOM');
assert.match(sourceFiles.simpleTweet, /\[role="img"\]\[aria-label\]/, 'simpleTweet extractor should use the source badge role and aria-label as the Article signal');
assert.match(sourceFiles.simpleTweet, /sourceIconPath[\s\S]*svg path/, 'simpleTweet extractor should preserve the X logo svg path from the Article badge');
assert.match(sourceFiles.simpleTweet, /sourceColor = getStyleValue\(badge\.closest\('div\[dir="ltr"\]'\) \?\? badge, 'color'\)/, 'simpleTweet extractor should preserve the X Article badge source color');
assert.match(sourceFiles.simpleTweet, /titleTextStyle:\s*extractElementTextStyle\(titleElement\)/, 'simpleTweet extractor should preserve article-cover title text style');
assert.match(sourceFiles.simpleTweet, /excerptTextStyle:\s*extractElementTextStyle\(excerptElement\)/, 'simpleTweet extractor should preserve article-cover excerpt text style');
assert.match(sourceFiles.simpleTweet, /getArticleCoverAspectRatio/, 'simpleTweet extractor should derive the article-cover image aspect ratio from source DOM');
assert.match(sourceFiles.article, /extractXArticleMetadata/, 'article extractor should delegate title-area author and interaction metadata extraction');
assert.match(sourceFiles.articleMetadata, /findHeaderElementAfterTitle\(readView, longform, '\[itemprop="author"\]'/, 'article metadata extraction should use the title-to-longform boundary');
assert.match(sourceFiles.cleanTree, /getSpecialComponentHandler/, 'generic clean-tree converter should hand off special component parsing through handlerId');
assert.doesNotMatch(sourceFiles.cleanTree, /simple-tweet-clean-tree-converter\.js/, 'generic clean-tree converter should not import the X simpleTweet converter directly');
assert.match(sourceFiles.simpleTweetHandler, /handlerId:\s*'x\.simple-tweet'/, 'X simpleTweet handler should own the x.simple-tweet handlerId');
assert.match(sourceFiles.simpleTweetHandler, /convertSimpleTweetElement/, 'X simpleTweet handler should call the clean-tree simpleTweet converter explicitly');
assert.match(sourceFiles.builtInHandlers, /registerXSimpleTweetHandler/, 'built-in handler registry should register X simpleTweet handling');
assert.doesNotMatch(sourceFiles.cleanTree, /extractSimpleTweetItemsFromCleanTree|extractTweetAiGeneratedText|extractArticleCoverAuthorProfile|extractMetricsFromGroup|isCondensedPreview|getSimpleTweetPhotoLayoutRoot|getSimpleTweetMediaLayoutDirection/, 'generic clean-tree converter should not contain X-only simpleTweet parsing helpers');
assert.match(sourceFiles.simpleTweetCleanTree, /extractSimpleTweetBlockFromCleanTreeRoot/, 'X clean-tree converter should route clean-tree simpleTweet blocks into the X parser');
assert.match(sourceFiles.simpleTweetCleanTree, /isSimpleTweetCard/, 'X clean-tree converter should own simpleTweet root detection');
assert.match(sourceFiles.simpleTweet, /extractSimpleTweetItemsFromCleanTree/, 'X simpleTweet module should emit ordered clean-tree simpleTweet items');
assert.match(sourceFiles.simpleTweet, /extractTweetAiGeneratedText/, 'X simpleTweet module should extract the AI-generated badge text from tweet DOM');
assert.match(sourceFiles.simpleTweet, /extractArticleCoverAuthorProfile/, 'X simpleTweet module should extract article-cover author metadata from the card DOM');
assert.match(sourceFiles.simpleTweet, /extractMetricsFromGroup/, 'X simpleTweet module should extract article-cover interaction metrics from the card DOM');
assert.match(sourceFiles.simpleTweet, /text === '由 AI 生成' \|\| text === 'Made by AI' \|\| text === 'Generated by AI'/, 'X simpleTweet module should recognize the AI-generated footer text variants');
assert.match(sourceFiles.simpleTweet, /\[data-testid="simpleTweet"\], \[data-testid="tweet"\], \[role="link"\]/, 'X simpleTweet module should detect role=link quoted tweets');
assert.match(sourceFiles.simpleTweet, /isCondensedPreview/, 'X simpleTweet module should parse condensed video-preview layout');
assert.match(sourceFiles.simpleTweet, /getSimpleTweetPhotoLayoutRoot/, 'X simpleTweet module should derive photo grouping from shared wrapper containers');
assert.match(sourceFiles.simpleTweet, /mediaBranches\.length > 1/, 'X simpleTweet module should recognize multi-branch media wrappers as one group');
assert.match(sourceFiles.simpleTweet, /let layoutRoot: Element \| null = null;[\s\S]*layoutRoot = current;[\s\S]*return layoutRoot/, 'X simpleTweet module should choose the outermost media layout root');
assert.match(sourceFiles.simpleTweet, /getSimpleTweetMediaLayoutDirection/, 'X simpleTweet module should use preserved X row/column metadata for photo layout trees');
assert.match(sourceFiles.platformFixes, /preserveXMediaLayoutMetadata/, 'platform fixes should preserve X media layout metadata before sanitizing');
assert.match(sourceFiles.cloneTree, /data-linelens-media-layout-direction/, 'clean tree should preserve media layout direction attributes');
assert.match(sourceFiles.cloneTree, /data-linelens-media-layout-width/, 'clean tree should preserve media branch width ratio attributes');
assert.match(sourceFiles.cloneTree, /data-linelens-media-layout-height/, 'clean tree should preserve media branch height ratio attributes');
assert.match(sourceFiles.cloneTree, /data-linelens-media-aspect-ratio/, 'clean tree should preserve media aspect ratio attributes');
assert.match(sourceFiles.adapterTypes, /'preserve-x-media-layout'/, 'adapter fix ids should include media layout preservation');
assert.match(sourceFiles.xAdapter, /'preserve-x-media-layout'/, 'X article adapter should enable media layout preservation');
assert.match(sourceFiles.renderer, /case 'quoted-tweet'/, 'reader should render quoted tweet items');
assert.match(sourceFiles.renderer, /renderSimpleTweetVideoPreview/, 'reader should render video preview items');
assert.match(sourceFiles.renderer, /renderArticleHeaderAuthorMeta/, 'reader should render article header author metadata under the title');
assert.match(sourceFiles.renderer, /renderArticleHeaderMetrics/, 'reader should render article header interaction metrics under the title');
assert.match(sourceFiles.renderer, /renderSimpleTweetAiGeneratedBadge/, 'reader should render the AI-generated badge row above actions');
assert.match(sourceFiles.renderer, /renderSimpleTweetArticleCoverAuthorMeta/, 'reader should render article-cover author metadata under the title');
assert.match(sourceFiles.renderer, /renderSimpleTweetArticleCoverMetrics/, 'reader should render article-cover interaction metrics under the title');
assert.match(sourceFiles.renderer, /renderXLogoIcon\(item\.sourceIconPath\)/, 'reader should render the extracted X Article svg path when present');
assert.match(sourceFiles.renderer, /renderSourceLabelText\(item\.sourceLabel \?\? 'Article'\)/, 'reader should render the extracted Article label when present');
assert.match(sourceFiles.renderer, /--reader-simple-tweet-source-color: ' \+ item\.sourceColor/, 'reader should render X Article badge text with the extracted source color');
assert.match(sourceFiles.renderer, /applyTextStyle\(title, item\.titleTextStyle\)/, 'reader should apply extracted article-cover title text style');
assert.match(sourceFiles.renderer, /applyTextStyle\(excerpt, item\.excerptTextStyle\)/, 'reader should apply extracted article-cover excerpt text style');
assert.match(sourceFiles.renderer, /applyMediaAspectRatio\(media, item\.aspectRatio\)/, 'reader should apply extracted article-cover image aspect ratio');
assert.match(sourceFiles.renderer, /M12\.998 1\.94c\.18 3\.015/, 'reader should embed the AI-generated badge SVG path');
assert.match(sourceFiles.renderer, /reader-simple-tweet-video-portrait/, 'reader should tag portrait simpleTweet videos for narrower in-card rendering');
assert.match(sourceFiles.renderer, /video\.defaultMuted = true;/, 'reader should default simpleTweet video elements to muted playback');
assert.match(sourceFiles.renderer, /renderCondensedSimpleTweetItems/, 'reader should render condensed quoted media/text layouts');
assert.match(sourceFiles.renderer, /renderSimpleTweetPhotoLayoutTree\(item\.layout, item\.aspectRatio\)/, 'reader should render photo-groups from the parsed layout tree');
assert.match(sourceFiles.renderer, /reader-simple-tweet-photo-layout-\$\{layout\.kind\}/, 'reader should emit row/column layout classes from the tree');
assert.match(sourceFiles.renderer, /applySimpleTweetPhotoLayoutSize/, 'reader should apply DOM-derived layout ratios to row/column children');
assert.match(sourceFiles.renderer, /element\.style\.flex = `0 0 \$\{percentage\}%`/, 'reader should convert layout ratios to flex-basis');
assert.match(sourceFiles.renderer, /reader-simple-tweet-shell-compact/, 'compact quoted media should span to the avatar column');
assert.match(sourceFiles.renderer, /reader-simple-tweet-actions-secondary/, 'reader should group bookmark and share actions tightly');
assert.match(sourceFiles.comparator, /left\.items\.length === right\.items\.length/, 'phase4 comparison should use simpleTweet items');
assert.match(sourceFiles.css, /\.reader-simple-tweet-condensed\s*\{[\s\S]*?grid-template-columns:/, 'reader CSS should define compact condensed media/text layout');
assert.match(sourceFiles.tokensCss, /--reader-social-card-compact-shell-padding:\s*6px 0 0 4px;/, 'compact shell inset token should add top-left inset for the thumbnail');
assert.match(sourceFiles.css, /\.reader-simple-tweet-frame-compact \.reader-simple-tweet-shell-compact\s*\{[\s\S]*?padding: var\(--reader-social-card-compact-shell-padding\);/, 'compact shell should use the shared inset token for the thumbnail');
assert.match(sourceFiles.tokensCss, /--reader-social-condensed-media-size:\s*84px;/, 'desktop condensed thumbnail token should keep the explicit square size');
assert.match(sourceFiles.css, /\.reader-simple-tweet-condensed-media \.reader-simple-tweet-media\s*\{[\s\S]*?width: var\(--reader-social-condensed-media-size\);[\s\S]*?min-height: var\(--reader-social-condensed-media-size\);/, 'desktop condensed thumbnail should use the shared square size token');
assert.match(sourceFiles.css, /\.reader-simple-tweet-condensed\s*\{[\s\S]*?border: 0;/, 'condensed quoted text should not receive an extra gray inner border');
assert.match(sourceFiles.css, /\.reader-simple-tweet-video-preview-rounded-square\s*\{[\s\S]*?border-radius: var\(--reader-radius-content\);/, 'condensed preview should render as a rounded square with the shared reader media radius');
assert.match(sourceFiles.tokensCss, /--reader-social-card-actions-secondary-gap:\s*4px;/, 'bookmark and share action gap token should stay tight');
assert.match(sourceFiles.css, /\.reader-simple-tweet-actions-secondary\s*\{[\s\S]*?gap: var\(--reader-social-card-actions-secondary-gap\);/, 'bookmark and share actions should use the tight shared gap token');
assert.match(sourceFiles.css, /\.reader-simple-tweet-ai-generated\s*\{[\s\S]*?display: inline-flex;/, 'reader CSS should style the AI-generated badge row');
assert.match(sourceFiles.tokensCss, /--reader-social-card-ai-generated-icon-size:\s*18px;/, 'AI-generated badge icon token should keep the expected size');
assert.match(sourceFiles.css, /\.reader-simple-tweet-ai-generated-icon\s*\{[\s\S]*?width: var\(--reader-social-card-ai-generated-icon-size\);/, 'reader CSS should size the AI-generated badge icon through the shared token');
assert.match(sourceFiles.css, /\.reader-simple-tweet-photo-grid\s*\{[\s\S]*?border-radius: var\(--reader-radius-content\);/, 'simpleTweet photo grids should use the shared reader media radius');
assert.match(sourceFiles.css, /\.reader-simple-tweet-photo-count-2,\s*[\s\S]*?grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);/, 'two-photo groups should render as a horizontal two-column grid');
assert.match(sourceFiles.css, /\.reader-simple-tweet-photo-layout-row\s*\{[\s\S]*?flex-direction: row;/, 'photo layout trees should render row branches');
assert.match(sourceFiles.css, /\.reader-simple-tweet-photo-layout-column\s*\{[\s\S]*?flex-direction: column;/, 'photo layout trees should render column branches');
assert.match(sourceFiles.css, /\.reader-simple-tweet-photo-branch > \.reader-simple-tweet-photo-layout\s*\{[\s\S]*?width: 100%;[\s\S]*?height: 100%;/, 'nested photo layout branches should fill their allocated media tile');
assert.match(sourceFiles.css, /\.reader-simple-tweet-photo-layout \.reader-simple-tweet-photo\s*\{[\s\S]*?width: 100%;[\s\S]*?height: 100%;/, 'photo layout cells should fill row/column branches');
assert.match(sourceFiles.css, /\.reader-simple-tweet-photo \.reader-media-background\s*\{[\s\S]*?opacity: 1;/, 'tweetPhoto should use the shared background layer for X-style centered cover cropping');
assert.match(sourceFiles.css, /\.reader-simple-tweet-photo \.reader-media-frame\s*\{[\s\S]*?width: 100%;[\s\S]*?height: 100%;/, 'tweetPhoto shared media frame should fill the allocated tile');
assert.match(sourceFiles.css, /\.reader-simple-tweet-photo-image\s*\{[\s\S]*?object-fit: cover;/, 'photo layout tree cells should fill the source media tiles');
assert.match(sourceFiles.css, /\.reader-simple-tweet-photo-image\s*\{[\s\S]*?max-width: none;[\s\S]*?max-height: none;[\s\S]*?object-position: center center;/, 'photo layout tree images should crop from the visual center');
assert.match(sourceFiles.css, /\.reader-simple-tweet \.reader-video-media\s*\{[\s\S]*?border-radius: var\(--reader-radius-content\);/, 'simpleTweet videos should use the shared reader media radius');
assert.match(sourceFiles.tokensCss, /--reader-social-article-meta-author-margin-top:\s*10px;/, 'article-cover author metadata margin token should keep the expected title spacing');
assert.match(sourceFiles.css, /\.reader-simple-tweet-article-meta-author\s*\{[\s\S]*?margin-top: var\(--reader-social-article-meta-author-margin-top\);/, 'article-cover author metadata should sit under the title block through the shared token');
assert.match(sourceFiles.css, /\.reader-simple-tweet-media\s*\{[\s\S]*?aspect-ratio:\s*var\(--reader-media-aspect-ratio, 5 \/ 2\);/, 'simpleTweet media should use extracted source aspect ratio with the existing fallback');
assert.match(sourceFiles.css, /\.reader-simple-tweet-source\s*\{[\s\S]*?color:\s*var\(--reader-simple-tweet-source-color,/, 'simpleTweet source badge should read the extracted source color variable');
assert.match(sourceFiles.css, /\.reader-simple-tweet-article-meta-metrics\s*\{[\s\S]*?border-top: 1px solid/, 'article-cover interaction metrics should render as a separate clickable row');
assert.match(sourceFiles.tokensCss, /--reader-social-card-video-portrait-max-width:\s*360px;/, 'portrait simpleTweet max-width token should keep the narrower in-card width');
assert.match(sourceFiles.css, /\.reader-simple-tweet-video-portrait\s*\{[\s\S]*?width: min\(100%, var\(--reader-social-card-video-portrait-max-width\)\);/, 'reader CSS should constrain portrait simpleTweet videos through the shared token');
assert.match(sourceFiles.css, /\.reader-simple-tweet-video-portrait\s*\{[\s\S]*?margin-left: 0;[\s\S]*?margin-right: auto;/, 'portrait simpleTweet videos should stay left-aligned instead of centered');
assert.match(sourceFiles.css, /\.reader-simple-tweet-shell\s*\{[\s\S]*?border: 0;/, 'outer simpleTweet shell should not add an extra inner border');
assert.match(sourceFiles.tokensCss, /--reader-meta-author-margin-bottom:\s*18px;/, 'article author metadata margin token should keep the expected title spacing');
assert.match(sourceFiles.layoutCss, /\.article-meta-author\s*\{[\s\S]*?margin: 0 0 var\(--reader-meta-author-margin-bottom\);/, 'article author metadata should render below the title through the shared token');
assert.match(sourceFiles.layoutCss, /\.article-meta-metrics\s*\{[\s\S]*?border-bottom: 1px solid/, 'article interaction metadata should render as a separated row below the author');
assert.match(sourceFiles.responsiveCss, /\.reader-simple-tweet-content\s*\{[\s\S]*?padding: 0;/, 'mobile CSS should not restore the old inner content padding');

assert.match(articleFixture, /data-testid="simpleTweet"/, 'fixture should contain an embedded simpleTweet');
assert.match(articleFixture, /data-testid="tweetText"/, 'fixture should include tweet text');
assert.ok(
  /data-testid="previewInterstitial"|data-testid="videoPlayer"|data-testid="tweetPhoto"/.test(articleFixture),
  'fixture should include simpleTweet media candidates'
);

assert.match(quotedTweetFixture, /data-testid="videoPlayer"/, 'quoted tweet fixture should include the outer real video');
assert.match(quotedTweetFixture, /role="link"[\s\S]*data-testid="User-Name"/, 'quoted tweet fixture should include a role=link quoted card');
assert.match(quotedTweetFixture, /data-testid="testCondensedMedia"[\s\S]*data-testid="previewInterstitial"[\s\S]*data-testid="tweetText"/, 'quoted tweet fixture should include condensed preview plus text');
assert.match(quotedTweetFixture, /data-testid="testCondensedMedia"[\s\S]*padding-bottom:\s*100%/, 'quoted tweet fixture should encode a square condensed thumbnail');
console.log('SimpleTweet content-flow verification passed.');

function findAssetRoot(startDir) {
  let current = startDir;
  while (true) {
    if (
      existsSync(resolve(current, 'assets/x-article-simpletweet-tweet.html')) &&
      existsSync(resolve(current, 'assets2/我们还要被“AI智障客服”折磨多久？.html'))
    ) {
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
