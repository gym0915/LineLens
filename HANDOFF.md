# HANDOFF: P9 complete -> P10 manifest scope

## Current state

- Worktree: `/Users/steve/ClaudeWork/Codex/LineByLine/LineLens/.worktrees/new-media-platform-refactor`
- Branch: `feature/new-media-platform-refactor`
- Latest completed phase: P9, platform-neutral media resolver
- Next phase: P10, manifest scope guardrails

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

## Verified after P9

- `npm run build`
- `npm run verify:platform-media-resolver`
- `npm run verify:x-article-image-gallery`
- `npm run verify:substack-article-fixture`
- `npm run verify:reader-shared-media`
- `npm run verify:phase4-x-article-full`

## Notes for P10

- Start by extending `scripts/verify-adapter-manifest-scope.mjs`.
- Check `public/manifest.json`, `src/content/adapters/index.ts`, and built-in adapters.
- Enforce that enabled built-in adapters have explicit manifest host coverage.
- Keep fixture-only adapters out of manifest scope.
- Add explicit external media allowlist checks without broadening content-script matches for media CDNs.
