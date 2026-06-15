# Layout-Aware Semantic Focus Segmentation

Goal: reduce overly fragmented paragraph FocusUnits while preserving technical tokens such as file paths, extensions, hidden directories, URLs, and IP addresses as indivisible reading units.

## Problem

The current semantic splitter treats sentence-ending punctuation as hard boundaries. This makes short adjacent sentences become separate FocusUnits even when they fit naturally on one Reader line. For example:

```text
一个下午。代码不到40行。
```

This can force unnecessary next-focus navigation. The same punctuation-based rule also risks splitting technical text at dots, for example hidden paths, filenames, extensions, and IP addresses.

## Target Behavior

- Generate semantic candidates from punctuation, but do not treat every sentence mark as a final FocusUnit boundary.
- Protect technical tokens with regular-expression ranges before punctuation splitting.
- Merge adjacent candidates when the merged text can fit within the current Reader line width.
- Keep fallback behavior deterministic when browser measurement is unavailable.
- Avoid making a single FocusUnit so long that it spans multiple visual rows in normal Reader width.

## Protected Token Rules

Protected ranges are indivisible. Punctuation inside these ranges must not split a FocusUnit.

- URLs: `https://example.com/a.b/c`
- IPv4 forms: `192.168.1.1`, `10.0.0.1:8080`, `192.168.0.0/24`
- File names and extensions: `notes.txt`, `report.pdf`, `index.html`, `config.yaml`, `data.json`
- Hidden directory/path forms: `.claude/skills/`, `~/.claude/skills/`, `.config/app/settings.json`
- Existing version and decimal cases: `V3.2-Exp`, `93.3%`, `5.76 倍`

The extension allowlist is:

```text
.txt .pdf .docx .doc .xlsx .xls .pptx .ppt .html .htm .css .js .json .xml .yaml .yml .csv .log
```

## Segmentation Pipeline

1. Normalize paragraph whitespace while preserving source offsets through existing splitter conventions.
2. Find protected ranges using regex-based token scanners.
3. Split into semantic candidates using strong, medium, and weak punctuation, skipping protected ranges.
4. Greedily merge adjacent candidates:
   - Use browser measurement when available.
   - The merge is accepted when the combined text fits the current Reader line width.
   - The merge is rejected when the combined text would wrap.
5. Fall back to conservative width estimation in non-layout environments such as Node verifier scripts.

## Width Model

Primary runtime rule:

```text
merge if measuredTextWidth(candidateA + candidateB) <= availableReaderLineWidth
```

Fallback verifier rule:

```text
merge if estimatedTextWidth(candidateA + candidateB) <= fallbackLineWidth
```

The fallback estimator should account for common CJK and ASCII width differences instead of relying only on raw character count.

## Non-Goals

- Do not redesign active highlight styling.
- Do not change non-paragraph FocusUnit behavior.
- Do not split code blocks, media, tables, embeds, or list items differently.
- Do not use a hard sentence-count rule such as "always merge two sentences."

## Verification

Regression coverage should prove:

- Short adjacent Chinese sentences can merge into one FocusUnit.
- Measured Reader width can reject a merge that would wrap.
- Long English sentences still split at natural boundaries when they would not fit in one line.
- Protected paths, hidden directories, filenames, extensions, URLs, and IP addresses are not split at dots.
- Source offsets still map back to the original paragraph text.
