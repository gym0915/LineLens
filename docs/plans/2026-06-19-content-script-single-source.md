# Content Script 单一来源边界

日期：2026-06-19

## 目标

本分支只解决一件事：消除 Content Script 里的双份业务实现。

修改前，`src/content/index.ts` 同时承担运行时入口和 X Article 业务提取逻辑，容易出现两套实现互相漂移。修改后，业务提取只保留在模块化 extractor 里，content 入口只负责把浏览器消息、页面变化和 extractor 调用串起来。

## 修改后的目录职责

```text
src/content/index.ts
  Content Script runtime orchestration。
  只负责监听消息、观察路由变化、等待页面可读、调用 extractor registry、发送结果。

src/content/extractors/**
  各平台文章提取业务入口。
  当前 X Article 的业务逻辑归 src/content/extractors/x/article-extractor.ts 管。

src/content/preprocess/**
  clean tree pipeline。
  负责 clone 后内容树的清理、语义映射、样式白名单和标准 ArticleBlock 生成。

scripts/build-content.mjs
  用 esbuild 把 src/content/index.ts 及其依赖打包成 dist/content.js。

dist/content.js
  Chrome manifest 实际加载的 classic content script。
  这里必须没有顶层 import/export，避免 classic content script 运行时报错。

scripts/verify-content-single-source.mjs
  单一来源守门脚本。
  防止 src/content/index.ts 重新定义 Article / ArticleBlock / extractXArticle / extractBlocks / validateArticle。
  同时检查 dist/content.js 仍保持 classic content script 兼容。
```

## 关键流程对应关系

```text
当前 URL / DOM
  -> src/content/index.ts 监听消息或路由变化
  -> extractor registry 选择平台 extractor
  -> xArticleExtractor.extract()
  -> configurableArticleExtractor.match(adapter)
  -> configurableArticleExtractor.waitUntilReady(adapter)
  -> find articleRoot / titleNode / contentRoot
  -> cloneNode(contentRoot)
  -> applyPlatformFixes
  -> applyCleanRules
  -> applySemanticMap
  -> applyStyleWhitelist
  -> clean tree
  -> standard ArticleBlock[]
  -> special component handlers / legacy high-risk 保真路径
  -> Article JSON
  -> Reader renderer / FocusUnit builder
```

大白话解释：

- `src/content/index.ts` 不再“自己懂 X 文章怎么拆”，它只负责接电话、找人干活、把结果发回去。
- `extractors/x/article-extractor.ts` 才是“懂 X Article 怎么提取”的地方。
- `preprocess/*` 是“把网页乱七八糟的 DOM 洗成干净内容树”的流水线。
- `build-content.mjs` 是“把模块化源码打成 Chrome 能直接加载的一份 content.js”的打包器。
- `verify-content-single-source.mjs` 是“防止以后又把业务逻辑塞回入口文件”的护栏。

## 对未来适配其他新闻资讯站的影响

新增平台时，优先新增：

```text
src/content/extractors/<platform>/**
```

并接入 extractor registry。不要把平台 selector、block 转换、内容校验写回 `src/content/index.ts`。

这样未来目录边界会保持稳定：

- 入口层不关心具体网站细节。
- 平台层只处理各自网站差异。
- preprocess 层复用通用清洗规则。
- Reader / FocusUnit 继续消费统一的 Article JSON。

## 文档同步说明

计划里提到的 `Agent.md` 和 `docs/technical/*` 位于外层 workspace，不在本 LineLens git worktree 内。本分支先提交 worktree 内可追踪文档。若要同步外层治理文档，需要另起一次明确的外层文档更新。
