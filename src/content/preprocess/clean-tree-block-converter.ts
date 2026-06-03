import type {
  ArticleBlock,
  ImageBlock,
  ListBlock,
  ParagraphBlock,
  QuoteBlock,
  TextAnnotation
} from '../../shared/article.js';
import type { CleanTreeContext } from './clone-content-tree.js';

export type CleanTreeBlockConversionOptions = {
  enabledBlockTypes?: Array<ArticleBlock['type']>;
};

const DEFAULT_ENABLED_BLOCK_TYPES: Array<ArticleBlock['type']> = ['paragraph', 'heading', 'quote', 'list', 'image'];

export function convertCleanTreeToBlocks(
  root: Element,
  context: CleanTreeContext,
  options: CleanTreeBlockConversionOptions = {}
): ArticleBlock[] {
  const enabledBlockTypes = new Set(options.enabledBlockTypes ?? DEFAULT_ENABLED_BLOCK_TYPES);
  const blocks: ArticleBlock[] = [];
  let index = 0;

  for (const element of Array.from(root.querySelectorAll('[data-block="true"], h1, h2, h3, h4, h5, h6, blockquote, img'))) {
    const block = convertElementToBlock(element, context, index, enabledBlockTypes);
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
  enabledBlockTypes: Set<ArticleBlock['type']>
): ArticleBlock | null {
  if (isImageElement(element) && enabledBlockTypes.has('image')) {
    return convertImageElement(element, context, index);
  }

  if (isListElement(element) && enabledBlockTypes.has('list')) {
    return convertListElement(element, context, index);
  }

  if (isHeadingElement(element) && enabledBlockTypes.has('heading')) {
    return convertTextElement(element, context, index, 'heading');
  }

  if (isQuoteElement(element) && enabledBlockTypes.has('quote')) {
    return convertTextElement(element, context, index, 'quote');
  }

  if (enabledBlockTypes.has('paragraph')) {
    return convertTextElement(element, context, index, 'paragraph');
  }

  return null;
}

function convertTextElement(
  element: Element,
  context: CleanTreeContext,
  index: number,
  type: 'heading' | 'paragraph' | 'quote'
): ParagraphBlock | QuoteBlock | Extract<ArticleBlock, { type: 'heading' }> | null {
  const text = normalizeText(element.textContent ?? '');
  if (text === '') {
    return null;
  }

  const base = {
    id: cleanTreeBlockId(context, index),
    text,
    annotations: extractTextAnnotations(element)
  };

  if (type === 'heading') {
    return {
      ...base,
      type,
      level: getHeadingLevel(element)
    };
  }

  return {
    ...base,
    type
  };
}

function convertListElement(element: Element, context: CleanTreeContext, index: number): ListBlock | null {
  const text = normalizeText(element.textContent ?? '');
  if (text === '') {
    return null;
  }

  return {
    id: cleanTreeBlockId(context, index),
    type: 'list',
    kind: element.getAttribute('data-linelens-list-kind') === 'ordered' ? 'ordered' : 'unordered',
    items: [text],
    itemAnnotations: [extractTextAnnotations(element)]
  };
}

function convertImageElement(element: Element, context: CleanTreeContext, index: number): ImageBlock | null {
  const image = element.tagName.toUpperCase() === 'IMG' ? element : element.querySelector('img');
  const src = image?.getAttribute('src') ?? element.getAttribute('src');
  if (!src) {
    return null;
  }

  return {
    id: cleanTreeBlockId(context, index),
    type: 'image',
    src,
    alt: image?.getAttribute('alt') ?? element.getAttribute('alt') ?? undefined,
    href: element.closest('a')?.getAttribute('href') ?? undefined
  };
}

function extractTextAnnotations(element: Element): TextAnnotation[] {
  const fullText = normalizeText(element.textContent ?? '');
  const annotations: TextAnnotation[] = [];

  for (const textElement of Array.from(element.querySelectorAll('[data-text="true"], a[href], [role="link"], [data-linelens-emoji-image-url]'))) {
    const text = normalizeText(textElement.textContent ?? '');
    if (text === '') {
      continue;
    }

    const startOffset = fullText.indexOf(text);
    if (startOffset === -1) {
      continue;
    }

    const annotation: TextAnnotation = {
      startOffset,
      endOffset: startOffset + text.length
    };
    const emojiImageUrl = textElement.closest('[data-linelens-emoji-image-url]')?.getAttribute('data-linelens-emoji-image-url');
    const linkElement = textElement.closest('a[href], [role="link"]');

    if (isBoldElement(textElement)) {
      annotation.bold = true;
    }
    if (linkElement !== null) {
      const href = linkElement.getAttribute('href');
      if (href) {
        annotation.href = href;
      }
      annotation.target = linkElement.getAttribute('target') ?? undefined;
    }
    if (emojiImageUrl) {
      annotation.emojiImageUrl = emojiImageUrl;
    }

    if (annotation.bold || annotation.href || annotation.emojiImageUrl) {
      annotations.push(annotation);
    }
  }

  return annotations;
}

function isBoldElement(element: Element): boolean {
  return Boolean(element.closest('strong, b, [style*="font-weight: bold"], [style*="font-weight: 700"]'));
}

function isHeadingElement(element: Element): boolean {
  return /^H[1-6]$/.test(element.tagName.toUpperCase()) || element.getAttribute('data-linelens-block-role') === 'heading';
}

function isQuoteElement(element: Element): boolean {
  return element.tagName.toUpperCase() === 'BLOCKQUOTE' || element.getAttribute('data-testid') === 'tweet';
}

function isListElement(element: Element): boolean {
  return element.hasAttribute('data-linelens-list-kind') || element.tagName.toUpperCase() === 'LI';
}

function isImageElement(element: Element): boolean {
  return element.tagName.toUpperCase() === 'IMG' || element.getAttribute('data-testid') === 'tweetPhoto';
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
