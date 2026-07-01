import type { Article, FocusUnit } from '../shared/article-schema.js';
import type { ReadingUnitSplitOptions } from './semantic-splitter.js';
import { splitIntoReadingUnits } from './semantic-splitter.js';
import { createReaderTextMetadata, createReaderTextSpan } from './reader-text-renderer.js';

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

    if (block.type === 'divider') {
      continue;
    }

    if (block.type === 'paragraph') {
      blockElement.textContent = '';
      const readingUnits = block.text.includes('\n')
        ? [
            {
              text: block.text,
              startOffset: 0,
              endOffset: block.text.length
            }
          ]
        : splitIntoReadingUnits(block.text, createParagraphSplitOptions(blockElement));

      readingUnits.forEach((readingUnit, index) => {
        const unitId = `${block.id}-u${index + 1}`;
        const span = createReaderTextSpan(block.text, block.annotations, {
          role: 'body',
          className: 'focus-unit',
          rangeStart: readingUnit.startOffset,
          rangeEnd: readingUnit.endOffset
        });
        span.dataset.unitId = unitId;
        blockElement.append(span, document.createTextNode(' '));
        const textMetadata = createReaderTextMetadata(block.text, block.annotations, {
          role: 'body',
          rangeStart: readingUnit.startOffset,
          rangeEnd: readingUnit.endOffset
        });

        const unit: FocusUnit = {
          id: unitId,
          type: 'reading-text',
          blockId: block.id,
          unitId,
          text: readingUnit.text,
          startOffset: readingUnit.startOffset,
          endOffset: readingUnit.endOffset,
          textRole: 'body'
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
          endOffset: text.length,
          textRole: 'list-item'
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

function createParagraphSplitOptions(blockElement: HTMLElement): ReadingUnitSplitOptions {
  const maxLineWidth = blockElement.clientWidth;
  if (!maxLineWidth || maxLineWidth <= 0 || typeof window === 'undefined') {
    return {};
  }

  const style = window.getComputedStyle(blockElement);
  const reservedInlinePadding = resolveParagraphReservedInlinePadding(style);
  const availableLineWidth = Math.max(0, maxLineWidth - reservedInlinePadding * 2);
  const canvas = document.createElement('canvas');
  const context = canvas.getContext?.('2d');
  if (!context) {
    return { maxLineWidth: availableLineWidth };
  }

  context.font = style.font || [
    style.fontStyle,
    style.fontVariant,
    style.fontWeight,
    style.fontSize,
    style.fontFamily
  ].filter(Boolean).join(' ');

  const letterSpacing = Number.parseFloat(style.letterSpacing);

  return {
    maxLineWidth: Math.max(0, maxLineWidth - reservedInlinePadding * 2),
    measureText: (text) => {
      const baseWidth = context.measureText(text).width;
      if (!Number.isFinite(letterSpacing) || letterSpacing === 0) {
        return baseWidth;
      }
      return baseWidth + Math.max(0, Array.from(text).length - 1) * letterSpacing;
    }
  };
}

function resolveParagraphReservedInlinePadding(style: CSSStyleDeclaration): number {
  const tokenValue = style.getPropertyValue('--reader-inline-highlight-padding-inline');
  const tokenPadding = Number.parseFloat(tokenValue);
  if (Number.isFinite(tokenPadding)) {
    return tokenPadding;
  }

  const paddingInlineStart = Number.parseFloat(style.paddingInlineStart);
  if (Number.isFinite(paddingInlineStart)) {
    return paddingInlineStart;
  }

  return 0;
}
