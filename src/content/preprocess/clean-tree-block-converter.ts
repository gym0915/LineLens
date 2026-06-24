import type {
  ArticleBlock,
  ImageBlock,
  ImageGalleryBlock,
  TextAnnotation,
  TextStyle,
  TableBlock,
  CodeBlockStyle,
  CodeToken
} from '../../shared/article.js';
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
  convertSimpleTweetElement as convertXSimpleTweetElement,
  isSimpleTweetElement
} from '../extractors/x/simple-tweet-clean-tree-converter.js';
import { extractPlatformImageMetadata } from './platform-media-metadata.js';

export type CleanTreeBlockConversionOptions = {
  enabledBlockTypes?: Array<ArticleBlock['type']>;
};

const DEFAULT_ENABLED_BLOCK_TYPES: Array<ArticleBlock['type']> = ['paragraph', 'heading', 'quote', 'list', 'image', 'code', 'table', 'simple-tweet', 'image-gallery', 'embed'];
const X_CANONICAL_ORIGIN = 'https://x.com';
const X_CODE_COLOR_THEME_PAIRS: Array<{ light: string; dark: string }> = [
  { light: 'rgb(247, 249, 249)', dark: 'rgb(22, 24, 28)' },
  { light: 'rgb(250, 250, 250)', dark: 'rgb(22, 24, 28)' },
  { light: 'rgb(229, 234, 236)', dark: 'rgb(22, 24, 28)' },
  { light: 'rgb(15, 20, 25)', dark: 'rgb(231, 233, 234)' },
  { light: 'rgb(15, 20, 25)', dark: 'rgb(239, 243, 244)' },
  { light: 'rgb(56, 58, 66)', dark: 'rgb(212, 212, 212)' },
  { light: 'rgb(166, 38, 164)', dark: 'rgb(86, 156, 214)' },
  { light: 'rgb(64, 120, 242)', dark: 'rgb(220, 220, 170)' },
  { light: 'rgb(64, 120, 242)', dark: 'rgb(212, 212, 212)' },
  { light: 'rgb(80, 161, 79)', dark: 'rgb(206, 145, 120)' },
  { light: 'rgb(160, 161, 167)', dark: 'rgb(106, 153, 85)' },
  { light: 'rgb(56, 58, 66)', dark: 'rgb(156, 220, 254)' }
];

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

  if (isSimpleTweetElement(element) && enabledBlockTypes.has('simple-tweet')) {
    return convertXSimpleTweetElement({
      element,
      blockId: cleanTreeBlockId(context, index),
      consumedElements
    });
  }

  if (isImageGalleryElement(element, semanticSelectors) && enabledBlockTypes.has('image-gallery')) {
    return convertImageGalleryElement(element, context, index, consumedElements);
  }

  if (isImageElement(element, semanticSelectors) && enabledBlockTypes.has('image')) {
    return convertImageBlockElement(element, {
      blockId: cleanTreeBlockId(context, index),
      tweetPhotoElementToImageBlock: (tweetPhoto) => tweetPhotoElementToImageBlock(tweetPhoto, context, index),
      extractPlatformImageMetadata: (imageElement) => extractPlatformImageMetadata(context.adapter, imageElement)
    });
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
      extractCodeBlockStyle,
      extractCodeTokens
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
  const component = context.adapter.specialComponents?.find((candidate) => element.matches(candidate.rootSelector));
  if (!component || !enabledBlockTypes.has(component.type as ArticleBlock['type'])) {
    return null;
  }

  const handler = getSpecialComponentHandler(component.handlerId);
  if (!handler) {
    return null;
  }

  const block = handler.extract(element, {
    component,
    sourceUrl: context.sourceUrl,
    debugId: context.debugId,
    index
  });
  if (!block) {
    return null;
  }

  consumedElements.add(element);
  return block;
}

function tweetPhotoElementToImageBlock(element: HTMLElement, context: CleanTreeContext, index: number): ImageBlock | null {
  const image = element.querySelector<HTMLImageElement>('img');
  const displaySrc = getTweetPhotoBackgroundUrl(element);
  const src = image?.currentSrc || image?.src || image?.getAttribute('src') || displaySrc;
  if (!src) {
    return null;
  }

  const ratioRoot = element.closest('[data-block="true"]') ?? element.closest('a') ?? element;
  const frameAspectRatio = getImageGalleryAspectRatio(ratioRoot);
  const aspectRatio = frameAspectRatio ?? (image ? getImageAspectRatio(image) : undefined);
  const href = element.closest('a[href]')?.getAttribute('href') ?? undefined;
  return {
    id: cleanTreeBlockId(context, index),
    type: 'image',
    src,
    ...(displaySrc ? { displaySrc } : {}),
    alt: image?.alt || image?.getAttribute('alt') || undefined,
    ...(href ? { href: toAbsoluteXUrl(href) } : {}),
    ...(aspectRatio ? { aspectRatio } : {}),
    backgroundSize: 'cover',
    backgroundPosition: 'center center',
    objectFit: 'cover',
    objectPosition: 'center center'
  };
}

function convertImageGalleryElement(
  element: Element,
  context: CleanTreeContext,
  index: number,
  consumedElements: Set<Element>
): ImageGalleryBlock | null {
  const photos = Array.from(element.querySelectorAll<HTMLElement>('[data-testid="tweetPhoto"]'))
    .map((photo) => tweetPhotoElementToGalleryItem(photo))
    .filter((item): item is ImageGalleryBlock['items'][number] => Boolean(item));

  if (photos.length <= 1) {
    return null;
  }

  for (const photo of Array.from(element.querySelectorAll('[data-testid="tweetPhoto"]'))) {
    consumedElements.add(photo);
  }

  return {
    id: cleanTreeBlockId(context, index),
    type: 'image-gallery',
    items: photos,
    ...(getImageGalleryAspectRatio(element) ? { aspectRatio: getImageGalleryAspectRatio(element) } : {})
  };
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

function isTableElement(element: Element, selectors: ResolvedSemanticSelectors): boolean {
  return findTableRoot(element, selectors) !== null;
}

function isMediaCaptionElement(element: Element): boolean {
  return Boolean(
    element.getAttribute('data-linelens-block-role') === 'caption' ||
      element.closest('.twitter-article-media-caption-id, [id^="caption-"]') ||
      element.querySelector('.twitter-article-media-caption-id, [id^="caption-"]')
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

function extractCodeBlockStyle(codeRoot: Element | null, pre: Element | null, code: Element | null): CodeBlockStyle {
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
    themeColors: createCodeBlockThemeColors({
      headerBackgroundColor,
      headerColor,
      copyColor,
      preBackgroundColor,
      preColor,
      codeBackgroundColor,
      codeColor
    }),
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

function extractCodeTokens(code: Element | null): CodeToken[] | undefined {
  if (!code) {
    return undefined;
  }

  const tokens: CodeToken[] = [];
  collectCodeTokens(code, tokens, extractCodeTokenStyle(code));
  return tokens.length > 0 ? tokens : undefined;
}

function collectCodeTokens(node: Node, tokens: CodeToken[], inheritedStyle: Omit<CodeToken, 'text'> = {}): void {
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

  const style = { ...inheritedStyle, ...extractCodeTokenStyle(node) };
  for (const child of Array.from(node.childNodes)) {
    collectCodeTokens(child, tokens, style);
  }
}

function extractCodeTokenStyle(element: Element | null): Omit<CodeToken, 'text'> {
  const color = getStyleValue(element, 'color');
  return compactStyle({
    color,
    themeColors: createCodeTokenThemeColors(color, element?.textContent ?? ''),
    fontStyle: getStyleValue(element, 'fontStyle'),
    fontWeight: getStyleValue(element, 'fontWeight')
  });
}

function createCodeBlockThemeColors(colors: Pick<CodeBlockStyle, 'headerBackgroundColor' | 'headerColor' | 'copyColor' | 'preBackgroundColor' | 'preColor' | 'codeBackgroundColor' | 'codeColor'>): CodeBlockStyle['themeColors'] {
  return compactStyle({
    headerBackgroundColor: createCodeThemeColorPair(colors.headerBackgroundColor),
    headerColor: createCodeThemeColorPair(colors.headerColor, [{ light: 'rgb(15, 20, 25)', dark: 'rgb(231, 233, 234)' }]),
    copyColor: createCodeThemeColorPair(colors.copyColor, [{ light: 'rgb(15, 20, 25)', dark: 'rgb(239, 243, 244)' }]),
    preBackgroundColor: createCodeThemeColorPair(colors.preBackgroundColor),
    preColor: createCodeThemeColorPair(colors.preColor),
    codeBackgroundColor: createCodeThemeColorPair(colors.codeBackgroundColor),
    codeColor: createCodeThemeColorPair(colors.codeColor)
  });
}

function createCodeTokenThemeColors(color: string | undefined, text = ''): CodeToken['themeColors'] {
  return compactStyle({
    color: createCodeThemeColorPair(color, getCodeTokenPreferredThemePairs(text))
  });
}

function createCodeThemeColorPair(color: string | undefined, preferredPairs: Array<{ light: string; dark: string }> = []): { light?: string; dark?: string } | undefined {
  if (!color) {
    return undefined;
  }
  const normalized = normalizeCodeColor(color);
  const pair = [...preferredPairs, ...X_CODE_COLOR_THEME_PAIRS].find((candidate) => normalizeCodeColor(candidate.light) === normalized || normalizeCodeColor(candidate.dark) === normalized);
  return pair ?? { light: color, dark: color };
}

function getCodeTokenPreferredThemePairs(text: string): Array<{ light: string; dark: string }> {
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
    (element.querySelector('[data-testid="videoPlayer"]') !== null || element.querySelector('[data-testid="tweetPhoto"]') !== null)
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

function tweetPhotoElementToPhoto(element: HTMLElement): { src: string; displaySrc?: string; alt?: string; href?: string } | null {
  const image = element.querySelector<HTMLImageElement>('img');
  const displaySrc = getTweetPhotoBackgroundUrl(element);
  const src = image?.currentSrc || image?.src || displaySrc;
  if (!src) {
    return null;
  }

  const href = element.closest('a[href]')?.getAttribute('href') ?? undefined;
  return {
    src,
    ...(displaySrc ? { displaySrc } : {}),
    alt: image?.alt || undefined,
    ...(href ? { href: toAbsoluteXUrl(href) } : {})
  };
}

function getTweetPhotoBackgroundUrl(element: Element): string {
  const backgroundLayer = element.querySelector<HTMLElement>('[style*="background-image"]');
  const style = backgroundLayer?.style.backgroundImage || backgroundLayer?.getAttribute('style') || '';
  const match = /url\((?:"|&quot;)?([^")]+)(?:"|&quot;)?\)/.exec(style);
  return match?.[1]?.replace(/&amp;/g, '&') ?? '';
}

function tweetPhotoElementToGalleryItem(element: HTMLElement): ImageGalleryBlock['items'][number] | null {
  const image = element.querySelector<HTMLImageElement>('img');
  const displaySrc = getTweetPhotoBackgroundUrl(element);
  const src = image?.currentSrc || image?.src || displaySrc;
  if (!src) {
    return null;
  }

  const href = element.closest('a[href]')?.getAttribute('href') ?? undefined;
  const aspectRatio = image ? getImageAspectRatio(image) : undefined;
  return {
    src,
    ...(displaySrc ? { displaySrc } : {}),
    alt: image?.alt || undefined,
    ...(href ? { href: toAbsoluteXUrl(href) } : {}),
    ...(aspectRatio ? { aspectRatio } : {})
  };
}

function getImageGalleryAspectRatio(element: Element): number | undefined {
  const descendantPreservedRatio = getDescendantPreservedMediaAspectRatio(element);
  if (descendantPreservedRatio) {
    return descendantPreservedRatio;
  }

  const descendantRatio = getDescendantPaddingBottomAspectRatio(element);
  if (descendantRatio) {
    return descendantRatio;
  }

  for (let current: Element | null = element; current; current = current.parentElement) {
    const preservedRatio = getPreservedMediaAspectRatio(current);
    if (preservedRatio) {
      return preservedRatio;
    }

    const paddingRatio = getPaddingBottomAspectRatio(current);
    if (paddingRatio) {
      return paddingRatio;
    }
  }

  return undefined;
}

function getDescendantPreservedMediaAspectRatio(element: Element): number | undefined {
  for (const child of Array.from(element.querySelectorAll<HTMLElement>('[data-linelens-media-aspect-ratio]'))) {
    const ratio = getPreservedMediaAspectRatio(child);
    if (ratio) {
      return ratio;
    }
  }

  return undefined;
}

function getPreservedMediaAspectRatio(element: Element): number | undefined {
  const ratio = Number(element.getAttribute('data-linelens-media-aspect-ratio'));
  return Number.isFinite(ratio) && ratio > 0 ? ratio : undefined;
}

function getDescendantPaddingBottomAspectRatio(element: Element): number | undefined {
  for (const child of Array.from(element.querySelectorAll<HTMLElement>('[style*="padding-bottom"]'))) {
    const paddingBottom = getInlinePaddingBottomPercent(child);
    if (paddingBottom) {
      return roundAspectRatio(100 / paddingBottom);
    }
  }

  return undefined;
}

function getImageAspectRatio(image: HTMLImageElement): number | undefined {
  return toValidAspectRatio(image.naturalWidth, image.naturalHeight);
}

function getPaddingBottomAspectRatio(element: Element): number | undefined {
  for (const child of Array.from(element.children)) {
    const paddingBottom = getInlinePaddingBottomPercent(child);
    if (paddingBottom) {
      return roundAspectRatio(100 / paddingBottom);
    }
  }

  return undefined;
}

function getInlinePaddingBottomPercent(element: Element): number | undefined {
  const inlinePaddingBottom = (element as HTMLElement).style?.paddingBottom;
  const match = inlinePaddingBottom
    ? /^([0-9.]+)%$/i.exec(inlinePaddingBottom.trim())
    : /(?:^|;)\s*padding-bottom:\s*([0-9.]+)%/i.exec(element.getAttribute('style') ?? '');
  if (!match) {
    return undefined;
  }

  const value = Number(match[1]);
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

function toValidAspectRatio(width: number, height: number): number | undefined {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return undefined;
  }

  return roundAspectRatio(width / height);
}

function roundAspectRatio(value: number): number {
  return Math.round(value * 10000) / 10000;
}

function toAbsoluteXUrl(href: string): string {
  return new URL(href, X_CANONICAL_ORIGIN).toString();
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
