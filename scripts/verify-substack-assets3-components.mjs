import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';

import { JSDOM } from 'jsdom';

import { resolvePlatformAdapter, substackArticleAdapter } from '../dist/content/adapters/index.js';
import { extractConfigurableArticleWithDiagnostics } from '../dist/content/extractors/configurable/index.js';

const projectRoot = resolve(import.meta.dirname, '..');
const assets3Root = findAssets3Root(projectRoot);
const fixtures = listAssets3HtmlFixtures(assets3Root);
const sourceUrls = [
  'https://substack.com/home/post/p-199574024',
  'https://substack.com/inbox/post/203490377'
].map((url) => new URL(url));
const requiredCoverage = [
  { label: 'Twitter', componentNames: ['Twitter2ToDOM'], implementation: coversSpecialComponentName },
  { label: 'YouTube', componentNames: ['Youtube2ToDOM'], implementation: coversSpecialComponentName },
  { label: 'Video', componentNames: ['VideoEmbedPlayer'], implementation: coversSpecialComponentName },
  { label: 'Image', componentNames: ['Image2ToDOM'], implementation: coversImageComponent },
  { label: 'Footnote', componentNames: ['FootnoteAnchorToDOM', 'FootnoteToDOM'], implementation: coversSpecialComponentName },
  { label: 'Paywall', componentNames: ['Paywall'], implementation: coversPaywallComponent },
  { label: 'Subscribe', componentNames: ['SubscribeWidget'], implementation: coversSpecialComponentName },
  { label: 'Audio', componentNames: [], sourceCount: countAudioComponents, implementation: coversAudioComponent }
];

assert.equal(fixtures.length, 4, `assets3/html dom should expose exactly 4 HTML fixtures, found ${fixtures.length}`);

const aggregateCounts = new Map();

console.log(`[assets3-components] assets3 root: ${assets3Root}`);

for (const [index, fixture] of fixtures.entries()) {
  const html = readFileSync(fixture.path, 'utf8');
  const dom = new JSDOM(html);
  const componentCounts = countComponentNames(dom.window.document);
  const audioCount = countAudioComponents(dom.window.document);
  if (audioCount > 0) {
    aggregateCounts.set('audio[src]', (aggregateCounts.get('audio[src]') ?? 0) + audioCount);
  }
  for (const [name, count] of componentCounts) {
    aggregateCounts.set(name, (aggregateCounts.get(name) ?? 0) + count);
  }

  console.log(`[assets3-components] ${fixture.name}`);
  for (const item of requiredCoverage) {
    const count = countRequiredCoverage(componentCounts, dom.window.document, item);
    console.log(`  ${item.label}: ${count}`);
  }

  const sourceUrl = sourceUrls[index % sourceUrls.length];
  const extractionDom = installDom(html, sourceUrl.toString());
  const adapter = resolvePlatformAdapter(sourceUrl);
  assert.equal(adapter?.id, 'substack.article', `${fixture.name} should resolve to substack.article`);
  const result = await extractConfigurableArticleWithDiagnostics(adapter, {
    url: sourceUrl,
    root: extractionDom.window.document,
    now: () => 1782220000000
  });
  assertArticleJsonComponentMapping(result.article, componentCounts, extractionDom.window.document, fixture.name);
}

const missingSourceCoverage = requiredCoverage
  .filter((item) => countRequiredCoverage(aggregateCounts, null, item) === 0)
  .map((item) => item.label);

assert.deepEqual(
  missingSourceCoverage,
  [],
  `assets3 fixtures should cover all required Substack component categories; missing=${missingSourceCoverage.join(', ')}`
);

const missingImplementationCoverage = requiredCoverage
  .filter((item) => countRequiredCoverage(aggregateCounts, null, item) > 0)
  .filter((item) => !item.implementation(substackArticleAdapter, item.componentNames))
  .map((item) => item.label);

if (missingImplementationCoverage.length > 0) {
  console.error('[assets3-components] implementation coverage gaps:');
  for (const label of missingImplementationCoverage) {
    console.error(`- ${label}`);
  }
}

assert.deepEqual(
  missingImplementationCoverage,
  [],
  `substack.article should declare handling for every assets3 component category; missing=${missingImplementationCoverage.join(', ')}`
);

console.log('verify:substack-assets3-components passed');

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

function countComponentNames(document) {
  const counts = new Map();
  for (const element of document.querySelectorAll('[data-component-name]')) {
    const name = element.getAttribute('data-component-name');
    if (name) {
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
  }
  return counts;
}

function countRequiredComponents(counts, names) {
  return names.reduce((total, name) => total + (counts.get(name) ?? 0), 0);
}

function countRequiredCoverage(counts, document, item) {
  if (typeof item.sourceCount === 'function') {
    if (document) {
      return item.sourceCount(document);
    }
    return counts.get('audio[src]') ?? 0;
  }
  return countRequiredComponents(counts, item.componentNames);
}

function countAudioComponents(document) {
  return document.querySelectorAll('audio[src]').length;
}

function coversSpecialComponentName(adapter, componentNames) {
  const selectorSource = (adapter.specialComponents ?? []).map((component) => component.rootSelector).join('\n');
  return componentNames.some((name) => selectorSource.includes(`data-component-name="${name}"`));
}

function coversImageComponent(adapter, componentNames) {
  return coversSpecialComponentName(adapter, componentNames) || Boolean(adapter.semanticMap?.imageSelector);
}

function coversPaywallComponent(adapter, componentNames) {
  const removedSelectors = adapter.cleanRules?.removeSelectors ?? [];
  const removesPaywall = removedSelectors.some((selector) => selector.includes('paywall'));
  if (removesPaywall) {
    return false;
  }
  return coversSpecialComponentName(adapter, componentNames) || selectorListIncludes(adapter, 'paywall');
}

function coversAudioComponent(adapter) {
  const selectors = [
    adapter.semanticMap?.blockSelector,
    ...(adapter.specialComponents ?? []).map((component) => component.rootSelector)
  ].filter(Boolean);
  return selectors.some((selector) => selector.includes('audio[src]'));
}

function selectorListIncludes(adapter, value) {
  const selectors = [
    adapter.semanticMap?.blockSelector,
    adapter.semanticMap?.paragraphSelector,
    adapter.semanticMap?.quoteSelector,
    adapter.contentSelector,
    ...(adapter.specialComponents ?? []).map((component) => component.rootSelector)
  ].filter(Boolean);
  return selectors.some((selector) => selector.includes(value));
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

function assertArticleJsonComponentMapping(article, componentCounts, document, fixtureName) {
  assertNoUnsafePayload(article, fixtureName);

  if (countRequiredComponents(componentCounts, ['Twitter2ToDOM']) > 0) {
    const xEmbeds = article.blocks.filter((block) => block.type === 'embed' && block.provider === 'x');
    assert.ok(xEmbeds.length > 0, `${fixtureName} should map Twitter2ToDOM to provider=x EmbedBlock`);
    assert.equal(article.blocks.some((block) => block.type === 'simple-tweet'), false, `${fixtureName} should not emit simple-tweet for Substack Twitter2ToDOM`);
  }

  const imageComponentCount = countRequiredComponents(componentCounts, ['Image2ToDOM']);
  if (imageComponentCount > 0) {
    const imageBlocks = article.blocks.filter((block) => block.type === 'image');
    const galleryItems = article.blocks
      .filter((block) => block.type === 'image-gallery')
      .flatMap((block) => block.items);
    const imageLikeBlocks = [...imageBlocks, ...galleryItems];
    assert.ok(imageLikeBlocks.length >= imageComponentCount, `${fixtureName} should map Image2ToDOM to image blocks`);
    assert.ok(imageLikeBlocks.every((image) => isSafeUrl(image.src)), `${fixtureName} should preserve safe image src values`);
    assert.ok(imageLikeBlocks.some((image) => Boolean(image.srcset)), `${fixtureName} should preserve Substack image srcset`);
    assert.ok(imageLikeBlocks.some((image) => Boolean(image.href)), `${fixtureName} should preserve Substack image href`);
    assert.ok(imageLikeBlocks.some((image) => typeof image.aspectRatio === 'number'), `${fixtureName} should preserve Substack image aspect ratio`);
    assert.ok(imageLikeBlocks.some((image) => image.objectFit === 'contain'), `${fixtureName} should preserve Substack Image2ToDOM containment`);
    assert.ok(imageLikeBlocks.some((image) => image.backgroundColor === 'transparent'), `${fixtureName} should preserve a transparent image surface for transparent Image2ToDOM assets`);
    assert.ok(
      imageLikeBlocks.some((image) => image.visualBleedScale === 1.08 && image.visualBleedMode === 'alpha-transparent'),
      `${fixtureName} should preserve Substack Image2ToDOM visual bleed compensation as alpha-gated structured image metadata`
    );
  }

  const youtubeCount = countRequiredComponents(componentCounts, ['Youtube2ToDOM']);
  if (youtubeCount > 0) {
    const youtubeEmbeds = article.blocks.filter((block) => block.type === 'embed' && block.provider === 'youtube');
    assert.ok(youtubeEmbeds.length >= youtubeCount, `${fixtureName} should map Youtube2ToDOM to provider=youtube EmbedBlock`);
    assert.ok(youtubeEmbeds.every((block) => isSafeUrl(block.href)), `${fixtureName} should preserve safe YouTube href`);
    assert.ok(youtubeEmbeds.every((block) => block.label === 'YouTube'), `${fixtureName} should label YouTube embeds`);
  }

  const videoCount = countRequiredComponents(componentCounts, ['VideoEmbedPlayer']);
  if (videoCount > 0) {
    const videoBlocks = article.blocks.filter((block) => block.type === 'video');
    const videoEmbeds = article.blocks.filter(
      (block) =>
        block.type === 'embed' &&
        block.provider === 'substack' &&
        block.label === 'Substack' &&
        (/video/i.test(`${block.title ?? ''} ${block.text ?? ''}`) || block.media?.some((media) => /substack-video/i.test(media.src)))
    );
    assert.ok(videoBlocks.length + videoEmbeds.length >= videoCount, `${fixtureName} should map VideoEmbedPlayer to VideoBlock or Substack EmbedBlock`);
    assert.ok(videoBlocks.every((block) => isSafeUrl(block.src)), `${fixtureName} should not pass blob video src into Article JSON`);
    assert.ok(videoEmbeds.every((block) => !String(block.href ?? '').startsWith('blob:')), `${fixtureName} should not pass blob embed href into Article JSON`);
    assert.ok(
      [...videoBlocks, ...videoEmbeds.flatMap((block) => block.media ?? [])].some((block) => typeof block.aspectRatio === 'number'),
      `${fixtureName} should preserve VideoEmbedPlayer layout aspect ratio`
    );
    assert.ok(
      videoEmbeds.flatMap((block) => block.media ?? []).some((media) => media.objectFit === 'cover'),
      `${fixtureName} should preserve VideoEmbedPlayer poster object-fit layout`
    );
  }

  const audioCount = countAudioComponents(document);
  if (audioCount > 0) {
    const audioEmbeds = article.blocks.filter(
      (block) => block.type === 'embed' && block.provider === 'substack' && /audio/i.test(`${block.title ?? ''} ${block.text ?? ''}`)
    );
    assert.ok(audioEmbeds.length >= audioCount, `${fixtureName} should map audio[src] to Substack EmbedBlock`);
    assert.ok(audioEmbeds.every((block) => isSafeUrl(block.href)), `${fixtureName} should preserve safe audio src href`);
    assert.ok(
      audioEmbeds.some((block) => block.media?.some((media) => isSafeUrl(media.src) && media.objectFit === 'cover')),
      `${fixtureName} should preserve audio cover/poster media layout`
    );
  }

  if (countRequiredComponents(componentCounts, ['FootnoteToDOM']) > 0) {
    const footnoteParagraph = article.blocks.find(
      (block) => block.type === 'paragraph' && /This is somewhat at odds with what the biology and chemistry worlds deal with/.test(block.text)
    );
    assert.ok(footnoteParagraph, `${fixtureName} should preserve FootnoteToDOM as lightweight paragraph text`);
    assert.doesNotMatch(footnoteParagraph.text, /popover|footnote-content|data-component-name/i, `${fixtureName} should not leak footnote DOM internals`);
  }

  if (countRequiredComponents(componentCounts, ['Paywall']) > 0) {
    const paywallEmbed = article.blocks.find(
      (block) => block.type === 'embed' && block.provider === 'substack' && /paid subscribers/i.test(`${block.title ?? ''} ${block.text ?? ''}`)
    );
    assert.ok(paywallEmbed, `${fixtureName} should map Paywall to Substack EmbedBlock`);
    assert.equal(paywallEmbed.label, 'Substack', `${fixtureName} should label Paywall embeds as Substack`);
    assert.ok(!paywallEmbed.href || isSafeUrl(paywallEmbed.href), `${fixtureName} should preserve only safe Paywall links`);
    assert.ok(
      paywallEmbed.textAnnotations?.some((annotation) => annotation.bold),
      `${fixtureName} should preserve Paywall bold text annotations`
    );
    assert.ok(
      paywallEmbed.textAnnotations?.some((annotation) => annotation.href && annotation.textDecoration === 'underline'),
      `${fixtureName} should preserve Paywall hyperlink and underline annotations`
    );
  }

  if (countRequiredComponents(componentCounts, ['SubscribeWidget']) > 0) {
    const subscribeEmbed = article.blocks.find(
      (block) => block.type === 'embed' && block.provider === 'substack' && /subscribe|subscribed|upgrade/i.test(`${block.title ?? ''} ${block.text ?? ''}`)
    );
    assert.ok(subscribeEmbed, `${fixtureName} should map SubscribeWidget to Substack EmbedBlock`);
    assert.equal(subscribeEmbed.label, 'Substack', `${fixtureName} should label SubscribeWidget embeds as Substack`);
    assert.ok(!subscribeEmbed.href || isSafeUrl(subscribeEmbed.href), `${fixtureName} should preserve only safe SubscribeWidget links`);
    assert.equal(subscribeEmbed.presentation, 'cta', `${fixtureName} should mark SubscribeWidget embeds as CTA presentation`);
    assert.ok(
      subscribeEmbed.textAnnotations?.some((annotation) => annotation.href && annotation.textDecoration === 'underline'),
      `${fixtureName} should preserve SubscribeWidget hyperlink and underline annotations`
    );
  }
}

function assertNoUnsafePayload(article, fixtureName) {
  const payload = JSON.stringify(article.blocks);
  assert.doesNotMatch(payload, /<\s*(script|template|iframe)\b/i, `${fixtureName} should not pass script/template/iframe HTML strings into Article JSON`);
  assert.doesNotMatch(payload, /\son[a-z]+\s*=/i, `${fixtureName} should not pass event handler HTML into Article JSON`);
  assert.doesNotMatch(payload, /data-component-name/i, `${fixtureName} should not leak Substack component names into Article JSON`);
  assert.doesNotMatch(payload, /blob:/i, `${fixtureName} should not pass blob URLs into Article JSON`);
}

function isSafeUrl(value) {
  if (!value || typeof value !== 'string') {
    return false;
  }
  try {
    const url = new URL(value, 'https://substack.com');
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}
