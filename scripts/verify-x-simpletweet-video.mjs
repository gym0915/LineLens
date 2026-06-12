import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const rootDir = resolve(import.meta.dirname, '..');
const workspaceRoot = findWorkspaceRoot(rootDir);

const articleModelSource = readFileSync(resolve(rootDir, 'src/shared/article.ts'), 'utf8');
const extractorSource = readFileSync(resolve(rootDir, 'src/content/extractors/x/article-extractor.ts'), 'utf8');
const simpleTweetSource = readFileSync(resolve(rootDir, 'src/content/extractors/x/simple-tweet.ts'), 'utf8');
const readerRendererSource = readFileSync(resolve(rootDir, 'src/reader/block-renderer.ts'), 'utf8');
const readerCss = readReaderCss();
const packageJson = JSON.parse(readFileSync(resolve(rootDir, 'package.json'), 'utf8'));
const simpleTweetVideoFixture = readFileSync(
  resolve(workspaceRoot, 'assets/x-article-simpletweet-video-tweet-text.html'),
  'utf8'
);

assert.match(
  simpleTweetVideoFixture,
  /data-testid="simpleTweet"[\s\S]*data-testid="videoPlayer"/,
  'fixture should represent a simpleTweet that contains a videoPlayer'
);
assert.match(
  simpleTweetVideoFixture,
  /source[\s\S]*src="blob:https:\/\/x\.com\//,
  'fixture should represent a real X video with a blob source'
);
assert.match(
  simpleTweetVideoFixture,
  /amplify_video_thumb\/2056721555456229376/,
  'fixture should expose a stable amplify video poster id for captured-video matching'
);

assert.match(
  articleModelSource,
  /export type SimpleTweetVideoItem = \{[\s\S]*?type:\s*'video';[\s\S]*?video: VideoBlock;/,
  'SimpleTweet content flow should support an embedded video media item contract'
);
assert.match(
  articleModelSource,
  /items: SimpleTweetContentItem\[\]/,
  'SimpleTweet card data should expose ordered content items'
);
assert.match(
  simpleTweetSource,
  /function extractVideoItem\(element: Element, id: string, capturedVideos: CapturedXVideo\[\]\): SimpleTweetContentItem \| null[\s\S]*?extractVideoFromElement\(element, id, capturedVideos\)/,
  'simpleTweet video extraction should reuse the same videoPlayer extraction helper'
);
assert.match(
  extractorSource,
  /extractSimpleTweetBlock\(block, blockId\(articleId, index\), capturedVideos\)/,
  'top-level block extraction should pass captured video groups into simpleTweet extraction'
);
assert.match(
  extractorSource,
  /const simpleTweet = await extractSimpleTweetBlock[\s\S]*?const video = extractVideoFromElement/,
  'simpleTweet detection should run before standalone video extraction so embedded tweet videos stay inside the tweet card'
);
assert.match(
  readerRendererSource,
  /function renderVideoPlayer/,
  'reader should expose one reusable video player renderer'
);
assert.match(
  readerRendererSource,
  /renderVideoPlayer\(item\.video/,
  'simpleTweet rendering should call the shared video player for embedded tweet videos'
);
assert.match(
  readerRendererSource,
  /renderVideoBlock\(block: VideoBlock\)[\s\S]*renderVideoPlayer\(block/,
  'standalone video block rendering should call the same shared video player'
);
assert.match(
  readerCss,
  /\.reader-simple-tweet\.focus-unit\.is-active \.reader-video-player\s*\{[\s\S]*?filter: none;/,
  'active simpleTweet video should remove the default video desaturation filter'
);
assert.equal(
  packageJson.scripts['verify:x-simpletweet-video'],
  'npm run build && node scripts/verify-x-simpletweet-video.mjs',
  'package.json should expose the simpleTweet video verification command'
);

console.log('B40-B45 simpleTweet video verification passed.');

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
    if (existsSync(resolve(current, 'assets/x-article-simpletweet-video-tweet-text.html'))) {
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
