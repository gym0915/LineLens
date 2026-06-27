# HANDOFF: P10 complete -> final acceptance

## Current state

- Worktree: `/Users/steve/ClaudeWork/Codex/LineByLine/LineLens/.worktrees/new-media-platform-refactor`
- Branch: `feature/new-media-platform-refactor`
- Latest completed phase: P10, manifest scope guardrails
- Next phase: final acceptance, merge to main, and diff report

## Completed so far

- P4 made the generic clean-tree converter platform-neutral for X media/gallery/code-theme helpers.
- P5 routed special components through registered code-owned handlers.
- P6 split and generalized Reader article header rendering.
- P7 added `src/content/extractors/configurable/dom-readiness.ts`.
- P7 made `waitUntilConfigurableArticleReady()` consume `adapter.readiness.stableDomMs`.
- P8 added `scripts/templates/verify-platform-article-template.mjs`.
- P8 added `scripts/verify-fixture-platform-template.mjs` and `verify:platform-template-fixture`.
- P8 added `docs/templates/platform-adapter-checklist.md` and linked it from `docs/README.md`.
- P9 added `src/content/preprocess/media-resolver.ts`.
- P9 routes image extraction through `resolveImageCandidate()`.
- P9 preserves safe media attributes in clean trees: `srcset`, `sizes`, `data-src`, `data-original`, poster/thumbnail metadata.
- P9 adds generic gallery resolution while keeping X `preserve-x-media-layout` gallery conversion first.
- P9 adds safe iframe/embed metadata extraction into existing `EmbedBlock` fields without passing iframe DOM to Reader.
- P10 added `src/content/adapters/external-media-hosts.ts`.
- P10 moved X external media hosts into an auditable allowlist with platform, purpose, and allowed manifest surfaces.
- P10 tightened `verify-adapter-manifest-scope` so enabled adapter hosts must be covered, fixture hosts must stay out of production manifest scope, and media hosts cannot enter content-script or web-accessible scopes unless explicitly allowlisted.

## Verified after P10

- `npm run build`
- `npm run verify:adapter-manifest-scope`
- `npm run verify:fixture-platform-adapter`
- `npm run verify:stage0`
- `npm run verify:configurable-article-extractor`

## Notes for final acceptance

- Commit P10 with `test: tighten adapter manifest scope guardrails`.
- Run the overall acceptance commands from the plan in the feature worktree.
- Merge `feature/new-media-platform-refactor` back to `main`.
- Rerun the overall acceptance commands from the main checkout.
- After main passes, write `docs/reports/2026-06-26-new-media-platform-refactor-diff.md` in the outer workspace and update the final report checklist.
