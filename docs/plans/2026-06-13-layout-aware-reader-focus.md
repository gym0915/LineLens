# Layout-Aware Reader Focus Implementation Plan

> For Claude: REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

Goal: Make normal paragraph focus/highlight use full reading-width line rows so users navigate paragraph text one row at a time, while lists, quotes, code, media, and embedded components keep their existing focus behavior.

Architecture: The latest product decision replaces the previous semantic-fragment plus Range-measurement path for normal paragraphs. Paragraph text is split into reading-width rows, each row is rendered as a block-level focus unit, and active highlight keeps the existing visual style while stretching to the Reader column width. The previous semantic splitter and Range utilities remain in the codebase for future use and regression coverage, but normal paragraph focus no longer depends on them.

Tech Stack: TypeScript, MV3 Reader DOM, existing FocusEngine, existing Node-based verifier scripts, Reader CSS tokens.

---

## Current Problem

Current paragraph focus is built in src/reader/focus-unit-builder.ts:

- Paragraph text is split by splitIntoReadingUnits().
- Each reading unit is rendered as a .focus-unit inline span.
- The active span receives padding, background, border-radius, box-shadow, and box-decoration-break from public/styles/focus.css.

For the reported text, the semantic units are:

1. Here's a practical guide for complete beginners,
2. without assuming prior knowledge in coding,
3. using an agent, or knowing about GitHub or skills:

Unit 2 can wrap into two visual rows. Since active inline styling participates in layout, activating unit 2 can make the highlighted text appear to change length. The UX direction is now simpler: normal paragraphs should feel like row-by-row reading, not semantic phrase selection.

## Target Behavior

- Normal paragraph focus units are full-width reading rows.
- Arrow navigation moves one paragraph row at a time.
- Active paragraph row highlight spans the Reader content width, not just the text width.
- The highlight visual style remains the same: radius, surface, shadow, and active text color continue to use the existing Reader tokens.
- Paragraph active transitions should include a subtle vertical movement so row-to-row navigation feels continuous.
- Paragraph rows should greedily fill the reading width as much as possible, avoiding short semantic fragments that leave large blank space at line end.
- Paragraph row splitting must subtract the active highlight's inline padding from available text width. Otherwise a generated focus row can still wrap internally once highlighted.
- Progress should still be restorable with stable IDs.
- Existing non-paragraph behavior remains unchanged for ol, ul, quotes, code, media, tables, links, simple tweets, and embeds.
- Browser resize should keep Reader at a minimum reading width rather than forcing paragraph highlighter recalculation for arbitrary narrow widths.

## Non-Goals

- Do not delete the semantic splitter, TextOffsetIndex, or Range-based visual fragment utilities already added.
- Do not use semantic splitting for normal paragraph focus.
- Do not change ol, ul, quote, code, media, or embedded component highlight behavior.
- Do not implement a full custom text layout engine.
- Do not change article extraction or text annotation extraction.
- Do not solve arbitrary zoom/reflow scenarios; the Reader can be manually resized and should preserve a minimum reading width.

---

## Change Request: Full-Width Paragraph Row Highlight

This supersedes the earlier implementation direction for normal paragraphs:

- Keep semantic-splitter.ts, text-offset-index.ts, and visual-line-fragmenter.ts in place.
- Keep their verifier coverage so the code does not rot.
- Stop routing normal paragraph focus through semantic units or semantic+Range mixed fragments.
- Add a simple paragraph row splitter that creates reading rows by filling a target reading-line length.
- In browser runtime, use rendered Range measurement for candidate paragraph rows and subtract the highlight inline bleed before accepting a row. In non-layout verifier environments, keep a conservative character-count fallback.
- Render each paragraph row as a block-level .focus-unit inside p.
- Make p .focus-unit active state full-width with the existing highlight surface/radius/shadow.
- Reserve the same row padding in inactive state so activating a row does not change the amount of text that fits.
- Add a small translateY transition for active paragraph row navigation.
- Keep list items, quotes, and other component focus paths as they are.

---

## Task 1: Add a Layout-Aware Text Offset Mapper

Files:

- Create: src/reader/text-offset-index.ts
- Test: scripts/verify-reader-layout-focus.mjs
- Modify: package.json

Steps:

1. Add scripts/verify-reader-layout-focus.mjs with a fake DOM tree containing plain text plus nested strong/link nodes.
2. Assert TextOffsetIndex.from(root).text equals the full rendered paragraph text.
3. Assert TextOffsetIndex.resolve(offset) returns the correct text node and local offset across nested inline nodes.
4. Add npm script: verify:reader-layout-focus = npm run build && node scripts/verify-reader-layout-focus.mjs.
5. Run npm run verify:reader-layout-focus and confirm it fails because text-offset-index does not exist.
6. Implement TextOffsetIndex with:
   - readonly text
   - private text runs: node, start, end
   - static from(root: Node)
   - resolve(offset)
   - resolveRange(startOffset, endOffset)
7. Walk text nodes recursively using childNodes, not querySelectorAll, so annotations and nested inline elements are handled uniformly.
8. Run npm run verify:reader-layout-focus and confirm it passes.

Implementation contract:

- Empty roots should fail explicitly when resolving an offset.
- Offsets should clamp into the range [0, text.length].
- This module should not know about FocusUnit or CSS.

---

## Task 2: Measure Browser Line Fragments for Semantic Units

Files:

- Create: src/reader/visual-line-fragmenter.ts
- Modify: scripts/verify-reader-layout-focus.mjs

Steps:

1. Extend the verifier with a deterministic fixture for the reported sentence.
2. Add a pure createVisualLineFragments() helper that receives:
   - blockId
   - semantic unitId
   - full source text
   - startOffset
   - endOffset
   - lineBreakOffsets
   - textRole
3. Assert semantic unit p1-u2 with range 49-92 and lineBreakOffsets [83] returns:
   - p1-u2-l1: without assuming prior knowledge
   - p1-u2-l2: in coding,
4. Implement trimming so leading/trailing spaces are excluded from each visual fragment.
5. Add measureVisualLineBreakOffsets() using TextOffsetIndex plus Range.getClientRects().
6. Build split candidates from whitespace boundaries inside the semantic range.
7. For each candidate, set a Range from the current line start to the candidate.
8. Compare first/last rect top values. When the last rect moves to a new line, record the previous safe whitespace offset as the line break.
9. Continue until endOffset.
10. Fallback to no split when Range is unavailable, rect data is empty, or candidates are insufficient.
11. Run npm run verify:reader-layout-focus and confirm it passes.

Implementation contract:

- The first version should split on whitespace boundaries, not arbitrary glyph offsets.
- Browser measurements are runtime-derived and should not be persisted as article data.
- The module should expose pure helpers that can be verified without a real browser.

---

## Task 3: Integrate Layout Fragments into Focus Unit Building

Files:

- Modify: src/reader/focus-unit-builder.ts
- Modify: src/reader/reader-app.ts
- Modify: scripts/verify-reader-a6-a7.mjs
- Modify: scripts/verify-reader-layout-focus.mjs

Steps:

1. Refactor paragraph handling in buildFocusUnits().
2. Preserve the existing semantic split from splitIntoReadingUnits().
3. Render paragraph text once using the existing reader text renderer and annotations.
4. After paragraph DOM exists, build TextOffsetIndex for the paragraph element.
5. For each semantic unit, measure visual line break offsets.
6. Create visual fragments with IDs derived from the parent semantic unit:
   - p1-u2-l1
   - p1-u2-l2
7. Add parentUnitId metadata to visual paragraph fragments.
8. Register each visual fragment in the units list and elements map.
9. Keep non-paragraph behavior unchanged for headings, quotes, list items, media, code, tables, links, and simple tweets.
10. If measurement fails, return the current semantic units as fallback.
11. Run npm run verify:reader-layout-focus and npm run verify:reader-a6-a7.

Implementation contract:

- Existing click selection should keep using target.closest('[data-unit-id]').
- Visual fragments should still be FocusUnit-compatible.
- The fallback path should not produce console noise by default.

Preferred DOM strategy:

- Keep paragraph text DOM stable during measurement.
- Create focusable visual fragment spans only after measurement.
- Do not measure while active, muted, or hover styling is applied.

---

## Task 4: Make Active Paragraph Styling Layout-Stable

Files:

- Modify: public/styles/focus.css
- Modify: public/styles/tokens.css
- Modify: scripts/verify-reader-inline-highlight-clean-style.mjs
- Modify: scripts/verify-reader-layout-focus.mjs

Steps:

1. Update the style verifier so paragraph active focus must not depend on layout-changing inline padding.
2. Replace active paragraph padding with visual expansion that does not affect layout, such as box-shadow spread or an overlay.
3. Keep border radius, highlight surface, and highlight shadow driven by design tokens.
4. If a new token is needed, define it in public/styles/tokens.css, for example reader-inline-highlight-visual-bleed.
5. Update scripts/verify-reader-inline-highlight-clean-style.mjs to assert the new contract.
6. Run npm run verify:reader-inline-highlight-clean-style and npm run verify:reader-layout-focus.

Implementation contract:

- Active visual styling must not change text metrics or inline width.
- The highlight should remain visually close to the current clean white capsule style.
- No hard-coded radius values should be introduced.

---

## Task 5: Handle Font Loading and Resize

Files:

- Modify: src/reader/reader-app.ts
- Modify: src/reader/focus-unit-builder.ts
- Modify: scripts/verify-reader-layout-focus.mjs

Steps:

1. Keep initial article rendering synchronous.
2. Build semantic fallback focus units immediately so keyboard navigation is never unavailable.
3. Schedule layout-aware rebuild after document.fonts.ready resolves.
4. Add ResizeObserver on the article element.
5. Debounce resize rebuild with requestAnimationFrame.
6. Before measuring, temporarily remove paragraph focus states that could affect layout.
7. After rebuild, map the active semantic unit to the nearest visual fragment:
   - exact visual unit ID if it still exists
   - first fragment with the same parentUnitId
   - nearest unit by previous index
8. Re-run HighlightLayer.update() after rebuild.
9. Disconnect ResizeObserver when remounting/cleanup is introduced.
10. Verify rebuild behavior in scripts/verify-reader-layout-focus.mjs.

Implementation contract:

- Font readiness and resize should improve precision, not block initial reading.
- Rebuilds should only affect paragraph text units.
- Media/code/table focus units should not be recreated unnecessarily.

---

## Task 6: Preserve Progress Compatibility

Files:

- Modify: src/reader/reader-app.ts
- Modify: src/shared/focus.ts if parent metadata needs to be typed
- Modify: scripts/verify-reader-a6-a7.mjs
- Modify: scripts/verify-reader-layout-focus.mjs

Steps:

1. Extend the paragraph visual fragment type with parentUnitId.
2. Update resolveInitialIndex() so saved p1-u2 can resolve to p1-u2-l1.
3. Update resolveInitialIndex() so saved p1-u2-l2 resolves exactly when available.
4. Add verifier cases for old semantic IDs and new visual IDs.
5. Ensure progressStore.save() can keep saving the active visual unitId without schema changes.
6. Run npm run verify:reader-layout-focus and npm run verify:reader-a6-a7.

Implementation contract:

- Old saved progress must not break.
- New visual progress should be more precise.
- No migration step is required.

---

## Task 7: Add the Reported Sentence Regression

Files:

- Modify: scripts/verify-reader-layout-focus.mjs
- Optional Modify: src/reader/fixtures.ts

Steps:

1. Add the exact reported sentence as a verifier fixture.
2. Assert semantic unit 2 is still without assuming prior knowledge in coding,.
3. Assert narrow layout produces two visual fragments:
   - without assuming prior knowledge
   - in coding,
4. Assert activating p1-u2-l1 and p1-u2-l2 does not change fragment text or offsets.
5. Assert the fragment IDs remain stable across repeated rebuilds with the same layout width.
6. Run the final verification set.

Final commands:

- npm run build
- npm run verify:reader-layout-focus
- npm run verify:reader-inline-highlight-clean-style
- npm run verify:reader-a6-a7

---

## Risks and Tradeoffs

- Range.getClientRects() is browser-only, so pure Node tests need fake range fixtures; manual/browser QA is still required.
- Browser line boxes vary by font, zoom, and container width. Visual fragments must be treated as runtime-derived.
- Splitting DOM after annotations are rendered is harder than semantic splitting. Keep TextOffsetIndex small and heavily verified.
- Resize/font recomputation can be expensive. Debounce it and only rebuild paragraph units.
- Progress IDs change from p1-u2 to p1-u2-l1. Compatibility must be handled in resolveInitialIndex().

## Manual QA Checklist

- Open the Reader on the fixture article containing the reported sentence.
- Navigate to the first, second, and third text areas with arrow keys.
- Confirm the second text area becomes two separate visual focus steps when it wraps.
- Confirm text does not jump horizontally or rewrap when focus changes.
- Resize the Reader width and confirm focus remains on the nearest valid fragment.
- Confirm bold/link annotations inside paragraphs still render correctly.

## Final Verification Commands

Run from:

cd /Users/steve/ClaudeWork/Codex/LineByLine/LineLens

Commands:

- npm run build
- npm run verify:reader-layout-focus
- npm run verify:reader-inline-highlight-clean-style
- npm run verify:reader-a6-a7
