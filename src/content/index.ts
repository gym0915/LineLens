import { createExtractorRegistry, type RegistryMatch } from './extractor-registry.js';
import { BUILT_IN_PLATFORM_ADAPTERS } from './adapters/index.js';
import { createAdapterDrivenArticleExtractor } from './extractors/configurable/index.js';
import { xArticleExtractor } from './extractors/x/article-extractor.js';
import type { ArticleExtractor, ExtractorContext } from '../shared/extractor-types.js';
import type { ExtensionMessage } from '../shared/messages.js';

const MAX_READY_CHECKS = 40;
const READY_CHECK_INTERVAL_MS = 250;
const LOG_PREFIX = '[LineLens Content]';
const AMPLIFY_VIDEO_ID_PATTERN = /amplify_video(?:_thumb)?\/(\d+)/;

const registry = createExtractorRegistry([
  xArticleExtractor,
  createAdapterDrivenArticleExtractor(BUILT_IN_PLATFORM_ADAPTERS, {
    excludeAdapterIds: [xArticleExtractor.id]
  })
]);

let activeReadinessCleanup: (() => void) | undefined;
let activePosterCleanup: (() => void) | undefined;

void monitorArticleState();

chrome.runtime.onMessage.addListener((message: ExtensionMessage, _sender, sendResponse) => {
  if (message.type === 'EXTRACT_CURRENT_ARTICLE') {
    void extractCurrentArticle().then(sendResponse);
    return true;
  }

  if (message.type === 'LINELENS_ROUTE_CHANGED') {
    console.info(LOG_PREFIX, 'route changed; restarting article monitor', {
      url: message.url
    });
    void monitorArticleState().then(() => sendResponse({ ok: true }));
    return true;
  }
});

async function monitorArticleState(): Promise<void> {
  stopActiveReadinessMonitor();
  stopPosterMonitor();

  const match = matchCurrentExtractor();
  if (!match) {
    console.info(LOG_PREFIX, 'unsupported URL', {
      url: location.href
    });
    await sendArticleState({
      type: 'ARTICLE_NOT_READY',
      reason: 'unsupported_url'
    });
    return;
  }

  startPosterMonitor();
  await reportWhenReady(match.extractor, match.result.extractorId);
}

async function reportWhenReady(extractor: ArticleExtractor, extractorId: string): Promise<void> {
  let checks = 0;
  let lastReason = 'content_not_stable';
  console.info(LOG_PREFIX, 'monitoring article DOM readiness', {
    extractorId,
    url: location.href
  });

  const observer = new MutationObserver(() => {
    void check();
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  });

  const timer = window.setInterval(() => {
    void check();
  }, READY_CHECK_INTERVAL_MS);

  activeReadinessCleanup = cleanup;
  await check();

  async function check(): Promise<void> {
    checks += 1;
    const ready = await extractor.waitUntilReady(createExtractorContext());

    if (ready.ready) {
      cleanup();
      console.info(LOG_PREFIX, 'article ready', {
        checks,
        extractorId
      });
      await sendArticleState({
        type: 'ARTICLE_READY',
        extractorId
      });
      return;
    }

    lastReason = ready.reason;

    if (checks >= MAX_READY_CHECKS) {
      cleanup();
      console.info(LOG_PREFIX, 'article not ready after retries', {
        checks,
        reason: lastReason
      });
      await sendArticleState({
        type: 'ARTICLE_NOT_READY',
        reason: lastReason
      });
    }
  }

  function cleanup(): void {
    if (activeReadinessCleanup === cleanup) {
      activeReadinessCleanup = undefined;
    }
    observer.disconnect();
    window.clearInterval(timer);
  }
}

function stopActiveReadinessMonitor(): void {
  activeReadinessCleanup?.();
  activeReadinessCleanup = undefined;
}

function startPosterMonitor(): void {
  void publishVideoPosters();

  const observer = new MutationObserver(() => {
    void publishVideoPosters();
  });

  observer.observe(document.body ?? document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['poster']
  });

  activePosterCleanup = () => observer.disconnect();
}

function stopPosterMonitor(): void {
  activePosterCleanup?.();
  activePosterCleanup = undefined;
}

async function sendArticleState(message: ExtensionMessage): Promise<void> {
  console.info(LOG_PREFIX, 'sending article state', {
    type: message.type,
    reason: message.type === 'ARTICLE_NOT_READY' ? message.reason : undefined
  });
  await chrome.runtime.sendMessage(message).catch(() => {
    // The page can outlive the extension context during reloads.
  });
}

async function extractCurrentArticle(): Promise<ExtensionMessage> {
  console.info(LOG_PREFIX, 'extract request received', {
    url: location.href
  });

  const match = matchCurrentExtractor();
  if (!match) {
    console.info(LOG_PREFIX, 'extract failed: unsupported URL');
    return {
      type: 'ARTICLE_EXTRACT_FAILED',
      reason: 'unsupported_url'
    };
  }

  const ready = await match.extractor.waitUntilReady(createExtractorContext());
  if (!ready.ready) {
    console.info(LOG_PREFIX, 'extract failed: article not ready', {
      reason: ready.reason
    });
    return {
      type: 'ARTICLE_EXTRACT_FAILED',
      reason: ready.reason
    };
  }

  try {
    const article = await match.extractor.extract(createExtractorContext());
    console.info(LOG_PREFIX, 'extract succeeded', {
      articleId: article.id,
      title: article.title,
      blocks: article.blocks.length
    });
    return {
      type: 'ARTICLE_EXTRACTED',
      article
    };
  } catch (error) {
    console.warn(LOG_PREFIX, 'extract threw', {
      error: error instanceof Error ? error.message : String(error)
    });
    return {
      type: 'ARTICLE_EXTRACT_FAILED',
      reason: error instanceof Error ? error.message : 'extract_failed'
    };
  }
}

function matchCurrentExtractor(): RegistryMatch | null {
  return registry.match(createExtractorContext());
}

function createExtractorContext(): ExtractorContext {
  return {
    url: new URL(location.href),
    document,
    now: () => Date.now()
  };
}

async function publishVideoPosters(): Promise<void> {
  const posters = collectVideoPosters();
  if (Object.keys(posters).length === 0) {
    return;
  }

  await chrome.runtime.sendMessage({
    type: 'UPSERT_X_VIDEO_POSTERS',
    posters
  }).catch(() => {
    // ignore transient extension reloads
  });
}

function collectVideoPosters(): Record<string, string> {
  const posters: Record<string, string> = {};
  for (const video of Array.from(document.querySelectorAll<HTMLVideoElement>('video[poster]'))) {
    const poster = video.getAttribute('poster') ?? '';
    const videoId = getAmplifyVideoId(poster);
    if (videoId && poster) {
      posters[videoId] = poster;
    }
  }
  return posters;
}

function getAmplifyVideoId(value: string | null | undefined): string | undefined {
  const match = value?.match(AMPLIFY_VIDEO_ID_PATTERN);
  return match?.[1];
}
