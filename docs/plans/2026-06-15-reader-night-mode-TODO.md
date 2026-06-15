# Reader Night Mode TODO

## 范围

- [x] 以当前暖白低刺激主题作为日间模式基线。
- [x] 根据 /Users/steve/Downloads/DESIGN (10).md 建立夜间模式主题 token。
- [x] 使用 CSS prefers-color-scheme 跟随系统 Appearance / Color 自动切换。
- [x] 系统设置为自动时，由浏览器/系统媒体查询自动完成日夜切换。
- [x] 仅修改设计系统、验证脚本和文档，不引入 Reader 业务逻辑。

## 执行

- [x] 新增 verify:reader-night-mode-system 静态校验。
- [x] 先运行校验并确认因为夜间主题缺失而失败。
- [x] 在 public/styles/tokens.css 中新增夜间主题 token 和 dark media 覆盖。
- [x] 更新 LineLens/docs/ 中的夜间模式说明。
- [x] 运行 npm run verify:reader-night-mode-system。
- [x] 运行现有设计系统相关验证。
- [x] 运行 npm run build。
- [ ] 提交并推送，提交备注 New night mode added。
