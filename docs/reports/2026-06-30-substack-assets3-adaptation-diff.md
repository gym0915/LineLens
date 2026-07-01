# Substack Assets3 Adaptation Diff Report

## Status

- Worktree: `/Users/steve/ClaudeWork/Codex/LineByLine/LineLens/.worktrees/substack-assets3-adaptation`
- Branch: `feature/substack-assets3-adaptation`
- Scope: Substack assets3 adaptation only, plus required shared Article JSON / clean-tree / Reader rendering plumbing.
- Merge state: not merged to `main`; wait for explicit user confirmation before fast-forward merge.

## Before

- Runtime Substack scope still included broader `/p/...` and Latent Space/custom-domain paths.
- Substack root/title selectors were tuned for newsletter posts and did not reliably cover assets3 podcast-shaped DOM.
- `scripts/verify-substack-article-fixture.mjs` only covered the earlier assets2 fixture; assets3 full pages and component DOM were not locked as verifier contracts.
- Substack special component coverage was limited; Paywall was removed by clean rules and SubscribeWidget had no explicit Article JSON mapping.
- Reader embed rendering did not consume `EmbedBlock` rich-text annotations, so preserved CTA/link/underline/bold semantics in embed text had no neutral rendering path.

## After

- Runtime Substack scope is narrowed to `substack.com/inbox/post/...` and `substack.com/home/post/...`; `/p/...` and Latent Space/custom domains are intentionally unsupported in this phase.
- `substack.article` covers newsletter and podcast article roots, stable title fallback, assets3 component block roots, and clean-rule preservation for safe component attributes.
- Assets3 is covered by three verifier contracts:
  - `verify:substack-assets3-fixtures`
  - `verify:substack-assets3-components`
  - `verify:substack-url-scope`
- Substack special components map into existing Article JSON shapes:
  - YouTube -> `EmbedBlock(provider: 'youtube')`
  - Video -> `VideoBlock` when direct media is safe, otherwise `EmbedBlock(provider: 'substack')`
  - Audio -> `EmbedBlock(provider: 'substack')`
  - Footnote -> lightweight `ParagraphBlock`
  - Paywall / SubscribeWidget -> neutral `EmbedBlock(provider: 'substack')`
  - Twitter remains generic `EmbedBlock(provider: 'x')`, not X `simple-tweet`
- Safe style/layout preservation now includes rich text annotations and media/layout metadata where representable:
  - bold, italic, underline, links, targets
  - font size, line height, color, alignment when safely carried as text metadata
  - media aspect ratio, cover/poster, object-fit/object-position where supported
  - Paywall/Subscribe readable CTA text and safe links, without preserving original scripts/events/raw DOM
- Reader renders embed rich text with platform-neutral `reader-text-renderer` and avoids nested anchors when embed text already contains links.

## File Groups

Substack adapter and handler:

- `src/content/adapters/substack-article-adapter.ts`
- `src/content/extractors/substack/assets3-component-handler.ts`
- `src/content/extractors/substack/index.ts`
- `src/content/extractors/configurable/register-built-in-special-handlers.ts`
- `src/content/extractors/configurable/configurable-article-extractor.ts`

Shared schema / clean-tree plumbing:

- `src/shared/article.ts`
- `src/content/preprocess/clone-content-tree.ts`

Reader rendering:

- `src/reader/renderers/social-embed-renderer.ts`
- `src/reader/reader-text-renderer.ts`
- `src/reader/style-policy.ts`

Scope and verifier contracts:

- `public/manifest.json`
- `src/background/index.ts`
- `package.json`
- `scripts/verify-substack-assets3-fixtures.mjs`
- `scripts/verify-substack-assets3-components.mjs`
- `scripts/verify-substack-url-scope.mjs`
- `scripts/verify-substack-article-fixture.mjs`
- `scripts/verify-configurable-article-extractor.mjs`
- `scripts/verify-m3-adapters-settings.mjs`
- `scripts/verify-adapter-manifest-scope.mjs`
- `scripts/verify-x-article-b10-b15.mjs`

## Phase 6 Verification

Passed in the worktree:

```bash
npm run verify:phase4-pipeline-baseline
npm run verify:phase4-x-article-full
npm run verify:phase4-x-article-boundaries
npm run verify:x-article-image-gallery
npm run verify:x-media-caption
npm run verify:x-simpletweet-flow
npm run verify:x-simpletweet-video
npm run verify:x-video-b31-b39
```

Result: PASS. The shared clean-tree, media, Reader renderer, X image gallery, X caption, X simpleTweet, and X video paths did not regress.

## Phase 7 Verification

Passed in the worktree:

```bash
npm run build
npm run verify:content-single-source
npm run verify:m3-adapters-settings
npm run verify:adapter-manifest-scope
npm run verify:generic-converter-platform-neutral
npm run verify:special-components-platform-boundary
npm run verify:configurable-article-extractor
npm run verify:substack-article-fixture
npm run verify:substack-assets3-fixtures
npm run verify:substack-assets3-components
npm run verify:substack-url-scope
npm run verify:reader-platform-neutral-header
npm run verify:reader-m1-m2
npm run verify:reader-shared-media
```

Result: PASS. During final acceptance, `verify:m3-adapters-settings` exposed a stale assertion that still expected `substack.article.contentSelector` to point at `.available-content .body.markup`. The current assets3 contract intentionally leaves `contentSelector` unset so the configurable extractor uses the article root and can map assets3 components outside the body markup. The verifier was updated to match that contract; production adapter behavior was not changed.

## Remaining Risk

- Live Substack pages can still vary beyond the captured assets3 DOM; this phase is fixture-locked and should be followed by manual smoke testing after merge.
- `blob:` video URLs are intentionally not preserved; when no safe direct media URL exists, Reader displays a neutral Substack embed fallback with text/poster.
- Audio is represented as an `EmbedBlock`, not a new audio-specific ArticleBlock.
- `/p/...`, `latent.space`, and other custom domains are intentionally out of scope for this phase.
