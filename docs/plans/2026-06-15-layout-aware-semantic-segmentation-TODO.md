# Layout-Aware Semantic Focus Segmentation TODO

关联方案：[2026-06-15-layout-aware-semantic-segmentation.md](./2026-06-15-layout-aware-semantic-segmentation.md)

目标：优化普通段落的语义切分，减少过碎 FocusUnit，并通过正则保护技术 token，避免路径、文件扩展名和 IP 地址被句号规则拆开。

## 执行任务

### 1. 文档同步

- [x] 新增语义分割方案文档。
- [x] 新增独立 TODO，不复用已完成的段落整行高亮 TODO。

### 2. Verifier 先行

- [x] 在 `scripts/verify-reader-a3-a4.mjs` 增加短句合并回归。
- [x] 验证 `一个下午。代码不到40行。` 可作为一个 FocusUnit。
- [x] 验证真实测量宽度可阻止会换行的候选合并。
- [x] 验证隐藏目录路径不被 `.` 拆开，例如 `.claude/skills/`、`~/.claude/skills/`。
- [x] 验证文件扩展名不被拆开，覆盖 allowlist 中的常见扩展。
- [x] 验证 IPv4、端口和 CIDR 不被拆开。
- [x] 验证原始 offset 仍能映射回原文。

### 3. 正则保护实现

- [x] 扩展 `findProtectedRanges()`。
- [x] 新增隐藏路径保护规则。
- [x] 新增文件扩展名保护规则。
- [x] 新增 IPv4 / port / CIDR 保护规则。
- [x] 保留 URL、括号、版本号和小数保护行为。

### 4. 宽度感知合并

- [x] 增加语义候选合并阶段，让强标点只生成候选边界。
- [x] 在浏览器环境支持按 Reader 行宽测量候选合并。
- [x] 在 Node verifier 环境提供 CJK/ASCII 宽度估算 fallback。
- [x] 只在合并后预计仍为一行时合并。
- [x] 避免生成明显跨多行的超长 FocusUnit。

### 5. 验证

- [x] 运行 `npm run build`。
- [x] 运行 `npm run verify:reader-a3-a4`。
- [x] 根据影响面补跑 Reader 相关 verifier：`npm run verify:reader-a6-a7`。
