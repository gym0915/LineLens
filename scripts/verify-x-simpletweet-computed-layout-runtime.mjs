import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const html = `
  <article data-testid="simpleTweet">
    <div data-testid="tweet">
      <div data-testid="User-Name"><span>Layout Author</span><span>@layout</span></div>
      <div data-testid="tweetText">computed layout tweet</div>
      <div id="layout-root" data-display="flex" data-flex-direction="row" data-rect="0,0,400,300">
        <div id="left-branch" data-rect="0,0,300,300">
          <div data-testid="tweetPhoto" data-rect="0,0,300,300">
            <img src="https://example.com/left.jpg" alt="left">
          </div>
        </div>
        <div id="right-branch" data-display="flex" data-flex-direction="column" data-rect="300,0,100,300">
          <div id="right-top" data-rect="300,0,100,75">
            <div data-testid="tweetPhoto" data-rect="300,0,100,75">
              <img src="https://example.com/top.jpg" alt="top">
            </div>
          </div>
          <div id="right-bottom" data-rect="300,75,100,225">
            <div data-testid="tweetPhoto" data-rect="300,75,100,225">
              <img src="https://example.com/bottom.jpg" alt="bottom">
            </div>
          </div>
        </div>
      </div>
    </div>
  </article>
`;

const dom = new JSDOM(html, { url: 'https://x.com/i/article/1' });
const previousWindow = globalThis.window;
const previousElement = globalThis.Element;
const previousHTMLElement = globalThis.HTMLElement;
const previousNode = globalThis.Node;

globalThis.window = dom.window;
globalThis.Element = dom.window.Element;
globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.Node = dom.window.Node;

dom.window.getComputedStyle = (element) => ({
  display: element.getAttribute('data-display') ?? 'block',
  flexDirection: element.getAttribute('data-flex-direction') ?? 'row'
});

for (const element of Array.from(dom.window.document.querySelectorAll('[data-rect]'))) {
  element.getBoundingClientRect = () => {
    const [x, y, width, height] = element.getAttribute('data-rect').split(',').map(Number);
    return {
      x,
      y,
      width,
      height,
      top: y,
      right: x + width,
      bottom: y + height,
      left: x,
      toJSON() {
        return { x, y, width, height, top: y, right: x + width, bottom: y + height, left: x };
      }
    };
  };
}

try {
  const { extractSimpleTweetBlockFromRoot } = await import('../dist/content/extractors/x/simple-tweet.js');
  const { applyPlatformFixes } = await import('../dist/content/preprocess/apply-platform-fixes.js');
  const { xArticleAdapter } = await import('../dist/content/adapters/x-article-adapter.js');
  const block = await extractSimpleTweetBlockFromRoot(dom.window.document.querySelector('[data-testid="simpleTweet"]'), 'computed-layout');
  assert.equal(block.type, 'simple-tweet');

  const photoGroup = block.items.find((item) => item.type === 'photo-group');
  assert.ok(photoGroup, 'computed-layout fixture should extract a photo-group item');
  assert.equal(photoGroup.layout.kind, 'row', 'root media layout should use computed flex row without X classes');
  assert.equal(photoGroup.layout.children.length, 2, 'root media layout should preserve two media branches');

  const [left, right] = photoGroup.layout.children;
  assert.equal(left.kind, 'photo', 'left branch should resolve to a photo leaf');
  assert.equal(left.widthRatio, 0.75, 'left branch should preserve computed width ratio');
  assert.equal(right.kind, 'column', 'right branch should use computed flex column without X classes');
  assert.equal(right.widthRatio, 0.25, 'right branch should preserve computed width ratio');
  assert.equal(right.children.length, 2, 'right branch should preserve its nested column children');
  assert.equal(right.children[0].heightRatio, 0.25, 'top nested photo should preserve computed height ratio');
  assert.equal(right.children[1].heightRatio, 0.75, 'bottom nested photo should preserve computed height ratio');

  const platformFixes = applyPlatformFixes(dom.window.document.querySelector('[data-testid="simpleTweet"]'), xArticleAdapter, {
    adapter: xArticleAdapter,
    debugId: 'computed-layout-runtime',
    platform: 'x',
    sourceUrl: 'https://x.com/i/article/1'
  });
  const mediaLayoutFix = platformFixes.results.find((result) => result.id === 'preserve-x-media-layout');
  assert.ok(mediaLayoutFix?.applied, 'platform fixes should apply the media layout preservation fix');
  assert.equal(
    dom.window.document.querySelector('#layout-root').getAttribute('data-linelens-media-layout-direction'),
    'row',
    'platform fixes should preserve computed root row direction'
  );
  assert.equal(
    dom.window.document.querySelector('#left-branch').getAttribute('data-linelens-media-layout-width'),
    '0.75',
    'platform fixes should preserve computed left branch width ratio'
  );
  assert.equal(
    dom.window.document.querySelector('#right-branch').getAttribute('data-linelens-media-layout-width'),
    '0.25',
    'platform fixes should preserve computed right branch width ratio'
  );
  assert.equal(
    dom.window.document.querySelector('#right-branch').getAttribute('data-linelens-media-layout-direction'),
    'column',
    'platform fixes should preserve computed nested column direction'
  );
  assert.equal(
    dom.window.document.querySelector('#right-top').getAttribute('data-linelens-media-layout-height'),
    '0.25',
    'platform fixes should preserve computed nested top height ratio'
  );
  assert.equal(
    dom.window.document.querySelector('#right-bottom').getAttribute('data-linelens-media-layout-height'),
    '0.75',
    'platform fixes should preserve computed nested bottom height ratio'
  );
} finally {
  globalThis.window = previousWindow;
  globalThis.Element = previousElement;
  globalThis.HTMLElement = previousHTMLElement;
  globalThis.Node = previousNode;
}

console.log('SimpleTweet computed layout runtime verification passed.');
