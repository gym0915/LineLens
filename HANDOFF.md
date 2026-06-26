# HANDOFF: P5 complete -> P6 reader header metadata

## Current state

- Worktree: `/Users/steve/ClaudeWork/Codex/LineByLine/LineLens/.worktrees/new-media-platform-refactor`
- Branch: `feature/new-media-platform-refactor`
- Latest completed phase: P5, special components fully routed through platform handlers
- Next phase: P6, make Article header metadata and Reader header platform neutral

## Completed so far

- P4 moved X media/gallery helpers and X code theme pairs out of the generic clean-tree converter.
- P5 added `verify:special-components-platform-boundary`.
- P5 added `src/content/extractors/x/simple-tweet-handler.ts`.
- P5 added `src/content/extractors/configurable/register-built-in-special-handlers.ts`.
- `clean-tree-block-converter.ts` now calls registered special component handlers by `handlerId`; it no longer imports `simple-tweet-clean-tree-converter.ts`.
- `x.video-or-gif` remains an explicit high-risk dual-track boundary; `verify:phase4-x-article-boundaries` asserts that no handler is registered for it yet.

## Verified after P5

- `npm run build`
- `npm run verify:special-components-platform-boundary`
- `npm run verify:configurable-article-extractor`
- `npm run verify:substack-article-fixture`
- `npm run verify:x-simpletweet-flow`
- `npm run verify:x-simpletweet-video`
- `npm run verify:phase4-x-article-full`
- `npm run verify:phase4-x-article-boundaries`
- `npm run verify:x-video-b31-b39`
- `npm run verify:generic-converter-platform-neutral`

## Notes for P6

- Start with `scripts/verify-reader-platform-neutral-header.mjs`.
- `src/reader/block-renderer.ts` still renders the article header inline and still includes X-specific icons such as Grok and reply/retweet/like/views metrics.
- P6 should split header rendering into `src/reader/renderers/article-header-renderer.ts` while preserving `renderArticleShell(article)`.
- Keep X compatibility, but render X-only action icons only for X articles or explicit X-style metadata.
