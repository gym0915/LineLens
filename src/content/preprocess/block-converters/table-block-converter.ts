import type { TableBlock, TextStyle } from '../../../shared/article.js';
import { normalizePreWrapText } from '../../../shared/text.js';
import type { ResolvedSemanticSelectors } from '../semantic-map-selectors.js';

export type TableBlockConverterDeps = {
  blockId: string;
  consumedElements: Set<Element>;
  semanticSelectors: ResolvedSemanticSelectors;
  findTableRoot(element: Element, semanticSelectors: ResolvedSemanticSelectors): Element | null;
  getTableRowElements(tableRoot: Element): Element[];
  getTableCellElements(row: Element): Element[];
  isTableHeaderCell(cell: Element): boolean;
  getTableSpanAttributes(cell: Element): Pick<TableBlock['rows'][number]['cells'][number], 'colSpan' | 'rowSpan'>;
  extractTableTextStyle(element: Element | null): TextStyle;
  getElementDisplayText(element: Element, preserveLineBreaks?: boolean): string;
  rootBlockAncestors(element: Element): Iterable<Element>;
};

export function convertTableElement(element: Element, deps: TableBlockConverterDeps): TableBlock | null {
  const tableRoot = deps.findTableRoot(element, deps.semanticSelectors);
  if (!tableRoot) {
    return null;
  }

  const rowElements = deps.getTableRowElements(tableRoot);
  const rows = rowElements
    .map((row) => ({
      cells: deps.getTableCellElements(row).map((cell) => ({
        text: normalizePreWrapText(deps.getElementDisplayText(cell, true)),
        ...(deps.isTableHeaderCell(cell) ? { header: true } : {}),
        ...deps.getTableSpanAttributes(cell),
        textStyle: deps.extractTableTextStyle(cell)
      }))
    }))
    .filter((row) => row.cells.some((cell) => cell.text));

  if (rows.length === 0) {
    return null;
  }

  deps.consumedElements.add(element);
  deps.consumedElements.add(tableRoot);
  for (const ancestor of Array.from(deps.rootBlockAncestors(tableRoot))) {
    deps.consumedElements.add(ancestor);
  }

  return {
    id: deps.blockId,
    type: 'table',
    rows,
    columnCount: Math.max(...rows.map((row) => row.cells.reduce((total, cell) => total + (cell.colSpan ?? 1), 0)))
  };
}
