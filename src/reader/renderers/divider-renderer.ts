export function renderDividerBlock(id: string): HTMLElement {
  const divider = document.createElement('hr');
  divider.className = 'reader-block reader-divider';
  divider.dataset.blockId = id;
  divider.dataset.blockType = 'divider';
  return divider;
}
