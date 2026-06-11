# SimpleTweet 组件内布局解析层计划

## Summary
在 `simple-tweet` legacy 提取器内部新增一个通用的组件布局解析层：保留 simpleTweet 作为独特组件边界，但不再为每个视觉 case 写专用子结构。第一期只接入 simpleTweet，布局来源使用原页面 DOM 上的 `getComputedStyle()`，目标是保住结构布局：上下/左右、媒体顺序、网格、比例和核心间距；字体、主题、外层卡片风格仍由 Reader 控制。`layoutTree` 缺失或不完整时继续走现有模板兜底。

## Key Changes
- 在 `SimpleTweetBlock` 增加可选 `layoutTree?: SimpleTweetLayoutNode`，旧字段 `excerpt/photos/video/author/metrics` 保持兼容。
- 新增 simpleTweet 内部 layout AST：
  - `container`：`display: block | flex | grid`、`direction`、`gapPx`、`alignItems`、`justifyContent`、`aspectRatio`。
  - `leaf`：引用现有内容字段，如 `textRef: 'excerpt'`、`photoIndex`、`videoRef: true`。
  - `role`：只用于语义定位，限定为 `root | header | body | media | text | photo | video | actions | quotedTweet`。
- 新增解析器，例如 `extractSimpleTweetLayoutTree(tweetRoot, extractedMedia)`：
  - 在 clean-tree 之前、legacy simpleTweet 提取期间运行。
  - 对原 DOM 调 `getComputedStyle()` 读取 `display/flexDirection/gridTemplateColumns/gap/alignItems/justifyContent/width/height/aspectRatio/objectFit`。
  - 只保留布局白名单字段，不保留颜色、字体、position、transform、动画。
  - 识别 `tweetText`、`tweetPhoto`、`videoPlayer`、嵌套 `tweet/simpleTweet` 为 leaf 或容器节点。
- Reader 渲染：
  - `block.layoutTree` 存在时走 `renderSimpleTweetLayoutTree(block)`。
  - leaf 节点从现有 `excerpt/photos/video` 取内容，不直接信任原 HTML。
  - layoutTree 不可用时保留现有 `renderSimpleTweetBlock` 分支作为 fallback。
- 同步维护两份 X 提取实现：
  - `LineLens/src/content/extractors/x/article-extractor.ts`
  - `LineLens/src/content/index.ts`

## Implementation Steps
1. 写 verifier：新增 `verify:x-simpletweet-layout-tree`，覆盖 5 个 fixture：
   - text-only：只生成文本纵向 layout。
   - tweet/quoted：识别嵌套 tweet 与 quoted content。
   - multi-photo：生成媒体 grid/row-column 结构，不只靠 `photos.length`。
   - video tweet：生成 text + video layout。
   - video + quoted text/photo：保留主 tweet 上下布局和 quoted 内部左右布局。
2. 扩展 shared 类型，导出 `SimpleTweetLayoutNode`，并保持 `SimpleTweetBlock` 旧字段可选兼容。
3. 实现 simpleTweet layout parser：
   - 从 `data-testid` 锚点建立组件叶子节点。
   - 从 `getComputedStyle()` 抽取布局属性。
   - 将像素值规范化为 number，非法/空值直接丢弃。
   - 不把 X class 写入 article payload。
4. 修改 simpleTweet 提取器：
   - `extractSimpleTweetImageCard/VideoCard/TextCard` 在返回 block 时附加 `layoutTree`。
   - 仍继续抽取 `photos/video/excerpt`，作为渲染内容源和 fallback。
5. 修改 Reader：
   - 新增 layoutTree renderer。
   - container 只应用受控 CSS custom properties 或有限 class。
   - photo/video/text leaf 复用现有 `renderSimpleTweetPhotoGrid` 的媒体元素、`renderVideoPlayer`、`renderExpandableSimpleTweetText`。
6. 更新 `package.json` 增加 `verify:x-simpletweet-layout-tree`，并把它加入相关回归说明。

## Test Plan
- `npm run build`
- `npm run verify:x-simpletweet-layout-tree`
- `npm run verify:x-simpletweet-text`
- `npm run verify:x-simpletweet-video`
- `npm run verify:x-article-b1-b9`
- `npm run verify:phase4-pipeline-baseline`
- 手动检查目标错例：
  - 主 simpleTweet 保持上方文本、下方视频。
  - quoted tweet 内部媒体左、文字右。
  - 多图 simpleTweet 仍保持三图布局。
  - layoutTree 删除或为空时仍回退到旧模板。

## Assumptions
- 第一期只接 simpleTweet，不改 clean-tree 的 block 替换范围。
- 布局解析发生在原页面 DOM 上，cleanTree 之后不再尝试恢复 X 原子 class。
- 不维护完整 X class 字典；测试环境如果没有真实 computedStyle，可用 fixture + 静态断言验证 parser 接口和 reader 合约。
- Reader 仍拥有字体、主题、阅读宽度和外层卡片视觉，layoutTree 只负责组件内部结构布局。
