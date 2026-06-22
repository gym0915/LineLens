# 通用文章提取器 TODO

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 补齐通用文章提取器，让后续新增新闻资讯平台时优先写平台 adapter 配置，而不是复制一套平台专用 extractor。

**Architecture:** 当前 xArticleExtractor 仍保留 X 特有 metadata、HLS、simpleTweet、imageGallery 等高保真路径；本计划把通用的 root/title/content 定位、readiness、cleanRules、semanticMap block 转换、validation 收敛到可复用的 configurable article extractor。迁移必须分阶段进行，每一步都要证明 X 当前输出不回退。

**Tech Stack:** TypeScript、MV3 content script、JSDOM verifier、现有 clean-tree pipeline、现有 PlatformAdapter / settings merge。

---

## 当前基线

- [x] 主分支已移除微信 adapter，当前内置 adapter 只有 x.article。
- [x] PlatformAdapter 已有 semanticMap 与 specialComponents 字段。
- [ ] semanticMap 目前还是声明式配置，尚未驱动 clean-tree-block-converter 的候选选择。
- [x] specialComponents 目前只声明 x.simple-tweet 与 x.video-or-gif，还没有 handler registry。
- [x] src/content/index.ts 已是 content runtime orchestration，不应该重新放回平台业务逻辑。

## 非目标

- 不在第一轮新增第二个平台。
- 不删除 xArticleExtractor 的 X 专用逻辑。
- 不一次性迁移 video / simpleTweet / imageGallery 等高风险路径。
- 不把 Reader 渲染逻辑放进 extractor。
- 不允许 settings 注入 script、函数、任意 HTML template 或 Reader DOM。

## 总体验收标准

- npm run build
- npm run verify:content-single-source
- npm run verify:m3-adapters-settings
- npm run verify:phase4-pipeline-baseline
- npm run verify:phase4-x-article-full
- 受影响的 X 专项 verifier 按实际改动补跑，例如：
  - npm run verify:x-media-caption
  - npm run verify:x-article-image-gallery
  - npm run verify:x-simpletweet-flow

---

## Step 1：让 semanticMap 进入 clean-tree block conversion

目标：把 semanticMap 从“只声明不消费”推进到“clean-tree converter 实际读取”，同时保证 X 默认配置下输出不变。

**Status:** completed

**Checklist:**

- [x] Task 1.1：为 semanticMap 消费路径写失败验证。
- [x] Task 1.2：抽出 semantic selector 解析 helper。
- [x] Task 1.3：锁住 X 默认行为不变。

### Task 1.1：为 semanticMap 消费路径写失败验证

**Files:**

- Modify: scripts/verify-m3-adapters-settings.mjs
- Modify: scripts/verify-phase4-pipeline-baseline.mjs
- Test fixture can be inline JSDOM in verifier；如需复用可新增 fixtures/ 下最小 HTML。

**Steps:**

- [x] 在 verifier 中构造一个最小 clean-tree DOM，包含自定义 heading、quote、ordered list、unordered list、image、code、table selector。
- [x] 调用 convertCleanTreeToBlocks(root, context)，其中 context.adapter.semanticMap 使用测试自定义 selector。
- [x] 先断言当前实现失败：因为 converter 仍使用硬编码 selector。
- [x] 失败信息必须指向具体语义类型，例如 semanticMap.headingSelector should drive clean-tree heading detection。

**Run:**

~~~bash
npm run build
npm run verify:phase4-pipeline-baseline
~~~

**Expected before implementation:** verify:phase4-pipeline-baseline 失败，提示 semanticMap 未被 converter 消费。

### Task 1.2：抽出 semantic selector 解析 helper

**Files:**

- Create: src/content/preprocess/semantic-map-selectors.ts
- Modify: src/content/preprocess/clean-tree-block-converter.ts
- Modify: src/content/preprocess/clone-content-tree.ts（仅在需要把 adapter 透传给 context 时修改）

**Implementation notes:**

- [x] 新增 helper resolveSemanticSelectors(map)，输出完整 ResolvedSemanticSelectors：
  - blockSelector
  - paragraphSelector
  - headingSelector
  - quoteSelector
  - orderedListSelector
  - unorderedListSelector
  - imageSelector
  - imageGallerySelector
  - codeSelector
  - tableSelector
  - linkSelector
  - textSelector
- [x] convertCleanTreeToBlocks() 从 context.adapter.semanticMap 解析 selector。
- [x] 顶层候选 query 不再直接写死 X selector；应由 resolved selectors 组合生成。
- [x] 判断函数如 isHeadingElement()、isQuoteElement()、isCodeElement() 需要使用 resolved selector，而不是只看 tag/class。
- [x] 默认 X adapter 下 block 输出必须不变。

**Run:**

~~~bash
npm run build
npm run verify:phase4-pipeline-baseline
npm run verify:m3-adapters-settings
~~~

**Expected after implementation:** semanticMap verifier 通过，Phase4 baseline 中 legacy/cleanTree block count 不回退。

### Task 1.3：锁住 X 默认行为不变

**Files:**

- Modify: scripts/verify-phase4-x-article-full.mjs
- Modify as needed: scripts/verify-phase4-x-article-boundaries.mjs

**Steps:**

- [x] 对 X fixture 统计关键 block 类型数量。
- [x] 确认 X 的 heading、quote、list、image、code、table、simpleTweet、imageGallery 仍能进入 clean-tree block conversion。
- [x] 确认 video 仍保持 high-risk dual-track，不被 Step 1 误迁移。

**Run:**

~~~bash
npm run verify:phase4-x-article-full
npm run verify:phase4-x-article-boundaries
~~~

---

## Step 2：扩展 adapter schema：cleanRules / readiness / validation

目标：把“删除广告/按钮/推荐区/评论区”“DOM 是否 ready”“Article 是否有效”从硬编码策略推进到 adapter 可配置策略。

**Status:** completed

**Checklist:**

- [x] Task 2.1：新增类型定义
- [x] Task 2.2：给 xArticleAdapter 写当前事实配置
- [x] Task 2.3：settings merge 支持新字段
- [x] Task 2.4：把 readiness / validation verifier 先接到配置，不改变 runtime

### Task 2.1：新增类型定义

**Files:**

- Modify: src/content/adapters/adapter-types.ts

**Add types:**

- CleanRulesConfig
  - removeSelectors?: string[]
  - unwrapSelectors?: string[]
  - preserveAttributeNames?: string[]
- ReadinessConfig
  - minTextLength?: number
  - minBlockCount?: number
  - requiredSelectors?: string[]
  - stableDomMs?: number
- ValidationConfig
  - minBlockCount?: number
  - minTextLength?: number
  - titleStrategy?: required | optional | fallback-from-h1
  - emptyContentStrategy?: reject | allow-media-only

**Extend:**

- PlatformAdapter.cleanRules?: CleanRulesConfig
- PlatformAdapter.readiness?: ReadinessConfig
- PlatformAdapter.validation?: ValidationConfig
- PlatformAdapterUserConfig.cleanRules?: Partial<CleanRulesConfig>
- PlatformAdapterUserConfig.readiness?: Partial<ReadinessConfig>
- PlatformAdapterUserConfig.validation?: Partial<ValidationConfig>

### Task 2.2：给 xArticleAdapter 写当前事实配置

**Files:**

- Modify: src/content/adapters/x-article-adapter.ts

**X default config should express current behavior:**

- readiness.requiredSelectors 包含：
  - [data-testid="twitterArticleReadView"]
  - [data-testid="twitter-article-title"]
  - [data-testid="longformRichTextComponent"]
- readiness.minBlockCount 对齐当前 X detector。
- readiness.minTextLength 对齐当前 X detector。
- validation.minBlockCount 对齐 article-validator 当前默认。
- validation.minTextLength 对齐 article-validator 当前默认。
- cleanRules.removeSelectors 先保守表达脚本、按钮、交互控件、推荐/评论候选，不改变现有 X 输出。

### Task 2.3：settings merge 支持新字段

**Files:**

- Modify: src/shared/settings.ts
- Modify: scripts/verify-m3-adapters-settings.mjs

**Rules:**

- selector array 只接受非空字符串。
- number 只接受有限正数。
- enum 只接受白名单值。
- unknown key 丢弃。
- 空 selector / 空数组按字段策略回退默认或忽略。
- 不允许注入 script、函数、template。

**Run:**

~~~bash
npm run verify:m3-adapters-settings
~~~

### Task 2.4：把 readiness / validation verifier 先接到配置，不改变 runtime

**Files:**

- Modify: scripts/verify-m3-adapters-settings.mjs
- Modify: scripts/verify-phase4-pipeline-baseline.mjs

**Expected:**

- verifier 能证明新字段存在、可 merge、非法配置被丢弃。
- runtime 行为暂不要求由这些字段驱动。

---

## Step 3：建立 configurableArticleExtractor 骨架

目标：新增通用 extractor 模块，先在 verifier 中使用，不立即替换 X 主路径。

**Status:** completed

**Checklist:**

- [x] Task 3.1：新增 configurable extractor 文件
- [x] Task 3.2：为最小通用页面写 verifier
- [x] Task 3.3：验证 X adapter 可被 configurable extractor 读取

### Task 3.1：新增 configurable extractor 文件

**Files:**

- Create: src/content/extractors/configurable/configurable-article-extractor.ts
- Create: src/content/extractors/configurable/index.ts
- Create or modify verifier: scripts/verify-configurable-article-extractor.mjs
- Modify: package.json

**Initial API:**

- matchConfigurableArticle(adapter, url): boolean
- waitUntilConfigurableArticleReady(adapter, context): ReadyResult
- extractConfigurableArticle(adapter, context): Article

**Behavior:**

- 使用 adapter host / urlPatterns 判断 URL。
- 使用 adapter root/title/content selector 定位 DOM。
- 使用 adapter readiness 判断 ready。
- 使用 cloneContentTree + convertCleanTreeToBlocks 生成 blocks。
- 使用 adapter validation 或现有 validateArticle 做校验。
- Article metadata 第一版只保证 id、source、sourceUrl、canonicalUrl、title、extractedAt、blocks。

### Task 3.2：为最小通用页面写 verifier

**Files:**

- Modify: scripts/verify-configurable-article-extractor.mjs

**Fixture should include:**

- article root
- title
- content root
- paragraph
- heading
- quote
- ordered list
- unordered list
- image
- code
- table
- link text

**Run:**

~~~bash
npm run build
npm run verify:configurable-article-extractor
~~~

**Expected:**

- 不依赖 X DOM 也能产出标准 Article JSON。
- ArticleBlock 类型覆盖 paragraph/heading/quote/list/image/code/table。

### Task 3.3：验证 X adapter 可被 configurable extractor 读取

**Files:**

- Modify: scripts/verify-configurable-article-extractor.mjs

**Steps:**

1. 用 X fixture 调用 configurable extractor。
2. 只验证低风险 block 类型。
3. 不要求 simpleTweet/video/imageGallery 与 legacy 完全一致。

**Expected:**

- 证明 X adapter 已具备通用 extractor 的基础输入能力。
- 不改变 xArticleExtractor 主路径。

---

## Step 4：逐步迁移 X extractor，保留高风险专用路径

目标：让 X extractor 复用 configurable extractor 的通用阶段，但继续保留 X 专用 metadata、HLS、simpleTweet、imageGallery 和 high-risk fallback。

**Status:** completed

**Checklist:**

- [x] Task 4.1：抽出 X metadata 与 high-risk 逻辑边界
- [x] Task 4.2：X extractor 委托 configurable extractor 的 root/title/content/readiness
- [x] Task 4.3：X extractor 委托 configurable clean-tree 低风险 block path
- [x] Task 4.4：建立 specialComponents handler registry 的最小接口

### Task 4.1：抽出 X metadata 与 high-risk 逻辑边界

**Files:**

- Modify: src/content/extractors/x/article-extractor.ts
- Optional create: src/content/extractors/x/article-metadata.ts
- Optional create: src/content/extractors/x/article-legacy-blocks.ts

**Steps:**

1. 把 metadata 逻辑从 extract() 主函数中抽成独立 helper。
2. 把 legacy block extraction 保留为独立 helper。
3. 保证 extract() 主函数只负责 orchestration。

**Run:**

~~~bash
npm run build
npm run verify:phase4-x-article-full
~~~

### Task 4.2：X extractor 委托 configurable extractor 的 root/title/content/readiness

**Files:**

- Modify: src/content/extractors/x/article-extractor.ts
- Modify: src/content/extractors/configurable/configurable-article-extractor.ts

**Steps:**

1. xArticleExtractor.waitUntilReady() 调用 configurable readiness。
2. xArticleExtractor.extract() 复用 configurable 的 root/title/content 定位。
3. X 仍自行补充 author、metrics、coverImage、canonicalUrl。

**Run:**

~~~bash
npm run verify:x-article-b1-b9
npm run verify:x-article-b10-b15
npm run verify:phase4-x-article-full
~~~

### Task 4.3：X extractor 委托 configurable clean-tree 低风险 block path

**Files:**

- Modify: src/content/extractors/x/article-extractor.ts
- Modify: src/content/extractors/configurable/configurable-article-extractor.ts
- Modify as needed: src/content/preprocess/clean-tree-main-path.ts

**Steps:**

1. configurable extractor 返回 cleanTreeBlocks 与 diagnostics。
2. X extractor 继续提供 legacyBlocks。
3. 通过 mergeCleanTreePrimaryBlocks() 合并低风险 block。
4. video 仍 high-risk dual-track。
5. simpleTweet/imageGallery 保持现有 verifier 通过。

**Run:**

~~~bash
npm run verify:phase4-pipeline-baseline
npm run verify:x-simpletweet-flow
npm run verify:x-article-image-gallery
npm run verify:x-media-caption
~~~

### Task 4.4：建立 specialComponents handler registry 的最小接口

**Files:**

- Create: src/content/extractors/configurable/special-component-handlers.ts
- Modify: src/content/adapters/adapter-types.ts
- Modify: scripts/verify-configurable-article-extractor.mjs

**Initial API:**

- SpecialComponentHandler.handlerId: string
- SpecialComponentHandler.extract(root, context): ArticleBlock | null

**Rules:**

- registry 只接受代码内注册的 handler。
- adapter settings 只能选择 handlerId，不能注入函数。
- unknown handler 回退为普通 clean-tree block 或跳过，不能执行用户配置。

**Run:**

~~~bash
npm run verify:configurable-article-extractor
npm run verify:m3-adapters-settings
~~~

---

## 推荐提交节奏

1. test: cover semantic map driven clean-tree conversion
2. feat: route clean-tree conversion through semantic map
3. feat: add adapter readiness validation and clean rules schema
4. test: cover configurable article extractor baseline
5. feat: add configurable article extractor skeleton
6. refactor: delegate x article generic extraction stages
7. feat: add special component handler registry skeleton

## 每轮合并前检查

~~~bash
git status --short --branch
npm run build
npm run verify:content-single-source
npm run verify:m3-adapters-settings
npm run verify:phase4-pipeline-baseline
~~~

如涉及 X 输出或 Reader 渲染，再补跑对应专项 verifier。
