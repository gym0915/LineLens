import type { FocusUnit } from '../../shared/article-schema.js';
import { FocusEngine } from '../focus-engine.js';
import { copyCodeToClipboard } from './code-copy-controller.js';
import {
  getActiveMediaPreview,
  getCoverMediaPreview,
  logReaderMediaLinkClick,
  openMediaPreview,
  type MediaPreviewState
} from './media-preview-controller.js';

export function registerClickController(options: {
  root: HTMLElement;
  articleId: string;
  units: FocusUnit[];
  engine: FocusEngine;
  hint: HTMLElement;
  toast: HTMLElement;
  mediaPreviewState: MediaPreviewState;
  getActiveUnit: () => FocusUnit | null;
}): void {
  const { root, articleId, units, engine, hint, toast, mediaPreviewState, getActiveUnit } = options;

  root.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }

    const copyButton = target.closest<HTMLButtonElement>('button[data-copy-code]');
    if (copyButton) {
      event.preventDefault();
      event.stopPropagation();
      void copyCodeToClipboard(copyButton.dataset.copyCode ?? '', toast);
      return;
    }

    const coverPreview = getCoverMediaPreview(target, mediaPreviewState);
    if (coverPreview) {
      event.preventDefault();
      event.stopPropagation();
      hideHint(hint);
      openMediaPreview(mediaPreviewState, coverPreview, root);
      return;
    }

    const focusElement = target.closest<HTMLElement>('[data-unit-id]');
    if (!focusElement?.dataset.unitId) {
      return;
    }

    const index = units.findIndex((unit) => unit.unitId === focusElement.dataset.unitId);
    if (index < 0) {
      return;
    }

    const activeUnit = getActiveUnit();
    const mediaPreview = getActiveMediaPreview(target, focusElement, activeUnit, mediaPreviewState);
    if (mediaPreview) {
      event.preventDefault();
      event.stopPropagation();
      hideHint(hint);
      logReaderMediaLinkClick(articleId, focusElement, mediaPreview);
      openMediaPreview(mediaPreviewState, mediaPreview, root);
      return;
    }

    const shouldNavigateBlock = shouldNavigateBlockHref(target, focusElement, activeUnit);
    if (shouldSelectBlockLinkBeforeNavigation(target, focusElement, activeUnit)) {
      event.preventDefault();
      event.stopPropagation();
    }
    hideHint(hint);
    engine.setIndex(index);
    if (shouldNavigateBlock) {
      event.preventDefault();
      event.stopPropagation();
      openBlockHref(focusElement.dataset.href ?? '');
    }
  });
}

function shouldSelectBlockLinkBeforeNavigation(target: Element, focusElement: HTMLElement, activeUnit: FocusUnit | null): boolean {
  if (activeUnit?.unitId === focusElement.dataset.unitId) {
    return false;
  }

  const blockType = focusElement.dataset.blockType;
  if (blockType === 'simple-tweet') {
    if (isSimpleTweetVideoInteractionTarget(target)) {
      return false;
    }
    return Boolean(target.closest('a.reader-simple-tweet[href]') || focusElement.dataset.href);
  }
  if (blockType === 'image') {
    return Boolean(target.closest('a.reader-media[href]'));
  }
  if (blockType === 'image-gallery') {
    return Boolean(target.closest('a.reader-image-gallery-item[href]'));
  }

  return false;
}

function shouldNavigateBlockHref(target: Element, focusElement: HTMLElement, activeUnit: FocusUnit | null): boolean {
  if (activeUnit?.unitId !== focusElement.dataset.unitId) {
    return false;
  }
  if (focusElement.dataset.blockType !== 'simple-tweet') {
    return false;
  }
  if (!focusElement.dataset.href) {
    return false;
  }
  if (isSimpleTweetVideoInteractionTarget(target)) {
    return false;
  }
  return !target.closest('a[href]');
}

function isSimpleTweetVideoInteractionTarget(target: Element): boolean {
  for (let current: Element | null = target; current; current = current.parentElement) {
    const blockType = current.getAttribute('data-block-type');
    if (
      current.tagName === 'VIDEO' ||
      current.tagName === 'BUTTON' ||
      current.tagName === 'INPUT' ||
      current.getAttribute('role') === 'slider' ||
      current.classList.contains('reader-video-media') ||
      current.classList.contains('reader-video-player') ||
      blockType === 'simple-tweet-video' ||
      blockType === 'video'
    ) {
      return true;
    }
  }
  return false;
}

function openBlockHref(href: string): void {
  if (!href) {
    return;
  }

  if (typeof window.open === 'function') {
    const openedWindow = window.open(href, '_self');
    if (openedWindow) {
      return;
    }
  }

  if (typeof window.location?.assign === 'function') {
    window.location.assign(href);
  }
}

function hideHint(hint: HTMLElement): void {
  hint.classList.add('is-hidden');
}
