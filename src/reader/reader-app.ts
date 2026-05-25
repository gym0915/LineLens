import { renderArticleShell } from './block-renderer.js';
import { buildFocusUnits } from './focus-unit-builder.js';
import { FocusEngine } from './focus-engine.js';
import { HighlightLayer } from './highlight-layer.js';
import { ProgressStore } from './progress-store.js';
import type { Article, FocusUnit } from '../shared/article-schema.js';

export function mountReaderApp(root: HTMLElement, article: Article): void {
  root.textContent = '';

  const articleElement = renderArticleShell(article);
  const status = document.createElement('footer');
  status.className = 'reader-status';
  const hint = document.createElement('p');
  hint.className = 'reader-hint';
  hint.textContent = '使用 ← → 逐步阅读，Home / End 跳到首尾';

  root.append(articleElement, hint, status);

  const { units, elements } = buildFocusUnits(article, articleElement);
  const highlightLayer = new HighlightLayer();
  highlightLayer.mount(root);
  const progressStore = new ProgressStore();
  const savedProgress = progressStore.get(article.id);
  const initialIndex = resolveInitialIndex(savedProgress?.unitId, units);
  let activeUnit: FocusUnit | null = null;
  let activeIndex: number | null = null;
  let hasRenderedInitialFocus = false;
  let refreshFrame = 0;

  const engine = new FocusEngine(units, (unit, index) => {
    const shouldScroll = hasRenderedInitialFocus && index !== activeIndex;
    activeUnit = unit;
    activeIndex = index;
    highlightLayer.update(unit, elements, { scroll: shouldScroll });
    hasRenderedInitialFocus = true;
    progressStore.save({
      articleId: article.id,
      unitId: unit.unitId,
      focusIndex: index,
      updatedAt: Date.now()
    });
    status.textContent = formatReadingStatus(units, index);
  });
  engine.setAnchorMode('free');

  root.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    const focusElement = target.closest<HTMLElement>('[data-unit-id]');
    if (!focusElement?.dataset.unitId) {
      return;
    }

    const index = units.findIndex((unit) => unit.unitId === focusElement.dataset.unitId);
    if (index >= 0) {
      hideHint(hint);
      engine.setIndex(index);
    }
  });

  window.addEventListener('keydown', (event) => {
    if (shouldIgnoreKeydown(event)) {
      return;
    }

    if (event.key === 'ArrowRight') {
      event.preventDefault();
      hideHint(hint);
      engine.next();
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      hideHint(hint);
      engine.previous();
    } else if (event.key === 'Home') {
      event.preventDefault();
      hideHint(hint);
      engine.first();
    } else if (event.key === 'End') {
      event.preventDefault();
      hideHint(hint);
      engine.last();
    } else if (event.key === 'h' || event.key === 'H') {
      event.preventDefault();
      hideHint(hint);
      engine.first();
    } else if (event.key === 'e' || event.key === 'E') {
      event.preventDefault();
      hideHint(hint);
      engine.last();
    }
  });

  engine.start(initialIndex);

  const scheduleHighlightRefresh = () => {
    if (refreshFrame) {
      return;
    }

    refreshFrame = window.requestAnimationFrame(() => {
      refreshFrame = 0;
      if (activeUnit) {
        highlightLayer.refresh(activeUnit, elements);
      }
    });
  };

  window.addEventListener('resize', scheduleHighlightRefresh);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      scheduleHighlightRefresh();
    }
  });
  document.fonts?.ready.then(scheduleHighlightRefresh).catch(() => undefined);

  articleElement.querySelectorAll('img').forEach((image) => {
    image.addEventListener('load', scheduleHighlightRefresh);
    image.addEventListener('error', scheduleHighlightRefresh);
  });
}

function resolveInitialIndex(unitId: string | undefined, units: FocusUnit[]): number {
  if (!unitId) {
    return 0;
  }

  const index = units.findIndex((unit) => unit.unitId === unitId);
  return index >= 0 ? index : 0;
}

function shouldIgnoreKeydown(event: KeyboardEvent): boolean {
  if (window.getSelection?.()?.toString()) {
    return true;
  }

  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return target.isContentEditable || ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName);
}

function hideHint(hint: HTMLElement): void {
  hint.classList.add('is-hidden');
}

function formatReadingStatus(units: FocusUnit[], activeIndex: number): string {
  const progress = Math.round(((activeIndex + 1) / units.length) * 100);
  const remainingWords = units
    .slice(activeIndex + 1)
    .reduce((count, unit) => count + ('text' in unit ? countWords(unit.text) : 0), 0);
  const minutesLeft = Math.max(1, Math.ceil(remainingWords / 200));
  return `${progress}% · ${minutesLeft} min remaining`;
}

function countWords(text: string): number {
  const latinWords = text.match(/[A-Za-z0-9]+(?:[-'][A-Za-z0-9]+)*/g)?.length ?? 0;
  const cjkChars = text.match(/[\u3400-\u9fff]/g)?.length ?? 0;
  return latinWords + Math.ceil(cjkChars / 2);
}
