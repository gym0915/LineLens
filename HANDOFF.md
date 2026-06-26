# HANDOFF: P8 complete -> P9 media resolver

## Current state

- Worktree: `/Users/steve/ClaudeWork/Codex/LineByLine/LineLens/.worktrees/new-media-platform-refactor`
- Branch: `feature/new-media-platform-refactor`
- Latest completed phase: P8, platform article verifier template
- Next phase: P9, platform-neutral media resolver

## Completed so far

- P4 made the generic clean-tree converter platform-neutral for X media/gallery/code-theme helpers.
- P5 routed special components through registered code-owned handlers.
- P6 split and generalized Reader article header rendering.
- P7 added `src/content/extractors/configurable/dom-readiness.ts`.
- P7 made `waitUntilConfigurableArticleReady()` consume `adapter.readiness.stableDomMs`.
- P8 added `scripts/templates/verify-platform-article-template.mjs`.
- P8 added `scripts/verify-fixture-platform-template.mjs` and `verify:platform-template-fixture`.
- P8 added `docs/templates/platform-adapter-checklist.md` and linked it from `docs/README.md`.

## Verified after P8

- `npm run build`
- `node scripts/templates/verify-platform-article-template.mjs --help`
- `npm run verify:platform-template-fixture`
- `npm run verify:adapter-manifest-scope`
- `npm run verify:configurable-article-extractor`

## Notes for P9

- Start by adding `scripts/verify-platform-media-resolver.mjs` before implementation.
- Read `src/content/preprocess/platform-media-metadata.ts` and `src/content/preprocess/block-converters/image-block-converter.ts`.
- P9 should move image/gallery/embed media interpretation into platform-neutral resolver code while keeping platform-specific metadata and selectors outside generic converter internals.
- Keep `x.video-or-gif` dual-track/high-risk behavior unchanged unless the P9 verifier proves an explicit safe migration path.
