import type { EmbedBlock } from '../../shared/article-schema.js';

export function renderSubscribeWidgetBlock(block: EmbedBlock): HTMLElement {
  const container = document.createElement('aside');
  container.className = 'reader-block reader-embed reader-subscribe-widget';
  container.dataset.blockId = block.id;
  container.dataset.blockType = 'embed';
  container.dataset.presentation = 'cta';
  if (block.href) {
    container.dataset.href = block.href;
  }

  const control = block.href ? document.createElement('a') : document.createElement('span');
  control.className = 'reader-subscribe-widget-link';
  if (block.href) {
    control.setAttribute('href', block.href);
    control.setAttribute('target', '_blank');
    control.setAttribute('rel', 'noopener noreferrer');
  }

  control.append(renderSubscribeWidgetCheckIcon());

  const label = document.createElement('span');
  label.className = 'reader-subscribe-widget-text';
  label.textContent = block.text ?? block.title ?? block.label;
  control.append(label);

  container.append(control);
  return container;
}

function renderSubscribeWidgetCheckIcon(): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('class', 'reader-subscribe-widget-icon');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');

  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', 'M20 6 9 17l-5-5');
  svg.append(path);
  return svg;
}
