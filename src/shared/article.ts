export type LegacyArticleSource = 'fixture' | 'x-article' | 'substack-article';
export type ArticleSource = LegacyArticleSource | (string & {});
export type ArticleSourceKind = 'fixture' | 'platform' | 'imported';

export type Article = {
  id: string;
  source: ArticleSource;
  sourceKind?: ArticleSourceKind;
  sourceProvider?: string;
  adapterId?: string;
  platform?: string;
  contentType?: 'article' | 'post' | 'thread' | 'answer';
  sourceUrl: string;
  canonicalUrl: string;
  authorName?: string;
  authorHandle?: string;
  authorAvatarUrl?: string;
  authorVerified?: boolean;
  publishedAt?: string;
  publishedAtText?: string;
  metrics?: TweetMetrics;
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
  | TableBlock
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
  textStyle?: TextStyle;
};

export type ParagraphBlock = {
  id: string;
  type: 'paragraph';
  role?: 'caption';
  text: string;
  annotations?: TextAnnotation[];
  textStyle?: TextStyle;
};

export type QuoteBlock = {
  id: string;
  type: 'quote';
  text: string;
  annotations?: TextAnnotation[];
  textStyle?: TextStyle;
};

export type ImageBlock = {
  id: string;
  type: 'image';
  src: string;
  srcset?: string;
  sizes?: string;
  displaySrc?: string;
  alt?: string;
  href?: string;
  aspectRatio?: number;
  backgroundSize?: 'cover' | 'contain' | 'auto';
  backgroundPosition?: string;
  objectFit?: 'cover' | 'contain' | 'fill' | 'none' | 'scale-down';
  objectPosition?: string;
};

export type ImageGalleryItem = {
  src: string;
  srcset?: string;
  sizes?: string;
  displaySrc?: string;
  alt?: string;
  href?: string;
  aspectRatio?: number;
  backgroundSize?: 'cover' | 'contain' | 'auto';
  backgroundPosition?: string;
  objectFit?: 'cover' | 'contain' | 'fill' | 'none' | 'scale-down';
  objectPosition?: string;
};

export type ImageGalleryLayoutNode =
  | {
      type: 'item';
      itemIndex: number;
      grow?: number;
      shrink?: number;
      basis?: string;
    }
  | {
      type: 'row' | 'column';
      children: ImageGalleryLayoutNode[];
      grow?: number;
      shrink?: number;
      basis?: string;
    };

export type ImageGalleryBlock = {
  id: string;
  type: 'image-gallery';
  items: ImageGalleryItem[];
  aspectRatio?: number;
  layout?: ImageGalleryLayoutNode;
};

export type TweetPhoto = {
  src: string;
  srcset?: string;
  sizes?: string;
  displaySrc?: string;
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
  itemTextStyles?: TextStyle[];
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
  codeStyle?: CodeBlockStyle;
  tokens?: CodeToken[];
};

export type CodeBlockStyle = {
  headerBackgroundColor?: string;
  headerColor?: string;
  copyColor?: string;
  preBackgroundColor?: string;
  preColor?: string;
  codeBackgroundColor?: string;
  codeColor?: string;
  themeColors?: CodeBlockThemeColors;
  fontFamily?: string;
  fontSize?: string;
  lineHeight?: string;
  tabSize?: string;
};

export type CodeThemeColorPair = {
  light?: string;
  dark?: string;
};

export type CodeBlockThemeColors = {
  headerBackgroundColor?: CodeThemeColorPair;
  headerColor?: CodeThemeColorPair;
  copyColor?: CodeThemeColorPair;
  preBackgroundColor?: CodeThemeColorPair;
  preColor?: CodeThemeColorPair;
  codeBackgroundColor?: CodeThemeColorPair;
  codeColor?: CodeThemeColorPair;
};

export type CodeTokenThemeColors = {
  color?: CodeThemeColorPair;
};

export type CodeToken = {
  text: string;
  color?: string;
  themeColors?: CodeTokenThemeColors;
  fontStyle?: string;
  fontWeight?: string;
};

export type TableBlock = {
  id: string;
  type: 'table';
  rows: TableRow[];
  columnCount?: number;
  tableStyle?: TableStyle;
};

export type TableRow = {
  cells: TableCell[];
};

export type TableCell = {
  text: string;
  header?: boolean;
  colSpan?: number;
  rowSpan?: number;
  textStyle?: TextStyle;
  backgroundColor?: string;
  borderColor?: string;
};

export type TableStyle = {
  backgroundColor?: string;
  borderColor?: string;
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

export type SimpleTweetTextItem = {
  type: 'text';
  text: string;
  annotations?: TextAnnotation[];
};

export type SimpleTweetVideoItem = {
  type: 'video';
  video: VideoBlock;
};

export type SimpleTweetVideoPreviewItem = {
  type: 'video-preview';
  src: string;
  alt?: string;
  href?: string;
  durationText?: string;
  aspectRatio?: number;
  layout?: 'condensed';
  shape?: 'rounded-square';
};

export type SimpleTweetPhotoItem = {
  type: 'photo';
  photo: TweetPhoto;
  layout?: 'condensed';
  shape?: 'rounded-square';
};

export type SimpleTweetPhotoLayout =
  | {
      kind: 'photo';
      photo: TweetPhoto;
      widthRatio?: number;
      heightRatio?: number;
    }
  | {
      kind: 'row' | 'column';
      children: SimpleTweetPhotoLayout[];
      widthRatio?: number;
      heightRatio?: number;
    };

export type SimpleTweetPhotoGroupItem = {
  type: 'photo-group';
  photos: TweetPhoto[];
  layout: SimpleTweetPhotoLayout;
  aspectRatio?: number;
};

export type SimpleTweetArticleCoverItem = {
  type: 'article-cover';
  coverUrl: string;
  coverAlt?: string;
  aspectRatio?: number;
  sourceLabel?: string;
  sourceIconPath?: string;
  sourceColor?: string;
  title?: string;
  titleTextStyle?: TextStyle;
  excerpt?: string;
  excerptTextStyle?: TextStyle;
  href?: string;
  authorName?: string;
  authorHandle?: string;
  authorAvatarUrl?: string;
  authorVerified?: boolean;
  publishedAt?: string;
  publishedAtText?: string;
  metrics?: TweetMetrics;
};

export type SimpleTweetCardData = {
  source: string;
  title: string;
  excerpt: string;
  href?: string;
  items: SimpleTweetContentItem[];
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
  aiGeneratedText?: string;
};

export type SimpleTweetQuotedTweetItem = {
  type: 'quoted-tweet';
  tweet: SimpleTweetCardData;
};

export type SimpleTweetLayoutRole =
  | 'root'
  | 'header'
  | 'body'
  | 'media'
  | 'text'
  | 'photo'
  | 'video'
  | 'actions'
  | 'quotedTweet';

export type SimpleTweetLayoutContainer = {
  kind: 'container';
  role: Extract<SimpleTweetLayoutRole, 'root' | 'header' | 'body' | 'media' | 'actions' | 'quotedTweet'>;
  display?: 'block' | 'flex' | 'inline-flex' | 'grid';
  flexDirection?: 'row' | 'row-reverse' | 'column' | 'column-reverse';
  gridTemplateColumns?: string;
  gapPx?: number;
  alignItems?: string;
  justifyContent?: string;
  widthRatio?: number;
  heightRatio?: number;
  aspectRatio?: number;
  children: SimpleTweetLayoutNode[];
};

export type SimpleTweetLayoutLeaf = {
  kind: 'leaf';
  role: Extract<SimpleTweetLayoutRole, 'text' | 'photo' | 'video'>;
  contentRef: string;
  children?: SimpleTweetLayoutNode[];
};

export type SimpleTweetLayoutNode = SimpleTweetLayoutContainer | SimpleTweetLayoutLeaf;

export type SimpleTweetContentItem =
  | SimpleTweetTextItem
  | SimpleTweetVideoItem
  | SimpleTweetVideoPreviewItem
  | SimpleTweetPhotoItem
  | SimpleTweetPhotoGroupItem
  | SimpleTweetArticleCoverItem
  | SimpleTweetQuotedTweetItem;

export type SimpleTweetBlock = SimpleTweetCardData & {
  id: string;
  type: 'simple-tweet';
  photos?: TweetPhoto[];
  metrics?: TweetMetrics;
  layoutTree?: SimpleTweetLayoutNode;
};

export type EmbedBlock = {
  id: string;
  type: 'embed';
  label: string;
  text?: string;
  href?: string;
  provider?: 'x' | 'youtube' | 'substack' | 'generic';
  title?: string;
  authorName?: string;
  authorHandle?: string;
  authorAvatarUrl?: string;
  publishedAt?: string;
  publishedAtText?: string;
  metrics?: TweetMetrics;
  media?: Array<{
    type: 'image';
    src: string;
    href?: string;
    alt?: string;
    aspectRatio?: number;
    objectFit?: 'cover' | 'contain';
    objectPosition?: string;
  }>;
};

export type TextAnnotation = {
  startOffset: number;
  endOffset: number;
  bold?: boolean;
  href?: string;
  target?: string;
  emojiImageUrl?: string;
  color?: string;
  fontSize?: string;
  lineHeight?: string;
  textAlign?: string;
  fontStyle?: string;
  textDecoration?: string;
};

export type TextStyle = {
  color?: string;
  fontSize?: string;
  lineHeight?: string;
  textAlign?: string;
  fontStyle?: string;
  fontWeight?: string;
};
