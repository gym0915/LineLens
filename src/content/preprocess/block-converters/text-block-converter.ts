import type { ArticleBlock, ParagraphBlock, QuoteBlock, TextAnnotation, TextStyle } from '../../../shared/article.js';

export type TextBlockKind = 'heading' | 'paragraph' | 'quote';

export type TextBlockConverterDeps = {
  blockId: string;
  getPreferredTextContent(element: Element, type: TextBlockKind): string;
  extractTextAnnotations(element: Element, fullText: string): TextAnnotation[];
  extractElementTextStyle(element: Element | null): TextStyle;
  getHeadingLevel(element: Element): 1 | 2 | 3 | 4 | 5 | 6;
  isMediaCaptionElement(element: Element): boolean;
};

export function convertTextElement(
  element: Element,
  type: TextBlockKind,
  deps: TextBlockConverterDeps
): ParagraphBlock | QuoteBlock | Extract<ArticleBlock, { type: 'heading' }> | null {
  const text = deps.getPreferredTextContent(element, type);
  if (text === '') {
    return null;
  }

  const base = {
    id: deps.blockId,
    text,
    annotations: deps.extractTextAnnotations(element, text),
    textStyle: deps.extractElementTextStyle(element)
  };

  if (type === 'heading') {
    return {
      ...base,
      type,
      level: deps.getHeadingLevel(element)
    };
  }

  return {
    ...base,
    type,
    ...(type === 'paragraph' && deps.isMediaCaptionElement(element) ? { role: 'caption' as const } : {})
  };
}
