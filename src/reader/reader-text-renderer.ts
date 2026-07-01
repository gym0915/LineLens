import type { TextAnnotation } from '../shared/article-schema.js';
import type { ReaderTextRole } from '../shared/reader-config.js';
import { applyInlineTextStyle } from './style-policy.js';

export type ReaderTextMetadata = {
  sourceText: string;
  rangeStart: number;
  rangeEnd: number;
  role: ReaderTextRole;
  annotations: Array<{
    startOffset: number;
    endOffset: number;
    bold?: boolean;
    href?: string;
    target?: string;
    emojiImageUrl?: string;
    color?: string;
    fontSize?: string;
    lineHeight?: string;
    textAlign?: string;
    fontStyle?: string;
    textDecoration?: string;
  }>;
};

type ReaderTextRenderOptions = {
  className?: string;
  rangeStart?: number;
  rangeEnd?: number;
  role: ReaderTextRole;
};

export function appendReaderText(
  container: HTMLElement,
  sourceText: string,
  annotations: TextAnnotation[] = [],
  options: ReaderTextRenderOptions
): ReaderTextMetadata {
  const metadata = createReaderTextMetadata(sourceText, annotations, options);
  container.append(...createReaderTextNodes(metadata));
  return metadata;
}

export function createReaderTextMetadata(
  sourceText: string,
  annotations: TextAnnotation[] = [],
  options: ReaderTextRenderOptions
): ReaderTextMetadata {
  const rangeStart = Math.max(0, options.rangeStart ?? 0);
  const rangeEnd = Math.min(sourceText.length, options.rangeEnd ?? sourceText.length);
  return {
    sourceText,
    rangeStart,
    rangeEnd,
    role: options.role,
    annotations: annotations
      .filter(
        (annotation) =>
          (annotation.bold ||
            annotation.href ||
            annotation.emojiImageUrl ||
            annotation.color ||
            annotation.fontSize ||
            annotation.lineHeight ||
            annotation.textAlign ||
            annotation.fontStyle ||
            annotation.textDecoration) &&
          annotation.endOffset > rangeStart &&
          annotation.startOffset < rangeEnd
      )
      .map((annotation) => ({
        startOffset: Math.max(annotation.startOffset, rangeStart),
        endOffset: Math.min(annotation.endOffset, rangeEnd),
        bold: annotation.bold,
        href: annotation.href,
        target: annotation.target,
        emojiImageUrl: annotation.emojiImageUrl,
        color: annotation.color,
        fontSize: annotation.fontSize,
        lineHeight: annotation.lineHeight,
        textAlign: annotation.textAlign,
        fontStyle: annotation.fontStyle,
        textDecoration: annotation.textDecoration
      }))
      .filter((annotation) => annotation.endOffset > annotation.startOffset)
      .sort((a, b) => a.startOffset - b.startOffset)
  };
}

export function createReaderTextSpan(
  sourceText: string,
  annotations: TextAnnotation[] = [],
  options: ReaderTextRenderOptions
): HTMLSpanElement {
  const span = document.createElement('span');
  span.className = ['reader-text', `reader-text--${options.role}`, options.className].filter(Boolean).join(' ');
  const metadata = appendReaderText(span, sourceText, annotations, options);
  applyReaderTextMetadata(span, metadata);
  return span;
}

export function applyReaderTextMetadata(element: HTMLElement, metadata: ReaderTextMetadata): void {
  element.dataset.readerTextRole = metadata.role;
  element.dataset.readerTextStart = String(metadata.rangeStart);
  element.dataset.readerTextEnd = String(metadata.rangeEnd);
}

export function createReaderTextNodes(metadata: ReaderTextMetadata): Array<Node> {
  const nodes: Node[] = [];
  let cursor = metadata.rangeStart;

  for (const annotation of metadata.annotations) {
    if (annotation.startOffset < cursor) {
      continue;
    }

    if (annotation.startOffset > cursor) {
      nodes.push(document.createTextNode(metadata.sourceText.slice(cursor, annotation.startOffset)));
    }

    const text = metadata.sourceText.slice(annotation.startOffset, annotation.endOffset);
    nodes.push(createAnnotatedNode(text, annotation));
    cursor = annotation.endOffset;
  }

  if (cursor < metadata.rangeEnd) {
    nodes.push(document.createTextNode(metadata.sourceText.slice(cursor, metadata.rangeEnd)));
  }

  return nodes;
}

function createAnnotatedNode(
  text: string,
  annotation: Pick<TextAnnotation, 'bold' | 'href' | 'target' | 'emojiImageUrl' | 'color' | 'fontSize' | 'lineHeight' | 'textAlign' | 'fontStyle' | 'textDecoration'>
): HTMLElement {
  let node: HTMLElement;

  const hasTextStyle = Boolean(annotation.color || annotation.fontSize || annotation.lineHeight || annotation.textAlign || annotation.fontStyle || annotation.textDecoration);

  if (annotation.emojiImageUrl) {
    node = createXEmojiNode(text, annotation.emojiImageUrl, Boolean(annotation.bold));
  } else if (annotation.href) {
    const link = document.createElement('a');
    link.setAttribute('href', annotation.href);
    if (annotation.target) {
      link.setAttribute('target', annotation.target);
    }
    link.setAttribute('rel', 'noreferrer');
    link.textContent = text;
    node = link;
  } else if (annotation.bold) {
    const strong = document.createElement('strong');
    strong.textContent = text;
    node = strong;
  } else if (hasTextStyle) {
    const span = document.createElement('span');
    span.textContent = text;
    node = span;
  } else {
    const span = document.createElement('span');
    span.textContent = text;
    node = span;
  }

  applyInlineTextStyle(node, annotation);

  if (annotation.href && annotation.emojiImageUrl) {
    const link = document.createElement('a');
    link.setAttribute('href', annotation.href);
    if (annotation.target) {
      link.setAttribute('target', annotation.target);
    }
    link.setAttribute('rel', 'noreferrer');
    link.append(node);
    node = link;
  }

  if (annotation.bold && annotation.href) {
    const strong = document.createElement('strong');
    strong.append(node);
    return strong;
  }

  return node;
}

function createXEmojiNode(text: string, emojiImageUrl: string, bold: boolean): HTMLElement {
  const emoji = document.createElement('span');
  emoji.className = 'reader-x-emoji';
  emoji.style.backgroundImage = `url("${emojiImageUrl}")`;
  emoji.style.backgroundSize = '1em 1em';
  emoji.style.backgroundPosition = 'center center';
  emoji.style.backgroundRepeat = 'no-repeat';
  emoji.style.padding = '0.15em';
  emoji.style.webkitTextFillColor = 'transparent';

  const hidden = document.createElement('span');
  hidden.className = 'reader-x-emoji-hidden';
  hidden.style.clipPath = 'circle(0% at 50% 50%)';

  if (bold) {
    const strong = document.createElement('strong');
    strong.textContent = text;
    hidden.append(strong);
  } else {
    hidden.textContent = text;
  }

  emoji.append(hidden);
  return emoji;
}
