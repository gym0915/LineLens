import type { Article, FocusUnit } from '../shared/article-schema.js';
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
        span.textContent = readingUnit.text;
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
