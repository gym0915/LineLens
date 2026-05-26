export type ReadingUnit = {
  text: string;
  startOffset: number;
  endOffset: number;
};

const MIN_UNIT_LENGTH = 18;
const TARGET_UNIT_LENGTH = 62;
const STRONG_BREAKS = new Set(['。', '！', '？', '!', '?', '.']);
const MEDIUM_BREAKS = new Set(['；', ';']);
const WEAK_BREAKS = new Set(['，', ',', '、', '：', ':']);
const CLOSING_PUNCTUATION = new Set(['”', '’', '"', "'", '）', ')', '】', ']', '》']);

export function splitIntoReadingUnits(text: string): ReadingUnit[] {
  const normalized = normalizeWhitespace(text);
  if (!normalized) {
    return [];
  }

  const protectedRanges = findProtectedRanges(normalized);
  const strongSegments = splitByBreaks(normalized, STRONG_BREAKS, 0, protectedRanges);
  const units: ReadingUnit[] = [];

  for (const segment of strongSegments) {
    units.push(...splitLongSegment(segment));
  }

  return units;
}

function splitLongSegment(segment: ReadingUnit): ReadingUnit[] {
  const protectedRanges = findProtectedRanges(segment.text);
  const mediumSegments = splitByBreaks(
    segment.text,
    MEDIUM_BREAKS,
    segment.startOffset,
    protectedRanges
  );
  const result: ReadingUnit[] = [];

  for (const mediumSegment of mediumSegments) {
    if (mediumSegment.text.length <= TARGET_UNIT_LENGTH) {
      result.push(mediumSegment);
      continue;
    }

    const weakSegments = coalesceShortUnits(splitByBreaks(
      mediumSegment.text,
      WEAK_BREAKS,
      mediumSegment.startOffset,
      findProtectedRanges(mediumSegment.text)
    ));
    for (const weakSegment of weakSegments) {
      result.push(weakSegment);
    }
  }

  return result;
}

function coalesceShortUnits(units: ReadingUnit[]): ReadingUnit[] {
  const forwardMerged = mergeShortUnitsForward(units);
  const result: ReadingUnit[] = [];
  let pending: ReadingUnit | null = null;

  for (const unit of forwardMerged) {
    if (!pending) {
      pending = unit;
      continue;
    }

    const mergedText = mergeText(pending, unit);
    const shouldMerge = pending.text.length < MIN_UNIT_LENGTH || mergedText.length <= TARGET_UNIT_LENGTH;

    if (shouldMerge) {
      pending = {
        text: mergedText,
        startOffset: pending.startOffset,
        endOffset: unit.endOffset
      };
    } else {
      result.push(pending);
      pending = unit;
    }
  }

  if (pending) {
    const previous = result.at(-1);
    const mergedText = previous ? mergeText(previous, pending) : '';

    if (previous && pending.text.length < MIN_UNIT_LENGTH) {
      result[result.length - 1] = {
        text: mergedText,
        startOffset: previous.startOffset,
        endOffset: pending.endOffset
      };
    } else {
      result.push(pending);
    }
  }

  return result;
}

function mergeShortUnitsForward(units: ReadingUnit[]): ReadingUnit[] {
  const result: ReadingUnit[] = [];
  let index = 0;

  while (index < units.length) {
    const current = units[index];
    const next = units[index + 1];

    if (current && next && current.text.length < MIN_UNIT_LENGTH) {
      const mergedText = mergeText(current, next);
      result.push({
        text: mergedText,
        startOffset: current.startOffset,
        endOffset: next.endOffset
      });
      index += 2;
      continue;
    }

    if (current) {
      result.push(current);
    }
    index += 1;
  }

  return result;
}

function mergeText(left: ReadingUnit, right: ReadingUnit): string {
  const gap = right.startOffset > left.endOffset ? ' ' : '';
  return `${left.text}${gap}${right.text}`;
}

function splitByBreaks(
  text: string,
  breakChars: ReadonlySet<string>,
  baseOffset: number,
  protectedRanges: Range[]
): ReadingUnit[] {
  const units: ReadingUnit[] = [];
  let start = 0;
  let index = 0;

  while (index < text.length) {
    const char = text[index] ?? '';

    // Strong punctuation maps to natural reading stops; keep nearby closing quotes
    // or brackets with the same unit so punctuation context is not stranded.
    if (breakChars.has(char) && !isProtectedIndex(index, protectedRanges) && !isProtectedBreak(text, index)) {
      let end = consumeBreakTail(text, index + 1);
      while (end < text.length && CLOSING_PUNCTUATION.has(text[end] ?? '')) {
        end += 1;
      }
      end = consumeTrailingDecorations(text, end);
      pushUnit(units, text, start, end, baseOffset);
      start = end;
      index = end;
      continue;
    }

    index += 1;
  }

  pushUnit(units, text, start, text.length, baseOffset);
  return units;
}

function isProtectedBreak(text: string, index: number): boolean {
  const char = text[index] ?? '';
  if (char !== '.') {
    return false;
  }

  const before = text[index - 1] ?? '';
  const after = text[index + 1] ?? '';
  return isAsciiWordChar(before) && isAsciiWordChar(after);
}

function consumeBreakTail(text: string, start: number): number {
  let end = start;
  while (end < text.length && isRepeatedBreakMark(text[end] ?? '')) {
    end += 1;
  }
  return end;
}

function isRepeatedBreakMark(char: string): boolean {
  return char === '.' || char === '。' || char === '!' || char === '?' || char === '！' || char === '？';
}

function consumeTrailingDecorations(text: string, start: number): number {
  let index = start;
  let cursor = start;

  let consumedDecoration = false;
  while (cursor < text.length) {
    let next = cursor;
    while (next < text.length && /\s/.test(text[next] ?? '')) {
      next += 1;
    }

    const nextChar = readChar(text, next);
    const emojiEnd = consumeEmojiSequence(text, next);
    if (emojiEnd === next && !isRepeatedBreakMark(nextChar)) {
      break;
    }
    cursor = emojiEnd > next ? emojiEnd : next + nextChar.length;
    consumedDecoration = true;

    while (cursor < text.length && CLOSING_PUNCTUATION.has(text[cursor] ?? '')) {
      cursor += 1;
    }
  }

  if (consumedDecoration) {
    index = cursor;
  }
  return index;
}

function pushUnit(
  units: ReadingUnit[],
  source: string,
  start: number,
  end: number,
  baseOffset: number
): void {
  const trimmedStart = consumeLeadingSpaces(source, start);
  let trimmedEnd = end;
  while (trimmedEnd > trimmedStart && /\s/.test(source[trimmedEnd - 1] ?? '')) {
    trimmedEnd -= 1;
  }

  if (trimmedEnd <= trimmedStart) {
    return;
  }

  units.push({
    text: source.slice(trimmedStart, trimmedEnd),
    startOffset: baseOffset + trimmedStart,
    endOffset: baseOffset + trimmedEnd
  });
}

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function consumeLeadingSpaces(text: string, start: number): number {
  let index = start;
  while (index < text.length && /\s/.test(text[index] ?? '')) {
    index += 1;
  }
  return index;
}

function isAsciiWordChar(char: string): boolean {
  return /[A-Za-z0-9_]/.test(char);
}

function isEmojiLike(char: string): boolean {
  return /\p{Extended_Pictographic}/u.test(char);
}

function readChar(text: string, index: number): string {
  return Array.from(text.slice(index))[0] ?? '';
}

function consumeEmojiSequence(text: string, start: number): number {
  let cursor = start;
  let consumedEmoji = false;

  while (cursor < text.length) {
    const char = readChar(text, cursor);
    if (!isEmojiLike(char)) {
      break;
    }

    cursor += char.length;
    cursor = consumeEmojiModifiers(text, cursor);
    consumedEmoji = true;

    if (text[cursor] !== '\u200D') {
      break;
    }

    const afterJoiner = consumeEmojiModifiers(text, cursor + 1);
    if (!isEmojiLike(readChar(text, afterJoiner))) {
      break;
    }
    cursor = afterJoiner;
  }

  return consumedEmoji ? cursor : start;
}

function consumeEmojiModifiers(text: string, start: number): number {
  let cursor = start;
  while (cursor < text.length) {
    const char = readChar(text, cursor);
    if (char === '\uFE0E' || char === '\uFE0F' || isEmojiSkinTone(char)) {
      cursor += char.length;
      continue;
    }
    break;
  }
  return cursor;
}

function isEmojiSkinTone(char: string): boolean {
  return /\p{Emoji_Modifier}/u.test(char);
}

type Range = {
  start: number;
  end: number;
};

function findProtectedRanges(text: string): Range[] {
  return [...findUrlRanges(text), ...findBracketRanges(text)];
}

function findUrlRanges(text: string): Range[] {
  const ranges: Range[] = [];
  const urlPattern = /https?:\/\/\S+/gi;
  let match: RegExpExecArray | null;

  while ((match = urlPattern.exec(text)) !== null) {
    ranges.push({ start: match.index, end: match.index + match[0].length });
  }

  return ranges;
}

function findBracketRanges(text: string): Range[] {
  const ranges: Range[] = [];
  const pairs: Array<[string, string]> = [
    ['(', ')'],
    ['（', '）'],
    ['[', ']'],
    ['【', '】']
  ];

  for (const [open, close] of pairs) {
    let start = text.indexOf(open);
    while (start >= 0) {
      const end = text.indexOf(close, start + open.length);
      if (end < 0) {
        break;
      }
      ranges.push({ start, end: end + close.length });
      start = text.indexOf(open, end + close.length);
    }
  }

  return ranges;
}

function isProtectedIndex(index: number, ranges: Range[]): boolean {
  return ranges.some((range) => index >= range.start && index < range.end);
}
