import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const rootDir = resolve(import.meta.dirname, '..');
const backgroundSource = readFileSync(resolve(rootDir, 'src/background/index.ts'), 'utf8');
const extractorSource = readFileSync(resolve(rootDir, 'src/content/extractors/x/article-extractor.ts'), 'utf8');
const legacyBlocksSource = readFileSync(resolve(rootDir, 'src/content/extractors/x/article-legacy-blocks.ts'), 'utf8');
const articleModelSource = readFileSync(resolve(rootDir, 'src/shared/article.ts'), 'utf8');
const messageModelSource = readFileSync(resolve(rootDir, 'src/shared/messages.ts'), 'utf8');
const videoRendererSource = readFileSync(resolve(rootDir, 'src/reader/renderers/video-renderer.ts'), 'utf8');
const videoSourceControllerSource = readFileSync(
  resolve(rootDir, 'src/reader/renderers/video-source-controller.ts'),
  'utf8'
);
const videoPlaybackControllerSource = readFileSync(
  resolve(rootDir, 'src/reader/renderers/video-playback-controller.ts'),
  'utf8'
);
const readerRendererSource = [
  readFileSync(resolve(rootDir, 'src/reader/block-renderer.ts'), 'utf8'),
  videoRendererSource
].join('\n');
const readerAppSource = readFileSync(resolve(rootDir, 'src/reader/reader-app.ts'), 'utf8');
const readerHtml = readFileSync(resolve(rootDir, 'public/reader.html'), 'utf8');

globalThis.ImageData = class ImageData {
  constructor(data, width, height) {
    this.data = data;
    this.width = width;
    this.height = height;
  }
};

globalThis.OffscreenCanvas = class OffscreenCanvas {
  constructor(width, height) {
    this.width = width;
    this.height = height;
  }

  getContext() {
    return {
      clearRect() {},
      beginPath() {},
      roundRect() {},
      fill() {},
      fillText() {},
      getImageData: (_x, _y, width, height) =>
        new ImageData(new Uint8ClampedArray(width * height * 4), width, height),
      set fillStyle(_value) {},
      set font(_value) {},
      set textAlign(_value) {},
      set textBaseline(_value) {}
    };
  }
};

let runtimeMessageListener;
let webRequestListener;
let tabsUpdatedListener;
const webRequestFilters = [];

globalThis.chrome = {
  action: {
    disable() {
      return Promise.resolve();
    },
    enable() {
      return Promise.resolve();
    },
    setIcon() {
      return Promise.resolve();
    },
    setTitle() {
      return Promise.resolve();
    },
    onClicked: {
      addListener() {}
    }
  },
  runtime: {
    onInstalled: {
      addListener() {}
    },
    onMessage: {
      addListener(callback) {
        runtimeMessageListener = callback;
      }
    },
    sendMessage() {
      return Promise.resolve({ ok: true });
    },
    getURL(path) {
      return `chrome-extension://linelens/${path}`;
    }
  },
  storage: {
    local: {
      async set() {},
      async get() {
        return {};
      },
      async remove() {}
    }
  },
  tabs: {
    onUpdated: {
      addListener(callback) {
        tabsUpdatedListener = callback;
      }
    },
    onActivated: {
      addListener() {}
    },
    async create(details) {
      return { id: 1, url: details.url };
    },
    async get(tabId) {
      return { id: tabId };
    },
    async sendMessage() {
      return null;
    }
  },
  scripting: {
    async executeScript() {
      return [];
    }
  },
  webNavigation: {
    onHistoryStateUpdated: {
      addListener() {}
    }
  },
  webRequest: {
    onBeforeRequest: {
      addListener(callback, filter) {
        webRequestListener = callback;
        webRequestFilters.push(filter);
      }
    }
  }
};

await import('../dist/background/index.js');

assert.equal(typeof runtimeMessageListener, 'function', 'background should register runtime message listener');
assert.equal(typeof webRequestListener, 'function', 'background should register webRequest listener');
assert.equal(typeof tabsUpdatedListener, 'function', 'background should register tab update listener');
assert.deepEqual(webRequestFilters, [{ urls: ['https://video.twimg.com/*'] }]);

webRequestListener({
  tabId: 71,
  url: 'https://video.twimg.com/amplify_video/2034699363109543936/pl/avc1/480x270/EBR_YCUscfzCNNxq.m3u8'
});
webRequestListener({
  tabId: 71,
  url: 'https://video.twimg.com/amplify_video/2034699363109543936/pl/avc1/1280x720/EBR_YCUscfzCNNxq.m3u8'
});
webRequestListener({
  tabId: 71,
  url: 'https://video.twimg.com/amplify_video/2034699363109543936/pl/mp4a/32000/ULDWU_yyNq8YCGsp.m3u8'
});
webRequestListener({
  tabId: 71,
  url: 'https://video.twimg.com/amplify_video/2034699363109543936/pl/playlist.m3u8'
});
webRequestListener({
  tabId: 71,
  url: 'https://video.twimg.com/amplify_video/2053916866964590592/pl/avc1/1920x1080/Xe6H3LKwsbZRo_Mj.m3u8'
});

let capturedResponse;
runtimeMessageListener(
  { type: 'GET_CAPTURED_X_VIDEOS' },
  { tab: { id: 71 } },
  (response) => {
    capturedResponse = response;
  }
);

assert.equal(capturedResponse.videos.length, 2, 'background should keep separate groups for multiple videos in one tab');

const groupedVideo = capturedResponse.videos.find((video) => video.videoId === '2034699363109543936');
assert.ok(groupedVideo, 'background should keep the video group keyed by amplify video id');
assert.equal(groupedVideo.masterPlaylistUrl, 'https://video.twimg.com/amplify_video/2034699363109543936/pl/playlist.m3u8');
assert.equal(groupedVideo.videoPlaylists['480x270'], 'https://video.twimg.com/amplify_video/2034699363109543936/pl/avc1/480x270/EBR_YCUscfzCNNxq.m3u8');
assert.equal(groupedVideo.videoPlaylists['1280x720'], 'https://video.twimg.com/amplify_video/2034699363109543936/pl/avc1/1280x720/EBR_YCUscfzCNNxq.m3u8');
assert.equal(groupedVideo.audioPlaylists['32000'], 'https://video.twimg.com/amplify_video/2034699363109543936/pl/mp4a/32000/ULDWU_yyNq8YCGsp.m3u8');

await tabsUpdatedListener(71, { status: 'loading' }, { id: 71, url: 'https://x.com/example/article/1' });

let clearedResponse;
runtimeMessageListener(
  { type: 'GET_CAPTURED_X_VIDEOS' },
  { tab: { id: 71 } },
  (response) => {
    clearedResponse = response;
  }
);

assert.deepEqual(clearedResponse, { videos: [] }, 'tab loading should clear stale captured video groups');

assert.match(messageModelSource, /masterPlaylistUrl\?: string/, 'captured video model should store a real master playlist when observed');
assert.match(messageModelSource, /videoPlaylists\?: Record<string, string>/, 'captured video model should store grouped video renditions');
assert.match(messageModelSource, /audioPlaylists\?: Record<string, string>/, 'captured video model should store grouped audio renditions');
assert.match(articleModelSource, /hls\?: \{/, 'video block should expose HLS playback metadata');
assert.match(articleModelSource, /masterPlaylistUrl\?: string/, 'video block HLS metadata should include direct master playlist url');
assert.match(articleModelSource, /audioPlaylistUrl\?: string/, 'video block HLS metadata should include separated audio playlist url');
assert.match(articleModelSource, /videoPlaylists\?: Array<\{/, 'video block HLS metadata should include multiple video renditions');
assert.match(backgroundSource, /url\.includes\('\/pl\/mp4a\/'\)/, 'background capture should classify audio playlists separately');
assert.match(backgroundSource, /url\.includes\('\/pl\/avc1\/'\)/, 'background capture should classify video playlists separately');
assert.match(backgroundSource, /masterPlaylistUrl/, 'background capture should store real master playlists');
assert.match(extractorSource, /capturedVideos[\s\S]*extractXArticleLegacyBlocks/, 'extractor should pass captured video groups into the legacy block boundary');
assert.match(legacyBlocksSource, /function buildVideoHlsPayload/, 'legacy block extractor should build HLS payloads instead of only choosing one url');
assert.match(legacyBlocksSource, /function pickAudioPlaylist/, 'legacy block extractor should select a grouped audio playlist when master is absent');
assert.match(legacyBlocksSource, /videoPlaylists: /, 'legacy block extractor should pass grouped video renditions to reader');
assert.match(legacyBlocksSource, /audioPlaylistUrl: /, 'legacy block extractor should pass grouped audio playlist to reader');
assert.match(
  legacyBlocksSource,
  /const preferredVideo = hls\?\.videoPlaylists\?\.\[0\]\?\.url/,
  'legacy block extractor should choose the first normalized HLS video rendition as the preferred fallback source'
);
assert.match(
  legacyBlocksSource,
  /\.sort\(\(\[left\], \[right\]\) => compareResolutionLabel\(right\) - compareResolutionLabel\(left\)\)/,
  'legacy block extractor should sort video renditions by descending resolution so the preferred source is high resolution'
);
assert.match(readerHtml, /vendor\/hls\.min\.js/, 'reader should load local hls.min.js');
assert.match(videoRendererSource, /export function renderGifBlock/, 'video renderer should remain the GIF DOM render facade');
assert.match(videoRendererSource, /export function renderVideoBlock/, 'video renderer should remain the video block DOM render facade');
assert.match(videoRendererSource, /export function renderVideoPlayer/, 'video renderer should remain the shared video player DOM render facade');
assert.match(
  videoRendererSource,
  /attachVisibilityControlledPlayback\(figure, video/,
  'video renderer should wire rendered videos and GIFs into the playback controller'
);
assert.match(
  videoRendererSource,
  /attachVideoSourceController\(video, block\)/,
  'video renderer should delegate video source and HLS setup to the source controller'
);
assert.match(videoSourceControllerSource, /window\.Hls/, 'video source controller should use the global hls.js runtime');
assert.match(videoSourceControllerSource, /hls\.attachMedia\(video\)/, 'video source controller should attach HLS instances to the video element');
assert.match(videoSourceControllerSource, /hls\.loadSource\(/, 'video source controller should load HLS sources through hls.js');
assert.match(videoSourceControllerSource, /hls\.destroy\(\)/, 'video source controller should destroy HLS instances during cleanup');
assert.match(videoSourceControllerSource, /URL\.createObjectURL/, 'video source controller should generate blob master playlists when necessary');
assert.match(videoSourceControllerSource, /new Blob\(\[masterPlaylist\]/, 'video source controller should materialize a generated master playlist');
assert.match(videoSourceControllerSource, /URL\.revokeObjectURL/, 'video source controller should revoke generated blob master playlists');
assert.match(videoSourceControllerSource, /function estimateBandwidth/, 'video source controller should keep generated playlist bandwidth estimation');
assert.match(videoPlaybackControllerSource, /IntersectionObserver/, 'video playback controller should use visibility observation to lazy-load and pause media');
assert.match(videoPlaybackControllerSource, /isMostlyVisible = entry\.intersectionRatio > 0\.2/, 'video playback controller should track whether more than 20% of the media is visible');
assert.match(videoPlaybackControllerSource, /if \(!isMostlyVisible\) \{[\s\S]*?pauseForOcclusion\(\);/, 'video playback controller should pause video and GIF playback once at least 80% of the media is occluded');
assert.match(videoPlaybackControllerSource, /let hasActivated = false/, 'video playback controller should defer media source attachment until the element begins rendering in view');
assert.match(videoPlaybackControllerSource, /wasPlayingBeforeOcclusion/, 'video playback controller should remember whether media was playing before occlusion');
assert.match(
  videoPlaybackControllerSource,
  /visibilityPauseInProgress = true;[\s\S]*?video\.pause\(\);[\s\S]*?queueMicrotask\(\(\) => \{[\s\S]*?visibilityPauseInProgress = false;/,
  'visibility-driven pause should keep its guard through the async pause event so it does not overwrite the pre-occlusion playing state'
);
assert.match(videoPlaybackControllerSource, /if \(wasPlayingBeforeOcclusion\)/, 'video playback controller should only resume media that was playing before occlusion');
assert.match(videoPlaybackControllerSource, /MutationObserver/, 'video playback controller should observe highlight state changes as a playback recovery fallback');
assert.match(
  videoPlaybackControllerSource,
  /container\.closest\('\.focus-unit\.is-active'\)/,
  'highlight recovery should also work when a parent focus unit, such as simpleTweet, owns the active state'
);
assert.match(
  videoPlaybackControllerSource,
  /if \(isMostlyVisible && isHighlighted\(\)\) \{[\s\S]*?forcePlay\(\);[\s\S]*?\}/,
  'highlighting a video or GIF focus unit should only force playback while the media is still visible'
);
assert.match(readerAppSource, /disposeRenderedArticleShell|cleanupRenderedMedia|teardownRenderedArticleShell/, 'reader app should clean up rendered media lifecycles');

console.log('B31-B39 video verification passed.');
