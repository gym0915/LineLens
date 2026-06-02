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
  | ImageGalleryBlock
  | ListBlock
  | LinkBlock
  | CodeBlock
  | GifBlock
  | VideoBlock
  | SimpleTweetBlock
  | EmbedBlock;

export type HeadingBlock = {
  id: string;
  type: 'heading';
  text: string;
  level?: 1 | 2 | 3 | 4 | 5 | 6;
  annotations?: TextAnnotation[];
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

export type ImageGalleryItem = {
  src: string;
  alt?: string;
  href?: string;
  aspectRatio?: number;
};

export type ImageGalleryBlock = {
  id: string;
  type: 'image-gallery';
  items: ImageGalleryItem[];
  aspectRatio?: number;
};

export type TweetPhoto = {
  src: string;
  alt?: string;
  href?: string;
};

export type TweetMetrics = {
  replies?: string;
  reposts?: string;
  likes?: string;
  views?: string;
  bookmarks?: string;
};

export type ListBlock = {
  id: string;
  type: 'list';
  kind?: 'ordered' | 'unordered';
  items: string[];
  itemAnnotations?: TextAnnotation[][];
};

export type LinkBlock = {
  id: string;
  type: 'link';
  text: string;
  href: string;
  target?: string;
};

export type CodeBlock = {
  id: string;
  type: 'code';
  language?: string;
  text: string;
};

export type GifBlock = {
  id: string;
  type: 'gif';
  src: string;
  poster?: string;
  aspectRatio?: number;
  backgroundColor?: string;
  top?: string;
  left?: string;
  transform?: string;
  paused?: boolean;
};

export type VideoBlock = {
  id: string;
  type: 'video';
  src: string;
  sourceType?: string;
  transport?: 'hls' | 'direct';
  hls?: {
    masterPlaylistUrl?: string;
    audioPlaylistUrl?: string;
    videoPlaylists?: Array<{
      resolution: string;
      width?: number;
      height?: number;
      url: string;
    }>;
  };
  poster?: string;
  aspectRatio?: number;
  backgroundColor?: string;
  top?: string;
  left?: string;
  transform?: string;
  preload?: 'auto' | 'metadata' | 'none' | '';
  playsInline?: boolean;
  tabIndex?: number;
  ariaLabel?: string;
  paused?: boolean;
};

export type SimpleTweetBlock = {
  id: string;
  type: 'simple-tweet';
  coverUrl: string;
  coverAlt?: string;
  source: string;
  title: string;
  excerpt: string;
  href?: string;
  photos?: TweetPhoto[];
  video?: VideoBlock;
  authorName?: string;
  authorHandle?: string;
  authorAvatarUrl?: string;
  authorBadgeAvatarUrl?: string;
  authorVerified?: boolean;
  publishedAt?: string;
  publishedAtText?: string;
  replyContextText?: string;
  replyToHandle?: string;
  translationSourceText?: string;
  translationActionText?: string;
  metrics?: TweetMetrics;
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
  href?: string;
  target?: string;
  emojiImageUrl?: string;
};
