# Focus Padding Reserved Layout

Goal: prevent paragraph text from changing line breaks when a FocusUnit becomes active.

## Problem

Paragraph FocusUnits currently receive inline highlight padding only in the active state:

```css
p .focus-unit.is-active {
  padding: var(--reader-inline-highlight-padding-block) var(--reader-inline-highlight-padding-inline);
}
```

That padding participates in inline layout. A sentence can fit on one line while muted, then wrap to two lines after focus because the active capsule needs extra horizontal space.

This creates a visible layout jump during navigation.

## Target Behavior

- Paragraph FocusUnits should reserve active highlight padding before focus.
- Muted, hover, and active states should use the same inline padding footprint.
- Active focus should only change color, background, shadow, and cursor behavior, not text wrapping.
- Semantic segmentation measurement should subtract the reserved highlight bleed from available line width.
- The default unfocused rendering may wrap earlier, but it should match the eventual focused layout.

## CSS Contract

Use the same highlight padding tokens for paragraph FocusUnits in their default state:

```css
p .focus-unit {
  display: inline;
  padding: var(--reader-inline-highlight-padding-block) var(--reader-inline-highlight-padding-inline);
  border-radius: var(--reader-radius-card);
  -webkit-box-decoration-break: clone;
  box-decoration-break: clone;
}
```

The active rule keeps visual styling:

```css
p .focus-unit.is-active {
  background: var(--reader-highlight-surface);
  box-shadow: var(--reader-highlight-shadow);
}
```

## Segmentation Contract

When Reader runtime measures whether adjacent semantic candidates can merge into one FocusUnit, the available width must be:

```text
blockElement.clientWidth - 2 * inlineHighlightPaddingInline
```

This prevents generating a FocusUnit that only fits before highlight padding is applied.

## Non-Goals

- Do not change media, code, table, list, simple tweet, quote, or heading FocusUnit layout.
- Do not introduce hard-coded radius or padding values outside design tokens.
- Do not remove the existing inline highlight visual style.

## Verification

- Static CSS verifier asserts default paragraph FocusUnits reserve inline highlight padding.
- Static CSS verifier asserts active paragraph FocusUnits do not own a layout-only padding delta.
- Reader splitter verifier asserts measured line width can reject a merge when reserved padding is included.
- Existing Reader navigation verifier still passes.
