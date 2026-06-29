import type { TableBlock } from '../../shared/article-schema.js';
import { applyTableCellTextStyle } from '../style-policy.js';

export function renderTableBlock(block: TableBlock): HTMLElement {
  const wrapper = document.createElement('figure');
  wrapper.className = 'reader-block reader-table';
  wrapper.dataset.blockId = block.id;
  wrapper.dataset.blockType = 'table';

  const table = document.createElement('table');
  table.className = 'reader-table-grid';
  if (block.columnCount) {
    table.style.setProperty('--reader-table-columns', String(block.columnCount));
  }

  const tbody = document.createElement('tbody');
  for (const row of block.rows) {
    const tr = document.createElement('tr');
    for (const cell of row.cells) {
      const cellElement = document.createElement(cell.header ? 'th' : 'td');
      cellElement.className = 'reader-table-cell';
      if (cell.colSpan) cellElement.colSpan = cell.colSpan;
      if (cell.rowSpan) cellElement.rowSpan = cell.rowSpan;
      applyTableCellTextStyle(cellElement, cell.textStyle);
      if (cell.header) cellElement.style.textAlign = 'center';
      cellElement.textContent = cell.text;
      tr.append(cellElement);
    }
    tbody.append(tr);
  }

  table.append(tbody);
  wrapper.append(table);
  return wrapper;
}
