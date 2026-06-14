# 布局感知 Reader 高亮 TODO

关联方案：[2026-06-13-layout-aware-reader-focus.md](./2026-06-13-layout-aware-reader-focus.md)

目标：让段落高亮跟随浏览器真实视觉换行，而不是只按语义片段高亮；高亮切换时文本不应因为 active 样式重新排版。

## 当前状态

- [x] 已确认问题根因：段落 .focus-unit.is-active 的 inline padding 参与排版，导致激活不同片段时浏览器重新换行。
- [x] 已写技术方案：保留语义切分，再增加浏览器布局测量后的视觉行片段。
- [x] 已实现 TextOffsetIndex 文本 offset 映射。
- [x] 已实现视觉行片段生成与测量。
- [x] 已接入 Reader focus 构建。
- [x] 已让段落 active 高亮不改变 inline 排版宽度。
- [x] 已兼容字体加载、resize 和旧进度 ID。
- [x] 已加入截图中英文句子的回归验证。

## 执行任务

### 1. 文本 offset 映射

- [x] 新建 src/reader/text-offset-index.ts。
- [x] 新建 scripts/verify-reader-layout-focus.mjs。
- [x] 在 package.json 增加 verify:reader-layout-focus。
- [x] 先写失败验证：嵌套 strong/link/span 后仍能把 DOM 文本映射回全局 offset。
- [x] 实现 TextOffsetIndex.from()、resolve()、resolveRange()。
- [x] 运行 npm run verify:reader-layout-focus 通过。

### 2. 视觉行片段生成

- [x] 新建 src/reader/visual-line-fragmenter.ts。
- [x] 实现纯函数 createVisualLineFragments()。
- [x] 针对 reported sentence 验证 p1-u2 可拆成 p1-u2-l1、p1-u2-l2。
- [x] 实现 measureVisualLineBreakOffsets()，用 Range.getClientRects() 判断真实换行。
- [x] 无可用 Range 或 rect 数据时回退为语义片段。
- [x] 运行 npm run verify:reader-layout-focus 通过。

### 3. 接入 FocusUnit 构建

- [x] 修改 src/reader/focus-unit-builder.ts。
- [x] 保留 splitIntoReadingUnits() 作为第一阶段语义切分。
- [x] 段落渲染完成后建立 TextOffsetIndex。
- [x] 根据真实视觉行生成可导航片段。
- [x] 给视觉片段增加 parentUnitId。
- [x] 非段落 block 的 focus 行为保持不变。
- [x] 运行 npm run verify:reader-layout-focus 和 npm run verify:reader-a6-a7 通过。

### 4. 高亮样式稳定化

- [x] 修改 public/styles/focus.css。
- [x] 移除或替换段落 active 高亮中会改变 inline 宽度的 padding。
- [x] 如需新增视觉外扩 token，写入 public/styles/tokens.css。
- [x] 更新 scripts/verify-reader-inline-highlight-clean-style.mjs。
- [x] 确认 active 高亮仍使用设计 token，不引入硬编码圆角。
- [x] 运行 npm run verify:reader-inline-highlight-clean-style 通过。

### 5. 字体加载与 resize

- [x] 修改 src/reader/reader-app.ts。
- [x] 初始渲染先使用语义 fallback，避免阅读器不可用。
- [x] document.fonts.ready 后触发布局感知重建。
- [x] 增加 ResizeObserver，宽度变化后 debounce 重算。
- [x] 重算前移除会影响测量的 active/muted 状态，重算后恢复当前 focus。
- [x] 验证 resize 后 active unit 能映射到最近视觉片段。

### 6. 进度兼容

- [x] 扩展 FocusUnit 或局部视觉片段类型，支持 parentUnitId。
- [x] 旧进度 ID 如 p1-u2 应恢复到 p1-u2-l1。
- [x] 新进度 ID 如 p1-u2-l2 应精确恢复。
- [x] 不新增存储迁移。
- [x] 更新 scripts/verify-reader-a6-a7.mjs 或 scripts/verify-reader-layout-focus.mjs 覆盖兼容逻辑。

### 7. 回归验证

- [x] 用截图中的原句建立固定回归：
  Here's a practical guide for complete beginners, without assuming prior knowledge in coding, using an agent, or knowing about GitHub or skills:
- [x] 验证第二个语义片段仍是：
  without assuming prior knowledge in coding,
- [x] 在窄宽度下验证视觉片段为：
  without assuming prior knowledge
  in coding,
- [x] 验证切换 p1-u2-l1 / p1-u2-l2 不改变片段文本和 offset。
- [x] 验证相同宽度下重复重建 ID 稳定。

## 最终验收命令

从 LineLens 仓库根目录运行：

- [x] npm run build
- [x] npm run verify:reader-layout-focus
- [x] npm run verify:reader-inline-highlight-clean-style
- [x] npm run verify:reader-a6-a7
