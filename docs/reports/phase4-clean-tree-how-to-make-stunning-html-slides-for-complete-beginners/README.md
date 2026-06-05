# Phase4 CleanTree Dump: How to make stunning HTML slides (for complete beginners).html

Title: How to make stunning HTML slides (for complete beginners)

## Files

- Input HTML: `/Users/steve/ClaudeWork/Codex/LineByLine/LineLens/.worktrees/phase4-x-article-pipeline/assets2/How to make stunning HTML slides (for complete beginners).html`
- cloneNode outerHTML: `/Users/steve/ClaudeWork/Codex/LineByLine/LineLens/.worktrees/phase4-x-article-pipeline/docs/reports/phase4-clean-tree-how-to-make-stunning-html-slides-for-complete-beginners/01-longform-cloneNode.outerHTML.html`
- cleanTree outerHTML: `/Users/steve/ClaudeWork/Codex/LineByLine/LineLens/.worktrees/phase4-x-article-pipeline/docs/reports/phase4-clean-tree-how-to-make-stunning-html-slides-for-complete-beginners/02-cleanTree.outerHTML.html`
- cleanTreeBlocks JSON: `/Users/steve/ClaudeWork/Codex/LineByLine/LineLens/.worktrees/phase4-x-article-pipeline/docs/reports/phase4-clean-tree-how-to-make-stunning-html-slides-for-complete-beginners/03-cleanTreeBlocks.json`

## 1. CloneNode 具体内容是什么

运行时取的是 X Article longform 根节点：

```ts
const readView = document.querySelector(X_ARTICLE_SELECTORS.readView);
const longform = readView?.querySelector(X_ARTICLE_SELECTORS.longform);
const rawClone = longform.cloneNode(true);
```

当前样本的完整 cloneNode 内容已写入 `01-longform-cloneNode.outerHTML.html`。下面是文件开头片段：

```html
<div aria-describedby="placeholder-7tp09" class="public-DraftEditor-content" contenteditable="false" data-testid="longformRichTextComponent" spellcheck="false" style="
                                                                            outline: none;
                                                                            user-select: text;
                                                                            white-space: pre-wrap;
                                                                            overflow-wrap: break-word;
                                                                        ">
                                                                        <div data-contents="true">
                                                                            <div class="longform-unstyled" data-block="true" data-editor="7tp09" data-offset-key="bb8l4-0-0">
                                                                                <div data-offset-key="bb8l4-0-0" class="public-DraftStyleDefault-block public-DraftStyleDefault-ltr">
                                                                                    <span data-offset-key="bb8l4-0-0"><span data-text="true">Don't
                                                                                            make
                                                                                            PowerPoint
                                                                                            decks.
                                                                                            Make
                                                                                            HTML
                                                                                            slides
                                                                                            that
                                                                                            look
                                                                                            like
                                                                                            these:</span></span>
                                                                                </div>
                                                                            </div>
                                                                            <section class="" data-block="true" data-editor="7tp09" data-offset-key="delne-0-0" contenteditable="false">
                                                                                <div class="css-175oi2r r-1nxhmzv">
                                                                                    <div class="css-175oi2r r-13qz1uu">
                                                                                        <div class="css-175oi2r r-1867qdf r-1udh08x r-o7ynqc r-6416eg r-1ny4l3l">
                                                                                            <div class="css-175oi2r">
                                                                                                <div class="css-175oi2r r-1pi2tsx" data-testid="tweetPhoto">
                                                                                                    <div class="css-175oi2r" style="">
                                                                                                        <div class="css-175oi2r r-1adg3ll r-1udh08x">
                                                                                                            <div class="r-1adg3ll r-13qz1uu" style="
                                                                                                                    padding-bottom: 56.1508%;
                                                                                                                "></div>
                                                                                                            <div class="r-1p0dtai r-1pi2tsx r-1d2f490 r-u8s1d r-ipm5af r-13qz1uu">
                                                                                                                <div class="css-175oi2r r-1p0dtai r-1d2f490 r-u8s1d r-zchlnj r-ipm5af" data-testid="placementTracking">
                                                                                                                    <div class="css-175oi2r r-1p0dtai r-1d2f490 r-u8s1d r-zchlnj r-ipm5af" data-testid="videoPlayer">
                                                                                                                        <div class="css-175oi2r r-1adg3ll r-1udh08x r-bnwqim r-1pi2tsx r-13qz1uu">
                                                                                                                            <div class="r-1adg3ll r-13qz1uu" style="
                                                                                                                                    padding-bottom: 56.1508%;
                                                                                                                                "></div>
                                                                                                                            <div class="r-1p0dtai r-1pi2tsx r-1d2f490 r-u8s1d r-ipm5af r-13qz1uu">
                                                                                                                                <div data-testid="videoComponent" style="
                                                                                                                                        height: 100%;
                                                                                                                                        position: relative;
                                                                                                               
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
      (context.matchesCustomColorSelector && preserveColorFor.includes('custom-selector'))
    );
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
<div contenteditable="false" data-testid="longformRichTextComponent">
                                                                        <div>
                                                                            <div data-block="true" data-editor="7tp09" data-offset-key="bb8l4-0-0">
                                                                                <div data-offset-key="bb8l4-0-0">
                                                                                    <span data-offset-key="bb8l4-0-0"><span data-text="true">Don't
                                                                                            make
                                                                                            PowerPoint
                                                                                            decks.
                                                                                            Make
                                                                                            HTML
                                                                                            slides
                                                                                            that
                                                                                            look
                                                                                            like
                                                                                            these:</span></span>
                                                                                </div>
                                                                            </div>
                                                                            <section data-block="true" data-editor="7tp09" data-offset-key="delne-0-0" contenteditable="false">
                                                                                <div>
                                                                                    <div>
                                                                                        <div>
                                                                                            <div>
                                                                                                <div data-testid="tweetPhoto">
                                                                                                    <div>
                                                                                                        <div>
                                                                                                            <div></div>
                                                                                                            <div>
                                                                                                                <div data-testid="placementTracking">
                                                                                                                    <div data-testid="videoPlayer" data-linelens-video-hls-candidate="assets2:how-to-make-stunning-html-slides-for-complete-beginners">
                                                                                                                        <div>
                                                                                                                            <div></div>
                                                                                                                            <div>
                                                                                                                                <div data-testid="videoComponent">
                                                                                                                                    <div>
                                                                                                                                        <div>
                                                                                                                                            <video aria-label="嵌入式视频">
                                                                                                                                                <source src="blob:https://x.com/6327e273-dbc0-4ab8-9a16-813468b86384">
                                                                                                                                            </video>
                                                                                                                                        </div>
                                                                                                                                    </div>
                                                                                                                                    <div>
                                                                                                                                        <div>
                                                                                                                                            <div>
                                                                                                                                                <div></div>
                                                                                                                                                <div>
                                                                                                                                                    <div>
                                                                                                                                                        <div></div>
                                                            
<!-- truncated in README; see full artifact file -->
```

## 4. cleanTreeBlocks 具体内容

当前样本完整 cleanTreeBlocks 已写入 `03-cleanTreeBlocks.json`。下面是前 8 个 block：

```json
[
  {
    "id": "assets2:how-to-make-stunning-html-slides-for-complete-beginners:clean-block-0",
    "text": "Don't make PowerPoint decks. Make HTML slides that look like these:",
    "annotations": [],
    "type": "paragraph"
  },
  {
    "id": "assets2:how-to-make-stunning-html-slides-for-complete-beginners:clean-block-1",
    "type": "image",
    "src": "https://pbs.twimg.com/amplify_video_thumb/2053916866964590592/img/3pE8XJrlgNBM7EQC.jpg",
    "alt": ""
  },
  {
    "id": "assets2:how-to-make-stunning-html-slides-for-complete-beginners:clean-block-2",
    "text": "If you want to adopt a more AI-native way of working but don't know where to start, the easiest and highest-leverage thing you can do is probably starting to replace all your PPT decks with HTML slides.",
    "annotations": [
      {
        "startOffset": 84,
        "endOffset": 202,
        "bold": true
      }
    ],
    "type": "paragraph"
  },
  {
    "id": "assets2:how-to-make-stunning-html-slides-for-complete-beginners:clean-block-3",
    "text": "HTML slides are taking over the world because:",
    "annotations": [],
    "type": "paragraph"
  },
  {
    "id": "assets2:how-to-make-stunning-html-slides-for-complete-beginners:clean-block-4",
    "type": "list",
    "kind": "ordered",
    "items": [
      "AI is very good at generating beautiful HTML, especially arranging text and images into boxed layouts (since their training data contains lots of websites)",
      "Humans are visual animals. We simply like beautiful things. The most important thing your slides need to do is to capture someone's attention",
      "It is FAST. If you have a presentation in half an hour and need a quick deck, you simply don't have time to push boxes around in PowerPoint. Just send the content to AI and it will magically arrange all the content in beautiful layouts in A COUPLE MINUTES",
      "Users have told me that they got extremely positive feedback from audiences because they usually have never seen anything like this, and admire how AI-native the presenter is"
    ],
    "itemAnnotations": [
      [],
      [],
      [],
      []
    ]
  },
  {
    "id": "assets2:how-to-make-stunning-html-slides-for-complete-beginners:clean-block-5",
    "text": "Here's a practical guide for complete beginners, without assuming prior knowledge in coding, using an agent, or knowing about GitHub or skills:",
    "annotations": [
      {
        "startOffset": 25,
        "endOffset": 143,
        "bold": true
      }
    ],
    "type": "paragraph"
  },
  {
    "id": "assets2:how-to-make-stunning-html-slides-for-complete-beginners:clean-block-6",
    "type": "list",
    "kind": "ordered",
    "items": [
      "Go to AnyGen (You can get started for free and get free credits)",
      "Select \"Build slides\" -> \"Frontend\", then choose a template you like"
    ],
    "itemAnnotations": [
      [
        {
          "startOffset": 6,
          "endOffset": 12,
          "href": "https://www.anygen.io/slides?type=frontend_slides",
          "target": "_blank"
        },
        {
          "startOffset": 6,
          "endOffset": 12,
          "href": "https://www.anygen.io/slides?type=frontend_slides",
          "target": "_blank"
        }
      ],
      []
    ]
  },
  {
    "id": "assets2:how-to-make-stunning-html-slides-for-complete-beginners:clean-block-7",
    "type": "list",
    "kind": "ordered",
    "items": [
      "Type your instruction for creating the slides in the prompt box",
      "Iterate and edit. All HTML decks are editable in AnyGen! Just click on any text to edit, or click on \"Boss mode\" to give targeted edits in batch: just comment on elements to tell AI what to change"
    ],
    "itemAnnotations": [
      [],
      []
    ]
  }
]
```
