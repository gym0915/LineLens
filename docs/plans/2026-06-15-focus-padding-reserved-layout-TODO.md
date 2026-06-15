# Focus Padding Reserved Layout TODO

关联方案：[2026-06-15-focus-padding-reserved-layout.md](./2026-06-15-focus-padding-reserved-layout.md)

目标：让普通段落 FocusUnit 在未 focus 时就预留 active 高亮边距，避免 focus 前后一行变两行的视觉跳动。

## 执行任务

### 1. 文档同步

- [x] 新增 focus 边距预留技术方案。
- [x] 新增独立 TODO。

### 2. Verifier 先行

- [x] 更新 `scripts/verify-reader-inline-highlight-clean-style.mjs`。
- [x] 验证 `p .focus-unit` 默认态预留 inline highlight padding。
- [x] 验证 `p .focus-unit.is-active` 不再引入额外 layout padding delta。
- [x] 复用 `scripts/verify-reader-a3-a4.mjs` 的测量宽度回归，覆盖 reserved padding width 会阻止临界合并。

### 3. CSS 实现

- [x] 修改 `public/styles/focus.css`。
- [x] 将 paragraph inline highlight padding 移到 `p .focus-unit` 默认态。
- [x] active 状态只保留背景、阴影、颜色等视觉变化。
- [x] 继续使用 `--reader-inline-highlight-padding-*` 和 `--reader-radius-card`，不写死值。

### 4. 测量实现

- [x] 修改 `src/reader/focus-unit-builder.ts`。
- [x] 从 computed style 读取 `--reader-inline-highlight-padding-inline`。
- [x] 传给 splitter 的 `maxLineWidth` 扣除左右 reserved padding。
- [x] 保留无 DOM/无 canvas 时的 fallback。

### 5. 验证

- [x] 运行 `npm run build`。
- [x] 运行 `npm run verify:reader-inline-highlight-clean-style`。
- [x] 运行 `npm run verify:reader-a3-a4`。
- [x] 运行 `npm run verify:reader-a6-a7`。
