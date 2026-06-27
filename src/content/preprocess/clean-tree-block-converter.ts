import type {
  ArticleBlock,
  ImageGalleryBlock,
  TextAnnotation,
  TextStyle,
  TableBlock,
  CodeBlockStyle,
  CodeToken
} from '../../shared/article.js';
import type { CodeThemePair } from '../adapters/adapter-types.js';
import type { CleanTreeContext } from './clone-content-tree.js';
import { resolveSemanticSelectors, type ResolvedSemanticSelectors } from './semantic-map-selectors.js';
import { getSpecialComponentHandler } from '../extractors/configurable/special-component-handlers.js';
import { convertTextElement as convertTextBlockElement } from './block-converters/text-block-converter.js';
import {
  convertListElementGroup as convertListBlockElementGroup,
  isListElement
} from './block-converters/list-block-converter.js';
import { convertImageElement as convertImageBlockElement } from './block-converters/image-block-converter.js';
import { convertCodeElement as convertCodeBlockElement } from './block-converters/code-block-converter.js';
import { convertTableElement as convertTableBlockElement } from './block-converters/table-block-converter.js';
import {
  convertPlatformImageGalleryElement,
  convertPlatformSpecialImageElement,
  extractPlatformImageMetadata,
  getPlatformImageGalleryConsumedElements
} from './platform-media-metadata.js';
import { resolveEmbedElement, resolveImageGalleryElement } from './media-resolver.js';

export type CleanTreeBlockConversionOptions = {
  enabledBlockTypes?: Array<ArticleBlock['type']>;
};

const DEFAULT_ENABLED_BLOCK_TYPES: Array<ArticleBlock['type']> = ['paragraph', 'heading', 'quote', 'list', 'image', 'code', 'table', 'simple-tweet', 'image-gallery', 'embed'];

export function convertCleanTreeToBlocks(
  root: Element,
  context: CleanTreeContext,
  options: CleanTreeBlockConversionOptions = {}
): ArticleBlock[] {
  const enabledBlockTypes = new Set(options.enabledBlockTypes ?? DEFAULT_ENABLED_BLOCK_TYPES);
  const semanticSelectors = resolveSemanticSelectors(context.adapter.semanticMap);
  const blocks: ArticleBlock[] = [];
  const consumedElements = new Set<Element>();
  let index = 0;

  for (const element of Array.from(root.querySelectorAll(buildBlockCandidateSelector(semanticSelectors, context)))) {
    if (consumedElements.has(element) || hasConsumedAncestor(element, consumedElements)) {
      continue;
    }

    const block = convertElementToBlock(element, context, index, enabledBlockTypes, consumedElements, semanticSelectors);
    if (block === null) {
      continue;
    }

    blocks.push(block);
    index += 1;
  }

  return blocks;
}

function convertElementToBlock(
  element: Element,
  context: CleanTreeContext,
  index: number,
  enabledBlockTypes: Set<ArticleBlock['type']>,
  consumedElements: Set<Element>,
  semanticSelectors: ResolvedSemanticSelectors
): ArticleBlock | null {
  const specialComponentBlock = convertSpecialComponentElement(element, context, index, enabledBlockTypes, consumedElements);
  if (specialComponentBlock) {
    return specialComponentBlock;
  }

  if (isImageGalleryElement(element, semanticSelectors) && enabledBlockTypes.has('image-gallery')) {
    return convertImageGalleryElement(element, context, index, consumedElements);
  }

  if (isImageElement(element, semanticSelectors) && enabledBlockTypes.has('image')) {
    return convertImageBlockElement(element, {
      blockId: cleanTreeBlockId(context, index),
      specialImageRootSelector: semanticSelectors.imageGallerySelector,
      convertSpecialImageElement: (specialImageElement) => convertPlatformSpecialImageElement(context.adapter, specialImageElement, cleanTreeBlockId(context, index)),
      extractPlatformImageMetadata: (imageElement) => extractPlatformImageMetadata(context.adapter, imageElement)
    });
  }

  if (isEmbedElement(element) && enabledBlockTypes.has('embed')) {
    const embed = resolveEmbedElement(element, cleanTreeBlockId(context, index));
    if (embed) {
      for (const consumedElement of Array.from(element.querySelectorAll('iframe, embed'))) {
        consumedElements.add(consumedElement);
      }
    }
    return embed;
  }

  if (isHeadingElement(element, semanticSelectors) && enabledBlockTypes.has('heading')) {
    return convertTextBlockElement(element, 'heading', createTextBlockConverterDeps(element, context, index));
  }

  if (isCodeElement(element, semanticSelectors) && enabledBlockTypes.has('code')) {
    return convertCodeBlockElement(element, {
      blockId: cleanTreeBlockId(context, index),
      consumedElements,
      semanticSelectors,
      rootBlockAncestors,
      normalizeCodeLanguage,
      extractCodeBlockStyle: (codeRoot, pre, code) => extractCodeBlockStyle(codeRoot, pre, code, context.adapter.codeThemePairs ?? []),
      extractCodeTokens: (code) => extractCodeTokens(code, context.adapter.codeThemePairs ?? [])
    });
  }

  if (isTableElement(element, semanticSelectors) && enabledBlockTypes.has('table')) {
    return convertTableBlockElement(element, {
      blockId: cleanTreeBlockId(context, index),
      consumedElements,
      semanticSelectors,
      findTableRoot,
      getTableRowElements,
      getTableCellElements,
      isTableHeaderCell,
      getTableSpanAttributes,
      extractTableTextStyle,
      getElementDisplayText,
      rootBlockAncestors
    });
  }

  if (isListElement(element, semanticSelectors) && enabledBlockTypes.has('list')) {
    return convertListBlockElementGroup(element, {
      blockId: cleanTreeBlockId(context, index),
      consumedElements,
      semanticSelectors,
      getElementDisplayText,
      extractTextAnnotations,
      extractElementTextStyle,
      nextElementInDocument
    });
  }

  if (isQuoteElement(element, semanticSelectors) && enabledBlockTypes.has('quote')) {
    return convertTextBlockElement(element, 'quote', createTextBlockConverterDeps(element, context, index));
  }

  if (shouldSkipParagraphFallback(element, semanticSelectors)) {
    return null;
  }

  if (enabledBlockTypes.has('paragraph')) {
    return convertTextBlockElement(element, 'paragraph', createTextBlockConverterDeps(element, context, index));
  }

  return null;
}

function createTextBlockConverterDeps(element: Element, context: CleanTreeContext, index: number) {
  return {
    blockId: cleanTreeBlockId(context, index),
    getPreferredTextContent,
    extractTextAnnotations,
    extractElementTextStyle,
    getHeadingLevel,
    isMediaCaptionElement
  };
}

function convertSpecialComponentElement(
  element: Element,
  context: CleanTreeContext,
  index: number,
  enabledBlockTypes: Set<ArticleBlock['type']>,
  consumedElements: Set<Element>
): ArticleBlock | null {
  const matched = findSpecialComponentRoot(element, context);
  if (!matched) {
    return null;
  }

  const { component, root } = matched;
  const handler = getSpecialComponentHandler(component.handlerId);
  if (!handler) {
    return null;
  }

  const block = handler.extract(root, {
    component,
    sourceUrl: context.sourceUrl,
    debugId: context.debugId,
    index
  });
  if (!block || !enabledBlockTypes.has(block.type)) {
    return null;
  }

  consumedElements.add(element);
  consumedElements.add(root);
  for (const ancestor of Array.from(rootBlockAncestors(root))) {
    consumedElements.add(ancestor);
  }
  return block;
}

function findSpecialComponentRoot(
  element: Element,
  context: CleanTreeContext
): { component: NonNullable<CleanTreeContext['adapter']['specialComponents']>[number]; root: Element } | null {
  for (const component of context.adapter.specialComponents ?? []) {
    if (element.matches(component.rootSelector)) {
      return { component, root: element };
    }

    const root = element.querySelector(component.rootSelector);
    if (root) {
      return { component, root };
    }
  }

  return null;
}

function convertImageGalleryElement(
  element: Element,
  context: CleanTreeContext,
  index: number,
  consumedElements: Set<Element>
): ImageGalleryBlock | null {
  const gallery = convertPlatformImageGalleryElement(context.adapter, element, cleanTreeBlockId(context, index));
  if (gallery !== null) {
    for (const consumedElement of getPlatformImageGalleryConsumedElements(context.adapter, element)) {
      consumedElements.add(consumedElement);
    }

    return gallery;
  }

  const genericGallery = resolveImageGalleryElement(element, cleanTreeBlockId(context, index), {
    extractPlatformImageMetadata: (imageElement) => extractPlatformImageMetadata(context.adapter, imageElement)
  });
  if (genericGallery === null) {
    return null;
  }

  for (const consumedElement of Array.from(element.querySelectorAll('img'))) {
    consumedElements.add(consumedElement);
  }

  return genericGallery;
}

function extractTextAnnotations(element: Element, fullText = normalizeText(element.textContent ?? '')): TextAnnotation[] {
  const annotations: TextAnnotation[] = [];
  const normalizeSegment = fullText.includes('\n') ? normalizePreWrapText : normalizeText;
  let searchCursor = 0;

  for (const textElement of Array.from(element.querySelectorAll('[data-text="true"], a[href], [role="link"], strong, b, em, i, u, [style*="font-weight"], [style*="font-style"], [style*="text-decoration"], [data-linelens-emoji-image-url]'))) {
    const text = normalizeSegment(textElement.textContent ?? '');
    if (text === '') {
      continue;
    }

    const startOffset = fullText.indexOf(text, searchCursor);
    if (startOffset === -1) {
      continue;
    }
    searchCursor = startOffset + text.length;

    const annotation: TextAnnotation = {
      startOffset,
      endOffset: startOffset + text.length,
      ...extractTextAnnotationStyle(textElement)
    };
    const emojiImageUrl = textElement.closest('[data-linelens-emoji-image-url]')?.getAttribute('data-linelens-emoji-image-url');
    const linkElement = textElement.closest('a[href], [role="link"]');

    if (isBoldElement(textElement)) {
      annotation.bold = true;
    }
    if (isItalicElement(textElement)) {
      annotation.fontStyle = 'italic';
    }
    if (linkElement !== null) {
      const href = linkElement.getAttribute('href');
      if (href) {
        annotation.href = href;
      }
      annotation.target = linkElement.getAttribute('target') ?? undefined;
      Object.assign(annotation, extractTextAnnotationStyle(linkElement));
    }
    if (emojiImageUrl) {
      annotation.emojiImageUrl = emojiImageUrl;
    }

    if (hasTextAnnotationSignal(annotation)) {
      annotations.push(annotation);
    }
  }

  return annotations;
}

function hasTextAnnotationSignal(annotation: TextAnnotation): boolean {
  return Boolean(
    annotation.bold ||
      annotation.href ||
      annotation.emojiImageUrl ||
      annotation.color ||
      annotation.fontSize ||
      annotation.lineHeight ||
      annotation.textAlign ||
      annotation.fontStyle ||
      annotation.textDecoration
  );
}

function isBoldElement(element: Element): boolean {
  return Boolean(element.closest('strong, b, [style*="font-weight: bold"], [style*="font-weight: 700"]'));
}

function isItalicElement(element: Element): boolean {
  return Boolean(element.closest('em, i, [style*="font-style: italic"]'));
}

function buildBlockCandidateSelector(selectors: ResolvedSemanticSelectors, context: CleanTreeContext): string {
  return uniqueSelectors([
    selectors.blockSelector,
    selectors.paragraphSelector,
    selectors.headingSelector,
    selectors.quoteSelector,
    selectors.orderedListSelector,
    selectors.unorderedListSelector,
    selectors.imageGallerySelector,
    selectors.imageSelector,
    'iframe[src], iframe[data-src], embed[src], embed[data-src], [data-kind="embed"], figcaption',
    selectors.codeSelector,
    selectors.tableSelector,
    ...(context.adapter.specialComponents ?? []).map((component) => component.rootSelector)
  ]);
}

function uniqueSelectors(selectors: string[]): string {
  return Array.from(new Set(selectors.map((selector) => selector.trim()).filter(Boolean))).join(', ');
}

function isHeadingElement(element: Element, selectors: ResolvedSemanticSelectors): boolean {
  return element.matches(selectors.headingSelector);
}

function isQuoteElement(element: Element, selectors: ResolvedSemanticSelectors): boolean {
  return element.matches(selectors.quoteSelector);
}

function isImageElement(element: Element, selectors: ResolvedSemanticSelectors): boolean {
  return element.matches(selectors.imageSelector);
}

function isImageGalleryElement(element: Element, selectors: ResolvedSemanticSelectors): boolean {
  const galleryImageCount = element.querySelectorAll(selectors.imageGallerySelector).length;
  if (galleryImageCount > 1) {
    return true;
  }

  return element.matches(selectors.imageGallerySelector) && element.querySelectorAll(selectors.imageSelector).length > 1;
}

function isCodeElement(element: Element, selectors: ResolvedSemanticSelectors): boolean {
  return element.matches(selectors.codeSelector) || element.querySelector(selectors.codeSelector) !== null;
}

function isEmbedElement(element: Element): boolean {
  return element.matches('iframe[src], iframe[data-src], embed[src], embed[data-src]') || element.querySelector('iframe[src], iframe[data-src], embed[src], embed[data-src]') !== null;
}

function isTableElement(element: Element, selectors: ResolvedSemanticSelectors): boolean {
  return findTableRoot(element, selectors) !== null;
}

function isMediaCaptionElement(element: Element): boolean {
  return Boolean(
    element.tagName.toUpperCase() === 'FIGCAPTION' ||
      element.getAttribute('data-linelens-block-role') === 'caption' ||
      element.closest('[data-linelens-block-role="caption"]') ||
      element.querySelector('[data-linelens-block-role="caption"]')
  );
}

function shouldSkipParagraphFallback(element: Element, selectors: ResolvedSemanticSelectors): boolean {
  return (
    element.querySelector(uniqueSelectors([selectors.orderedListSelector, selectors.unorderedListSelector, selectors.codeSelector])) !== null ||
    element.closest(selectors.codeSelector) !== null ||
    isMediaUiOnlyBlock(element)
  );
}

function getPreferredTextContent(element: Element, type: 'heading' | 'paragraph' | 'quote'): string {
  if (type === 'heading') {
    return normalizeText(element.textContent ?? '');
  }

  if (type === 'quote') {
    return normalizePreWrapText(getElementDisplayText(element, true));
  }

  const mediaText = getMediaBlockPrimaryText(element);
  if (mediaText !== null) {
    return mediaText;
  }

  return normalizePreWrapText(getElementDisplayText(element, true));
}

function getElementDisplayText(element: Element, preserveLineBreaks = false): string {
  if (preserveLineBreaks && element instanceof HTMLElement && typeof element.innerText === 'string') {
    return element.innerText;
  }
  return element.textContent ?? '';
}

function extractCodeBlockStyle(codeRoot: Element | null, pre: Element | null, code: Element | null, platformThemePairs: CodeThemePair[]): CodeBlockStyle {
  const header = codeRoot?.querySelector(':scope > div:first-child') ?? null;
  const copyIcon = codeRoot?.querySelector('button svg, button [style*="color"]') ?? null;
  const headerBackgroundColor = getStyleValue(header, 'backgroundColor');
  const headerColor = getCodeHeaderColor(codeRoot, header);
  const copyColor = getStyleValue(copyIcon, 'color');
  const preBackgroundColor = getStyleValue(pre, 'backgroundColor');
  const preColor = getStyleValue(pre, 'color');
  const codeBackgroundColor = getStyleValue(code, 'backgroundColor');
  const codeColor = getStyleValue(code, 'color');
  return compactStyle({
    headerBackgroundColor,
    headerColor,
    copyColor,
    preBackgroundColor,
    preColor,
    codeBackgroundColor,
    codeColor,
    themeColors: createCodeBlockThemeColors(
      {
        headerBackgroundColor,
        headerColor,
        copyColor,
        preBackgroundColor,
        preColor,
        codeBackgroundColor,
        codeColor
      },
      platformThemePairs
    ),
    fontFamily: getStyleValue(code, 'fontFamily') || getStyleValue(pre, 'fontFamily'),
    fontSize: getStyleValue(code, 'fontSize') || getStyleValue(pre, 'fontSize'),
    lineHeight: getStyleValue(code, 'lineHeight') || getStyleValue(pre, 'lineHeight'),
    tabSize: getStyleValue(code, 'tabSize') || getStyleValue(pre, 'tabSize')
  });
}

function getCodeHeaderColor(codeRoot: Element | null, header: Element | null): string | undefined {
  const languageLabel = codeRoot?.querySelector(':scope > div:first-child > div:first-child, :scope > div:first-child [dir="ltr"]') ?? null;
  return getStyleValue(languageLabel, 'color') || getStyleValue(header, 'color');
}

function extractCodeTokens(code: Element | null, platformThemePairs: CodeThemePair[]): CodeToken[] | undefined {
  if (!code) {
    return undefined;
  }

  const tokens: CodeToken[] = [];
  collectCodeTokens(code, tokens, extractCodeTokenStyle(code, platformThemePairs), platformThemePairs);
  return tokens.length > 0 ? tokens : undefined;
}

function collectCodeTokens(node: Node, tokens: CodeToken[], inheritedStyle: Omit<CodeToken, 'text'> = {}, platformThemePairs: CodeThemePair[] = []): void {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent ?? '';
    if (text) {
      tokens.push({ text, ...inheritedStyle });
    }
    return;
  }

  if (!(node instanceof Element)) {
    return;
  }

  const style = { ...inheritedStyle, ...extractCodeTokenStyle(node, platformThemePairs) };
  for (const child of Array.from(node.childNodes)) {
    collectCodeTokens(child, tokens, style, platformThemePairs);
  }
}

function extractCodeTokenStyle(element: Element | null, platformThemePairs: CodeThemePair[]): Omit<CodeToken, 'text'> {
  const color = getStyleValue(element, 'color');
  return compactStyle({
    color,
    themeColors: createCodeTokenThemeColors(color, element?.textContent ?? '', platformThemePairs),
    fontStyle: getStyleValue(element, 'fontStyle'),
    fontWeight: getStyleValue(element, 'fontWeight')
  });
}

function createCodeBlockThemeColors(
  colors: Pick<CodeBlockStyle, 'headerBackgroundColor' | 'headerColor' | 'copyColor' | 'preBackgroundColor' | 'preColor' | 'codeBackgroundColor' | 'codeColor'>,
  platformThemePairs: CodeThemePair[]
): CodeBlockStyle['themeColors'] {
  return compactStyle({
    headerBackgroundColor: createCodeThemeColorPair(colors.headerBackgroundColor, [], platformThemePairs),
    headerColor: createCodeThemeColorPair(colors.headerColor, [{ light: 'rgb(15, 20, 25)', dark: 'rgb(231, 233, 234)' }], platformThemePairs),
    copyColor: createCodeThemeColorPair(colors.copyColor, [{ light: 'rgb(15, 20, 25)', dark: 'rgb(239, 243, 244)' }], platformThemePairs),
    preBackgroundColor: createCodeThemeColorPair(colors.preBackgroundColor, [], platformThemePairs),
    preColor: createCodeThemeColorPair(colors.preColor, [], platformThemePairs),
    codeBackgroundColor: createCodeThemeColorPair(colors.codeBackgroundColor, [], platformThemePairs),
    codeColor: createCodeThemeColorPair(colors.codeColor, [], platformThemePairs)
  });
}

function createCodeTokenThemeColors(color: string | undefined, text = '', platformThemePairs: CodeThemePair[]): CodeToken['themeColors'] {
  return compactStyle({
    color: createCodeThemeColorPair(color, getCodeTokenPreferredThemePairs(text), platformThemePairs)
  });
}

function createCodeThemeColorPair(color: string | undefined, preferredPairs: CodeThemePair[] = [], platformThemePairs: CodeThemePair[] = []): { light?: string; dark?: string } | undefined {
  if (!color) {
    return undefined;
  }
  const normalized = normalizeCodeColor(color);
  const pair = [...preferredPairs, ...platformThemePairs].find((candidate) => normalizeCodeColor(candidate.light) === normalized || normalizeCodeColor(candidate.dark) === normalized);
  return pair ?? { light: color, dark: color };
}

function getCodeTokenPreferredThemePairs(text: string): CodeThemePair[] {
  if (/^[=+\-*/%<>!&|^~?:.,()[\]{}]+$/.test(text.trim())) {
    return [{ light: 'rgb(64, 120, 242)', dark: 'rgb(212, 212, 212)' }];
  }
  return [];
}

function normalizeCodeColor(color: string): string {
  return color.replace(/\s+/g, '').toLowerCase();
}

function findTableRoot(element: Element, semanticSelectors: ResolvedSemanticSelectors): Element | null {
  if (element.matches(semanticSelectors.tableSelector)) {
    return element;
  }
  return element.querySelector(semanticSelectors.tableSelector);
}

function getTableRowElements(tableRoot: Element): Element[] {
  const rows = Array.from(tableRoot.querySelectorAll(':scope tr, :scope [role="row"]'));
  if (rows.length > 0) {
    return rows;
  }

  const directRows = Array.from(tableRoot.children).filter((child) => getTableCellElements(child).length > 0);
  return directRows.length > 0 ? directRows : [tableRoot];
}

function getTableCellElements(row: Element): Element[] {
  const cells = Array.from(
    row.querySelectorAll(':scope > th, :scope > td, :scope > [role="columnheader"], :scope > [role="rowheader"], :scope > [role="cell"], :scope > [role="gridcell"]')
  );
  if (cells.length > 0) {
    return cells;
  }
  return Array.from(row.children).filter((child) => normalizeText(child.textContent ?? '') !== '');
}

function isTableHeaderCell(cell: Element): boolean {
  const role = cell.getAttribute('role');
  return cell.tagName.toUpperCase() === 'TH' || role === 'columnheader' || role === 'rowheader';
}

function getTableSpanAttributes(cell: Element): Pick<TableBlock['rows'][number]['cells'][number], 'colSpan' | 'rowSpan'> {
  const colSpan = Number(cell.getAttribute('colspan') ?? cell.getAttribute('aria-colspan') ?? '');
  const rowSpan = Number(cell.getAttribute('rowspan') ?? cell.getAttribute('aria-rowspan') ?? '');
  return {
    ...(Number.isFinite(colSpan) && colSpan > 1 ? { colSpan } : {}),
    ...(Number.isFinite(rowSpan) && rowSpan > 1 ? { rowSpan } : {})
  };
}

function extractTableTextStyle(element: Element | null): TextStyle {
  const textElement = findTableCellTextStyleElement(element);
  return compactStyle({
    fontSize: getStyleValue(textElement, 'fontSize') || getStyleValue(element, 'fontSize'),
    textAlign: getStyleValue(element, 'textAlign') || getStyleValue(textElement, 'textAlign')
  });
}

function findTableCellTextStyleElement(element: Element | null): Element | null {
  if (!element) {
    return null;
  }
  return (
    Array.from(element.querySelectorAll('[data-text="true"], [dir="ltr"], [dir="auto"], span, div')).find((candidate) => normalizeText(candidate.textContent ?? '') !== '') ??
    element
  );
}

function extractElementTextStyle(element: Element | null): TextStyle {
  return compactStyle({
    color: getStyleValue(element, 'color'),
    fontSize: getStyleValue(element, 'fontSize'),
    lineHeight: getStyleValue(element, 'lineHeight'),
    textAlign: getStyleValue(element, 'textAlign'),
    fontStyle: getStyleValue(element, 'fontStyle'),
    fontWeight: getStyleValue(element, 'fontWeight')
  });
}

function extractTextAnnotationStyle(element: Element | null): Pick<TextAnnotation, 'color' | 'fontSize' | 'lineHeight' | 'textAlign' | 'fontStyle' | 'textDecoration'> {
  return compactStyle({
    color: getStyleValue(element, 'color'),
    fontSize: getStyleValue(element, 'fontSize'),
    lineHeight: getStyleValue(element, 'lineHeight'),
    textAlign: getStyleValue(element, 'textAlign'),
    fontStyle: getStyleValue(element, 'fontStyle'),
    textDecoration: getStyleValue(element, 'textDecoration')
  });
}

function getStyleValue(element: Element | null | undefined, property: keyof CSSStyleDeclaration): string | undefined {
  if (!element || !(element instanceof HTMLElement)) {
    return undefined;
  }

  const inlineValue = element.style[property];
  const computedValue =
    typeof window !== 'undefined' && typeof window.getComputedStyle === 'function'
      ? window.getComputedStyle(element)[property]
      : '';
  const value = String(inlineValue || computedValue || '').trim();
  if (!value || value === 'normal' || value === 'auto' || value === 'none' || value === 'rgba(0, 0, 0, 0)') {
    return undefined;
  }
  return value;
}

function compactStyle<T extends Record<string, unknown>>(style: T): T {
  return Object.fromEntries(Object.entries(style).filter(([, value]) => value !== undefined && value !== '' && !isEmptyObject(value))) as T;
}

function isEmptyObject(value: unknown): boolean {
  return typeof value === 'object' && value !== null && !Array.isArray(value) && Object.keys(value).length === 0;
}

function getMediaBlockPrimaryText(element: Element): string | null {
  if (!isMediaContainerBlock(element)) {
    return null;
  }

  const textSpans = Array.from(element.querySelectorAll('[data-text="true"]'));
  const spanText = textSpans
    .map((textElement) => normalizeText(textElement.textContent ?? ''))
    .filter(Boolean)
    .join(' ')
    .trim();

  if (spanText) {
    return spanText;
  }

  return textSpans.length > 0 ? '' : null;
}

function isMediaUiOnlyBlock(element: Element): boolean {
  const mediaText = getMediaBlockPrimaryText(element);
  if (!isMediaContainerBlock(element) || mediaText !== null) {
    return false;
  }

  const rawText = normalizeText(element.textContent ?? '');
  return rawText === 'GIF' || /^\d+:\d{2}$/.test(rawText);
}

function isMediaContainerBlock(element: Element): boolean {
  return (
    element.hasAttribute('data-block') &&
    (element.querySelector('[data-linelens-media-aspect-ratio]') !== null ||
      element.querySelector('[data-linelens-media-layout-direction]') !== null ||
      element.querySelector('[data-linelens-video-hls-candidate]') !== null)
  );
}

function nextElementInDocument(element: Element): Element | null {
  if (element.nextElementSibling) {
    return element.nextElementSibling;
  }

  let current: Element | null = element;
  while (current !== null) {
    const parent: Element | null = current.parentElement;
    if (parent?.nextElementSibling) {
      return parent.nextElementSibling;
    }
    current = parent;
  }

  return null;
}

function* rootBlockAncestors(element: Element): Generator<Element> {
  let current = element.parentElement;
  while (current !== null) {
    if (current.hasAttribute('data-block')) {
      yield current;
    }
    current = current.parentElement;
  }
}

function hasConsumedAncestor(element: Element, consumedElements: Set<Element>): boolean {
  let current = element.parentElement;
  while (current !== null) {
    if (consumedElements.has(current)) {
      return true;
    }
    current = current.parentElement;
  }

  return false;
}


function getHeadingLevel(element: Element): 1 | 2 | 3 | 4 | 5 | 6 {
  const tagName = element.tagName.toUpperCase();
  if (/^H[1-6]$/.test(tagName)) {
    return Number(tagName.slice(1)) as 1 | 2 | 3 | 4 | 5 | 6;
  }

  const level = Number(element.getAttribute('data-linelens-heading-level') ?? 2);
  return [1, 2, 3, 4, 5, 6].includes(level) ? (level as 1 | 2 | 3 | 4 | 5 | 6) : 2;
}

function cleanTreeBlockId(context: CleanTreeContext, index: number): string {
  return `${context.debugId}:clean-block-${index}`;
}

function normalizeText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function normalizeCodeText(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/\u00a0/g, ' ').trim();
}

function normalizeCodeLanguage(language: string): string {
  return normalizeText(language).replace(/^language-/, '').toLowerCase();
}

function normalizePreWrapText(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/\u00a0/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
