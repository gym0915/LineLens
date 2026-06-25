import { cleanupRenderedMedia, renderArticleShell } from './block-renderer.js';
import { buildFocusUnits } from './focus-unit-builder.js';
import { FocusEngine } from './focus-engine.js';
import { HighlightLayer } from './highlight-layer.js';
import { ProgressStore } from './progress-store.js';
import { registerClickController } from './controllers/click-controller.js';
import { registerKeyboardController } from './controllers/keyboard-controller.js';
import { createMediaPreviewState, preloadMediaPreviews } from './controllers/media-preview-controller.js';
import { createReaderProgress, updateReaderProgress } from './controllers/progress-ui.js';
import type { Article, FocusUnit } from '../shared/article-schema.js';

export function mountReaderApp(root: HTMLElement, article: Article): void {
  cleanupRenderedMedia(root);
  root.textContent = '';

  const articleElement = renderArticleShell(article);
  const progress = createReaderProgress();
  const toast = document.createElement('div');
  toast.className = 'reader-toast';
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');
  const hint = document.createElement('p');
  hint.className = 'reader-hint';
  hint.textContent = '使用 ← → 逐步阅读，Home / End 跳到首尾';

  root.append(progress.element, articleElement, hint, toast);

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
  const mediaPreviewState = createMediaPreviewState(article);
  preloadMediaPreviews(mediaPreviewState);

  const engine = new FocusEngine(units, (unit, index) => {
    const shouldScroll = !hasRenderedInitialFocus
      ? initialIndex > 0
      : index !== activeIndex;
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
    updateReaderProgress(progress, units, index);
  });
  engine.setAnchorMode('free');

  registerClickController({
    root,
    articleId: article.id,
    units,
    engine,
    hint,
    toast,
    mediaPreviewState,
    getActiveUnit: () => activeUnit
  });
  registerKeyboardController({ root, engine, hint, mediaPreviewState });

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

  window.addEventListener(
    'pagehide',
    () => {
      cleanupRenderedMedia(articleElement);
    },
    { once: true }
  );
}

function resolveInitialIndex(unitId: string | undefined, units: FocusUnit[]): number {
  if (!unitId) {
    return 0;
  }

  const index = units.findIndex((unit) => unit.unitId === unitId);
  return index >= 0 ? index : 0;
}
