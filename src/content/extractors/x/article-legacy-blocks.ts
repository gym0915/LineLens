import type {
  ArticleBlock,
  CodeBlockStyle,
  CodeToken,
  GifBlock,
  ImageBlock,
  ImageGalleryBlock,
  ImageGalleryLayoutNode,
  TableBlock,
  TextAnnotation,
  TextStyle,
  VideoBlock
} from '../../../shared/article.js';
import type { CapturedXVideo } from '../../../shared/messages.js';
import { normalizeCodeText, normalizePreWrapText, normalizeText } from '../../../shared/text.js';
import { X_CANONICAL_ORIGIN } from '../../../shared/url.js';
import { X_ARTICLE_SELECTORS } from './article-selectors.js';
import * as simpleTweetModel from './simple-tweet.js';
import { buildVideoHlsPayload, chooseCapturedVideoSource, matchCapturedVideo } from './video-media.js';

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

export async function extractXArticleLegacyBlocks(params: {
  longform: Element;
  articleId: string;
  capturedVideos: CapturedXVideo[];
}): Promise<ArticleBlock[]> {
  return extractBlocks(params.longform, params.articleId, params.capturedVideos);
}

async function extractBlocks(longform: Element, articleId: string, capturedVideos: CapturedXVideo[]): Promise<ArticleBlock[]> {
  const blocks: ArticleBlock[] = [];
  let pendingListItems: string[] = [];
  let pendingListItemAnnotations: TextAnnotation[][] = [];
  let pendingListItemTextStyles: TextStyle[] = [];
  let pendingListKind: 'ordered' | 'unordered' = 'unordered';

  function flushPendingList() {
    if (pendingListItems.length === 0) {
      return;
    }

    const listBlock: ArticleBlock = {
      id: blockId(articleId, blocks.length + 1),
      type: 'list',
      kind: pendingListKind,
      items: pendingListItems
    };
    if (pendingListItemAnnotations.some((annotations) => annotations.length > 0)) {
      listBlock.itemAnnotations = pendingListItemAnnotations;
    }
    if (pendingListItemTextStyles.some((style) => Object.keys(style).length > 0)) {
      listBlock.itemTextStyles = pendingListItemTextStyles;
    }

    blocks.push(listBlock);
    pendingListItems = [];
    pendingListItemAnnotations = [];
    pendingListItemTextStyles = [];
    pendingListKind = 'unordered';
  }

  for (const block of Array.from(longform.querySelectorAll(X_ARTICLE_SELECTORS.block))) {
    const listKind = getListKind(block);
    if (listKind) {
      const extracted = extractTextWithAnnotations(block, { preserveLineBreaks: true });
      if (extracted.text) {
        if (pendingListItems.length === 0) {
          pendingListKind = listKind;
        } else if (pendingListKind !== listKind) {
          flushPendingList();
          pendingListKind = listKind;
        }
        pendingListItems.push(extracted.text);
        pendingListItemAnnotations.push(extracted.annotations);
        pendingListItemTextStyles.push(extractElementTextStyle(block));
      }
      continue;
    }

    const handwrittenOrderedListItem = extractHandwrittenOrderedListItem(block);
    if (handwrittenOrderedListItem) {
      if (pendingListItems.length === 0) {
        pendingListKind = 'ordered';
      } else if (pendingListKind !== 'ordered') {
        flushPendingList();
        pendingListKind = 'ordered';
      }
      pendingListItems.push(handwrittenOrderedListItem.text);
      pendingListItemAnnotations.push(handwrittenOrderedListItem.annotations);
      pendingListItemTextStyles.push(extractElementTextStyle(block));
      continue;
    }

    flushPendingList();
    const articleBlock = await extractBlock(block, articleId, blocks.length + 1, capturedVideos);
    if (articleBlock) {
      blocks.push(articleBlock);
    }
  }

  flushPendingList();

  return blocks;
}

// Debug/reporting helper for comparing legacy extraction against clean-tree output
// on the same longform root without changing the production extractor contract.
export async function extractXArticleLegacyBlocksForDebug(params: {
  longform: Element;
  articleId: string;
  capturedVideos?: CapturedXVideo[];
}): Promise<ArticleBlock[]> {
  return extractBlocks(params.longform, params.articleId, params.capturedVideos ?? []);
}

function getListKind(block: Element): 'ordered' | 'unordered' | null {
  if (
    block.closest('ol') ||
    block.classList.contains('public-DraftStyleDefault-orderedListItem') ||
    block.classList.contains('longform-ordered-list-item')
  ) {
    return 'ordered';
  }

  if (
    block.closest('ul') ||
    block.classList.contains('public-DraftStyleDefault-unorderedListItem') ||
    block.classList.contains('longform-unordered-list-item')
  ) {
    return 'unordered';
  }

  return null;
}

function extractHandwrittenOrderedListItem(block: Element): { text: string; annotations: TextAnnotation[] } | null {
  if (block.matches(X_ARTICLE_SELECTORS.quoteBlock) || isHeadingBlock(block) || hasNonTextContent(block)) {
    return null;
  }

  const extracted = extractTextWithAnnotations(block, { preserveLineBreaks: true });
  const marker = getHandwrittenOrderedListMarker(extracted.text);
  if (!marker) {
    return null;
  }

  const text = extracted.text.trim();
  if (!text) {
    return null;
  }

  return {
    text,
    annotations: extracted.annotations
  };
}

function getHandwrittenOrderedListMarker(text: string): string | null {
  return text.match(/^\s*(?:(?:\d+|[ivxlcdm]+)\s*[.)、:：]|[一二三四五六七八九十百千]+\s*[、.．:：])\s*/i)?.[0] ?? null;
}

function hasNonTextContent(block: Element): boolean {
  return Boolean(
    block.matches(X_ARTICLE_SELECTORS.codeBlock) ||
      block.querySelector(X_ARTICLE_SELECTORS.codeBlock) ||
      block.querySelector(X_ARTICLE_SELECTORS.tweetBlock) ||
      block.querySelector(X_ARTICLE_SELECTORS.tweetPhoto) ||
      block.querySelector('[data-testid="simpleTweet"], [data-testid="article-cover-image"], img, video, iframe')
  );
}

async function extractBlock(block: Element, articleId: string, index: number, capturedVideos: CapturedXVideo[]): Promise<ArticleBlock | null> {
  if (block.matches(X_ARTICLE_SELECTORS.quoteBlock)) {
    const extracted = extractTextWithAnnotations(block, { preserveLineBreaks: true });
    return extracted.text
      ? {
          id: blockId(articleId, index),
          type: 'quote',
          text: extracted.text,
          textStyle: extractElementTextStyle(block),
          ...(extracted.annotations.length > 0 ? { annotations: extracted.annotations } : {})
        }
      : null;
  }

  const nonTextBlock = await extractNonTextBlock(block, articleId, index, capturedVideos);
  if (nonTextBlock) {
    return nonTextBlock;
  }

  const extracted = extractTextWithAnnotations(block, { preserveLineBreaks: true });
  if (!extracted.text) {
    return null;
  }

  if (isHeadingBlock(block)) {
    return {
      id: blockId(articleId, index),
      type: 'heading',
      text: extracted.text,
      level: getHeadingLevel(block),
      textStyle: extractElementTextStyle(block),
      ...(extracted.annotations.length > 0 ? { annotations: extracted.annotations } : {})
    };
  }

  const textBlock: ArticleBlock = {
    id: blockId(articleId, index),
    type: 'paragraph',
    text: extracted.text,
    ...(isMediaCaptionElement(block) ? { role: 'caption' as const } : {}),
    textStyle: extractParagraphTextStyle(block)
  };
  if (textBlock.type === 'paragraph' && extracted.annotations.length > 0) {
    textBlock.annotations = extracted.annotations;
  }

  return textBlock;
}

function extractParagraphTextStyle(block: Element): TextStyle {
  if (!isMediaCaptionElement(block)) {
    return extractElementTextStyle(block);
  }

  const captionRoot = getMediaCaptionStyleRoot(block);
  return compactStyle({
    ...extractElementTextStyle(captionRoot),
    ...extractElementTextStyle(block)
  });
}

async function extractNonTextBlock(block: Element, articleId: string, index: number, capturedVideos: CapturedXVideo[]): Promise<ArticleBlock | null> {
  const tweetRef = await extractTweetRefBlock(block, blockId(articleId, index), capturedVideos);
  if (tweetRef) {
    return tweetRef;
  }

  const simpleTweet = await extractSimpleTweetBlock(block, blockId(articleId, index), capturedVideos);
  if (simpleTweet) {
    return simpleTweet;
  }

  const video = extractVideoFromElement(block, blockId(articleId, index), capturedVideos);
  if (video) {
    return video;
  }

  const gif = extractGifFromElement(block, blockId(articleId, index));
  if (gif) {
    return gif;
  }

  const imageGallery = extractImageGalleryFromElement(block, blockId(articleId, index));
  if (imageGallery) {
    return imageGallery;
  }

  const image = extractImageFromElement(block, blockId(articleId, index));
  if (image) {
    return image;
  }

  const link = extractLinkBlock(block, blockId(articleId, index));
  if (link) {
    return link;
  }

  const table = extractTableBlock(block, blockId(articleId, index));
  if (table) {
    return table;
  }

  const code = extractCodeBlock(block, blockId(articleId, index));
  if (code) {
    return code;
  }

  return null;
}

function extractCodeBlock(block: Element, id: string): ArticleBlock | null {
  // X Article wraps fenced markdown code in data-testid="markdown-code-block".
  const codeRoot = block.matches(X_ARTICLE_SELECTORS.codeBlock)
    ? block
    : block.querySelector(X_ARTICLE_SELECTORS.codeBlock);
  if (!codeRoot) {
    return null;
  }

  const code = codeRoot.querySelector('pre code');
  const pre = codeRoot.querySelector('pre');
  const text = normalizeCodeText(code?.textContent ?? pre?.textContent ?? '');
  if (!text) {
    return null;
  }

  const languageClass = Array.from(code?.classList ?? [])
    .find((className) => className.startsWith('language-'))
    ?.replace(/^language-/, '');
  const headerLanguage = normalizeText(codeRoot.querySelector<HTMLElement>(':scope > div:first-child span')?.textContent ?? '');
  const language = normalizeCodeLanguage(languageClass || headerLanguage);

  return {
    id,
    type: 'code',
    text,
    ...(language ? { language } : {}),
    codeStyle: extractCodeBlockStyle(codeRoot, pre, code),
    tokens: extractCodeTokens(code)
  };
}

function extractTableBlock(block: Element, id: string): TableBlock | null {
  const tableRoot = findTableRoot(block);
  if (!tableRoot) {
    return null;
  }

  const rowElements = getTableRowElements(tableRoot);
  const rows = rowElements
    .map((row) => ({
      cells: getTableCellElements(row).map((cell) => ({
        text: normalizePreWrapText(getElementDisplayText(cell, true)),
        ...(isTableHeaderCell(cell) ? { header: true } : {}),
        ...getTableSpanAttributes(cell),
        textStyle: extractTableTextStyle(cell)
      }))
    }))
    .filter((row) => row.cells.some((cell) => cell.text));

  if (rows.length === 0) {
    return null;
  }

  return {
    id,
    type: 'table',
    rows,
    columnCount: Math.max(...rows.map((row) => row.cells.reduce((total, cell) => total + (cell.colSpan ?? 1), 0)))
  };
}

function normalizeCodeLanguage(language: string): string {
  return normalizeText(language).replace(/^language-/, '').toLowerCase();
}

function extractCodeBlockStyle(codeRoot: Element, pre: Element | null, code: Element | null): CodeBlockStyle {
  const header = codeRoot.querySelector(':scope > div:first-child');
  const copyIcon = codeRoot.querySelector('button svg, button [style*="color"]');
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

function findTableRoot(block: Element): Element | null {
  if (block.matches('table, [role="table"], [role="grid"]')) {
    return block;
  }
  return block.querySelector('table, [role="table"], [role="grid"], [data-testid="markdown-table"]');
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

function isMediaCaptionElement(element: Element): boolean {
  return Boolean(
    element.getAttribute('data-linelens-block-role') === 'caption' ||
      element.closest('.twitter-article-media-caption-id, [id^="caption-"]') ||
      element.querySelector('.twitter-article-media-caption-id, [id^="caption-"]')
  );
}

function getMediaCaptionStyleRoot(element: Element): Element {
  return element.closest('.twitter-article-media-caption-id') ?? element.closest('[id^="caption-"]') ?? element;
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

function extractTextAnnotationStyle(element: Element | null): Pick<TextAnnotation, 'color' | 'fontSize' | 'lineHeight' | 'textAlign' | 'fontStyle'> {
  return compactStyle({
    color: getStyleValue(element, 'color'),
    fontSize: getStyleValue(element, 'fontSize'),
    lineHeight: getStyleValue(element, 'lineHeight'),
    textAlign: getStyleValue(element, 'textAlign'),
    fontStyle: getStyleValue(element, 'fontStyle')
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

async function extractTweetRefBlock(block: Element, id: string, capturedVideos: CapturedXVideo[]): Promise<ArticleBlock | null> {
  const tweet = block.querySelector(X_ARTICLE_SELECTORS.tweetBlock);
  if (!tweet) {
    return null;
  }

  const articleCard =
    (await simpleTweetModel.extractSimpleTweetBlockFromRoot(block, id, capturedVideos)) ??
    (await simpleTweetModel.extractSimpleTweetBlockFromRoot(tweet, id, capturedVideos));
  if (articleCard) {
    return articleCard;
  }

  return extractTweetSummaryBlock(tweet, id, block);
}

async function extractTweetSummaryBlock(tweet: Element, id: string, fallbackBlock?: Element): Promise<ArticleBlock> {
  const profile = simpleTweetModel.extractTweetProfile(tweet);
  const metrics = simpleTweetModel.extractTweetMetrics(tweet);
  const authorLine = simpleTweetModel.buildTweetAuthorLine(profile);
  const richText = await simpleTweetModel.extractTweetBodyRichText(tweet);
  const body = richText.text;
  const fallbackText = normalizeText(tweet.querySelector('[data-testid="User-Name"]') ? '' : (tweet.textContent ?? fallbackBlock?.textContent ?? ''));
  const title = authorLine || (body ? 'X Tweet' : fallbackText || 'X Tweet');
  const excerpt = body || (authorLine ? '' : fallbackText);
  const href = simpleTweetModel.getSimpleTweetHref(tweet) ?? (fallbackBlock ? simpleTweetModel.getSimpleTweetHref(fallbackBlock) : undefined);

  return {
    id,
    type: 'simple-tweet',
    source: 'X Tweet',
    title,
    excerpt,
    href,
    items: body
      ? [
          {
            type: 'text',
            text: body,
            ...(richText.annotations.length > 0 ? { annotations: richText.annotations } : {})
          }
        ]
      : [],
    ...profile,
    ...(simpleTweetModel.hasTweetMetrics(metrics) ? { metrics } : {})
  };
}

function extractLinkBlock(block: Element, id: string): ArticleBlock | null {
  const anchor = block.querySelector<HTMLAnchorElement>('a[href][role="link"], a[href]');
  if (!anchor) {
    return null;
  }

  const href = anchor.getAttribute('href');
  const text = normalizeText(anchor.textContent ?? '');
  const blockText = normalizeText(block.textContent ?? '');
  if (!href || !text || text !== blockText) {
    return null;
  }

  const target = anchor.getAttribute('target') ?? undefined;
  return {
    id,
    type: 'link',
    text,
    href,
    ...(target ? { target } : {})
  };
}

async function extractSimpleTweetBlock(block: Element, id: string, capturedVideos: CapturedXVideo[] = []): Promise<ArticleBlock | null> {
  if (!simpleTweetModel.isSimpleTweetCard(block)) {
    return null;
  }

  return simpleTweetModel.extractSimpleTweetBlockFromRoot(block, id, capturedVideos);
}

function getTweetPhotoBackgroundUrl(element: Element): string {
  const backgroundLayer = getTweetPhotoBackgroundLayer(element);
  const style = backgroundLayer?.style.backgroundImage || backgroundLayer?.getAttribute('style') || '';
  const match = /url\((?:"|&quot;)?([^")]+)(?:"|&quot;)?\)/.exec(style);
  return match?.[1]?.replace(/&amp;/g, '&') ?? '';
}

function getTweetPhotoBackgroundLayer(element: Element): HTMLElement | null {
  return element.querySelector<HTMLElement>('[style*="background-image"]');
}

function normalizeGalleryBackgroundSize(value: string | undefined): ImageGalleryBlock['items'][number]['backgroundSize'] {
  const normalized = normalizeCssText(value);
  if (normalized === 'cover' || normalized === 'contain' || normalized === 'auto') {
    return normalized;
  }

  return undefined;
}

function normalizeImageObjectFit(value: string | undefined): ImageGalleryBlock['items'][number]['objectFit'] {
  const normalized = normalizeCssText(value);
  if (
    normalized === 'cover' ||
    normalized === 'contain' ||
    normalized === 'fill' ||
    normalized === 'none' ||
    normalized === 'scale-down'
  ) {
    return normalized;
  }

  return undefined;
}

function normalizeCssText(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized || undefined;
}

function getTextAfterCover(coverRoot: Element, offset: number): string {
  const textBlocks = Array.from(coverRoot.parentElement?.querySelectorAll<HTMLElement>('div[dir="auto"]') ?? []);
  const coverIndex = textBlocks.findIndex((element) => coverRoot.contains(element));
  const candidates = coverIndex >= 0 ? textBlocks.slice(coverIndex + 1) : textBlocks;
  return candidates[offset]?.textContent ?? '';
}

export function extractXArticleCoverImage(readView: Element, articleId: string): ImageBlock | undefined {
  const title = readView.querySelector(X_ARTICLE_SELECTORS.title);
  const image = title ? findImageBeforeTitle(readView, title) : null;
  return image ? (imageElementToBlock(image, `${articleId}-cover`) ?? undefined) : undefined;
}

function extractGifFromElement(element: Element, id: string): GifBlock | null {
  const tweetPhoto = element.matches(X_ARTICLE_SELECTORS.tweetPhoto)
    ? element
    : element.querySelector(X_ARTICLE_SELECTORS.tweetPhoto);
  const videoPlayer = tweetPhoto?.querySelector('[data-testid="videoPlayer"]');
  if (!tweetPhoto || !videoPlayer) {
    return null;
  }

  const video = videoPlayer.querySelector<HTMLVideoElement>('video');
  if (!video || video.querySelector('source[src^="blob:"]')) {
    return null;
  }

  const src = video.currentSrc || video.src || video.getAttribute('src') || '';
  if (!src) {
    return null;
  }

  const aspectRatio = getMediaAspectRatio(video, tweetPhoto);
  const backgroundColor = video.style.backgroundColor || getInlineStyleValue(video, 'background-color');
  const top = video.style.top || getInlineStyleValue(video, 'top');
  const left = video.style.left || getInlineStyleValue(video, 'left');
  const transform = video.style.transform || getInlineStyleValue(video, 'transform');

  return {
    id,
    type: 'gif',
    src,
    ...(video.poster ? { poster: video.poster } : {}),
    ...(aspectRatio ? { aspectRatio } : {}),
    ...(backgroundColor ? { backgroundColor } : {}),
    ...(top ? { top } : {}),
    ...(left ? { left } : {}),
    ...(transform ? { transform } : {}),
    paused: video.paused
  };
}

function extractVideoFromElement(element: Element, id: string, capturedVideos: CapturedXVideo[]): VideoBlock | null {
  const tweetPhoto = element.matches(X_ARTICLE_SELECTORS.tweetPhoto)
    ? element
    : element.querySelector(X_ARTICLE_SELECTORS.tweetPhoto);
  const videoPlayer = tweetPhoto?.querySelector('[data-testid="videoPlayer"]');
  if (!tweetPhoto || !videoPlayer) {
    return null;
  }

  const video = videoPlayer.querySelector<HTMLVideoElement>('video');
  const source = video?.querySelector<HTMLSourceElement>('source[src^="blob:"]');
  if (!video || !source) {
    return null;
  }

  const capturedVideo = matchCapturedVideo(video, capturedVideos);
  const hls = buildVideoHlsPayload(capturedVideo);
  const src = chooseCapturedVideoSource(capturedVideo, hls);
  if (!src) {
    return null;
  }

  const aspectRatio = getMediaAspectRatio(video, tweetPhoto);
  const backgroundColor = video.style.backgroundColor || getInlineStyleValue(video, 'background-color');
  const top = video.style.top || getInlineStyleValue(video, 'top');
  const left = video.style.left || getInlineStyleValue(video, 'left');
  const transform = video.style.transform || getInlineStyleValue(video, 'transform');
  const ariaLabel = video.getAttribute('aria-label') ?? undefined;

  return {
    id,
    type: 'video',
    src,
    ...(resolveVideoSourceType(src, source.type) ? { sourceType: resolveVideoSourceType(src, source.type) } : {}),
    transport: 'hls',
    ...(hls ? { hls } : {}),
    ...((capturedVideo?.poster || video.poster) ? { poster: capturedVideo?.poster || video.poster } : {}),
    ...(aspectRatio ? { aspectRatio } : {}),
    ...(backgroundColor ? { backgroundColor } : {}),
    ...(top ? { top } : {}),
    ...(left ? { left } : {}),
    ...(transform ? { transform } : {}),
    ...(video.preload ? { preload: video.preload } : {}),
    playsInline: video.playsInline,
    tabIndex: video.tabIndex,
    ...(ariaLabel ? { ariaLabel } : {}),
    paused: video.paused
  };
}

function extractImageFromElement(element: Element, id: string): ImageBlock | null {
  const tweetPhoto = element.querySelector<HTMLElement>(X_ARTICLE_SELECTORS.tweetPhoto);
  if (!tweetPhoto) {
    return null;
  }

  return tweetPhotoElementToImageBlock(tweetPhoto, id);
}

function extractImageGalleryFromElement(element: Element, id: string): ImageGalleryBlock | null {
  const photoElements = Array.from(element.querySelectorAll<HTMLElement>(X_ARTICLE_SELECTORS.tweetPhoto));
  const photos = photoElements
    .map((photo) => tweetPhotoElementToGalleryItem(photo))
    .filter((item): item is ImageGalleryBlock['items'][number] => Boolean(item));

  if (photos.length <= 1) {
    return null;
  }

  const aspectRatio = getImageGalleryAspectRatio(element);
  const layout = getImageGalleryLayout(element, photoElements, photos);
  return {
    id,
    type: 'image-gallery',
    items: photos,
    ...(aspectRatio ? { aspectRatio } : {}),
    ...(layout ? { layout } : {})
  };
}

function tweetPhotoElementToGalleryItem(element: HTMLElement): ImageGalleryBlock['items'][number] | null {
  const image = element.querySelector<HTMLImageElement>('img');
  const backgroundLayer = getTweetPhotoBackgroundLayer(element);
  const displaySrc = getTweetPhotoBackgroundUrl(element);
  const src = image?.currentSrc || image?.src || displaySrc;
  if (!src) {
    return null;
  }

  const href = element.closest('a[href]')?.getAttribute('href') ?? undefined;
  const aspectRatio = image ? getImageAspectRatio(image) : undefined;
  const backgroundSize = normalizeGalleryBackgroundSize(
    backgroundLayer?.style.backgroundSize || (backgroundLayer ? getInlineStyleValue(backgroundLayer, 'background-size') : '')
  );
  const backgroundPosition =
    normalizeCssText(backgroundLayer?.style.backgroundPosition || backgroundLayer?.style.backgroundPositionX || undefined) ?? 'center center';
  const objectFit = normalizeImageObjectFit(image?.style.objectFit) ?? 'cover';
  const objectPosition = normalizeCssText(image?.style.objectPosition) ?? backgroundPosition;
  return {
    src,
    ...(displaySrc ? { displaySrc } : {}),
    alt: image?.alt || undefined,
    ...(href ? { href: new URL(href, X_CANONICAL_ORIGIN).toString() } : {}),
    ...(aspectRatio ? { aspectRatio } : {}),
    ...(backgroundSize ? { backgroundSize } : {}),
    ...(backgroundPosition ? { backgroundPosition } : {}),
    objectFit,
    ...(objectPosition ? { objectPosition } : {})
  };
}

function getImageGalleryAspectRatio(element: Element): number | undefined {
  const descendantRatio = getDescendantPaddingBottomAspectRatio(element);
  if (descendantRatio) {
    return descendantRatio;
  }

  for (let current: Element | null = element; current; current = current.parentElement) {
    const paddingRatio = getPaddingBottomAspectRatio(current);
    if (paddingRatio) {
      return paddingRatio;
    }
  }

  return undefined;
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

function getImageGalleryLayout(
  element: Element,
  photoElements: HTMLElement[],
  items: ImageGalleryBlock['items']
): ImageGalleryLayoutNode | undefined {
  const itemIndexes = new Map<HTMLElement, number>();
  for (const [index, photo] of photoElements.entries()) {
    if (items[index]) {
      itemIndexes.set(photo, index);
    }
  }

  return buildImageGalleryLayoutNode(element, itemIndexes);
}

function buildImageGalleryLayoutNode(
  element: Element,
  itemIndexes: Map<HTMLElement, number>
): ImageGalleryLayoutNode | undefined {
  const ownItemIndex = getOwnGalleryItemIndex(element, itemIndexes);
  if (ownItemIndex !== undefined) {
    return {
      type: 'item',
      itemIndex: ownItemIndex,
      ...getGalleryFlexMetrics(element)
    };
  }

  const photoChildren = Array.from(element.children).filter((child) => containsGalleryPhoto(child, itemIndexes));
  if (photoChildren.length === 0) {
    return undefined;
  }

  if (photoChildren.length === 1) {
    return buildImageGalleryLayoutNode(photoChildren[0], itemIndexes);
  }

  const children = photoChildren
    .map((child) => buildImageGalleryLayoutNode(child, itemIndexes))
    .filter((child): child is ImageGalleryLayoutNode => Boolean(child));
  if (children.length === 0) {
    return undefined;
  }

  return {
    type: getGalleryFlexDirection(element),
    children,
    ...getGalleryFlexMetrics(element)
  };
}

function getOwnGalleryItemIndex(element: Element, itemIndexes: Map<HTMLElement, number>): number | undefined {
  const indexes = getContainedGalleryItemIndexes(element, itemIndexes);
  return indexes.length === 1 ? indexes[0] : undefined;
}

function getContainedGalleryItemIndexes(element: Element, itemIndexes: Map<HTMLElement, number>): number[] {
  const indexes: number[] = [];
  for (const [photo, index] of itemIndexes.entries()) {
    if (photo === element || element.contains(photo)) {
      indexes.push(index);
    }
  }

  return indexes;
}

function containsGalleryPhoto(element: Element, itemIndexes: Map<HTMLElement, number>): boolean {
  for (const photo of itemIndexes.keys()) {
    if (photo === element || element.contains(photo)) {
      return true;
    }
  }

  return false;
}

function getGalleryFlexDirection(element: Element): 'row' | 'column' {
  if (element.classList.contains('r-eqz5dr')) {
    return 'column';
  }
  if (element.classList.contains('r-18u37iz')) {
    return 'row';
  }

  return 'row';
}

function getGalleryFlexMetrics(element: Element): Pick<ImageGalleryLayoutNode, 'grow' | 'shrink' | 'basis'> {
  const grow = element.classList.contains('r-1iusvr4') || element.classList.contains('r-16y2uox') ? 1 : undefined;
  const shrink = element.classList.contains('r-16y2uox') ? 1 : undefined;
  const basis = element.classList.contains('r-bnwqim') ? '0%' : undefined;

  return {
    ...(grow !== undefined ? { grow } : {}),
    ...(shrink !== undefined ? { shrink } : {}),
    ...(basis ? { basis } : {})
  };
}

function getMediaAspectRatio(media: HTMLMediaElement, container: Element): number | undefined {
  const descendantRatio = getDescendantPaddingBottomAspectRatio(container);
  if (descendantRatio) {
    return descendantRatio;
  }

  for (let element: Element | null = container; element; element = element.parentElement) {
    const paddingRatio = getPaddingBottomAspectRatio(element);
    if (paddingRatio) {
      return paddingRatio;
    }
  }

  const video = media as HTMLVideoElement;
  const intrinsicRatio = toValidAspectRatio(video.videoWidth, video.videoHeight);
  if (intrinsicRatio) {
    return intrinsicRatio;
  }

  return undefined;
}

function resolveVideoSourceType(src: string, fallbackType: string): string {
  if (src.includes('.m3u8')) {
    return 'application/x-mpegURL';
  }

  return fallbackType;
}

function getInlineStyleValue(element: HTMLElement, property: string): string {
  const style = element.getAttribute('style') ?? '';
  const match = new RegExp(`${property}:\\s*([^;]+)`, 'i').exec(style);
  return match?.[1]?.replace(/\s+/g, ' ').trim() ?? '';
}

function findImageBeforeTitle(readView: Element, title: Element): HTMLImageElement | null {
  return (
    Array.from(readView.querySelectorAll<HTMLImageElement>(X_ARTICLE_SELECTORS.tweetPhotoImage)).find((image) =>
      isBefore(image, title)
    ) ?? null
  );
}

function isBefore(element: Element, target: Element): boolean {
  return Boolean(element.compareDocumentPosition(target) & Node.DOCUMENT_POSITION_FOLLOWING);
}

function tweetPhotoElementToImageBlock(element: HTMLElement, id: string): ImageBlock | null {
  const image = element.querySelector<HTMLImageElement>('img');
  const backgroundLayer = getTweetPhotoBackgroundLayer(element);
  const displaySrc = getTweetPhotoBackgroundUrl(element);
  const src = image?.currentSrc || image?.src || displaySrc;
  if (!src) {
    return null;
  }

  const href = element.closest('a[href]')?.getAttribute('href') ?? undefined;
  const ratioRoot = element.closest('[data-block="true"]') ?? element.closest('a') ?? element;
  const frameAspectRatio = getImageGalleryAspectRatio(ratioRoot);
  const aspectRatio = frameAspectRatio ?? (image ? getImageAspectRatio(image) : undefined);
  const backgroundSize = normalizeGalleryBackgroundSize(
    backgroundLayer?.style.backgroundSize || (backgroundLayer ? getInlineStyleValue(backgroundLayer, 'background-size') : '')
  );
  const backgroundPosition =
    normalizeCssText(backgroundLayer?.style.backgroundPosition || backgroundLayer?.style.backgroundPositionX || undefined) ?? 'center center';
  const objectFit = normalizeImageObjectFit(image?.style.objectFit) ?? 'cover';
  const objectPosition = normalizeCssText(image?.style.objectPosition) ?? backgroundPosition;
  return {
    id,
    type: 'image',
    src,
    ...(displaySrc ? { displaySrc } : {}),
    alt: image?.alt || undefined,
    ...(href ? { href: new URL(href, X_CANONICAL_ORIGIN).toString() } : {}),
    ...(aspectRatio ? { aspectRatio } : {}),
    ...(backgroundSize ? { backgroundSize } : {}),
    ...(backgroundPosition ? { backgroundPosition } : {}),
    objectFit,
    ...(objectPosition ? { objectPosition } : {})
  };
}

function imageElementToBlock(image: HTMLImageElement, id: string): ImageBlock | null {
  const src = image.currentSrc || image.src;
  if (!src) {
    return null;
  }

  const href = image.closest('a[href]')?.getAttribute('href') ?? undefined;
  const aspectRatio = getImageAspectRatio(image);
  return {
    id,
    type: 'image',
    src,
    alt: image.alt || undefined,
    ...(href ? { href: new URL(href, X_CANONICAL_ORIGIN).toString() } : {}),
    ...(aspectRatio ? { aspectRatio } : {})
  };
}

function getImageAspectRatio(image: HTMLImageElement): number | undefined {
  const intrinsicRatio = toValidAspectRatio(image.naturalWidth, image.naturalHeight);
  if (intrinsicRatio) {
    return intrinsicRatio;
  }

  for (let element: Element | null = image.parentElement; element; element = element.parentElement) {
    const paddingRatio = getPaddingBottomAspectRatio(element);
    if (paddingRatio) {
      return paddingRatio;
    }
  }

  return undefined;
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

function isHeadingBlock(block: Element): boolean {
  return getHeadingLevel(block) !== undefined;
}

function getHeadingLevel(block: Element): 1 | 2 | 3 | 4 | 5 | 6 | undefined {
  const tagMatch = /^H([1-6])$/i.exec(block.tagName);
  if (tagMatch) {
    return Number(tagMatch[1]) as 1 | 2 | 3 | 4 | 5 | 6;
  }

  if (block.classList.contains('longform-header-one')) {
    return 1;
  }

  if (block.classList.contains('longform-header-two')) {
    return 2;
  }

  return undefined;
}

function isBoldTextElement(textElement: HTMLElement): boolean {
  const styledElement = textElement.closest<HTMLElement>('[style*="font-weight"]');
  const fontWeight = styledElement?.style.fontWeight;
  return fontWeight === 'bold' || fontWeight === '700';
}

function isEmojiTextElement(textElement: HTMLElement): boolean {
  return Boolean(getEmojiImageUrl(textElement));
}

function getEmojiImageUrl(textElement: HTMLElement): string | undefined {
  const emojiLayer = textElement.closest<HTMLElement>('[style*="background-image"]');
  const backgroundImage = emojiLayer?.style.backgroundImage ?? '';
  const match = backgroundImage.match(/url\((['"]?)(.*?)\1\)/i);
  return match?.[2];
}

function extractTextWithAnnotations(
  element: Element,
  options: { preserveLineBreaks?: boolean } = {}
): { text: string; annotations: TextAnnotation[] } {
  const normalize = options.preserveLineBreaks ? normalizePreWrapText : normalizeText;
  const textElements = Array.from(element.querySelectorAll<HTMLElement>('[data-text="true"]'));
  const fullText = normalize(getElementDisplayText(element, options.preserveLineBreaks));
  if (textElements.length === 0) {
    return { text: fullText, annotations: [] };
  }

  const annotations: TextAnnotation[] = [];
  const linkAnnotations = annotations;
  let text = '';
  let searchCursor = 0;
  for (const textElement of textElements) {
    const segment = normalize(textElement.textContent ?? '');
    if (!segment) {
      continue;
    }

    const startOffset = options.preserveLineBreaks ? fullText.indexOf(segment, searchCursor) : text.length;
    if (startOffset === -1) {
      continue;
    }

    if (!options.preserveLineBreaks) {
      text += segment;
    }
    const endOffset = text.length;
    const resolvedEndOffset = options.preserveLineBreaks ? startOffset + segment.length : endOffset;
    searchCursor = resolvedEndOffset;
    const annotation: TextAnnotation = {
      startOffset,
      endOffset: resolvedEndOffset,
      ...extractTextAnnotationStyle(textElement)
    };

    if (resolvedEndOffset > startOffset && isBoldTextElement(textElement)) {
      annotation.bold = true;
    }
    const anchor = textElement.closest<HTMLAnchorElement>('a[href][role="link"], a[href]');
    if (resolvedEndOffset > startOffset && anchor) {
      const href = anchor.getAttribute('href');
      if (href) {
        const linkStyle = extractTextAnnotationStyle(anchor);
        annotation.href = href;
        annotation.target = anchor.getAttribute('target') ?? undefined;
        Object.assign(annotation, linkStyle);
      }
    }
    if (isEmojiTextElement(textElement)) {
      // X renders emoji through a background image and hides the real glyph with
      // `clip-path: circle(...)`; keep the underlying text so sentence units
      // include the emoji instead of dropping it from the reading flow.
      const emojiImageUrl = getEmojiImageUrl(textElement);
      if (emojiImageUrl) {
        annotation.emojiImageUrl = emojiImageUrl;
      }
    }
    if (resolvedEndOffset > startOffset && hasTextAnnotationSignal(annotation)) {
      annotations.push(annotation);
    }
  }

  return { text: options.preserveLineBreaks ? fullText : normalize(text), annotations: linkAnnotations };
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
      annotation.fontStyle
  );
}

function getElementDisplayText(element: Element, preserveLineBreaks = false): string {
  if (preserveLineBreaks && element instanceof HTMLElement && typeof element.innerText === 'string') {
    return element.innerText;
  }
  return element.textContent ?? '';
}

function blockId(articleId: string, index: number): string {
  return `${articleId}-b${index}`;
}
