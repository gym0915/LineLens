# Substack Assets3 适配差异报告

## 状态

- Worktree：`/Users/steve/ClaudeWork/Codex/LineByLine/LineLens/.worktrees/substack-assets3-adaptation`
- 分支：`feature/substack-assets3-adaptation`
- 范围：仅限 Substack assets3 适配，以及必要的共享 Article JSON / clean-tree / Reader 渲染 plumbing。
- 合并状态：尚未合并到 `main`；等待用户明确确认后再执行 fast-forward merge。

## 改动前

- Substack 运行时范围仍包含较宽的 `/p/...` 以及 Latent Space / custom-domain 路径。
- Substack root/title selector 主要面向 newsletter post，不稳定覆盖 assets3 中 podcast 形态的 DOM。
- `scripts/verify-substack-article-fixture.mjs` 只覆盖早期 assets2 fixture；assets3 完整页面和组件 DOM 还没有固化为 verifier 合同。
- Substack 特殊组件覆盖有限；Paywall 会被 clean rules 移除，SubscribeWidget 没有明确的 Article JSON 映射。
- Reader 的 embed 渲染不消费 `EmbedBlock` rich-text annotations，因此 embed 文本中保留下来的 CTA / link / underline / bold 语义没有平台中立的渲染路径。

## 改动后

- Substack 运行时范围收窄为 `substack.com/inbox/post/...` 和 `substack.com/home/post/...`；本阶段有意不支持 `/p/...` 和 Latent Space / custom-domain。
- `substack.article` 覆盖 newsletter 与 podcast article root、稳定 title fallback、assets3 组件 block root，并通过 clean-rule 保留安全组件属性。
- Assets3 由三个 verifier 合同覆盖：
  - `verify:substack-assets3-fixtures`
  - `verify:substack-assets3-components`
  - `verify:substack-url-scope`
- Substack 特殊组件映射到现有 Article JSON 形态：
  - YouTube -> `EmbedBlock(provider: 'youtube')`
  - Video -> 能拿到安全 direct media 时输出 `VideoBlock`，否则输出 `EmbedBlock(provider: 'substack')`
  - Audio -> `EmbedBlock(provider: 'substack')`
  - Footnote -> 轻量 `ParagraphBlock`
  - Paywall / SubscribeWidget -> 平台中立的 `EmbedBlock(provider: 'substack')`
  - Twitter 仍是通用 `EmbedBlock(provider: 'x')`，不是 X 的 `simple-tweet`
- 安全样式与布局保留现在覆盖 rich text annotations 和可表达的 media/layout metadata：
  - 粗体、斜体、下划线、链接、target
  - 字号、行高、颜色、对齐；仅在能安全作为文本 metadata 承载时保留
  - 支持的媒体比例、cover/poster、object-fit/object-position
  - Paywall / Subscribe 的可读 CTA 文案和安全链接；不保留原站 script、事件或 raw DOM
- Reader 使用平台中立的 `reader-text-renderer` 渲染 embed rich text，并在 embed 文本自身已经包含链接时避免生成嵌套 anchor。

## 文件分组

Substack adapter 和 handler：

- `src/content/adapters/substack-article-adapter.ts`
- `src/content/extractors/substack/assets3-component-handler.ts`
- `src/content/extractors/substack/index.ts`
- `src/content/extractors/configurable/register-built-in-special-handlers.ts`
- `src/content/extractors/configurable/configurable-article-extractor.ts`

共享 schema / clean-tree plumbing：

- `src/shared/article.ts`
- `src/content/preprocess/clone-content-tree.ts`

Reader 渲染：

- `src/reader/renderers/social-embed-renderer.ts`
- `src/reader/reader-text-renderer.ts`
- `src/reader/style-policy.ts`

Scope 与 verifier 合同：

- `public/manifest.json`
- `src/background/index.ts`
- `package.json`
- `scripts/verify-substack-assets3-fixtures.mjs`
- `scripts/verify-substack-assets3-components.mjs`
- `scripts/verify-substack-url-scope.mjs`
- `scripts/verify-substack-article-fixture.mjs`
- `scripts/verify-configurable-article-extractor.mjs`
- `scripts/verify-m3-adapters-settings.mjs`
- `scripts/verify-adapter-manifest-scope.mjs`
- `scripts/verify-x-article-b10-b15.mjs`

## Phase 6 验证

已在 worktree 中通过：

```bash
npm run verify:phase4-pipeline-baseline
npm run verify:phase4-x-article-full
npm run verify:phase4-x-article-boundaries
npm run verify:x-article-image-gallery
npm run verify:x-media-caption
npm run verify:x-simpletweet-flow
npm run verify:x-simpletweet-video
npm run verify:x-video-b31-b39
```

结果：PASS。共享 clean-tree、media、Reader renderer、X image gallery、X caption、X simpleTweet、X video 路径没有回退。

## Phase 7 验证

已在 worktree 中通过：

```bash
npm run build
npm run verify:content-single-source
npm run verify:m3-adapters-settings
npm run verify:adapter-manifest-scope
npm run verify:generic-converter-platform-neutral
npm run verify:special-components-platform-boundary
npm run verify:configurable-article-extractor
npm run verify:substack-article-fixture
npm run verify:substack-assets3-fixtures
npm run verify:substack-assets3-components
npm run verify:substack-url-scope
npm run verify:reader-platform-neutral-header
npm run verify:reader-m1-m2
npm run verify:reader-shared-media
```

结果：PASS。最终验收时，`verify:m3-adapters-settings` 暴露了一个过期断言：它仍期望 `substack.article.contentSelector` 指向 `.available-content .body.markup`。当前 assets3 合同有意不设置 `contentSelector`，这样 configurable extractor 会使用 article root，从而能映射 body markup 外部的 assets3 组件。已更新 verifier 以匹配该合同；生产 adapter 行为未改变。

## 剩余风险

- 真实 Substack 页面仍可能出现 captured assets3 DOM 之外的变化；本阶段是 fixture-locked，合并后应继续做手动 smoke testing。
- `blob:` video URL 有意不保留；当无法拿到安全 direct media URL 时，Reader 会展示带文本 / poster 的平台中立 Substack embed fallback。
- Audio 表示为 `EmbedBlock`，没有新增 audio-specific ArticleBlock。
- `/p/...`、`latent.space` 和其他 custom domain 是本阶段明确的非目标。
