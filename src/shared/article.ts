export type ArticleSource = 'fixture' | 'x-article';

export type Article = {
  id: string;
  source: ArticleSource;
  sourceUrl: string;
  canonicalUrl: string;
  authorHandle?: string;
  title: string;
  coverImage?: ImageBlock;
  extractedAt: number;
  blocks: ArticleBlock[];
};

export type ArticleBlock =
  | HeadingBlock
  | ParagraphBlock
  | QuoteBlock
  | ImageBlock
  | ListBlock
  | RefCardBlock
  | EmbedBlock;

export type HeadingBlock = {
  id: string;
  type: 'heading';
  text: string;
  level?: 1 | 2 | 3 | 4 | 5 | 6;
};

export type ParagraphBlock = {
  id: string;
  type: 'paragraph';
  text: string;
  annotations?: TextAnnotation[];
};

export type QuoteBlock = {
  id: string;
  type: 'quote';
  text: string;
  annotations?: TextAnnotation[];
};

export type ImageBlock = {
  id: string;
  type: 'image';
  src: string;
  alt?: string;
  href?: string;
  aspectRatio?: number;
};

export type ListBlock = {
  id: string;
  type: 'list';
  items: string[];
  itemAnnotations?: TextAnnotation[][];
};

export type RefCardBlock = {
  id: string;
  type: 'ref-card';
  coverUrl: string;
  coverAlt?: string;
  source: string;
  title: string;
  excerpt: string;
  href?: string;
};

export type EmbedBlock = {
  id: string;
  type: 'embed';
  label: string;
  text?: string;
  href?: string;
};

export type TextAnnotation = {
  startOffset: number;
  endOffset: number;
  bold?: boolean;
};
