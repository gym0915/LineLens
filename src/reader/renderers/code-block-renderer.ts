import type { CodeBlock, CodeToken } from '../../shared/article-schema.js';

export function renderCodeBlock(block: CodeBlock): HTMLElement {
  const figure = document.createElement('figure');
  figure.className = 'reader-block reader-code';
  figure.dataset.blockId = block.id;
  figure.dataset.blockType = 'code';

  const header = document.createElement('figcaption');
  // Surface colors are owned by Reader design tokens and respond to system theme automatically.
  header.className = 'reader-code-header';

  const label = document.createElement('span');
  label.className = 'reader-code-language';
  label.textContent = block.language || detectCodeLanguage(block.text) || 'text';

  const button = document.createElement('button');
  button.className = 'reader-code-copy';
  button.type = 'button';
  button.setAttribute('aria-label', 'Copy to clipboard');
  button.dataset.copyCode = block.text;
  button.append(renderCopyIcon());

  header.append(label, button);

  const pre = document.createElement('pre');
  pre.className = 'reader-code-pre';
  applyCodeStyle(pre, block.codeStyle);
  const code = document.createElement('code');
  code.className = `language-${label.textContent}`;
  if (block.codeStyle?.fontFamily) code.style.fontFamily = block.codeStyle.fontFamily;
  if (block.codeStyle?.fontSize) code.style.fontSize = block.codeStyle.fontSize;
  if (block.codeStyle?.lineHeight) code.style.lineHeight = block.codeStyle.lineHeight;
  if (block.codeStyle?.tabSize) code.style.tabSize = block.codeStyle.tabSize;
  if (block.tokens && block.tokens.length > 0) {
    appendExtractedCodeTokens(code, block.tokens);
  } else {
    appendHighlightedCode(code, block.text, label.textContent);
  }
  pre.append(code);
  figure.append(header, pre);
  return figure;
}

function applyCodeStyle(pre: HTMLElement, style?: CodeBlock['codeStyle']): void {
  if (!style) return;
  if (style.fontFamily) pre.style.fontFamily = style.fontFamily;
  if (style.fontSize) pre.style.fontSize = style.fontSize;
  if (style.lineHeight) pre.style.lineHeight = style.lineHeight;
  if (style.tabSize) pre.style.tabSize = style.tabSize;
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

function appendExtractedCodeTokens(container: HTMLElement, tokens: CodeToken[]): void {
  for (const token of tokens) {
    if (!token.color && !token.themeColors?.color && !token.fontStyle && !token.fontWeight) {
      container.append(document.createTextNode(token.text));
      continue;
    }

    const span = document.createElement('span');
    span.textContent = token.text;
    if (applyCodeThemeColorPair(span, '--reader-code-token-light-color', '--reader-code-token-dark-color', token.themeColors?.color)) {
      span.className = 'reader-code-token-themed';
    } else if (token.color) {
      span.style.color = token.color;
    }
    if (token.fontStyle) span.style.fontStyle = token.fontStyle;
    if (token.fontWeight) span.style.fontWeight = token.fontWeight;
    container.append(span);
  }
}

function renderCopyIcon(): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('class', 'reader-code-copy-icon');
  const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute(
    'd',
    'M19.5 2C20.88 2 22 3.12 22 4.5v11c0 1.21-.86 2.22-2 2.45V4.5c0-.28-.22-.5-.5-.5H6.05c.23-1.14 1.24-2 2.45-2h11zm-4 4C16.88 6 18 7.12 18 8.5v11c0 1.38-1.12 2.5-2.5 2.5h-11C3.12 22 2 20.88 2 19.5v-11C2 7.12 3.12 6 4.5 6h11zM4 19.5c0 .28.22.5.5.5h11c.28 0 .5-.22.5-.5v-11c0-.28-.22-.5-.5-.5h-11c-.28 0-.5.22-.5.5v11z'
  );
  group.append(path);
  svg.append(group);
  return svg;
}

function appendHighlightedCode(container: HTMLElement, text: string, language: string): void {
  if (language === 'markdown' || language === 'md') {
    appendHighlightedMarkdown(container, text);
    return;
  }

  const pattern = getCodeTokenPattern(language);
  let cursor = 0;
  for (const match of text.matchAll(pattern)) {
    if (match.index === undefined) continue;
    if (match.index > cursor) {
      container.append(document.createTextNode(text.slice(cursor, match.index)));
    }
    const span = document.createElement('span');
    span.className = `reader-code-token reader-code-token-${classifyCodeToken(match[0])}`;
    span.textContent = match[0];
    container.append(span);
    cursor = match.index + match[0].length;
  }
  if (cursor < text.length) {
    container.append(document.createTextNode(text.slice(cursor)));
  }
}

function appendHighlightedMarkdown(container: HTMLElement, text: string): void {
  const linePattern = /([^\n]*)(\n|$)/g;
  for (const match of text.matchAll(linePattern)) {
    const line = match[1];
    const lineEnd = match[2];
    if (!line && !lineEnd) continue;

    appendHighlightedMarkdownLine(container, line);
    if (lineEnd) {
      container.append(document.createTextNode(lineEnd));
    }
  }
}

function appendHighlightedMarkdownLine(container: HTMLElement, line: string): void {
  const headingMatch = line.match(/^(\s*)(#{1,6})(\s+)(.*)$/);
  if (headingMatch) {
    container.append(document.createTextNode(headingMatch[1]));
    appendCodeToken(container, headingMatch[2], 'punctuation');
    appendCodeToken(container, `${headingMatch[3]}${headingMatch[4]}`, 'heading');
    return;
  }

  const orderedListMatch = line.match(/^(\s*)(\d+\.)(\s+.*)$/);
  if (orderedListMatch) {
    container.append(document.createTextNode(orderedListMatch[1]));
    appendCodeToken(container, orderedListMatch[2], 'punctuation');
    container.append(document.createTextNode(orderedListMatch[3]));
    return;
  }

  const unorderedListMatch = line.match(/^(\s*)([-*+])(\s+.*)$/);
  if (unorderedListMatch) {
    container.append(document.createTextNode(unorderedListMatch[1]));
    appendCodeToken(container, unorderedListMatch[2], 'punctuation');
    container.append(document.createTextNode(unorderedListMatch[3]));
    return;
  }

  container.append(document.createTextNode(line));
}

function appendCodeToken(container: HTMLElement, text: string, tokenType: string): void {
  const span = document.createElement('span');
  span.className = `reader-code-token reader-code-token-${tokenType}`;
  span.textContent = text;
  container.append(span);
}

function getCodeTokenPattern(language: string): RegExp {
  if (['xml', 'html', 'jsx', 'tsx'].includes(language)) {
    return /<\/?[A-Za-z][\w:-]*|>|\/>|"[^"]*"|'[^']*'|\/\/[^\n]*|\b(?:class|function|const|let|var|return|type|interface|export|import|from|extends|pub|struct|impl|fn|let|mut)\b/g;
  }
  return /\/\/[^\n]*|"[^"]*"|'[^']*'|\b(?:class|function|const|let|var|return|type|interface|export|import|from|extends|pub|struct|impl|fn|mut|async|await)\b|\b\d+(?:\.\d+)?\b/g;
}

function classifyCodeToken(token: string): string {
  if (token.startsWith('//')) return 'comment';
  if (/^["']/.test(token)) return 'string';
  if (/^<\/?[A-Za-z]/.test(token)) return 'tag';
  if (/^\d/.test(token)) return 'number';
  if (token === '>' || token === '/>') return 'punctuation';
  return 'keyword';
}

function detectCodeLanguage(text: string): string {
  if (/^\s*</.test(text)) return 'xml';
  if (/\bpub\s+struct\b|\bfn\s+\w+/.test(text)) return 'rust';
  if (/\bnpm\s+install\b|\bcd\s+/.test(text)) return 'shell';
  return '';
}
