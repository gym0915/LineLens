import type { FocusUnit } from '../../shared/article-schema.js';

export type ReaderProgressElements = {
  element: HTMLElement;
  bar: HTMLElement;
};

export function createReaderProgress(): ReaderProgressElements {
  const element = document.createElement('div');
  element.className = 'reader-progress';
  element.setAttribute('data-ui', 'true');
  element.setAttribute('role', 'progressbar');
  element.setAttribute('aria-label', '阅读进度');
  element.setAttribute('aria-valuemin', '0');
  element.setAttribute('aria-valuemax', '100');
  element.setAttribute('aria-valuenow', '0');

  const track = document.createElement('div');
  track.className = 'reader-progress-track';

  const bar = document.createElement('div');
  bar.className = 'reader-progress-bar';

  track.append(bar);
  element.append(track);

  return { element, bar };
}

export function updateReaderProgress(progress: ReaderProgressElements, units: FocusUnit[], activeIndex: number): void {
  const total = Math.max(1, units.length);
  const percent = Math.round(((activeIndex + 1) / total) * 100);
  progress.element.style.setProperty('--reader-progress-value', `${percent}%`);
  progress.element.setAttribute('aria-valuenow', String(percent));
}
