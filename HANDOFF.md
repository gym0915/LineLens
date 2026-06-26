# HANDOFF: P6 complete -> P7 stable DOM readiness

## Current state

- Worktree: `/Users/steve/ClaudeWork/Codex/LineByLine/LineLens/.worktrees/new-media-platform-refactor`
- Branch: `feature/new-media-platform-refactor`
- Latest completed phase: P6, platform-neutral Article header metadata and Reader header
- Next phase: P7, implement `readiness.stableDomMs`

## Completed so far

- P4 made `clean-tree-block-converter.ts` platform-neutral for X media/gallery/code-theme helpers.
- P5 routed special components through registered code-owned handlers.
- P6 added `verify:reader-platform-neutral-header`.
- P6 added generic Article header metadata groups: `ArticleAuthorMeta`, `ArticleSourceMeta`, and `ArticleEngagementMeta`.
- P6 moved header rendering to `src/reader/renderers/article-header-renderer.ts`.
- Reader header now renders source provider labels for non-X articles and suppresses Grok/X action icons unless the article is X.

## Verified after P6

- `npm run build`
- `npm run verify:reader-platform-neutral-header`
- `npm run verify:configurable-article-extractor`
- `npm run verify:substack-article-fixture`
- `npm run verify:reader-m1-m2`
- `npm run verify:phase4-x-article-full`
- `npm run verify:x-article-dynamic-styles`
- `npm run verify:x-simpletweet-flow`
- `npm run verify:x-article-b10-b15`

## Notes for P7

- Start in `src/content/extractors/configurable/configurable-article-extractor.ts`.
- `ReadinessConfig.stableDomMs` already exists in `src/content/adapters/adapter-types.ts`, but is not consumed yet.
- Add the failing case inside `scripts/verify-configurable-article-extractor.mjs` before implementation.
- Keep X/Substack adapters fast by default; do not add `stableDomMs` to them unless a verifier proves it is needed.
