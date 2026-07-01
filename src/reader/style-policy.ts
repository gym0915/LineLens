import type { CodeBlock, CodeToken, TextAnnotation, TextStyle } from '../shared/article-schema.js';

type InlineTextStyle = Pick<TextAnnotation, 'color' | 'fontSize' | 'lineHeight' | 'textAlign' | 'fontStyle' | 'textDecoration'>;

export function applyInlineTextStyle(element: HTMLElement, style: InlineTextStyle): void {
  if (style.fontStyle) element.style.fontStyle = style.fontStyle;
  if (style.textDecoration) element.style.textDecoration = style.textDecoration;
}

export function applyCaptionTextStyle(element: HTMLElement, style?: TextStyle): void {
  if (style?.fontSize) {
    element.style.setProperty('--reader-media-caption-source-size', style.fontSize);
  }
  if (style?.lineHeight) {
    element.style.setProperty('--reader-media-caption-source-line-height', style.lineHeight);
  }
}

export function applyTableCellTextStyle(element: HTMLElement, style?: TextStyle): void {
  if (!style) return;
  if (style.fontSize) element.style.fontSize = style.fontSize;
  if (style.textAlign) element.style.textAlign = style.textAlign;
}

export function applyCodeStyle(element: HTMLElement, style?: CodeBlock['codeStyle']): void {
  if (!style) return;
  if (style.fontFamily) element.style.fontFamily = style.fontFamily;
  if (style.fontSize) element.style.fontSize = style.fontSize;
  if (style.lineHeight) element.style.lineHeight = style.lineHeight;
  if (style.tabSize) element.style.tabSize = style.tabSize;
}

export function applyCodeTokenStyle(
  element: HTMLElement,
  token: Pick<CodeToken, 'color' | 'themeColors' | 'fontStyle' | 'fontWeight'>
): boolean {
  const hasThemeColor = applyCodeThemeColorPair(
    element,
    '--reader-code-token-light-color',
    '--reader-code-token-dark-color',
    token.themeColors?.color
  );
  if (!hasThemeColor && token.color) {
    element.style.color = token.color;
  }
  if (token.fontStyle) element.style.fontStyle = token.fontStyle;
  if (token.fontWeight) element.style.fontWeight = token.fontWeight;
  return hasThemeColor;
}

function applyCodeThemeColorPair(element: HTMLElement, lightVariable: string, darkVariable: string, colorPair?: { light?: string; dark?: string }): boolean {
  if (!colorPair?.light && !colorPair?.dark) {
    return false;
  }
  if (colorPair.light) {
    element.style.setProperty(lightVariable, colorPair.light);
  }
  if (colorPair.dark) {
    element.style.setProperty(darkVariable, colorPair.dark);
  }
  return true;
}

export function applySimpleTweetTextStyle(element: HTMLElement, style?: TextStyle): void {
  if (!style) return;
  if (style.color) element.style.color = style.color;
  if (style.fontSize) element.style.fontSize = style.fontSize;
  if (style.lineHeight) element.style.lineHeight = style.lineHeight;
  if (style.textAlign) element.style.textAlign = style.textAlign;
  if (style.fontStyle) element.style.fontStyle = style.fontStyle;
  if (style.fontWeight) element.style.fontWeight = style.fontWeight;
}
