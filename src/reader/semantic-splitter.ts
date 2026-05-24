export type ReadingUnit = {
  text: string;
  startOffset: number;
  endOffset: number;
};

const MAX_UNIT_LENGTH = 80;
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
    if (segment.text.length <= MAX_UNIT_LENGTH) {
      units.push(segment);
      continue;
    }

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
    if (mediumSegment.text.length <= MAX_UNIT_LENGTH) {
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
      if (weakSegment.text.length <= MAX_UNIT_LENGTH) {
        result.push(weakSegment);
      } else {
        result.push(...splitBySafeBoundary(weakSegment));
      }
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

    if (previous && pending.text.length < MIN_UNIT_LENGTH && mergedText.length <= MAX_UNIT_LENGTH) {
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
      if (mergedText.length <= MAX_UNIT_LENGTH) {
        result.push({
          text: mergedText,
          startOffset: current.startOffset,
          endOffset: next.endOffset
        });
        index += 2;
        continue;
      }
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
    if (breakChars.has(char) && !isProtectedIndex(index, protectedRanges)) {
      let end = index + 1;
      while (end < text.length && CLOSING_PUNCTUATION.has(text[end] ?? '')) {
        end += 1;
      }
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

function splitBySafeBoundary(segment: ReadingUnit): ReadingUnit[] {
  const units: ReadingUnit[] = [];
  let start = 0;
  const text = segment.text;
  const protectedRanges = findProtectedRanges(text);

  while (start < text.length) {
    const end = findSafeEnd(text, start, protectedRanges);
    pushUnit(units, text, start, end, segment.startOffset);
    start = consumeLeadingSpaces(text, end);
  }

  return units;
}

function findSafeEnd(text: string, start: number, protectedRanges: Range[]): number {
  const target = Math.min(text.length, start + MAX_UNIT_LENGTH);
  if (target === text.length) {
    return text.length;
  }

  for (let index = target; index > start + 20; index -= 1) {
    if (!isProtectedIndex(index, protectedRanges) && isSafeBoundary(text, index)) {
      return index;
    }
  }

  return target;
}

function isSafeBoundary(text: string, index: number): boolean {
  const before = text[index - 1] ?? '';
  const after = text[index] ?? '';

  // URLs, English words, and numeric units should stay intact because splitting
  // inside them destroys recognizability and breaks future progress offsets.
  if (isAsciiWordChar(before) && isAsciiWordChar(after)) {
    return false;
  }

  if (before === '/' || after === '/' || before === '-' || after === '-') {
    return false;
  }

  return /\s/.test(after) || CLOSING_PUNCTUATION.has(before);
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
