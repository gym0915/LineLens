import type { FocusUnit } from '../shared/article-schema.js';

type HighlightUpdateOptions = {
  scroll?: boolean;
};

export class HighlightLayer {
  private layer: HTMLDivElement | null = null;
  private focus: HTMLDivElement | null = null;
  private activeUnitId: string | null = null;

  mount(root: HTMLElement): void {
    if (this.layer && this.focus) {
      return;
    }

    const layer = document.createElement('div');
    layer.className = 'highlight-layer';
    layer.setAttribute('aria-hidden', 'true');

    const focus = document.createElement('div');
    focus.className = 'highlight-focus';
    layer.append(focus);
    root.append(layer);

    this.layer = layer;
    this.focus = focus;
  }

  update(
    activeUnit: FocusUnit,
    elements: Map<string, HTMLElement>,
    options: HighlightUpdateOptions = {}
  ): void {
    for (const element of elements.values()) {
      element.classList.remove('is-active');
      element.classList.add('is-muted');
    }

    const activeElement = elements.get(activeUnit.unitId);
    if (!activeElement) {
      return;
    }

    activeElement.classList.remove('is-muted');
    activeElement.classList.add('is-active');
    this.activeUnitId = activeUnit.unitId;
    this.refresh(activeUnit, elements);

    if (options.scroll) {
      activeElement.scrollIntoView({
        behavior: shouldReduceMotion() ? 'auto' : 'smooth',
        block: 'center'
      });
    }
  }

  hide(): void {
    this.layer?.classList.remove('is-visible');
    this.activeUnitId = null;
  }

  get activeId(): string | null {
    return this.activeUnitId;
  }

  refresh(activeUnit: FocusUnit, elements: Map<string, HTMLElement>): boolean {
    const activeElement = elements.get(activeUnit.unitId);
    if (!activeElement) {
      return false;
    }

    this.activeUnitId = activeUnit.unitId;
    this.updateFocusRect(activeElement);
    return true;
  }

  private updateFocusRect(activeElement: HTMLElement): void {
    if (!this.layer || !this.focus) {
      return;
    }

    const rect = activeElement.getBoundingClientRect();
    this.layer.classList.add('is-visible');
    this.layer.dataset.activeUnitId = this.activeUnitId ?? '';
    this.focus.style.setProperty('--highlight-x', `${rect.left}px`);
    this.focus.style.setProperty('--highlight-y', `${rect.top}px`);
    this.focus.style.setProperty('--highlight-width', `${rect.width}px`);
    this.focus.style.setProperty('--highlight-height', `${rect.height}px`);
  }
}

function shouldReduceMotion(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}
