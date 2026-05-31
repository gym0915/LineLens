import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const rootDir = resolve(import.meta.dirname, '..');
const workspaceRoot = resolve(rootDir, '..');

const articleModelSource = readFileSync(resolve(rootDir, 'src/shared/article.ts'), 'utf8');
const extractorSource = readFileSync(resolve(rootDir, 'src/content/extractors/x/article-extractor.ts'), 'utf8');
const readerRendererSource = readFileSync(resolve(rootDir, 'src/reader/block-renderer.ts'), 'utf8');
const readerCss = readFileSync(resolve(rootDir, 'public/reader.css'), 'utf8');
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
  /video\?: VideoBlock/,
  'SimpleTweetBlock should support an embedded video media contract'
);
assert.match(
  extractorSource,
  /function extractSimpleTweetVideoCard/,
  'extractor should have a dedicated simpleTweet video path'
);
assert.match(
  extractorSource,
  /extractVideoFromElement\(block, id, capturedVideos\)/,
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
  /renderVideoPlayer\(block\.video/,
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
