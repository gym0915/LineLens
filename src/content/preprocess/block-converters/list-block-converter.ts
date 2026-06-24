import type { ListBlock, TextAnnotation, TextStyle } from '../../../shared/article.js';
import { normalizePreWrapText } from '../../../shared/text.js';
import type { ResolvedSemanticSelectors } from '../semantic-map-selectors.js';

export type ListKind = 'ordered' | 'unordered';

export type ListBlockConverterDeps = {
  blockId: string;
  consumedElements: Set<Element>;
  semanticSelectors: ResolvedSemanticSelectors;
  getElementDisplayText(element: Element, preserveLineBreaks?: boolean): string;
  extractTextAnnotations(element: Element, fullText: string): TextAnnotation[];
  extractElementTextStyle(element: Element | null): TextStyle;
  nextElementInDocument(element: Element): Element | null;
};

export function convertListElementGroup(element: Element, deps: ListBlockConverterDeps): ListBlock | null {
  const kind = getListKind(element, deps.semanticSelectors) ?? 'unordered';
  const elements = collectAdjacentListElements(element, kind, deps);
  const normalizedItems = elements.map((item) => normalizeListItem(item, kind, deps)).filter((item) => item.text !== '');

  if (normalizedItems.length === 0) {
    return null;
  }

  elements.forEach((item) => deps.consumedElements.add(item));

  return {
    id: deps.blockId,
    type: 'list',
    kind,
    items: normalizedItems.map((item) => item.text),
    itemAnnotations: normalizedItems.map((item) => item.annotations),
    itemTextStyles: normalizedItems.map((item) => item.textStyle)
  };
}

export function isListElement(element: Element, selectors: ResolvedSemanticSelectors): boolean {
  return element.matches(selectors.orderedListSelector) || element.matches(selectors.unorderedListSelector) || isHandwrittenOrderedListElement(element);
}

function collectAdjacentListElements(element: Element, kind: ListKind, deps: ListBlockConverterDeps): Element[] {
  const elements = [element];
  let current: Element | null = element;

  while (current !== null) {
    const next = deps.nextElementInDocument(current);
    if (next === null || !isListElement(next, deps.semanticSelectors) || getListKind(next, deps.semanticSelectors) !== kind) {
      break;
    }

    elements.push(next);
    current = next;
  }

  return elements;
}

function getListKind(element: Element, semanticSelectors: ResolvedSemanticSelectors): ListKind | null {
  if (element.matches(semanticSelectors.orderedListSelector)) {
    return 'ordered';
  }

  if (isHandwrittenOrderedListElement(element)) {
    return 'ordered';
  }

  if (element.matches(semanticSelectors.unorderedListSelector)) {
    return 'unordered';
  }

  return null;
}

function normalizeListItem(
  element: Element,
  kind: ListKind,
  deps: ListBlockConverterDeps
): { text: string; annotations: TextAnnotation[]; textStyle: TextStyle } {
  const rawText = normalizePreWrapText(deps.getElementDisplayText(element, true));
  const markerMatch = kind === 'ordered' ? getOrderedListMarker(rawText) : null;
  const markerLength = markerMatch?.[0].length ?? 0;
  const text = kind === 'ordered' && markerLength > 0 ? rawText.slice(markerLength).trimStart() : rawText;
  const annotations = shiftTextAnnotations(deps.extractTextAnnotations(element, rawText), markerLength);
  const textStyle = deps.extractElementTextStyle(element);

  return { text, annotations, textStyle };
}

function shiftTextAnnotations(annotations: TextAnnotation[], offset: number): TextAnnotation[] {
  if (offset === 0) {
    return annotations;
  }

  return annotations
    .map((annotation) => ({
      ...annotation,
      startOffset: Math.max(0, annotation.startOffset - offset),
      endOffset: Math.max(0, annotation.endOffset - offset)
    }))
    .filter((annotation) => annotation.endOffset > annotation.startOffset);
}

function getOrderedListMarker(text: string): RegExpMatchArray | null {
  return text.match(/^(\d+\.)\s+/);
}

function isHandwrittenOrderedListElement(element: Element): boolean {
  if (!element.hasAttribute('data-block')) {
    return false;
  }

  return getOrderedListMarker(normalizePreWrapText(element.textContent ?? '')) !== null;
}
