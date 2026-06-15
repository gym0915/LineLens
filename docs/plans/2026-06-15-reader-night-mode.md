# Reader Night Mode

## 背景

LineLens 当前 Reader 设计系统保留为日间模式：暖白低刺激阅读主题。/Users/steve/Downloads/DESIGN (10).md 中的 Spotlight Reading System 作为夜间模式主题来源，重点参数包括深色 navy 背景、纯白 active spotlight、低透明度 inactive 文本、680px 阅读宽度、20px 阅读正文和更圆润的容器半径。

## 设计系统落点

夜间模式只落在 public/styles/tokens.css：

- 新增 --reader-theme-night-* 主题 token，保存 DESIGN.md 中的夜间参数。
- 保持现有 --reader-system-*、--reader-text-*、--reader-radius-*、--reader-font-* 等语义 token 作为组件消费入口。
- 在 @media (prefers-color-scheme: dark) 中把语义 token 映射到夜间 token。
- 日间模式仍使用现有暖白 token，不改变当前业务结构和 Reader 渲染逻辑。

## 自动切换

主题切换完全依赖 CSS media query 与 custom properties。浏览器会跟随系统 Appearance / Color 设置。当系统设置为自动时，系统自身会根据时间或环境切换 light/dark，页面通过 prefers-color-scheme 自动收到结果，不需要 matchMedia、localStorage 或 Reader runtime 主题逻辑。

## 性能与维护

- 切换路径是 CSS media query + custom properties，避免 JS 监听和重新渲染。
- 组件继续读取语义 token，后续新增主题只需要扩展 token 映射。
- Spotlight blur 通过 --reader-highlight-backdrop-filter 控制，日间为 none，夜间为 blur(20px)，避免把效果写死在组件样式中。

## 验证

- npm run verify:reader-night-mode-system
- npm run verify:reader-radius-system
- npm run build
