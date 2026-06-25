import { FocusEngine } from '../focus-engine.js';
import { handleMediaPreviewKeydown, type MediaPreviewState } from './media-preview-controller.js';

export function registerKeyboardController(options: {
  root: HTMLElement;
  engine: FocusEngine;
  hint: HTMLElement;
  mediaPreviewState: MediaPreviewState;
}): void {
  const { root, engine, hint, mediaPreviewState } = options;

  window.addEventListener('keydown', (event) => {
    if (handleMediaPreviewKeydown(event, mediaPreviewState, root)) {
      return;
    }

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
