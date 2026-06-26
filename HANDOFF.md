# HANDOFF: P7 complete -> P8 platform verifier template

## Current state

- Worktree: `/Users/steve/ClaudeWork/Codex/LineByLine/LineLens/.worktrees/new-media-platform-refactor`
- Branch: `feature/new-media-platform-refactor`
- Latest completed phase: P7, `readiness.stableDomMs`
- Next phase: P8, platform article verifier template

## Completed so far

- P4 made the generic clean-tree converter platform-neutral for X media/gallery/code-theme helpers.
- P5 routed special components through registered code-owned handlers.
- P6 split and generalized Reader article header rendering.
- P7 added `src/content/extractors/configurable/dom-readiness.ts`.
- P7 made `waitUntilConfigurableArticleReady()` consume `adapter.readiness.stableDomMs`.
- X and Substack adapters still do not set `stableDomMs`, preserving current readiness speed.

## Verified after P7

- `npm run build`
- `npm run verify:configurable-article-extractor`
- `npm run verify:content-single-source`
- `npm run verify:substack-article-fixture`
- `npm run verify:phase4-x-article-full`

## Notes for P8

- Start with `scripts/templates/verify-platform-article-template.mjs`.
- The repo already has `scripts/verify-fixture-platform-adapter.mjs`; use it as the nearest existing fixture-adapter verifier reference.
- Check whether `docs/templates/platform-adapter-checklist.md` exists before editing; create it if absent.
- Keep the template copyable and opt-in; do not wire it into default npm verification.
