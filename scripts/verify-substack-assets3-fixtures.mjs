import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';

import { JSDOM } from 'jsdom';

import { resolvePlatformAdapter } from '../dist/content/adapters/index.js';
import {
  extractConfigurableArticleWithDiagnostics,
  locateConfigurableArticleRoots,
  waitUntilConfigurableArticleReady
} from '../dist/content/extractors/configurable/index.js';
import { renderArticleShell } from '../dist/reader/block-renderer.js';
import { registerClickController } from '../dist/reader/controllers/click-controller.js';
import { createMediaPreviewState } from '../dist/reader/controllers/media-preview-state.js';
import { FocusEngine } from '../dist/reader/focus-engine.js';
import { buildFocusUnits } from '../dist/reader/focus-unit-builder.js';

const projectRoot = resolve(import.meta.dirname, '..');
const assets3Root = findAssets3Root(projectRoot);
const fixtures = listAssets3HtmlFixtures(assets3Root);
const sourceUrls = [
  'https://substack.com/home/post/p-199574024',
  'https://substack.com/inbox/post/203490377'
].map((url) => new URL(url));
const bodySelector = '.available-content .body.markup';
const focusCss = readFileSync(resolve(projectRoot, 'public/styles/focus.css'), 'utf8');
const overlaysCss = readFileSync(resolve(projectRoot, 'public/styles/overlays.css'), 'utf8');
const socialCardCss = readFileSync(resolve(projectRoot, 'public/styles/social-card.css'), 'utf8');
const tokensCss = readFileSync(resolve(projectRoot, 'public/styles/tokens.css'), 'utf8');
const assets3ComponentRootSelector = [
  '[data-component-name="Image2ToDOM"]',
  '[data-component-name="Youtube2ToDOM"]',
  '[data-component-name="VideoEmbedPlayer"]',
  'audio[src]',
  '[data-component-name="FootnoteToDOM"]',
  '[data-component-name="Paywall"]',
  '[data-component-name="SubscribeWidget"]'
].join(', ');
const preservedSubstackComponentAttributes = ['data-component-name', 'data-href', 'data-native'];

assert.equal(fixtures.length, 4, `assets3/html dom should expose exactly 4 HTML fixtures, found ${fixtures.length}`);

console.log(`[assets3-fixtures] assets3 root: ${assets3Root}`);
console.log(`[assets3-fixtures] HTML fixtures: ${fixtures.length}`);

const implementationFailures = [];

for (const [index, fixture] of fixtures.entries()) {
  const sourceUrl = sourceUrls[index % sourceUrls.length];
  const dom = installDom(readFileSync(fixture.path, 'utf8'), sourceUrl.toString());
  const { document } = dom.window;
  const articleCount = document.querySelectorAll('article').length;
  const bodyRoots = document.querySelectorAll(bodySelector);
  const bodyRoot = document.querySelector(bodySelector);
  const articleRoot = document.querySelector('article.newsletter-post.post-viewer-post, article.podcast-post.post-viewer-post');

  assert.ok(articleCount > 0, `${fixture.name} should contain at least one <article>`);
  assert.equal(bodyRoots.length, 1, `${fixture.name} should expose exactly one ${bodySelector} body root`);
  assert.ok(articleRoot, `${fixture.name} should contain a Substack article root`);
  assert.ok(bodyRoot, `${fixture.name} should contain ${bodySelector}`);
  assert.equal(articleRoot.contains(bodyRoot), true, `${fixture.name} article root should contain ${bodySelector}`);

  const adapter = resolvePlatformAdapter(sourceUrl);
  assert.equal(adapter?.id, 'substack.article', `${sourceUrl.toString()} should resolve to substack.article`);
  assert.equal(adapter.contentSelector, undefined, 'Substack adapter should use the article root so out-of-body assets3 components can be mapped');
  assert.equal(
    adapter.cleanRules?.removeSelectors?.includes('.paywall'),
    false,
    'Substack clean rules should preserve Paywall roots for component handlers'
  );
  for (const attributeName of preservedSubstackComponentAttributes) {
    assert.ok(
      adapter.cleanRules?.preserveAttributeNames?.includes(attributeName),
      `Substack clean rules should preserve ${attributeName} for assets3 component handlers`
    );
  }

  const roots = locateConfigurableArticleRoots(adapter, { url: sourceUrl, root: document });
  assert.equal(roots.contentRoot, articleRoot, `${fixture.name} should extract from the Substack article root`);
  assertAssets3ComponentRootsCovered(adapter, articleRoot, fixture.name);
  const sourceDividerCount = countSourceDividers(bodyRoot);

  const readiness = await waitUntilConfigurableArticleReady(adapter, { url: sourceUrl, root: document });

  console.log(
    [
      `[assets3-fixtures] ${fixture.name}`,
      `article=${articleCount}`,
      `body=true`,
      `adapterRoot=${Boolean(roots.articleRoot)}`,
      `adapterTitle=${Boolean(roots.titleElement?.textContent?.trim())}`,
      `ready=${readiness.ready ? 'true' : readiness.reason}`
    ].join(' ')
  );

  if (!readiness.ready) {
    implementationFailures.push({
      fixture: fixture.name,
      reason: readiness.reason,
      adapterRoot: Boolean(roots.articleRoot),
      adapterTitle: Boolean(roots.titleElement?.textContent?.trim()),
      contentRoot: Boolean(roots.contentRoot),
      articleClass: document.querySelector('article')?.getAttribute('class') ?? ''
    });
    continue;
  }

  try {
    const result = await extractConfigurableArticleWithDiagnostics(adapter, {
      url: sourceUrl,
      root: document,
      now: () => 1782220000000
    });
    assert.equal(result.article.adapterId, 'substack.article', `${fixture.name} should extract through substack.article`);
    assert.equal(result.article.source, 'substack-article', `${fixture.name} should keep substack article source`);
    assert.ok(result.article.title.trim().length > 0, `${fixture.name} should extract a non-empty title`);
    assert.ok(result.article.blocks.length >= 10, `${fixture.name} should extract a substantial Article block set`);
    assertStandardDividerExtraction(result.article, sourceDividerCount, fixture.name);
    assertSubstackHeaderMetadata(result.article, fixture.name);
    assertReaderRendering(result.article, fixture.name, sourceDividerCount);
  } catch (error) {
    implementationFailures.push({
      fixture: fixture.name,
      reason: error instanceof Error ? error.message : String(error),
      adapterRoot: Boolean(roots.articleRoot),
      adapterTitle: Boolean(roots.titleElement?.textContent?.trim()),
      contentRoot: Boolean(roots.contentRoot),
      articleClass: document.querySelector('article')?.getAttribute('class') ?? ''
    });
  }
}

if (implementationFailures.length > 0) {
  console.error('[assets3-fixtures] implementation contract failures:');
  for (const failure of implementationFailures) {
    console.error(
      `- ${failure.fixture}: ${failure.reason}; ` +
        `adapterRoot=${failure.adapterRoot}; adapterTitle=${failure.adapterTitle}; ` +
        `contentRoot=${failure.contentRoot}; articleClass="${failure.articleClass}"`
    );
  }
}

assert.equal(
  implementationFailures.length,
  0,
  `substack.article should be ready to extract all assets3 HTML fixtures; failures=${implementationFailures.length}`
);

console.log('verify:substack-assets3-fixtures passed');

function findAssets3Root(startDir) {
  let current = startDir;
  for (let depth = 0; depth < 12; depth += 1) {
    const candidate = resolve(current, 'assets3');
    if (existsSync(resolve(candidate, 'html dom'))) {
      return candidate;
    }

    const parent = resolve(current, '..');
    if (parent === current) {
      break;
    }
    current = parent;
  }

  throw new Error(`Unable to locate outer assets3/ from ${startDir}`);
}

function listAssets3HtmlFixtures(assetsRoot) {
  const htmlRoot = resolve(assetsRoot, 'html dom');
  return readdirSync(htmlRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .flatMap((entry) => {
      const dir = resolve(htmlRoot, entry.name);
      return readdirSync(dir, { withFileTypes: true })
        .filter((file) => file.isFile() && file.name.endsWith('.html'))
        .map((file) => ({
          name: basename(file.name, '.html'),
          path: resolve(dir, file.name)
        }));
    })
    .sort((left, right) => left.path.localeCompare(right.path));
}

function installDom(html, url) {
  const jsdom = new JSDOM(html, { url });
  globalThis.Element = jsdom.window.Element;
  globalThis.HTMLElement = jsdom.window.HTMLElement;
  globalThis.HTMLImageElement = jsdom.window.HTMLImageElement;
  globalThis.HTMLVideoElement = jsdom.window.HTMLVideoElement;
  globalThis.Node = jsdom.window.Node;
  globalThis.MutationObserver = jsdom.window.MutationObserver;
  globalThis.window = jsdom.window;
  globalThis.document = jsdom.window.document;
  return jsdom;
}

function assertAssets3ComponentRootsCovered(adapter, contentRoot, fixtureName) {
  const blockSelector = adapter.semanticMap?.blockSelector ?? '';
  assert.ok(blockSelector, 'Substack adapter should expose semanticMap.blockSelector');

  const componentRoots = Array.from(contentRoot.querySelectorAll(assets3ComponentRootSelector));
  const blockCandidates = new Set(Array.from(contentRoot.querySelectorAll(blockSelector)));

  for (const componentRoot of componentRoots) {
    assert.equal(
      blockCandidates.has(componentRoot),
      true,
      `${fixtureName} should include ${describeComponentRoot(componentRoot)} in semanticMap.blockSelector`
    );
  }
}

function describeComponentRoot(element) {
  return element.getAttribute('data-component-name') ?? element.tagName.toLowerCase();
}

function countSourceDividers(bodyRoot) {
  return bodyRoot.querySelectorAll(':scope > hr, :scope > div > hr').length;
}

function assertStandardDividerExtraction(article, sourceDividerCount, fixtureName) {
  if (sourceDividerCount === 0) {
    return;
  }

  const dividerBlocks = article.blocks.filter((block) => block.type === 'divider');
  assert.equal(
    dividerBlocks.length,
    sourceDividerCount,
    `${fixtureName} should extract standard HTML <hr> separators as generic divider ArticleBlocks`
  );
}

function assertReaderRendering(article, fixtureName, sourceDividerCount = 0) {
  document.body.innerHTML = '';
  const shell = renderArticleShell(article);
  document.body.append(shell);

  assertSubstackHeaderRendering(shell, article, fixtureName);

  const focusResult = buildFocusUnits(article, shell);
  const blockTypes = new Map(article.blocks.map((block) => [block.id, block.type]));
  for (const unit of focusResult.units.filter((candidate) => candidate.type === 'block')) {
    assert.equal(unit.blockType, blockTypes.get(unit.blockId), `${fixtureName} FocusUnit should preserve block type for ${unit.blockId}`);
  }

  if (sourceDividerCount > 0) {
    assert.equal(
      shell.querySelectorAll('.reader-divider[data-block-type="divider"]').length,
      sourceDividerCount,
      `${fixtureName} Reader should render generic divider blocks for standard HTML <hr> separators`
    );
    assert.equal(
      shell.querySelector('.reader-divider.focus-unit, .reader-divider.is-active') === null,
      true,
      `${fixtureName} Reader dividers should not participate in active focus state`
    );
    assert.equal(
      focusResult.units.some((unit) => unit.type === 'block' && unit.blockType === 'divider'),
      false,
      `${fixtureName} FocusUnit should skip divider blocks because separators are not readable units`
    );
  }

  const paywallBlock = article.blocks.find((block) => block.type === 'embed' && block.provider === 'substack' && /paid subscribers/i.test(`${block.title ?? ''} ${block.text ?? ''}`));
  if (paywallBlock) {
    const paywallElement = shell.querySelector(`[data-block-id="${paywallBlock.id}"]`);
    assert.ok(paywallElement, `${fixtureName} Reader should render Paywall embed`);
    assert.notEqual(paywallBlock.presentation, 'cta', `${fixtureName} Reader should not render Paywall as a SubscribeWidget CTA`);
    assert.equal(paywallElement.querySelector('.reader-social-embed-text strong') !== null, true, `${fixtureName} Reader should render Paywall bold annotation`);
    assert.equal(paywallElement.querySelector('.reader-social-embed-text a[href]') !== null, true, `${fixtureName} Reader should render Paywall link annotation`);
  }

  const subscribeBlock = article.blocks.find((block) => block.type === 'embed' && block.provider === 'substack' && block.presentation === 'cta');
  if (subscribeBlock) {
    const subscribeElement = shell.querySelector(`[data-block-id="${subscribeBlock.id}"]`);
    assert.ok(subscribeElement, `${fixtureName} Reader should render SubscribeWidget embed`);
    assert.equal(subscribeBlock.presentation, 'cta', `${fixtureName} SubscribeWidget block should carry CTA presentation`);
    assert.equal(subscribeElement.classList.contains('reader-subscribe-widget'), true, `${fixtureName} Reader should render SubscribeWidget with a dedicated CTA wrapper`);
    assert.equal(subscribeElement.classList.contains('reader-social-embed'), false, `${fixtureName} Reader should not render SubscribeWidget as a social embed card`);
    assert.equal(subscribeElement.querySelector('.reader-subscribe-widget-link[href]') !== null, true, `${fixtureName} Reader should render SubscribeWidget as a linked button`);
    assert.equal(subscribeElement.querySelector('.reader-subscribe-widget-icon') !== null, true, `${fixtureName} Reader should render the SubscribeWidget check icon`);
    assertSubscribeWidgetClickBehavior(article, shell, focusResult, subscribeBlock, fixtureName);
  }

  const youtubeBlocks = article.blocks.filter((block) => block.type === 'embed' && block.provider === 'youtube');
  for (const block of youtubeBlocks) {
    const element = shell.querySelector(`[data-block-id="${block.id}"]`);
    assert.ok(element, `${fixtureName} Reader should render YouTube embed`);
    assert.match(element.textContent ?? '', /YouTube/i, `${fixtureName} Reader should not render blank YouTube fallback`);
  }

  const substackMediaEmbeds = article.blocks.filter(
    (block) => block.type === 'embed' && block.provider === 'substack' && block.media?.length
  );
  for (const block of substackMediaEmbeds) {
    const element = shell.querySelector(`[data-block-id="${block.id}"]`);
    assert.ok(element, `${fixtureName} Reader should render Substack media embed`);
    assert.equal(element.querySelector('.reader-social-embed-media-image') !== null, true, `${fixtureName} Reader should render Substack media fallback image`);
  }

  const transparentFriendlyImages = article.blocks.filter(
    (block) => block.type === 'image' && block.objectFit === 'contain' && block.backgroundColor === 'transparent'
  );
  for (const block of transparentFriendlyImages) {
    const element = shell.querySelector(`[data-block-id="${block.id}"]`);
    const frame = element?.querySelector('.reader-media-frame');
    assert.ok(frame, `${fixtureName} Reader should render Image2ToDOM through a media frame`);
    assert.equal(element?.hasAttribute('data-reader-media-surface'), false, `${fixtureName} Reader should not fork single-image focus styling for transparent Image2ToDOM assets`);
    assert.equal(block.visualBleedScale, 1.08, `${fixtureName} Image2ToDOM should carry visual bleed compensation metadata`);
    assert.equal(block.visualBleedMode, 'alpha-transparent', `${fixtureName} Image2ToDOM visual bleed compensation should be gated by alpha transparency detection`);
    assert.equal(frame?.style.backgroundColor, 'transparent', `${fixtureName} Reader should use a transparent frame surface for transparent Image2ToDOM assets`);
    const background = frame?.querySelector('.reader-media-background');
    assert.equal(background?.style.backgroundSize, 'contain', `${fixtureName} Reader should keep transparent Image2ToDOM assets contained`);
    assert.equal(background?.getAttribute('data-visual-bleed-mode'), 'alpha-transparent', `${fixtureName} Reader should mark Image2ToDOM visual bleed as alpha-gated`);
    assert.equal(background?.getAttribute('data-visual-bleed-scale'), '1.08', `${fixtureName} Reader should carry visual bleed scale for alpha-gated probing`);
    assert.equal(background?.style.transform, '', `${fixtureName} Reader should not blindly enlarge Image2ToDOM before alpha transparency is detected`);
  }

  assert.match(
    focusCss,
    /\.reader-media\.focus-unit\.is-active\s*\{[\s\S]*?padding:\s*var\(--reader-media-active-padding\);[\s\S]*?background:\s*var\(--reader-highlight-surface\);/,
    `${fixtureName} active Image2ToDOM focus should use the shared single-image selected background`
  );
  assert.doesNotMatch(
    focusCss,
    /\.reader-media\.focus-unit\.is-active\[data-reader-media-surface="transparent"\]/,
    `${fixtureName} active Image2ToDOM focus should not use a transparent-media-specific selected-state override`
  );
  assert.match(
    overlaysCss,
    /\.reader-media-preview-image\s*\{[\s\S]*?background:\s*transparent;/,
    `${fixtureName} media preview should not place transparent Image2ToDOM assets on a white image surface`
  );
  assert.match(
    socialCardCss,
    /\.reader-subscribe-widget\s*\{[\s\S]*?width:\s*fit-content;[\s\S]*?margin:\s*var\(--reader-subscribe-widget-active-margin\);[\s\S]*?padding:\s*var\(--reader-subscribe-widget-active-padding\);/,
    `${fixtureName} inactive SubscribeWidget wrapper should match active geometry without selected background`
  );
  assert.doesNotMatch(
    socialCardCss,
    /\.reader-subscribe-widget\s*\{[^}]*background\s*:/,
    `${fixtureName} inactive SubscribeWidget wrapper should not draw a selected background`
  );
  assert.match(
    socialCardCss,
    /\.reader-subscribe-widget\s*\{[^}]*border:\s*0;/,
    `${fixtureName} inactive SubscribeWidget wrapper should clear the generic embed border`
  );
  assert.doesNotMatch(
    socialCardCss,
    /\.reader-subscribe-widget\s*\{[^}]*box-shadow\s*:/,
    `${fixtureName} inactive SubscribeWidget wrapper should not draw a selected shadow`
  );
  assert.match(
    socialCardCss,
    /\.reader-subscribe-widget-link\s*\{[\s\S]*?width:\s*var\(--reader-subscribe-widget-width\);[\s\S]*?height:\s*var\(--reader-subscribe-widget-height\);/,
    `${fixtureName} SubscribeWidget CTA should consume the measured assets3 button size tokens`
  );
  assert.match(
    socialCardCss,
    /\.reader-subscribe-widget-link\s*\{[^}]*border:\s*0;/,
    `${fixtureName} inactive SubscribeWidget button should clear borders`
  );
  assert.match(
    socialCardCss,
    /\.reader-subscribe-widget-link\s*\{[^}]*outline:\s*0;/,
    `${fixtureName} inactive SubscribeWidget button should clear outlines`
  );
  assert.match(
    socialCardCss,
    /\.reader-subscribe-widget-link\s*\{[\s\S]*?color:\s*var\(--reader-subscribe-widget-muted\);/,
    `${fixtureName} inactive SubscribeWidget text should use a muted reader theme color`
  );
  assert.match(
    tokensCss,
    /--reader-subscribe-widget-width:\s*142px;[\s\S]*?--reader-subscribe-widget-height:\s*40px;[\s\S]*?--reader-subscribe-widget-icon-size:\s*20px;/,
    `${fixtureName} SubscribeWidget CTA should use the assets3 size_md and 2x screenshot-derived size`
  );
  assert.doesNotMatch(
    tokensCss,
    /--reader-subscribe-widget-(?:accent|surface|active-surface):\s*#[0-9a-f]{3,8}/i,
    `${fixtureName} SubscribeWidget colors should be derived from the reader theme system`
  );
  assert.match(
    focusCss,
    /\.reader-subscribe-widget\.focus-unit\.is-active\s*\{[\s\S]*?width:\s*fit-content;[\s\S]*?padding:\s*var\(--reader-subscribe-widget-active-padding\);[\s\S]*?background:\s*var\(--reader-highlight-surface\);/,
    `${fixtureName} active SubscribeWidget focus should wrap the button width with selected padding`
  );
  assert.doesNotMatch(
    focusCss,
    /\.reader-subscribe-widget\.focus-unit\.is-active\s*\{[^}]*border\s*:/,
    `${fixtureName} active SubscribeWidget focus should not add a border around the CTA`
  );

  for (const block of article.blocks.filter((candidate) => candidate.type === 'embed' || candidate.type === 'video')) {
    const unit = focusResult.units.find((candidate) => candidate.blockId === block.id);
    assert.equal(unit?.type, 'block', `${fixtureName} FocusUnit should treat ${block.type} as a block unit`);
  }
}

function assertSubscribeWidgetClickBehavior(article, shell, focusResult, subscribeBlock, fixtureName) {
  const subscribeElement = shell.querySelector(`[data-block-id="${subscribeBlock.id}"]`);
  const subscribeLink = subscribeElement?.querySelector('.reader-subscribe-widget-link[href]');
  assert.ok(subscribeElement, `${fixtureName} SubscribeWidget click test should find the wrapper`);
  assert.ok(subscribeLink, `${fixtureName} SubscribeWidget click test should find the link`);

  let activeUnit = null;
  const focusChanges = [];
  const openCalls = [];
  const originalOpen = window.open;
  window.open = (href, target) => {
    openCalls.push({ href, target });
    return {};
  };

  try {
    const engine = new FocusEngine(focusResult.units, (unit, index) => {
      activeUnit = unit;
      focusChanges.push([unit.unitId, index]);
    });
    registerClickController({
      root: shell,
      articleId: article.id,
      units: focusResult.units,
      engine,
      hint: document.createElement('div'),
      toast: document.createElement('div'),
      mediaPreviewState: createMediaPreviewState(article),
      getActiveUnit: () => activeUnit
    });

    const inactiveClick = new window.MouseEvent('click', { bubbles: true, cancelable: true });
    subscribeLink.dispatchEvent(inactiveClick);
    assert.equal(inactiveClick.defaultPrevented, true, `${fixtureName} inactive SubscribeWidget click should select before navigation`);
    assert.equal(openCalls.length, 0, `${fixtureName} inactive SubscribeWidget click should not navigate`);
    assert.equal(activeUnit?.blockId, subscribeBlock.id, `${fixtureName} inactive SubscribeWidget click should highlight the CTA block`);

    const activeLinkClick = new window.MouseEvent('click', { bubbles: true, cancelable: true });
    subscribeLink.dispatchEvent(activeLinkClick);
    assert.equal(activeLinkClick.defaultPrevented, false, `${fixtureName} active SubscribeWidget link click should allow native navigation`);

    const activeWrapperClick = new window.MouseEvent('click', { bubbles: true, cancelable: true });
    subscribeElement.dispatchEvent(activeWrapperClick);
    assert.equal(activeWrapperClick.defaultPrevented, true, `${fixtureName} active SubscribeWidget wrapper click should use the block href`);
    assert.deepEqual(openCalls.at(-1), { href: subscribeBlock.href, target: '_self' }, `${fixtureName} active SubscribeWidget wrapper click should navigate to the SubscribeWidget href`);
    assert.ok(focusChanges.length >= 2, `${fixtureName} SubscribeWidget click test should flow through FocusEngine`);
  } finally {
    window.open = originalOpen;
  }
}

function assertSubstackHeaderMetadata(article, fixtureName) {
  if (!fixtureName.includes('增长黑客AI周报')) {
    return;
  }

  assert.equal(article.sourceMeta?.label, 'AI Growth Hacking Weekly · 增长黑客AI周报', `${fixtureName} should preserve the Substack publication label`);
  assert.equal(article.sourceMeta?.href, 'https://www.zengzhang.ai/', `${fixtureName} should preserve the Substack publication link`);
  assert.equal(article.titleHref, 'https://www.zengzhang.ai/p/aiep61-aiagentai4sloop-engineering', `${fixtureName} should preserve the linked title URL`);
  assert.equal(article.subtitle, '当 AI 能替人消费时，品牌不主动嵌入 Agent 工具箱，就会被 Agent 忽略。', `${fixtureName} should preserve the Substack subtitle`);
  assert.equal(article.author?.name, '范冰 XDash', `${fixtureName} should preserve the Substack author name`);
  assert.equal(article.author?.profileUrl, 'https://substack.com/@xdash', `${fixtureName} should preserve the Substack author profile URL`);
  assert.ok(article.author?.avatarUrl?.includes('55cb259b-c4c4-4c79-8bfe-a4a47eef9d1a_940x940.jpeg'), `${fixtureName} should preserve the Substack author avatar`);
  assert.equal(article.publishedAtText, 'Jun 18, 2026', `${fixtureName} should preserve the Substack publish date`);
}

function assertSubstackHeaderRendering(shell, article, fixtureName) {
  if (!fixtureName.includes('增长黑客AI周报')) {
    return;
  }

  const sourceLink = shell.querySelector('.article-source-label[href]');
  assert.equal(sourceLink?.textContent, article.sourceMeta?.label, `${fixtureName} Reader should render the publication label above the title`);
  assert.equal(sourceLink?.getAttribute('href'), article.sourceMeta?.href, `${fixtureName} Reader should link the publication label`);

  const titleLink = shell.querySelector('.article-title a[href]');
  assert.equal(titleLink?.textContent, article.title, `${fixtureName} Reader should render the title as a link`);
  assert.equal(titleLink?.getAttribute('href'), article.titleHref, `${fixtureName} Reader should preserve the title link`);

  const subtitle = shell.querySelector('.article-subtitle');
  assert.equal(subtitle?.textContent, article.subtitle, `${fixtureName} Reader should render the Substack subtitle below the title`);

  const authorRow = shell.querySelector('.article-meta-author');
  assert.equal(authorRow?.getAttribute('href'), article.author?.profileUrl, `${fixtureName} Reader should link the author row to the author profile`);
  assert.equal(authorRow?.querySelector('.article-meta-author-name')?.textContent, article.author?.name, `${fixtureName} Reader should render the author name`);
  assert.equal(authorRow?.querySelector('.article-meta-avatar')?.getAttribute('src'), article.author?.avatarUrl, `${fixtureName} Reader should render the author avatar`);
  assert.match(authorRow?.querySelector('.article-meta-author-secondary')?.textContent ?? '', /Jun 18, 2026/, `${fixtureName} Reader should render the publish date with the author`);
  assert.equal(shell.querySelector('.article-header-divider') !== null, true, `${fixtureName} Reader should render the Substack header divider`);
}
