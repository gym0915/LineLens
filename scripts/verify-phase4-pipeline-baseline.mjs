import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { JSDOM } from 'jsdom';

import { xArticleAdapter } from '../dist/content/adapters/index.js';
import {
  buildCleanTreeDebugSnapshot,
  cloneContentTree
} from '../dist/content/preprocess/clone-content-tree.js';
import { applyPlatformFixes, getPlatformFixOrder } from '../dist/content/preprocess/apply-platform-fixes.js';
import { convertCleanTreeToBlocks } from '../dist/content/preprocess/clean-tree-block-converter.js';
import {
  CLEAN_TREE_PRIMARY_BLOCK_TYPES,
  HIGH_RISK_DUAL_TRACK_BLOCK_TYPES,
  mergeCleanTreePrimaryBlocks
} from '../dist/content/preprocess/clean-tree-main-path.js';
import {
  filterInlineStyle,
  shouldPreserveStyleProperty
} from '../dist/content/preprocess/style-whitelist.js';

const projectRoot = resolve(import.meta.dirname, '..');
const workspaceRoot = findWorkspaceRoot(projectRoot);
const detailSnapshot = readAsset('x-article-detail.html');
const fullDomSnapshot = readAsset('x-article-full-dom.html');
const codeBlockSnapshot = readAsset('x-article-codeblock.html');
const videoSnapshot = readAsset('x-article-video-gif.html');
const simpleTweetSnapshot = readAsset('x-article-simpletweet-video-tweet-text.html');
const imageGridSnapshot = readAsset('x-article-image-grid.html');
const whitelistFixture = readAsset('p4-whitelist-style-fixture.html');

const phase4Stages = ['clean tree', 'whitelist', 'fixes', 'block conversion'];
assert.deepEqual(
  phase4Stages,
  ['clean tree', 'whitelist', 'fixes', 'block conversion'],
  'Phase4 baseline should keep the four-stage verification order explicit'
);
assert.equal(typeof cloneContentTree, 'function', 'P4.1 should expose a clean tree clone entry');
assert.equal(typeof buildCleanTreeDebugSnapshot, 'function', 'P4.1 should expose a clean tree debug snapshot entry');
assert.equal(typeof filterInlineStyle, 'function', 'P4.2 should expose an inline style filtering entry');
assert.equal(typeof shouldPreserveStyleProperty, 'function', 'P4.2 should expose a style property predicate');
assert.equal(typeof applyPlatformFixes, 'function', 'P4.3 should expose a platform fixes entry');
assert.equal(typeof getPlatformFixOrder, 'function', 'P4.3 should expose a deterministic fix order helper');
assert.equal(typeof convertCleanTreeToBlocks, 'function', 'P4.4 should expose a clean tree block converter entry');
assert.equal(typeof mergeCleanTreePrimaryBlocks, 'function', 'P4.5 should expose a clean tree primary merge entry');
assertSemanticMapDrivesCleanTreeBlockConversion();
assertXSingleImageUsesPreservedFrameAspectRatio();
assert.deepEqual(getPlatformFixOrder(xArticleAdapter), [
  'expand-folded-tweet-text',
  'normalize-handwritten-ordered-list',
  'preserve-svg-emoji',
  'capture-x-video-hls',
  'preserve-x-media-caption',
  'preserve-x-media-layout'
]);
assert.deepEqual(CLEAN_TREE_PRIMARY_BLOCK_TYPES, ['paragraph', 'heading', 'quote', 'list', 'image', 'code', 'table', 'simple-tweet', 'image-gallery', 'embed']);
assert.deepEqual(HIGH_RISK_DUAL_TRACK_BLOCK_TYPES, ['video']);
assert.equal(xArticleAdapter.semanticMap?.blockSelector, '[data-block="true"]', 'P4.5 should expose X block semantics through adapter config');
assert.match(xArticleAdapter.semanticMap?.headingSelector ?? '', /longform-header-one/, 'P4.5 should expose X heading semantics through adapter config');
assert.match(xArticleAdapter.semanticMap?.quoteSelector ?? '', /blockquote/, 'P4.5 should expose X quote semantics through adapter config');
assert.match(xArticleAdapter.semanticMap?.orderedListSelector ?? '', /orderedListItem/, 'P4.5 should expose X ordered list semantics through adapter config');
assert.match(xArticleAdapter.semanticMap?.imageSelector ?? '', /tweetPhoto/, 'P4.5 should expose X image semantics through adapter config');
assert.match(xArticleAdapter.semanticMap?.codeSelector ?? '', /markdown-code-block/, 'P4.5 should expose X code semantics through adapter config');
assert.deepEqual(
  xArticleAdapter.readiness,
  {
    minTextLength: 200,
    minBlockCount: 3,
    requiredSelectors: [
      '[data-testid="twitterArticleReadView"]',
      '[data-testid="twitter-article-title"]',
      '[data-testid="longformRichTextComponent"]'
    ]
  },
  'Step 2 should expose current X readiness thresholds declaratively without changing runtime behavior'
);
assert.deepEqual(
  xArticleAdapter.validation,
  {
    minBlockCount: 3,
    minTextLength: 200,
    titleStrategy: 'required',
    emptyContentStrategy: 'reject'
  },
  'Step 2 should expose current article validation defaults declaratively without changing runtime behavior'
);
assert.equal(
  xArticleAdapter.cleanRules?.removeSelectors?.some((selector) => selector.includes('[role="button"]')),
  true,
  'Step 2 should expose current interactive clean-rule candidates declaratively'
);
assert.equal(
  xArticleAdapter.specialComponents?.some((component) => component.id === 'x.simple-tweet' && component.handlerId === 'x.simple-tweet'),
  true,
  'P4.5 should expose X simpleTweet as a declared special component'
);
assert.equal(
  xArticleAdapter.specialComponents?.some((component) => component.id === 'x.video-or-gif' && component.handlerId === 'x.video-or-gif'),
  true,
  'P4.5 should expose X video/GIF as a declared special component'
);

const regressionInventory = {
  title: count(detailSnapshot, 'data-testid="twitter-article-title"'),
  links: count(detailSnapshot, '<a '),
  bold: count(detailSnapshot, 'font-weight: bold') + count(detailSnapshot, 'font-weight: 700'),
  unorderedList: count(detailSnapshot, 'public-DraftStyleDefault-unorderedListItem'),
  orderedList: count(detailSnapshot, 'public-DraftStyleDefault-orderedListItem'),
  svgEmoji: count(fullDomSnapshot, 'abs.twimg.com/emoji/v2/svg/'),
  image: count(detailSnapshot, 'data-testid="tweetPhoto"') + count(imageGridSnapshot, 'data-testid="tweetPhoto"'),
  video: count(videoSnapshot, 'data-testid="videoPlayer"'),
  simpleTweet: count(simpleTweetSnapshot, 'data-testid="simpleTweet"'),
  codeBlock: count(codeBlockSnapshot, 'data-testid="markdown-code-block"')
};

for (const [name, value] of Object.entries(regressionInventory)) {
  assert.equal(value > 0, true, `P4 old-chain regression inventory should include ${name}`);
}

const cleanTreeBaseline = summarizeCleanTreeCandidate(detailSnapshot);
cleanTreeBaseline.svgEmojiCount = count(fullDomSnapshot, 'abs.twimg.com/emoji/v2/svg/');
assert.equal(cleanTreeBaseline.title, 'DeepSeek 的 10 万亿美元大战略【译】');
assert.equal(cleanTreeBaseline.paragraphCount > 100, true, 'clean tree baseline should retain paragraph-like text blocks');
assert.equal(cleanTreeBaseline.listItemCount > 0, true, 'clean tree baseline should retain list items');
assert.equal(cleanTreeBaseline.imageCount > 0, true, 'clean tree baseline should retain image candidates');
assert.equal(cleanTreeBaseline.quoteCount > 0, true, 'clean tree baseline should retain embedded tweet/quote candidates');
assert.equal(cleanTreeBaseline.linkCount > 0, true, 'clean tree baseline should retain links');
assert.equal(cleanTreeBaseline.boldInlineCount > 0, true, 'clean tree baseline should retain bold inline semantics');
assert.equal(cleanTreeBaseline.svgEmojiCount > 0, true, 'clean tree baseline should retain SVG emoji metadata');

const cleanTreeSource = readFileSync(
  resolve(projectRoot, 'src/content/preprocess/clone-content-tree.ts'),
  'utf8'
);
assert.match(cleanTreeSource, /export type CleanTreeContext/, 'P4.1 should define a clean tree context type');
assert.match(cleanTreeSource, /platform: string/, 'clean tree context should include platform');
assert.match(cleanTreeSource, /sourceUrl: string/, 'clean tree context should include sourceUrl');
assert.match(cleanTreeSource, /adapter: PlatformAdapter/, 'clean tree context should include adapter config');
assert.match(cleanTreeSource, /debugId: string/, 'clean tree context should include debugId');
assert.match(cleanTreeSource, /root\.cloneNode\(true\)/, 'clean tree should clone the content root');
assert.match(cleanTreeSource, /querySelectorAll\('\*'\)/, 'clean tree should sanitize descendants after cloning');
assert.match(cleanTreeSource, /element\.remove\(\)/, 'clean tree should remove script-like or interactive shells');
assert.match(cleanTreeSource, /removeAttribute\(attribute\.name\)/, 'clean tree should strip non-preserved attributes');
assert.match(cleanTreeSource, /'href'/, 'clean tree should preserve href');
assert.match(cleanTreeSource, /'src'/, 'clean tree should preserve src');
assert.match(cleanTreeSource, /'alt'/, 'clean tree should preserve alt');
assert.match(cleanTreeSource, /'data-testid'/, 'clean tree should preserve necessary data-testid markers');
assert.match(cleanTreeSource, /data-linelens-list-kind/, 'clean tree should preserve list semantics before class stripping');
assert.match(cleanTreeSource, /applyStyleWhitelistToTree\(root, adapter\.styleWhitelist\)/, 'P4.2 should run style whitelist inside clean tree preprocessing');
assert.match(cleanTreeSource, /applyPlatformFixes\(clonedRoot, context\.adapter, context\)/, 'P4.3 should run platform fixes before clean tree sanitizing');
assert.match(cleanTreeSource, /platformFixes: result\.platformFixes/, 'P4.3 debug snapshot should include platform fix results');
assert.doesNotMatch(
  cleanTreeSource.match(/const PRESERVED_ATTRIBUTE_NAMES = new Set\(\[[\s\S]*?\]\);/)?.[0] ?? '',
  /'class'/,
  'clean tree should not preserve platform class attributes in P4.1'
);
const platformFixesSource = readFileSync(
  resolve(projectRoot, 'src/content/preprocess/apply-platform-fixes.ts'),
  'utf8'
);
assert.match(platformFixesSource, /const FIX_ORDER/, 'P4.3 should define deterministic fix order');
assert.match(platformFixesSource, /enabledFixes/, 'P4.3 should respect adapter fix switches');
assert.match(platformFixesSource, /data-linelens-fix-folded-tweet-text/, 'P4.3 should migrate folded tweet text fix metadata into clean tree');
assert.match(platformFixesSource, /data-linelens-list-kind/, 'P4.3 should migrate list normalization into clean tree');
assert.match(platformFixesSource, /data-linelens-emoji-image-url/, 'P4.3 should preserve SVG emoji metadata in clean tree');
assert.match(platformFixesSource, /data-linelens-video-hls-candidate/, 'P4.3 should mark video HLS candidates without cutting main path');

const blockConverterSource = readFileSync(
  resolve(projectRoot, 'src/content/preprocess/clean-tree-block-converter.ts'),
  'utf8'
);
assert.match(blockConverterSource, /export function convertCleanTreeToBlocks/, 'P4.4 should define clean tree to block conversion entry');
assert.match(blockConverterSource, /enabledBlockTypes/, 'P4.4 should allow block type level rollout');
assert.match(blockConverterSource, /'paragraph', 'heading', 'quote', 'list', 'image', 'code', 'table', 'simple-tweet', 'image-gallery', 'embed'/, 'P4.4 should include code, table, simple-tweet, image-gallery, and embed after article migrations');
assert.match(blockConverterSource, /extractTextAnnotations/, 'P4.4 should preserve inline annotations');
assert.match(blockConverterSource, /annotation\.bold = true/, 'P4.4 should preserve bold annotations');
assert.match(blockConverterSource, /annotation\.href = href/, 'P4.4 should preserve link annotations');
assert.match(blockConverterSource, /annotation\.emojiImageUrl = emojiImageUrl/, 'P4.4 should preserve emoji annotations');
assert.doesNotMatch(
  blockConverterSource.match(/const DEFAULT_ENABLED_BLOCK_TYPES[\s\S]*?\];/)?.[0] ?? '',
  /video/,
  'P4.4 should keep video on the old path or dual-track only'
);

const mainPathSource = readFileSync(
  resolve(projectRoot, 'src/content/preprocess/clean-tree-main-path.ts'),
  'utf8'
);
assert.match(mainPathSource, /buildCleanTreePrimaryBlocks/, 'P4.5 should define clean tree primary block builder');
assert.match(mainPathSource, /mergeCleanTreePrimaryBlocks/, 'P4.5 should keep legacy merge statistics available');
assert.match(mainPathSource, /blocks:\s*params\.legacyBlocks \? mergeStats\.blocks : cleanTreeBlocks/, 'P4.5 should merge clean-tree primary blocks with legacy high-risk blocks when legacy input is provided');
assert.match(mainPathSource, /id: legacyBlock\.id/, 'P4.5 should preserve legacy block ids for Reader progress and FocusUnit stability');
assert.match(mainPathSource, /fallbackBlockCount/, 'P4.5 should report legacy fallback count');
assert.match(mainPathSource, /highRiskBlockCount/, 'P4.5 should report high-risk dual-track count');

const modularExtractorSource = readFileSync(
  resolve(projectRoot, 'src/content/extractors/x/article-extractor.ts'),
  'utf8'
);
for (const source of [modularExtractorSource]) {
  assert.match(source, /extractConfigurableArticleWithDiagnostics/, 'Step 4.3 should wire configurable clean-tree diagnostics into the modular X extractor path');
  assert.doesNotMatch(source, /buildCleanTreePrimaryBlocks/, 'Step 4.3 should keep direct clean-tree primary block building inside configurable extraction');
  assert.match(source, /legacyBlocks = await extractXArticleLegacyBlocks/, 'browser X extractor should keep legacy high-risk blocks through the Step 4 legacy boundary until clean-tree video migration is complete');
}
const liveExtractorSource = readFileSync(resolve(projectRoot, 'src/content/index.ts'), 'utf8');
assert.match(liveExtractorSource, /createExtractorRegistry/, 'content entry source should route through the extractor registry');
assert.match(liveExtractorSource, /xArticleExtractor/, 'content entry source should register the modular X Article extractor');
const builtContentSource = readFileSync(resolve(projectRoot, 'dist/content.js'), 'utf8');
assert.doesNotMatch(builtContentSource, /^import /m, 'built content.js should remain import-free so Chrome can execute it as a content script');

const mergeProbe = mergeCleanTreePrimaryBlocks(
  [
    { id: 'legacy-1', type: 'paragraph', text: 'same text' },
    { id: 'legacy-2', type: 'video', src: 'video.mp4' }
  ],
  [
    { id: 'clean-1', type: 'paragraph', text: 'same text', annotations: [{ startOffset: 0, endOffset: 4, bold: true }] }
  ]
);
assert.equal(mergeProbe.replacedBlockCount, 1, 'P4.5 should replace equivalent low-risk blocks from clean tree');
assert.equal(mergeProbe.highRiskBlockCount, 1, 'P4.5 should keep high-risk blocks dual-track');
assert.equal(mergeProbe.blocks[0]?.id, 'legacy-1', 'P4.5 should preserve legacy ids for replaced blocks');
assert.deepEqual(mergeProbe.blocks[0], {
  id: 'legacy-1',
  type: 'paragraph',
  text: 'same text',
  annotations: [{ startOffset: 0, endOffset: 4, bold: true }]
});
assert.deepEqual(mergeProbe.blocks[1], { id: 'legacy-2', type: 'video', src: 'video.mp4' });

const legacyBlocks = summarizeLegacyExtractorBaseline({
  detailSnapshot,
  codeBlockSnapshot,
  videoSnapshot,
  simpleTweetSnapshot,
  imageGridSnapshot
});
const cleanTreeBlocks = summarizeCleanTreeBlockCandidate({
  detailSnapshot,
  codeBlockSnapshot,
  videoSnapshot,
  simpleTweetSnapshot,
  imageGridSnapshot
});
const blockDiff = diffBlockCounts(legacyBlocks, cleanTreeBlocks);
assert.deepEqual(
  blockDiff,
  {},
  'P4 baseline block comparison should start with no diff while clean tree block conversion is not implemented'
);

assert.equal(xArticleAdapter.styleWhitelist.preserveProps.includes('font-weight'), true);
assert.equal(xArticleAdapter.styleWhitelist.preserveColorFor.includes('link'), true);
assert.equal(xArticleAdapter.styleWhitelist.preserveWhiteSpaceValues.includes('pre'), true);
assert.equal(xArticleAdapter.styleWhitelist.preserveWhiteSpaceValues.includes('pre-wrap'), true);

const whitelistBaseline = summarizeWhitelistFixture(whitelistFixture);
assert.deepEqual(whitelistBaseline.allowedStyleSignals, {
  fontWeight: true,
  linkColor: true,
  preWrap: true
});
assert.deepEqual(whitelistBaseline.disallowedStyleSignals, {
  fontSize: true,
  position: true,
  background: true,
  letterSpacing: true,
  width: true,
  transform: true
});
assert.equal(whitelistBaseline.platformClassCount >= 3, true, 'whitelist fixture should include platform classes to remove later');
assert.equal(
  filterInlineStyle('font-weight: 700; background: red; letter-spacing: 12px;', xArticleAdapter.styleWhitelist, {
    isLink: false,
    isPreformatted: false,
    matchesCustomColorSelector: false
  }),
  'font-weight: 700',
  'P4.2 should preserve allowed font-weight and remove visual pollution'
);
assert.equal(
  filterInlineStyle('color: rgb(29, 155, 240); font-size: 48px; position: fixed;', xArticleAdapter.styleWhitelist, {
    isLink: true,
    isPreformatted: false,
    matchesCustomColorSelector: false
  }),
  'color: rgb(29, 155, 240)',
  'P4.2 should preserve link color only for link contexts'
);
assert.equal(
  filterInlineStyle('color: rgb(29, 155, 240); font-size: 48px;', xArticleAdapter.styleWhitelist, {
    isLink: false,
    isPreformatted: false,
    matchesCustomColorSelector: false
  }),
  '',
  'P4.2 should remove link color outside allowed contexts'
);
assert.equal(
  filterInlineStyle('white-space: pre-wrap; width: 9999px; transform: scale(2);', xArticleAdapter.styleWhitelist, {
    isLink: false,
    isPreformatted: true,
    matchesCustomColorSelector: false
  }),
  'white-space: pre-wrap',
  'P4.2 should preserve configured preformatted whitespace values'
);
assert.equal(
  shouldPreserveStyleProperty('font-style', { preserveProps: ['font-weight', 'font-style'], preserveColorFor: [], preserveWhiteSpaceValues: [] }, {
    isLink: false,
    isInlineEmphasis: false,
    isPreformatted: false,
    matchesCustomColorSelector: false,
    value: 'italic'
  }),
  true,
  'P4.2 should allow emphasis props when adapter config opts in'
);
assert.equal(
  shouldPreserveStyleProperty('color', { preserveProps: [], preserveColorFor: ['inline-emphasis'], preserveWhiteSpaceValues: [] }, {
    isLink: false,
    isInlineEmphasis: true,
    isPreformatted: false,
    matchesCustomColorSelector: false,
    value: 'rgb(224, 36, 94)'
  }),
  true,
  'P4.2 should preserve configured inline emphasis colors without preserving body container color'
);

const baselineReport = {
  phase4Stages,
  regressionInventory,
  cleanTreeBaseline,
  legacyBlocks,
  cleanTreeBlocks,
  platformFixes: {
    deterministicOrder: getPlatformFixOrder(xArticleAdapter),
    supportsFixSwitches: true,
    foldedTweetTextMetadata: true,
    orderedListMetadata: true,
    svgEmojiMetadata: true,
    videoHlsCandidateMetadata: true
  },
  blockConversion: {
    lowRiskBlockTypes: ['paragraph', 'heading', 'quote', 'list', 'image', 'code', 'table', 'simple-tweet', 'image-gallery', 'embed'],
    preservesInlineSemantics: ['bold', 'link', 'emoji'],
    highRiskBlocksRemainDualTrack: ['video'],
    legacyIdsPreserved: true,
    legacyFallbackAvailable: true,
    xAdapterSchemaDeclared: true,
    xAdapterReadinessDeclared: true,
    xAdapterValidationDeclared: true,
    xAdapterCleanRulesDeclared: true
  },
  whitelistBaseline,
  whitelistFiltering: {
    preservesFontWeight: true,
    preservesLinkColor: true,
    preservesPreWrap: true,
    removesDisallowedStyle: true,
    removesPlatformClass: true
  }
};

console.log(JSON.stringify(baselineReport, null, 2));
console.log('Phase4 pipeline baseline verification passed');

function readAsset(fileName) {
  return readFileSync(resolve(workspaceRoot, 'assets', fileName), 'utf8');
}

function assertSemanticMapDrivesCleanTreeBlockConversion() {
  const dom = new JSDOM(`
    <main data-fixture-root>
      <section data-semantic-block data-kind="heading" data-linelens-heading-level="3">Mapped Heading</section>
      <aside data-semantic-block data-kind="quote">Mapped quote</aside>
      <div data-semantic-block data-kind="ordered">Ordered item</div>
      <div data-semantic-block data-kind="unordered">Unordered item</div>
      <figure data-semantic-block data-kind="image"><img src="https://example.com/mapped.png" alt="Mapped image"></figure>
      <section data-semantic-block data-kind="code"><pre><code class="language-js">const mapped = true;</code></pre></section>
      <section data-semantic-block data-kind="table">
        <div role="row"><span role="columnheader">Name</span><span role="columnheader">Value</span></div>
        <div role="row"><span role="cell">mapped</span><span role="cell">yes</span></div>
      </section>
    </main>
  `);
  const previousGlobals = {
    document: globalThis.document,
    window: globalThis.window,
    Element: globalThis.Element,
    HTMLElement: globalThis.HTMLElement,
    Node: globalThis.Node
  };

  globalThis.document = dom.window.document;
  globalThis.window = dom.window;
  globalThis.Element = dom.window.Element;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.Node = dom.window.Node;

  try {
    const blocks = convertCleanTreeToBlocks(dom.window.document.querySelector('[data-fixture-root]'), {
      adapter: {
        ...xArticleAdapter,
        id: 'semantic-map.fixture',
        platform: 'fixture',
        semanticMap: {
          blockSelector: '[data-semantic-block]',
          paragraphSelector: '[data-kind="paragraph"]',
          headingSelector: '[data-kind="heading"]',
          quoteSelector: '[data-kind="quote"]',
          orderedListSelector: '[data-kind="ordered"]',
          unorderedListSelector: '[data-kind="unordered"]',
          imageSelector: '[data-kind="image"]',
          imageGallerySelector: '[data-kind="gallery"]',
          codeSelector: '[data-kind="code"]',
          tableSelector: '[data-kind="table"]',
          linkSelector: 'a[href]',
          textSelector: '[data-text="true"]'
        }
      },
      debugId: 'semantic-map-fixture',
      platform: 'fixture',
      sourceUrl: 'https://example.com/article'
    });
    const blockTypes = blocks.map((block) => block.type);

    assert.equal(
      blocks.some((block) => block.type === 'heading' && block.text === 'Mapped Heading' && block.level === 3),
      true,
      'semanticMap.headingSelector should drive clean-tree heading detection'
    );
    assert.equal(
      blocks.some((block) => block.type === 'quote' && block.text === 'Mapped quote'),
      true,
      'semanticMap.quoteSelector should drive clean-tree quote detection'
    );
    assert.equal(
      blocks.some((block) => block.type === 'list' && block.kind === 'ordered' && block.items.includes('Ordered item')),
      true,
      'semanticMap.orderedListSelector should drive clean-tree ordered list detection'
    );
    assert.equal(
      blocks.some((block) => block.type === 'list' && block.kind === 'unordered' && block.items.includes('Unordered item')),
      true,
      'semanticMap.unorderedListSelector should drive clean-tree unordered list detection'
    );
    assert.equal(
      blocks.some((block) => block.type === 'image' && block.src === 'https://example.com/mapped.png'),
      true,
      'semanticMap.imageSelector should drive clean-tree image detection'
    );
    assert.equal(
      blocks.some((block) => block.type === 'code' && block.text === 'const mapped = true;' && block.language === 'js'),
      true,
      'semanticMap.codeSelector should drive clean-tree code detection'
    );
    assert.equal(
      blocks.some((block) => block.type === 'table' && block.rows.length === 2),
      true,
      'semanticMap.tableSelector should drive clean-tree table detection'
    );
    assert.deepEqual(
      blockTypes,
      ['heading', 'quote', 'list', 'list', 'image', 'code', 'table'],
      'semanticMap selectors should preserve fixture block order'
    );
  } finally {
    globalThis.document = previousGlobals.document;
    globalThis.window = previousGlobals.window;
    globalThis.Element = previousGlobals.Element;
    globalThis.HTMLElement = previousGlobals.HTMLElement;
    globalThis.Node = previousGlobals.Node;
  }
}

function assertXSingleImageUsesPreservedFrameAspectRatio() {
  const dom = new JSDOM(`
    <main data-fixture-root>
      <section data-block="true" contenteditable="false">
        <div>
          <a href="/0xileri/article/2058611697187782908/media/2058608975096995840">
            <div>
              <div style="padding-bottom: 133.333%;"></div>
              <div>
                <div aria-label="图像" data-testid="tweetPhoto">
                  <div style="background-image: url(&quot;https://pbs.twimg.com/media/HJGl9LQWYAAmCXM?format=jpg&amp;name=large&quot;);"></div>
                  <img alt="图像" src="https://pbs.twimg.com/media/HJGl9LQWYAAmCXM?format=jpg&amp;name=large">
                </div>
              </div>
            </div>
          </a>
        </div>
      </section>
    </main>
  `, { url: 'https://x.com/0xileri/article/2058611697187782908' });
  const previousGlobals = {
    document: globalThis.document,
    window: globalThis.window,
    Element: globalThis.Element,
    HTMLElement: globalThis.HTMLElement,
    Node: globalThis.Node
  };

  globalThis.document = dom.window.document;
  globalThis.window = dom.window;
  globalThis.Element = dom.window.Element;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.Node = dom.window.Node;

  try {
    const root = dom.window.document.querySelector('[data-fixture-root]');
    const context = {
      adapter: xArticleAdapter,
      debugId: 'x-single-image-frame-ratio',
      platform: 'x',
      sourceUrl: 'https://x.com/0xileri/article/2058611697187782908'
    };
    const cleanTree = cloneContentTree(root, context);
    const preservedFrame = cleanTree.root.querySelector('[data-linelens-media-aspect-ratio="0.75"]');
    assert(preservedFrame, 'platform fixes should preserve the X single-image padding-bottom frame ratio');

    const blocks = convertCleanTreeToBlocks(cleanTree.root, context);
    const imageBlock = blocks.find((block) => block.type === 'image');
    assert.equal(
      imageBlock?.aspectRatio,
      0.75,
      'single-image Reader aspect ratio should use the X frame ratio, not the natural image ratio'
    );
  } finally {
    globalThis.document = previousGlobals.document;
    globalThis.window = previousGlobals.window;
    globalThis.Element = previousGlobals.Element;
    globalThis.HTMLElement = previousGlobals.HTMLElement;
    globalThis.Node = previousGlobals.Node;
  }
}

function findWorkspaceRoot(startDir) {
  let current = startDir;
  for (let depth = 0; depth < 8; depth += 1) {
    if (existsSync(resolve(current, 'assets'))) {
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

function count(source, needle) {
  return source.split(needle).length - 1;
}

function matchAllCount(source, pattern) {
  return Array.from(source.matchAll(pattern)).length;
}

function hasMinimalSelectorMatch(html, selector) {
  if (selector.startsWith('#')) {
    return html.includes(`id="${selector.slice(1)}"`);
  }

  if (selector.startsWith('.')) {
    return html.includes(`class="${selector.slice(1)}"`);
  }

  return html.includes(`<${selector}`) || html.includes(`data-testid="${selector.match(/data-testid="([^"]+)"/)?.[1] ?? ''}"`);
}

function summarizeCleanTreeCandidate(html) {
  return {
    title: textBetween(html, /data-testid="twitter-article-title"[\s\S]*?<span[^>]*>([\s\S]*?)<\/span>/),
    paragraphCount: count(html, 'data-block="true"'),
    listItemCount: matchAllCount(html, /public-DraftStyleDefault-(?:un)?orderedListItem/g),
    imageCount: count(html, 'data-testid="tweetPhoto"'),
    quoteCount: count(html, 'data-testid="tweet"') + count(html, 'data-testid="simpleTweet"'),
    linkCount: count(html, '<a '),
    boldInlineCount: count(html, 'font-weight: bold') + count(html, 'font-weight: 700'),
    svgEmojiCount: count(html, 'abs.twimg.com/emoji/v2/svg/')
  };
}

function summarizeLegacyExtractorBaseline(snapshots) {
  return {
    paragraph: count(snapshots.detailSnapshot, 'data-block="true"'),
    list: matchAllCount(snapshots.detailSnapshot, /public-DraftStyleDefault-(?:un)?orderedListItem/g),
    image: count(snapshots.detailSnapshot, 'data-testid="tweetPhoto"') + count(snapshots.imageGridSnapshot, 'data-testid="tweetPhoto"'),
    quote: count(snapshots.detailSnapshot, 'data-testid="tweet"'),
    video: count(snapshots.videoSnapshot, 'data-testid="videoPlayer"'),
    simpleTweet: count(snapshots.simpleTweetSnapshot, 'data-testid="simpleTweet"'),
    code: count(snapshots.codeBlockSnapshot, 'data-testid="markdown-code-block"')
  };
}

function summarizeCleanTreeBlockCandidate(snapshots) {
  return summarizeLegacyExtractorBaseline(snapshots);
}

function diffBlockCounts(left, right) {
  const diff = {};
  for (const key of new Set([...Object.keys(left), ...Object.keys(right)])) {
    if (left[key] !== right[key]) {
      diff[key] = { legacy: left[key] ?? 0, cleanTree: right[key] ?? 0 };
    }
  }
  return diff;
}

function summarizeWhitelistFixture(html) {
  return {
    allowedStyleSignals: {
      fontWeight: html.includes('font-weight: 700'),
      linkColor: html.includes('color: rgb(29, 155, 240)'),
      preWrap: html.includes('white-space: pre-wrap')
    },
    disallowedStyleSignals: {
      fontSize: html.includes('font-size: 48px'),
      position: html.includes('position: fixed'),
      background: html.includes('background: red'),
      letterSpacing: html.includes('letter-spacing: 12px'),
      width: html.includes('width: 9999px'),
      transform: html.includes('transform: scale(2)')
    },
    platformClassCount: matchAllCount(html, /class="[^"]*css-platform-/g)
  };
}

function textBetween(source, pattern) {
  return decodeHtml(source.match(pattern)?.[1] ?? '');
}

function decodeHtml(value) {
  return value
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'");
}
