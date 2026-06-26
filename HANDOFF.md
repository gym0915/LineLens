# HANDOFF: P4 complete -> P5 special components

## Current state

- Worktree: `/Users/steve/ClaudeWork/Codex/LineByLine/LineLens/.worktrees/new-media-platform-refactor`
- Branch: `feature/new-media-platform-refactor`
- Completed phase: P4, generic clean-tree converter X residue cleanup
- Next phase: P5, route special components fully through platform handlers

## P4 changes

- Added `verify:generic-converter-platform-neutral`.
- Moved X media/gallery helpers into `src/content/extractors/x/media-layout.ts`.
- Moved X code color theme pairs into `src/content/extractors/x/code-theme.ts` and exposed them as static `PlatformAdapter.codeThemePairs`.
- Kept `clean-tree-block-converter.ts` responsible for standard block conversion while delegating platform media/gallery behavior through `platform-media-metadata`.
- Updated existing source-boundary verifiers so they assert the new X-owned helper boundary instead of requiring X code inside the generic converter.

## Verified

- `npm run build`
- `npm run verify:generic-converter-platform-neutral`
- `npm run verify:configurable-article-extractor`
- `npm run verify:substack-article-fixture`
- `npm run verify:phase4-x-article-full`
- `npm run verify:reader-shared-media`
- `npm run verify:x-article-dynamic-styles`
- `npm run verify:x-article-image-gallery`
- `npm run verify:x-media-caption`

## Notes for P5

- `clean-tree-block-converter.ts` still directly imports `../extractors/x/simple-tweet-clean-tree-converter.js`; P5 should remove that direct dependency.
- `x.article.specialComponents` already declares `x.simple-tweet` and `x.video-or-gif`.
- `src/content/extractors/configurable/special-component-handlers.ts` is the first file to inspect for handler registration.
- Keep the P4 verifier green while moving simpleTweet handling; it intentionally only scans the generic converter.
