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
  | EmbedBlock;

export type HeadingBlock = {
  id: string;
  type: 'heading';
  text: string;
};

export type ParagraphBlock = {
  id: string;
  type: 'paragraph';
  text: string;
};

export type QuoteBlock = {
  id: string;
  type: 'quote';
  text: string;
};

export type ImageBlock = {
  id: string;
  type: 'image';
  src: string;
  alt?: string;
  href?: string;
  aspectRatio?: number;
};

export type EmbedBlock = {
  id: string;
  type: 'embed';
  label: string;
  text?: string;
  href?: string;
};
