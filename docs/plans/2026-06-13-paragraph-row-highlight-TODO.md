# 普通段落整行高亮 TODO

关联技术方案：[2026-06-13-layout-aware-reader-focus.md](./2026-06-13-layout-aware-reader-focus.md)

## 需求理解

- [x] 普通文字段落不再按语义片段高亮。
- [x] 普通文字段落改为按阅读行一行一行导航。
- [x] 当前行高亮宽度应接近 Reader 阅读宽度，而不是文字自身宽度。
- [x] 高亮视觉样式保持现有 Reader token：背景、圆角、阴影和 active 文本色不重做。
- [x] 行切换需要有轻微上下平移过渡动画。
- [x] ol、ul、引用、代码、媒体、表格、链接、simple tweet 等组件保持现有表现。
- [x] semantic-splitter、TextOffsetIndex、Range visual fragment 相关代码保留，不删除。
- [x] Reader 保持最小阅读宽度，不为任意窄屏重新设计高亮换行。
- [x] 段落行要尽可能填满阅读宽度，避免语义短片段造成行尾大段空白。
- [x] 段落行拆分必须把高亮内边距计入可用文字宽度，避免 active 行内部再次换行。

## 执行任务

### 1. 文档同步

- [x] 更新技术方案，说明旧语义 + Range 混合方案不再作为普通段落主路径。
- [x] 新增本 TODO，跟踪普通段落整行高亮需求。

### 2. Verifier 先行

- [x] 更新 scripts/verify-reader-layout-focus.mjs。
- [x] 验证旧工具代码仍存在：semantic-splitter.ts、text-offset-index.ts、visual-line-fragmenter.ts。
- [x] 验证普通段落不再按语义逗号切成短片段。
- [x] 验证普通段落生成 p1-line-1、p1-line-2 这类行级 focus unit。
- [x] 验证行级 focus 文本尽可能填满目标阅读行长度。

### 3. 段落行拆分实现

- [x] 新增或改造普通段落行拆分逻辑。
- [x] 英文按词边界贪心填充目标行长。
- [x] 中文或无空格文本按字符目标长度切分。
- [x] 保留原始 annotation offset，行内 strong/link 等文本注解继续由 createReaderTextSpan() 渲染。
- [x] 普通段落路径不再调用 splitIntoReadingUnits() 和 Range measurement。
- [x] 浏览器环境优先用真实 Range 宽度测量候选行，并扣除高亮左右内边距。
- [x] 无真实布局能力时使用保守字符数 fallback。
- [x] 针对 “If you want to adopt...” 这段文本建立回归，确保第二行不会把 your PPT decks 合并进同一个高亮行。

### 4. 段落整行高亮样式

- [x] 修改 public/styles/focus.css。
- [x] p .focus-unit 改为 block / full width / border-box。
- [x] p .focus-unit 在 inactive 状态也预留高亮内边距，避免 active 后改变可用文字宽度。
- [x] active 高亮保持现有背景、圆角、阴影、active 文本色。
- [x] 增加轻微 translateY 过渡。
- [x] 不影响 .reader-list-item、blockquote、code、media、table、simple tweet 等其他 focus 样式。

### 5. Reader 宽度约束

- [x] 修改 public/styles/layout.css。
- [x] Reader shell 保持阅读列宽，同时声明最小阅读宽度。
- [x] 响应式窄屏仍可使用现有 mobile overrides。

### 6. 验证

- [x] npm run build
- [x] npm run verify:reader-layout-focus
- [x] npm run verify:reader-inline-highlight-clean-style
- [x] npm run verify:reader-a6-a7
