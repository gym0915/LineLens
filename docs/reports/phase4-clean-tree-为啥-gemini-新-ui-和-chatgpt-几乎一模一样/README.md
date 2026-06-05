# Phase4 CleanTree Dump: 为啥 Gemini 新 UI 和 ChatGPT 几乎一模一样？.html

Title: 为啥 Gemini 新 UI 和 ChatGPT 几乎一模一样？

## Files

- Input HTML: `/Users/steve/ClaudeWork/Codex/LineByLine/LineLens/.worktrees/phase4-x-article-pipeline/assets2/为啥 Gemini 新 UI 和 ChatGPT 几乎一模一样？.html`
- cloneNode outerHTML: `/Users/steve/ClaudeWork/Codex/LineByLine/LineLens/.worktrees/phase4-x-article-pipeline/docs/reports/phase4-clean-tree-为啥-gemini-新-ui-和-chatgpt-几乎一模一样/01-longform-cloneNode.outerHTML.html`
- cleanTree outerHTML: `/Users/steve/ClaudeWork/Codex/LineByLine/LineLens/.worktrees/phase4-x-article-pipeline/docs/reports/phase4-clean-tree-为啥-gemini-新-ui-和-chatgpt-几乎一模一样/02-cleanTree.outerHTML.html`
- cleanTreeBlocks JSON: `/Users/steve/ClaudeWork/Codex/LineByLine/LineLens/.worktrees/phase4-x-article-pipeline/docs/reports/phase4-clean-tree-为啥-gemini-新-ui-和-chatgpt-几乎一模一样/03-cleanTreeBlocks.json`

## 1. CloneNode 具体内容是什么

运行时取的是 X Article longform 根节点：

```ts
const readView = document.querySelector(X_ARTICLE_SELECTORS.readView);
const longform = readView?.querySelector(X_ARTICLE_SELECTORS.longform);
const rawClone = longform.cloneNode(true);
```

当前样本的完整 cloneNode 内容已写入 `01-longform-cloneNode.outerHTML.html`。下面是文件开头片段：

```html
<div aria-describedby="placeholder-55b1d" class="public-DraftEditor-content" contenteditable="false" data-testid="longformRichTextComponent" spellcheck="false" style="outline: none; user-select: text; white-space: pre-wrap; overflow-wrap: break-word;"><div data-contents="true"><div class="longform-unstyled" data-block="true" data-editor="55b1d" data-offset-key="6ifd-0-0"><div data-offset-key="6ifd-0-0" class="public-DraftStyleDefault-block public-DraftStyleDefault-ltr"><span data-offset-key="6ifd-0-0"><span data-text="true">Gemini 最近上线了新版 UI，很多人的第一反应是——</span></span><span data-offset-key="6ifd-0-1" style="font-weight: bold;"><span data-text="true">"怎么有点眼熟？"</span></span><span data-offset-key="6ifd-0-2"><span data-text="true"> </span></span></div></div><section class="" data-block="true" data-editor="55b1d" data-offset-key="dpps-0-0" contenteditable="false"><div class="css-175oi2r r-kemksi r-1roi411 r-1xfd6ze r-rs99b7 r-15ce4ve r-18u37iz r-1udh08x r-13qz1uu r-1nxhmzv" data-testid="simpleTweet"><div class="css-175oi2r r-13awgt0"><article aria-labelledby="id__2cxjvag3l8 id__m9y5gwwwwd id__z3vs0vrcx3c id__c5nkop68g35 id__coxubad9wl id__56i9beubo3 id__bo9xitp4oeu id__h18wkjchkks id__bnjqt7hbg9g id__581oe4c05ih id__7suz9ky72t3 id__51s7mx05f73 id__qydbdd1am1 id__1llf8e11y4a id__rystq9c7in id__2z2tcnvfm1 id__v7c9rd7k7m id__wtcerg8rfb id__xpn2u7evob id__14co4xfulefg" role="article" tabindex="0" class="css-175oi2r r-18u37iz r-1udh08x r-1c4vpko r-1c7gwzm r-o7ynqc r-6416eg r-1ny4l3l r-1loqt21" data-testid="tweet"><div class="css-175oi2r r-eqz5dr r-16y2uox r-1wbh5a2"><div class="css-175oi2r r-16y2uox r-1wbh5a2 r-1ny4l3l"><div class="css-175oi2r"><div class="css-175oi2r r-18u37iz r-136ojw6"><div class="css-175oi2r r-1iusvr4 r-16y2uox r-ttdzmv"></div></div></div><div class="css-175oi2r r-18u37iz r-136ojw6"><div class="css-175oi2r r-18kxxzh r-1wron08 r-onrtq4 r-1awozwy"><div class="css-175oi2r" data-testid="Tweet-User-Avatar"><div class="css-175oi2r r-18kxxzh r-1wbh5a2 r-13qz1uu"><div class="css-175oi2r r-1wbh5a2 r-dnmrzs"><div class="css-175oi2r r-bztko3 r-1adg3ll" data-testid="UserAvatar-Container-pixel_updates" style="width: 40px; height: 40px;"><div class="r-1adg3ll r-13qz1uu" style="padding-bottom: 100%;"></div><div class="r-1p0dtai r-1pi2tsx r-1d2f490 r-u8s1d r-ipm5af r-13qz1uu"><div class="css-175oi2r r-1adg3ll r-1pi2tsx r-13qz1uu r-45ll9u r-u8s1d r-1v2oles r-176fswd r-bztko3"><div class="r-1adg3ll r-13qz1uu" style="padding-bottom: 100%;"></div><div class="r-1p0dtai r-1pi2tsx r-1d2f490 r-u8s1d r-ipm5af r-13qz1uu"><div class="css-175oi2r r-sdzlij r-1udh08x r-5f1w11 r-u8s1d r-8jfcpp" style="width: calc(100% + 4px); height: calc(100% + 4px);"><a href="/pixel_updates" aria-hidden="true" role="link" tabindex="-1" class="css-175oi2r r-1pi2tsx r-13qz1uu r-o7ynqc r-6416eg r-1ny4l3l r-1loqt21" style="background-color: rgba(0, 0, 0, 0);"><div class="css-175oi2r r-sdzlij r-1udh08x r-633pao r-45ll9u r-u8s1d r-1v2oles r-176fswd" style="width: calc(100% - 4px); height: calc(100% - 4px);"><div class="css-175oi2r r-1pi2tsx r-13qz1uu" style="background-color: rgba(0, 0, 0, 0);"></div></div><div class="css-175oi2r r-sdzlij r-1udh08x r-633pao r-45ll9u r-u8s1d r-1v2oles r-176fswd" style="width: calc(100% - 4px); height: calc(100% - 4px);"><div class="css-175oi2r r-1pi2tsx r-13qz1uu r-kemksi"></div></div><div class="css-175oi2r r-sdzlij r-1udh08x r-633pao r-45ll9u r-u8s1d r-1v2oles r-176fswd" style="background-color: rgb(0, 0, 0); width: calc(100% - 4px); height: calc(100% - 4px);"><div class="css-175oi2r r-1adg3ll r-1udh08x" style=""><div class="r-1adg3ll r-13qz1uu" style="padding-bottom: 100%;"></div><div class="r-1p0dtai r-1pi2tsx r-1d2f490 r-u8s1d r-ipm5af r-13qz1uu"><div class="css-175oi2r r-1mlwlqe r-1udh08x r-417010 r-aqfbo4 r-n1ft60 r-gf0ln r-agouwx r-1p0dtai r-1d2f490 r-u8s1d r-zchlnj r-ipm5af"><div class="css-175oi2r r-1niwhzg r-vvn4in r-u6sd8q r-1p0dtai r-1pi2tsx r-1d2f490 r-u8s1d r-zchlnj r-ipm5af r-13qz1uu r-1wyyakw r-4gszlv" style="filter: brightness(1); background-image: url(&quot;https://pbs.twimg.com/profile_images/1954712101186080768/e5yRhhqs_x96.jpg&quot;);"></div><img alt="" draggable="true" src="https://pbs.twimg.com/profile_images/1954712101186080768/e5yRhhqs_x96.jpg" class="css-9pa8cd"></div></div></div></div><div class="css-175oi2r r-sdzlij r-1udh08x r-45ll9u r-u8s1d r-1v2oles r-176fswd" style="width: calc(100% - 4px); height: calc(100% - 4px);"><div class="css-175oi2r r-172uzmj r-1pi2tsx r-13qz1uu r-o7ynqc r-6416eg r-1ny4l3l"></div></div></a></div></div></div></div></div></div></div></div></div><div class="css-175oi2r r-1iusvr4 r-16y2uox r-1777fci r-kzbkwu"><div class="css-175oi2r r-zl2h9q"><div class="css-175oi2r r-k4xj1c r-18u37iz r-1wtj0ep"><div class="css-175oi2r r-1d09ksm r-18u37iz r-1wbh5a2"><div class="css-175oi2r r-1wbh5a2 r-dnmrzs r-1ny4l3l"><div class="css-175oi2r r-1wbh5a2 r-dnmrzs r-1ny4l3l r-1awozwy r-18u37iz" id="id__coxubad9wl" data-testid="User-Name"><div class="css-175oi2r r-1awozwy r-18u37iz r-1wbh5a2 r-dnmrzs"><div class="css-175oi2r r-1wbh5a2 r-dnmrzs"><div class="css-175oi2r r-1wbh5a2 r-dnmrzs r-1ny4l3l"><div class="css-175oi2r r-1awozwy r-18u37iz r-1wbh5a2 r-dnmrzs"><div dir="ltr" class="css-146c3p1 r-bcqeeo r-1ttztb7 r-qvutc0 r-37j5jr r-a023e6 r-rjixqe r-b88u0q r-1awozwy r-6koalj r-1udh08x r-3s2u2q" style="color: rgb(231, 233, 234);"><span class="css-1jxf684 r-dnmrzs r-1udh08x r-1udbk01 r-3s2u2q r-bcqeeo r-1ttztb7 r-qvutc0 r-poiln3"><span class="css-1jxf684 r-bcqeeo r-1ttztb7 r-qvutc0 r-poiln3">Pixel Updates</span></span></div><div dir="ltr" class="css-146c3p1 r-bcqeeo r-1ttztb7 r-qvutc0 r-37j5jr r-a023e6 r-rjixqe r-16dba41 r-xoduu5 r-18u37iz r-1q142lx" style="color: rgb(231, 233, 234);"><span class="css-1jxf684 r-bcqeeo r-1ttztb7 r-qvutc0 r-poiln3 r-1awozwy r-xoduu5"></span></div></div></div></div></div><div class="css-175oi2r r-18u37iz r-1wbh5a2 r-1ez5h0i"><div class="css-175oi2r r-1d09ksm r-18u37iz r-1wbh5a2"><div class="css-175oi2r r-1wbh5a2 r-dnmrzs"><div tabindex=
<!-- truncated in README; see full artifact file -->
```

对应实现代码：

```ts
export function cloneContentTree(root: Element, context: CleanTreeContext): CloneContentTreeResult {
  const clonedRoot = root.cloneNode(true);
  if (!(clonedRoot instanceof Element)) {
    throw new Error('cloneContentTree expected an Element root clone');
  }

  const platformFixes = applyPlatformFixes(clonedRoot, context.adapter, context);
  const stats = sanitizeElementTree(clonedRoot, context.adapter);

  return {
    context,
    platformFixes,
    root: clonedRoot,
    ...stats
  };
}
```

## 2. 白名单有哪些

X Article adapter 的白名单配置：

```ts
styleWhitelist: {
    preserveProps: ['font-weight'],
    preserveColorFor: ['link'],
    preserveWhiteSpaceValues: ['pre', 'pre-wrap']
  }
```

属性保留白名单：

```ts
const PRESERVED_ATTRIBUTE_NAMES = new Set([
  'alt',
  'aria-label',
  'contenteditable',
  'datetime',
  'dir',
  'href',
  'lang',
  'rel',
  'role',
  'src',
  'style',
  'target',
  'title'
]);
```

data 属性保留白名单：

```ts
const PRESERVED_DATA_ATTRIBUTES = new Set([
  'data-block',
  'data-editor',
  'data-linelens-block-role',
  'data-linelens-emoji-image-url',
  'data-linelens-fix-folded-tweet-text',
  'data-linelens-heading-level',
  'data-linelens-list-kind',
  'data-linelens-media-aspect-ratio',
  'data-linelens-media-layout-height',
  'data-linelens-media-layout-direction',
  'data-linelens-media-layout-width',
  'data-linelens-video-hls-candidate',
  'data-offset-key',
  'data-testid',
  'data-text'
]);
```

节点移除名单：

```ts
const REMOVED_TAG_NAMES = new Set([
  'SCRIPT',
  'STYLE',
  'NOSCRIPT',
  'BUTTON',
  'INPUT',
  'TEXTAREA',
  'SELECT',
  'OPTION',
  'SVG'
]);
```

互动元素移除名单：

```ts
const INTERACTIVE_TEST_IDS = new Set([
  'bookmark',
  'like',
  'reply',
  'retweet',
  'unlike'
]);
```

style 白名单执行代码：

```ts
export function applyStyleWhitelistToTree(root: Element, config: StyleWhitelistConfig): void {
  for (const element of [root, ...Array.from(root.querySelectorAll('*'))]) {
    const inlineStyle = element.getAttribute('style');
    if (inlineStyle === null) {
      continue;
    }

    const filteredStyle = filterInlineStyle(inlineStyle, config, getStyleWhitelistContext(element, config));
    if (filteredStyle === '') {
      element.removeAttribute('style');
      continue;
    }

    element.setAttribute('style', filteredStyle);
  }
}

export function shouldPreserveStyleProperty(
  property: string,
  config: StyleWhitelistConfig,
  context: StylePropertyContext
): boolean {
  const normalizedProperty = property.toLowerCase().trim();
  const normalizedValue = context.value.toLowerCase().trim();
  const preserveProps = new Set(config.preserveProps.map((prop) => prop.toLowerCase().trim()));

  if (normalizedProperty === 'color') {
    const preserveColorFor = config.preserveColorFor ?? [];
    return (
      (context.isLink && preserveColorFor.includes('link')) ||
      (context.isInlineEmphasis && preserveColorFor.includes('inline-emphasis')) ||
      (context.matchesCustomColorSelector && preserveColorFor.includes('custom-selector')) ||
      context.isReadableText ||
      context.isCodeLike ||
      context.isTableLike
    );
  }

  if (context.isCodeLike && CODE_STYLE_PROPS.has(normalizedProperty)) {
    return true;
  }

  if (context.isTableLike && TABLE_STYLE_PROPS.has(normalizedProperty)) {
    return true;
  }

  if (context.isReadableText && READABLE_TEXT_STYLE_PROPS.has(normalizedProperty)) {
    return true;
  }

  if (normalizedProperty === 'white-space') {
    return (
      context.isPreformatted &&
      (config.preserveWhiteSpaceValues ?? []).map((value) => value.toLowerCase().trim()).includes(normalizedValue)
    );
  }

  if (EMPHASIS_STYLE_PROPS.has(normalizedProperty)) {
    return preserveProps.has(normalizedProperty);
  }

  return preserveProps.has(normalizedProperty);
}

function getStyleWhitelistContext(element: Element, config: StyleWhitelistConfig): StyleWhitelistContext {
  return {
    isLink: isLinkElement(element),
    isInlineEmphasis: isInlineEmphasisElement(element),
    isPreformatted: isPreformattedElement(element),
    isCodeLike: isCodeLikeElement(element),
    isReadableText: isReadableTextElement(element),
    isTableLike: isTableLikeElement(element),
    matchesCustomColorSelector: matchesCustomColorSelector(element, config)
  };
}
```

## 3. cleanTree 的具体内容

cleanTree 是 `cloneNode(true)` 之后，按平台 fixes、节点删除、属性保留、style whitelist 处理后的 DOM：

```ts
function sanitizeElementTree(root: Element, adapter: PlatformAdapter): {
  removedNodeCount: number;
  strippedAttributeCount: number;
  preservedAttributeCount: number;
} {
  let removedNodeCount = 0;
  let strippedAttributeCount = 0;
  let preservedAttributeCount = 0;

  const elements = Array.from(root.querySelectorAll('*'));
  for (const element of elements) {
    if (shouldRemoveElement(element)) {
      element.remove();
      removedNodeCount += 1;
    }
  }

  const retainedElements = [root, ...Array.from(root.querySelectorAll('*'))];
  for (const element of retainedElements) {
    preserveListSemantics(element);

    for (const attribute of Array.from(element.attributes)) {
      if (shouldPreserveAttribute(attribute.name)) {
        preservedAttributeCount += 1;
        continue;
      }

      element.removeAttribute(attribute.name);
      strippedAttributeCount += 1;
    }
  }

  applyStyleWhitelistToTree(root, adapter.styleWhitelist);

  return {
    preservedAttributeCount,
    removedNodeCount,
    strippedAttributeCount
  };
}
```

主路径现在仍保留 legacy merge 统计，但浏览器输出直接使用 cleanTreeBlocks：

```ts
export function buildCleanTreePrimaryBlocks(params: {
  sourceRoot: Element;
  adapter: PlatformAdapter;
  sourceUrl: string;
  debugId: string;
  legacyBlocks: ArticleBlock[];
}): CleanTreePrimaryBlocksResult {
  const context = createCleanTreeContext({
    adapter: params.adapter,
    sourceUrl: params.sourceUrl,
    debugId: params.debugId
  });
  const cleanTree = cloneContentTree(params.sourceRoot, context);
  const cleanTreeBlocks = convertCleanTreeToBlocks(cleanTree.root, context, {
    enabledBlockTypes: CLEAN_TREE_PRIMARY_BLOCK_TYPES
  });

  const mergeStats = mergeCleanTreePrimaryBlocks(params.legacyBlocks, cleanTreeBlocks);

  return {
    ...mergeStats,
    blocks: cleanTreeBlocks
  };
}
```

当前样本完整 cleanTree 内容已写入 `02-cleanTree.outerHTML.html`。下面是文件开头片段：

```html
<div contenteditable="false" data-testid="longformRichTextComponent"><div><div data-block="true" data-editor="55b1d" data-offset-key="6ifd-0-0"><div data-offset-key="6ifd-0-0"><span data-offset-key="6ifd-0-0"><span data-text="true">Gemini 最近上线了新版 UI，很多人的第一反应是——</span></span><span data-offset-key="6ifd-0-1" style="font-weight: bold"><span data-text="true">"怎么有点眼熟？"</span></span><span data-offset-key="6ifd-0-2"><span data-text="true"> </span></span></div></div><section data-block="true" data-editor="55b1d" data-offset-key="dpps-0-0" contenteditable="false"><div data-testid="simpleTweet" data-linelens-media-layout-direction="row"><div><article role="article" data-testid="tweet" data-linelens-media-layout-direction="row"><div data-linelens-media-layout-direction="column"><div><div><div><div></div></div></div><div data-linelens-media-layout-direction="row"><div><div data-testid="Tweet-User-Avatar"><div><div><div data-testid="UserAvatar-Container-pixel_updates"><div></div><div><div><div></div><div><div><a href="/pixel_updates" role="link"><div><div></div></div><div><div></div></div><div><div><div></div><div><div><div></div><img alt="" src="https://pbs.twimg.com/profile_images/1954712101186080768/e5yRhhqs_x96.jpg"></div></div></div></div><div><div></div></div></a></div></div></div></div></div></div></div></div></div><div><div><div><div><div><div data-testid="User-Name"><div><div><div><div><div dir="ltr" style="color: rgb(231, 233, 234)"><span><span>Pixel Updates</span></span></div><div dir="ltr" style="color: rgb(231, 233, 234)"><span></span></div></div></div></div></div><div><div><div><div><div dir="ltr" style="color: rgb(113, 118, 123)"><span>@pixel_updates</span></div></div></div><div dir="ltr" style="color: rgb(113, 118, 123)"><span>·</span></div><div><a href="/pixel_updates/status/2056658641747583451" dir="ltr" aria-label="5月19日" role="link" style="color: rgb(113, 118, 123)"><time datetime="2026-05-19T08:50:05.000Z">5月19日</time></a></div></div></div></div></div></div><div><div><div></div></div></div></div></div><div><div dir="ltr" style="color: rgb(113, 118, 123)"><span><span>翻译自 英语</span></span></div><div dir="auto" lang="zh" data-testid="tweetText" style="color: rgb(231, 233, 234)" data-linelens-fix-folded-tweet-text="candidate"><span>得到了新的 Gemini 界面，它非常漂亮！</span></div></div><div><div><div><div><div><div data-linelens-media-aspect-ratio="1.7778"><div></div><div><div data-linelens-media-layout-direction="row"><div data-linelens-media-layout-width="0.5" data-linelens-media-layout-height="1"><div><a href="/pixel_updates/status/2056658641747583451/photo/1" role="link"><div><div aria-label="图像" data-testid="tweetPhoto"><div></div><img alt="图像" src="https://pbs.twimg.com/media/HIq4IqNbEAADZQM?format=jpg&amp;name=small"></div></div></a></div></div><div data-linelens-media-layout-width="0.5" data-linelens-media-layout-height="1"><div><a href="/pixel_updates/status/2056658641747583451/photo/2" role="link"><div><div aria-label="图像" data-testid="tweetPhoto"><div></div><img alt="图像" src="https://pbs.twimg.com/media/HIq4IrAa4AAyVGC?format=jpg&amp;name=small"></div></div></a></div></div></div></div></div></div></div></div></div></div><div><div><div aria-label="6 回复、6 次转帖、213 喜欢、10 书签、5528 次观看" role="group"><div></div><div></div><div></div><div><a href="/pixel_updates/status/2056658641747583451/analytics" aria-label="5528 次查看。查看帖子分析" role="link"><div dir="ltr" style="color: rgb(113, 118, 123)"><div><div></div></div><div><span data-testid="app-text-transition-container"><span><span>5,528</span></span></span></div></div></a></div><div></div><div><div></div></div></div></div></div></div></div></div></div></article></div></div></section><div data-block="true" data-editor="55b1d" data-offset-key="aigc8-0-0"><div data-offset-key="aigc8-0-0"><span data-offset-key="aigc8-0-0"><span data-text="true">把它和 ChatGPT 并排打开，会发现一件有趣的事：两家公司，把最重要的产品入口——对话输入框——做成了几乎一模一样的样子。一个文本框、一个加号、一个语音按钮，仅此而已。</span></span></div></div><div data-block="true" data-editor="55b1d" data-offset-key="5tjtc-0-0"><div data-offset-key="5tjtc-0-0"><span data-offset-key="5tjtc-0-0"><span data-text="true">当一个产品形态被反复打磨、被海量用户验证之后，最优解往往会向同一个点靠拢。</span></span></div></div><div data-block="true" data-editor="55b1d" data-offset-key="avsqf-0-0"><div data-offset-key="avsqf-0-0"><span data-offset-key="avsqf-0-0" style="font-weight: bold"><span data-text="true">这个设计是怎么样的？</span></span></div></div><section data-block="true" data-editor="55b1d" data-offset-key="8cm4h-0-0" contenteditable="false"><div><div><div><div><div><a href="/hwwaanng/article/2056919573778292757/media/2056743985037938688" role="link"><div data-linelens-media-aspect-ratio="1.0435"><div></div><div><div aria-label="图像" data-testid="tweetPhoto"><div></div><img alt="图像" src="https://pbs.twimg.com/media/HIsFwd4bkAAwKTi?format=jpg&amp;name=medium"></div></div></div></a></div></div></div></div></div></section><div data-block="true" data-editor="55b1d" data-offset-key="1hr2e-0-0"><div data-offset-key="1hr2e-0-0"><span data-offset-key="1hr2e-0-0"><span data-text="true">一级输入栏，只保留了三个元素：</span></span></div></div><ol data-offset-key="4ptf7-0-0"><li data-block="true" data-editor="55b1d" data-offset-key="4ptf7-0-0" data-linelens-list-kind="ordered"><div data-offset-key="4ptf7-0-0"><span data-offset-key="4ptf7-0-0" style="font-weight: bold"><span data-text="true">加号（+）</span></span><span data-offset-key="4ptf7-0-1"><span data-text="true"> —— + 什么并没有说明，添加附件？</span></span></div></li><li data-block="true" data-editor="55b1d" data-offset-key="bdla3-0-0" data-linelens-list-kind="ordered"><div data-offset-key="bdla3-0-0"><span data-offset-key="bdla3-0-0" style="font-weight: bold"><span data-text="true">文本输入框</span></span><span data-offset-key="bdla3-0-1"><span data-text="true"> —— 主要交互入口</span></span></div></li><li data-block="true" data-editor="55b1d" data-offset-key="b38q3-0-0" data-linelens-list-kind="ordered"><div data-offset-key="b38q3-0-0"><span data-offset-key="b38q3-0-0" style="font-weight: bold"><span dat
<!-- truncated in README; see full artifact file -->
```

## 4. cleanTreeBlocks 具体内容

当前样本完整 cleanTreeBlocks 已写入 `03-cleanTreeBlocks.json`。下面是前 8 个 block：

```json
[
  {
    "id": "assets2:为啥-gemini-新-ui-和-chatgpt-几乎一模一样:clean-block-0",
    "text": "Gemini 最近上线了新版 UI，很多人的第一反应是——\"怎么有点眼熟？\"",
    "annotations": [
      {
        "startOffset": 0,
        "endOffset": 29,
        "color": "rgb(0, 0, 0)",
        "fontSize": "medium"
      },
      {
        "startOffset": 29,
        "endOffset": 38,
        "color": "rgb(0, 0, 0)",
        "fontSize": "medium",
        "bold": true
      }
    ],
    "textStyle": {
      "color": "rgb(0, 0, 0)",
      "fontSize": "medium"
    },
    "type": "paragraph"
  },
  {
    "id": "assets2:为啥-gemini-新-ui-和-chatgpt-几乎一模一样:clean-block-1",
    "type": "simple-tweet",
    "source": "X Tweet",
    "title": "Pixel Updates @pixel_updates · 5月19日",
    "excerpt": "得到了新的 Gemini 界面，它非常漂亮！",
    "href": "https://x.com/pixel_updates/status/2056658641747583451",
    "items": [
      {
        "type": "text",
        "text": "得到了新的 Gemini 界面，它非常漂亮！"
      },
      {
        "type": "photo-group",
        "photos": [
          {
            "src": "https://pbs.twimg.com/media/HIq4IqNbEAADZQM?format=jpg&name=small",
            "alt": "图像",
            "href": "https://x.com/pixel_updates/status/2056658641747583451/photo/1"
          },
          {
            "src": "https://pbs.twimg.com/media/HIq4IrAa4AAyVGC?format=jpg&name=small",
            "alt": "图像",
            "href": "https://x.com/pixel_updates/status/2056658641747583451/photo/2"
          }
        ],
        "layout": {
          "kind": "row",
          "children": [
            {
              "kind": "photo",
              "photo": {
                "src": "https://pbs.twimg.com/media/HIq4IqNbEAADZQM?format=jpg&name=small",
                "alt": "图像",
                "href": "https://x.com/pixel_updates/status/2056658641747583451/photo/1"
              },
              "widthRatio": 0.5,
              "heightRatio": 1
            },
            {
              "kind": "photo",
              "photo": {
                "src": "https://pbs.twimg.com/media/HIq4IrAa4AAyVGC?format=jpg&name=small",
                "alt": "图像",
                "href": "https://x.com/pixel_updates/status/2056658641747583451/photo/2"
              },
              "widthRatio": 0.5,
              "heightRatio": 1
            }
          ]
        },
        "aspectRatio": 1.7778
      }
    ],
    "authorName": "Pixel Updates",
    "authorHandle": "@pixel_updates",
    "authorAvatarUrl": "https://pbs.twimg.com/profile_images/1954712101186080768/e5yRhhqs_x96.jpg",
    "publishedAt": "2026-05-19T08:50:05.000Z",
    "publishedAtText": "5月19日",
    "metrics": {
      "views": "5,528"
    }
  },
  {
    "id": "assets2:为啥-gemini-新-ui-和-chatgpt-几乎一模一样:clean-block-2",
    "text": "把它和 ChatGPT 并排打开，会发现一件有趣的事：两家公司，把最重要的产品入口——对话输入框——做成了几乎一模一样的样子。一个文本框、一个加号、一个语音按钮，仅此而已。",
    "annotations": [
      {
        "startOffset": 0,
        "endOffset": 86,
        "color": "rgb(0, 0, 0)",
        "fontSize": "medium"
      }
    ],
    "textStyle": {
      "color": "rgb(0, 0, 0)",
      "fontSize": "medium"
    },
    "type": "paragraph"
  },
  {
    "id": "assets2:为啥-gemini-新-ui-和-chatgpt-几乎一模一样:clean-block-3",
    "text": "当一个产品形态被反复打磨、被海量用户验证之后，最优解往往会向同一个点靠拢。",
    "annotations": [
      {
        "startOffset": 0,
        "endOffset": 37,
        "color": "rgb(0, 0, 0)",
        "fontSize": "medium"
      }
    ],
    "textStyle": {
      "color": "rgb(0, 0, 0)",
      "fontSize": "medium"
    },
    "type": "paragraph"
  },
  {
    "id": "assets2:为啥-gemini-新-ui-和-chatgpt-几乎一模一样:clean-block-4",
    "text": "这个设计是怎么样的？",
    "annotations": [
      {
        "startOffset": 0,
        "endOffset": 10,
        "color": "rgb(0, 0, 0)",
        "fontSize": "medium",
        "bold": true
      }
    ],
    "textStyle": {
      "color": "rgb(0, 0, 0)",
      "fontSize": "medium"
    },
    "type": "paragraph"
  },
  {
    "id": "assets2:为啥-gemini-新-ui-和-chatgpt-几乎一模一样:clean-block-5",
    "type": "image",
    "src": "https://pbs.twimg.com/media/HIsFwd4bkAAwKTi?format=jpg&name=medium",
    "alt": "图像",
    "href": "/hwwaanng/article/2056919573778292757/media/2056743985037938688"
  },
  {
    "id": "assets2:为啥-gemini-新-ui-和-chatgpt-几乎一模一样:clean-block-6",
    "text": "一级输入栏，只保留了三个元素：",
    "annotations": [
      {
        "startOffset": 0,
        "endOffset": 15,
        "color": "rgb(0, 0, 0)",
        "fontSize": "medium"
      }
    ],
    "textStyle": {
      "color": "rgb(0, 0, 0)",
      "fontSize": "medium"
    },
    "type": "paragraph"
  },
  {
    "id": "assets2:为啥-gemini-新-ui-和-chatgpt-几乎一模一样:clean-block-7",
    "type": "list",
    "kind": "ordered",
    "items": [
      "加号（+） —— + 什么并没有说明，添加附件？",
      "文本输入框 —— 主要交互入口",
      "音频按钮 —— 语音模式"
    ],
    "itemAnnotations": [
      [
        {
          "startOffset": 0,
          "endOffset": 5,
          "color": "rgb(0, 0, 0)",
          "fontSize": "medium",
          "bold": true
        },
        {
          "startOffset": 6,
          "endOffset": 24,
          "color": "rgb(0, 0, 0)",
          "fontSize": "medium"
        }
      ],
      [
        {
          "startOffset": 0,
          "endOffset": 5,
          "color": "rgb(0, 0, 0)",
          "fontSize": "medium",
          "bold": true
        },
        {
          "startOffset": 6,
          "endOffset": 15,
          "color": "rgb(0, 0, 0)",
          "fontSize": "medium"
        }
      ],
      [
        {
          "startOffset": 0,
          "endOffset": 4,
          "color": "rgb(0, 0, 0)",
          "fontSize": "medium",
          "bold": true
        },
        {
          "startOffset": 5,
          "endOffset": 12,
          "color": "rgb(0, 0, 0)",
          "fontSize": "medium"
        }
      ]
    ],
    "itemTextStyles": [
      {
        "color": "rgb(0, 0, 0)",
        "fontSize": "medium",
        "textAlign": "match-parent"
      },
      {
        "color": "rgb(0, 0, 0)",
        "fontSize": "medium",
        "textAlign": "match-parent"
      },
      {
        "color": "rgb(0, 0, 0)",
        "fontSize": "medium",
        "textAlign": "match-parent"
      }
    ]
  }
]
```
