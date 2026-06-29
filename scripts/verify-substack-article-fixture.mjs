import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { JSDOM } from 'jsdom';

import {
  extractConfigurableArticle,
  extractConfigurableArticleWithDiagnostics,
  waitUntilConfigurableArticleReady
} from '../dist/content/extractors/configurable/index.js';
import { resolvePlatformAdapter } from '../dist/content/adapters/index.js';
import { renderArticleShell } from '../dist/reader/block-renderer.js';
import { buildFocusUnits } from '../dist/reader/focus-unit-builder.js';

const projectRoot = resolve(import.meta.dirname, '..');
const fixtureName = 'substack-[AINews] Midjourney Medical- scan your organs like you step on a scale.html';
const fixturePath = findFixturePath(projectRoot, fixtureName);
const sourceUrl = new URL('https://substack.com/inbox/post/202529490');
const dom = installDom(readFileSync(fixturePath, 'utf8'), sourceUrl.toString());

const rootSelector = 'article.newsletter-post.post-viewer-post';
const titleSelector = 'article.newsletter-post.post-viewer-post > div:first-child a[href*="/p/"]';
const contentSelector = '.available-content .body.markup';

assert.ok(dom.window.document.querySelector(rootSelector), 'Substack fixture should expose the article root selector');
assert.ok(dom.window.document.querySelector(titleSelector), 'Substack fixture should expose the permalink title selector');
assert.ok(dom.window.document.querySelector(contentSelector), 'Substack fixture should expose the body markup content selector');

const adapter = resolvePlatformAdapter(sourceUrl);
assert.equal(adapter?.id, 'substack.article', 'Substack adapter should be registered in built-in platform adapters');

assert.deepEqual(
  await waitUntilConfigurableArticleReady(adapter, { url: sourceUrl, root: dom.window.document }),
  { ready: true },
  'Substack fixture should satisfy configurable article readiness'
);

const result = await extractConfigurableArticleWithDiagnostics(adapter, {
  url: sourceUrl,
  root: dom.window.document,
  now: () => 1782220000000
});
const article = result.article;
const counts = countBlocks(article.blocks);

assert.equal(article.source, 'substack-article');
assert.equal(article.sourceKind, 'platform');
assert.equal(article.sourceProvider, 'substack');
assert.equal(article.adapterId, 'substack.article');
assert.equal(article.platform, 'substack');
assert.equal(article.title, '[AINews] Midjourney Medical: scan your organs like you step on a scale');
assert.deepEqual(
  result.diagnostics,
  {
    adapterId: 'substack.article',
    platform: 'substack',
    fallbackBlockCount: 0,
    highRiskBlockCount: 0,
    legacyOnlyBlockCount: 0,
    replacedBlockCount: 0
  },
  'Substack configurable extraction should expose zero-fallback adapter diagnostics'
);
assert.equal(counts.paragraph, 19);
assert.equal(counts.image, 1);
assert.equal(counts.heading, 20);
assert.equal(counts.list, 23);
assert.equal(counts.quote, 1);
assert.equal(counts.embed, 1);
assert.equal(counts['simple-tweet'] ?? 0, 0);

const embed = article.blocks.find((block) => block.type === 'embed');
assert.ok(embed, 'Twitter2ToDOM should produce a generic embed block');
const embedIndex = article.blocks.indexOf(embed);
assert.equal(embedIndex, 4, 'Twitter2ToDOM should stay in its source DOM position instead of being appended');
assert.match(article.blocks[embedIndex - 1]?.type === 'paragraph' ? article.blocks[embedIndex - 1].text : '', /Overall the\s+vibe was/);
assert.match(article.blocks[embedIndex + 1]?.type === 'paragraph' ? article.blocks[embedIndex + 1].text : '', /On to the facts you\s+must know/);
assert.equal(embed.provider, 'x');
assert.equal(embed.href, 'https://x.com/iScienceLuvr/status/2067375098466869673');
assert.equal(embed.authorName, 'Tanishq Mathew Abraham, Ph.D.');
assert.equal(embed.authorHandle, '@iScienceLuvr');
assert.equal(embed.authorAvatarUrl, 'https://pbs.substack.com/profile_images/2058414948255211520/8jVMerrR_normal.jpg');
assert.match(embed.text ?? '', /This recent paper is super interesting/);
assert.equal(embed.metrics?.replies, '6 Replies');
assert.equal(embed.metrics?.reposts, '9 Reposts');
assert.equal(embed.metrics?.likes, '61 Likes');
assert.equal(embed.metrics?.views, '8.12K Views');
assert.equal(embed.media?.length, 2);
assert.equal(embed.media?.[0]?.aspectRatio, 1);
assert.equal(embed.media?.[0]?.objectFit, 'cover');

const image = article.blocks.find((block) => block.type === 'image');
assert.ok(image, 'Substack fixture should produce an image block');
assert.equal(Boolean(image.src), true, 'Substack image should preserve a usable source');
assert.equal(image.aspectRatio, 2.3002, 'Substack image dimensions should produce aspectRatio metadata');

const textBlocks = article.blocks.filter((block) => ['paragraph', 'heading', 'quote', 'list'].includes(block.type));
const annotations = textBlocks.flatMap((block) => {
  if (block.type === 'list') {
    return block.itemAnnotations?.flat() ?? [];
  }
  return block.annotations ?? [];
});
assert.equal(annotations.some((annotation) => annotation.bold), true, 'Substack text annotations should preserve bold text');
assert.equal(annotations.some((annotation) => annotation.fontStyle === 'italic'), true, 'Substack text annotations should preserve italic text');
assert.equal(annotations.some((annotation) => annotation.href), true, 'Substack text annotations should preserve links');

document.body.innerHTML = '';
const shell = renderArticleShell(article);
document.body.append(shell);
const embedElement = shell.querySelector(`[data-block-id="${embed.id}"]`);
assert.ok(embedElement, 'Reader should render the Substack embed block');
assert.equal(embedElement.classList.contains('reader-social-embed'), true, 'Reader should render Twitter2ToDOM with generic social embed class');
assert.equal(embedElement.classList.contains('reader-simple-tweet'), false, 'Reader should not render Substack Twitter2ToDOM as simple-tweet');
assert.equal(embedElement.querySelector('.reader-social-embed-avatar')?.getAttribute('src'), embed.authorAvatarUrl);
assert.equal(embedElement.querySelector('.reader-social-embed-author-name')?.textContent, embed.authorName);
assert.equal(embedElement.querySelector('.reader-social-embed-author-handle')?.textContent, embed.authorHandle);
assert.match(embedElement.querySelector('.reader-social-embed-text')?.textContent ?? '', /This recent paper is super interesting/);
assert.equal(embedElement.querySelectorAll('.reader-social-embed-media-item').length, 2);
assert.equal(embedElement.querySelector('.reader-social-embed-metrics')?.textContent?.includes('61 Likes'), true);

const focusResult = buildFocusUnits(article, shell);
const embedUnit = focusResult.units.find((unit) => unit.blockId === embed.id);
assert.equal(embedUnit?.type, 'block', 'FocusUnit should treat Substack embed as one block unit');
assert.equal(embedUnit?.blockType, 'embed', 'FocusUnit should preserve embed blockType');
assert.equal(focusResult.elements.get(embedUnit?.unitId ?? '')?.classList.contains('reader-social-embed'), true);

installDom(readFileSync(fixturePath, 'utf8'), sourceUrl.toString());
const articleFromPublicApi = await extractConfigurableArticle(adapter, {
  url: sourceUrl,
  root: globalThis.document,
  now: () => 1782220000000
});
assert.equal(articleFromPublicApi.id, article.id, 'public configurable extraction API should still return unchanged Substack Article JSON');

console.log('Substack article fixture verification passed');

function countBlocks(blocks) {
  return blocks.reduce((counts, block) => {
    counts[block.type] = (counts[block.type] ?? 0) + 1;
    return counts;
  }, {});
}

function installDom(html, url) {
  const jsdom = new JSDOM(html, { url });
  globalThis.Element = jsdom.window.Element;
  globalThis.HTMLElement = jsdom.window.HTMLElement;
  globalThis.HTMLImageElement = jsdom.window.HTMLImageElement;
  globalThis.Node = jsdom.window.Node;
  globalThis.MutationObserver = jsdom.window.MutationObserver;
  globalThis.window = jsdom.window;
  globalThis.document = jsdom.window.document;
  return jsdom;
}

function findFixturePath(startDir, name) {
  let current = startDir;
  for (let depth = 0; depth < 8; depth += 1) {
    const candidate = resolve(current, 'assets2', name);
    if (existsSync(candidate)) {
      return candidate;
    }

    const parent = resolve(current, '..');
    if (parent === current) {
      break;
    }
    current = parent;
  }

  throw new Error(`Unable to locate ${name} from ${startDir}`);
}
