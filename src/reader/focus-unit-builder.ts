import type { Article, FocusUnit, TextAnnotation } from '../shared/article-schema.js';
import { splitIntoReadingUnits } from './semantic-splitter.js';

export type FocusUnitBuildResult = {
  units: FocusUnit[];
  elements: Map<string, HTMLElement>;
};

export function buildFocusUnits(article: Article, root: HTMLElement): FocusUnitBuildResult {
  const units: FocusUnit[] = [];
  const elements = new Map<string, HTMLElement>();

  for (const block of article.blocks) {
    const blockElement = root.querySelector<HTMLElement>(`[data-block-id="${block.id}"]`);
    if (!blockElement) {
      continue;
    }

    if (block.type === 'paragraph') {
      blockElement.textContent = '';
      const readingUnits = splitIntoReadingUnits(block.text);

      readingUnits.forEach((readingUnit, index) => {
        const unitId = `${block.id}-u${index + 1}`;
        const span = document.createElement('span');
        span.className = 'focus-unit';
        span.dataset.unitId = unitId;
        appendAnnotatedText(span, block.text, readingUnit.startOffset, readingUnit.endOffset, block.annotations);
        blockElement.append(span, document.createTextNode(' '));

        const unit: FocusUnit = {
          id: unitId,
          type: 'reading-text',
          blockId: block.id,
          unitId,
          text: readingUnit.text,
          startOffset: readingUnit.startOffset,
          endOffset: readingUnit.endOffset
        };
        units.push(unit);
        elements.set(unitId, span);
      });
      continue;
    }

    if (block.type === 'list') {
      blockElement.querySelectorAll<HTMLElement>('.reader-list-item').forEach((itemElement, index) => {
        const unitId = `${block.id}-item-${index + 1}`;
        const text = block.items[index] ?? '';
        itemElement.classList.add('focus-unit');
        itemElement.dataset.unitId = unitId;

        const unit: FocusUnit = {
          id: unitId,
          type: 'reading-text',
          blockId: block.id,
          unitId,
          text,
          startOffset: 0,
          endOffset: text.length
        };
        units.push(unit);
        elements.set(unitId, itemElement);
      });
      continue;
    }

    const unitId = `${block.id}-block`;
    blockElement.classList.add('focus-unit');
    blockElement.dataset.unitId = unitId;
    const blockType = block.type === 'heading' ? 'heading' : block.type;

    const unit: FocusUnit = {
      id: unitId,
      type: 'block',
      blockId: block.id,
      unitId,
      blockType
    };
    units.push(unit);
    elements.set(unitId, blockElement);
  }

  return { units, elements };
}

function appendAnnotatedText(
  container: HTMLElement,
  sourceText: string,
  startOffset: number,
  endOffset: number,
  annotations: TextAnnotation[] = []
): void {
  const relevantAnnotations = annotations
    .filter((annotation) => (annotation.bold || annotation.href) && annotation.endOffset > startOffset && annotation.startOffset < endOffset)
    .map((annotation) => ({
      startOffset: Math.max(annotation.startOffset, startOffset),
      endOffset: Math.min(annotation.endOffset, endOffset),
      bold: annotation.bold,
      href: annotation.href,
      target: annotation.target
    }))
    .sort((a, b) => a.startOffset - b.startOffset);

  let cursor = startOffset;
  for (const annotation of relevantAnnotations) {
    if (annotation.startOffset > cursor) {
      container.append(document.createTextNode(sourceText.slice(cursor, annotation.startOffset)));
    }

    if (annotation.endOffset > annotation.startOffset) {
      const text = sourceText.slice(annotation.startOffset, annotation.endOffset);
      let annotatedNode: HTMLElement;
      if (annotation.href) {
        const link = document.createElement('a');
        link.setAttribute('href', annotation.href);
        if (annotation.target) {
          link.setAttribute('target', annotation.target);
        }
        link.setAttribute('rel', 'noreferrer');
        link.textContent = text;
        annotatedNode = link;
      } else {
        const strong = document.createElement('strong');
        strong.textContent = text;
        annotatedNode = strong;
      }

      if (annotation.bold && annotation.href) {
        const strong = document.createElement('strong');
        strong.append(annotatedNode);
        container.append(strong);
      } else {
        container.append(annotatedNode);
      }
    }
    cursor = annotation.endOffset;
  }

  if (cursor < endOffset) {
    container.append(document.createTextNode(sourceText.slice(cursor, endOffset)));
  }
}
