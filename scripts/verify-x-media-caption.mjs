import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { JSDOM } from 'jsdom';

const projectRoot = resolve(import.meta.dirname, '..');
const sourceFiles = {
  types: readFileSync(resolve(projectRoot, 'src/shared/article.ts'), 'utf8'),
  extractor: readFileSync(resolve(projectRoot, 'src/content/extractors/x/article-extractor.ts'), 'utf8'),
  cleanTree: readFileSync(resolve(projectRoot, 'src/content/preprocess/clean-tree-block-converter.ts'), 'utf8'),
  platformFixes: readFileSync(resolve(projectRoot, 'src/content/preprocess/apply-platform-fixes.ts'), 'utf8'),
  renderer: [
    readFileSync(resolve(projectRoot, 'src/reader/block-renderer.ts'), 'utf8'),
    readFileSync(resolve(projectRoot, 'src/reader/renderers/text-block-renderer.ts'), 'utf8')
  ].join('\n'),
  blocksCss: readFileSync(resolve(projectRoot, 'public/styles/blocks.css'), 'utf8'),
  tokensCss: readFileSync(resolve(projectRoot, 'public/styles/tokens.css'), 'utf8')
};

assert.match(sourceFiles.types, /export type ParagraphBlock = \{[\s\S]*?role\?: 'caption'/, 'ParagraphBlock should carry a caption role');

for (const [name, source] of [
  ['modular extractor', sourceFiles.extractor],
  ['platform fixes', sourceFiles.platformFixes]
]) {
  assert.match(source, /twitter-article-media-caption-id/, `${name} should recognize X article media caption DOM`);
  assert.match(source, /caption-/, `${name} should recognize X article media caption id prefixes`);
}
assert.match(sourceFiles.cleanTree, /data-linelens-block-role/, 'clean-tree converter should consume platform-neutral caption metadata');
assert.doesNotMatch(sourceFiles.cleanTree, /twitter-article-media-caption-id/, 'clean-tree converter should not directly recognize X article media caption DOM');

assert.match(sourceFiles.renderer, /reader-media-caption/, 'Reader should render media captions with a dedicated class');
assert.match(sourceFiles.blocksCss, /\.reader-media-caption\s*\{[\s\S]*?font-size:\s*var\(--reader-media-caption-source-size, var\(--reader-media-caption-size\)\)/, 'Reader caption CSS should prefer the parsed source font size');
assert.match(sourceFiles.tokensCss, /--reader-media-caption-size:\s*14px;/, 'Reader should expose a design-token fallback for media caption font size');

const captionHtml = `
  <div data-testid="longformRichTextComponent">
    <div class="css-175oi2r r-knv0ih" id="caption-2022543578803962302">
      <div class="twitter-article-media-caption-id" style="font-size: 15px; line-height: 21px;">
        <div class="css-175oi2r r-37j5jr">
          <div class="DraftEditor-root">
            <div class="DraftEditor-editorContainer">
              <div class="public-DraftEditor-content" data-testid="longformRichTextComponent" style="white-space: pre-wrap; overflow-wrap: break-word;">
                <div data-contents="true">
                  <div class="longform-unstyled" data-block="true" data-editor="7ji33" data-offset-key="9blar-0-0">
                    <div data-offset-key="9blar-0-0" class="public-DraftStyleDefault-block public-DraftStyleDefault-ltr">
                      <span data-offset-key="9blar-0-0"><span data-text="true">Prompt:风格与氛围：一支关于中国新年的高级时尚动态图形视频。</span></span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
`;

const dom = new JSDOM(captionHtml, { url: 'https://x.com/example/article/2022543578803962302' });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.Element = dom.window.Element;
globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.HTMLVideoElement = dom.window.HTMLVideoElement;
globalThis.HTMLImageElement = dom.window.HTMLImageElement;
globalThis.Node = dom.window.Node;

const { extractXArticleLegacyBlocksForDebug } = await import('../dist/content/extractors/x/article-extractor.js');
const { cloneContentTree, createCleanTreeContext } = await import('../dist/content/preprocess/clone-content-tree.js');
const { convertCleanTreeToBlocks } = await import('../dist/content/preprocess/clean-tree-block-converter.js');
const { buildCleanTreePrimaryBlocks } = await import('../dist/content/preprocess/clean-tree-main-path.js');
const { xArticleAdapter } = await import('../dist/content/adapters/x-article-adapter.js');
const { renderArticleShell } = await import('../dist/reader/block-renderer.js');

const longform = document.querySelector('[data-testid="longformRichTextComponent"]');
const legacyBlocks = await extractXArticleLegacyBlocksForDebug({
  longform,
  articleId: '2022543578803962302',
  capturedVideos: []
});

assert.equal(legacyBlocks.length, 1, 'legacy extractor should read the caption block');
assert.equal(legacyBlocks[0].type, 'paragraph');
assert.equal(legacyBlocks[0].role, 'caption', 'legacy extractor should mark media caption paragraphs');
assert.equal(legacyBlocks[0].textStyle.fontSize, '15px', 'legacy extractor should parse the caption computed font size');

const context = createCleanTreeContext({
  adapter: xArticleAdapter,
  sourceUrl: 'https://x.com/example/article/2022543578803962302',
  debugId: 'x-media-caption'
});
const cleanTree = cloneContentTree(longform, context);
const cleanBlocks = convertCleanTreeToBlocks(cleanTree.root, context);

assert.equal(cleanBlocks.length, 1, 'clean-tree converter should read the caption block');
assert.equal(cleanBlocks[0].type, 'paragraph');
assert.equal(cleanBlocks[0].role, 'caption', 'clean-tree converter should preserve caption role after class/id sanitization');

const mergedBlocks = buildCleanTreePrimaryBlocks({
  sourceRoot: longform,
  adapter: xArticleAdapter,
  sourceUrl: 'https://x.com/example/article/2022543578803962302',
  debugId: 'x-media-caption-merged',
  legacyBlocks
}).blocks;

assert.equal(mergedBlocks.length, 1, 'production clean-tree merge should keep the caption block');
assert.equal(mergedBlocks[0].type, 'paragraph');
assert.equal(mergedBlocks[0].role, 'caption', 'production clean-tree merge should keep the caption role');
assert.equal(mergedBlocks[0].textStyle.fontSize, '15px', 'production clean-tree merge should keep the parsed caption font size');

const article = {
  id: 'caption-reader-fixture',
  source: 'x-article',
  sourceUrl: 'https://x.com/example/article/2022543578803962302',
  canonicalUrl: 'https://x.com/example/article/2022543578803962302',
  title: 'Caption Reader Fixture',
  extractedAt: 1,
  blocks: [
    {
      id: 'caption-block',
      type: 'paragraph',
      role: 'caption',
      text: 'Prompt:风格与氛围：一支关于中国新年的高级时尚动态图形视频。',
      textStyle: {
        fontSize: '15px',
        lineHeight: '21px'
      }
    },
    {
      id: 'body-block',
      type: 'paragraph',
      text: '普通正文段落'
    }
  ]
};

const rendered = renderArticleShell(article);
const caption = rendered.querySelector('[data-block-id="caption-block"]');
const body = rendered.querySelector('[data-block-id="body-block"]');

assert(caption, 'Reader should render caption block');
assert.equal(caption.dataset.blockRole, 'caption', 'Reader should expose caption role in the rendered DOM');
assert(caption.className.split(/\s+/).includes('reader-media-caption'), 'Reader should style caption separately from body paragraphs');
assert.equal(caption.style.getPropertyValue('--reader-media-caption-source-size'), '15px', 'Reader should use the parsed X caption font size');
assert.equal(caption.style.getPropertyValue('--reader-media-caption-source-line-height'), '21px', 'Reader should use the parsed X caption line height');
assert.equal(body.style.getPropertyValue('--reader-media-caption-source-size'), '', 'ordinary paragraphs should not receive caption font sizing');
