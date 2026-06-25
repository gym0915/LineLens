import type { TextAnnotation, TextStyle } from '../../shared/article-schema.js';
import { appendReaderText, applyReaderTextMetadata } from '../reader-text-renderer.js';

export function renderHeadingBlock(
  blockId: string,
  level: 1 | 2 | 3 | 4 | 5 | 6 = 2,
  text: string,
  annotations: TextAnnotation[] = [],
  textStyle?: TextStyle
): HTMLElement {
  return renderTextBlock(getHeadingTagName(level), blockId, 'heading', text, annotations, textStyle);
}

export function renderParagraphBlock(
  blockId: string,
  text: string,
  annotations: TextAnnotation[] = [],
  textStyle?: TextStyle,
  blockRole?: 'caption'
): HTMLElement {
  return renderTextBlock('p', blockId, 'paragraph', text, annotations, textStyle, blockRole);
}

export function renderQuoteBlock(
  blockId: string,
  text: string,
  annotations: TextAnnotation[] = [],
  textStyle?: TextStyle
): HTMLElement {
  return renderTextBlock('blockquote', blockId, 'quote', text, annotations, textStyle);
}

export function renderLinkBlock(blockId: string, text: string, href: string, target?: string): HTMLElement {
  const element = document.createElement('a');
  element.className = 'reader-block reader-link';
  element.dataset.blockId = blockId;
  element.dataset.blockType = 'link';
  element.textContent = text;
  element.setAttribute('href', href);
  if (target) {
    element.setAttribute('target', target);
  }
  element.setAttribute('rel', 'noreferrer');
  return element;
}

function renderTextBlock(
  tagName: 'blockquote' | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'p',
  blockId: string,
  blockType: string,
  text: string,
  annotations: TextAnnotation[] = [],
  textStyle?: TextStyle,
  blockRole?: 'caption'
): HTMLElement {
  const element = document.createElement(tagName);
  element.className = blockRole === 'caption' ? 'reader-block reader-media-caption' : 'reader-block';
  element.dataset.blockId = blockId;
  element.dataset.blockType = blockType;
  if (blockRole) {
    element.dataset.blockRole = blockRole;
    applyCaptionTextStyle(element, textStyle);
  }
  applyReaderTextMetadata(
    element,
    appendReaderText(element, text, annotations, {
      role: blockType === 'paragraph' ? 'body' : blockType === 'quote' ? 'quote' : 'heading'
    })
  );
  return element;
}

function applyCaptionTextStyle(element: HTMLElement, style?: TextStyle): void {
  if (style?.fontSize) {
    element.style.setProperty('--reader-media-caption-source-size', style.fontSize);
  }
  if (style?.lineHeight) {
    element.style.setProperty('--reader-media-caption-source-line-height', style.lineHeight);
  }
}

function getHeadingTagName(level: 1 | 2 | 3 | 4 | 5 | 6 = 2): 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' {
  return `h${level}`;
}
