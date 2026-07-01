import type { StyleWhitelistConfig } from '../../shared/reader-config.js';
import type { ArticleBlock, ArticleSource } from '../../shared/article.js';

export type PlatformFixId =
  | 'expand-folded-tweet-text'
  | 'normalize-handwritten-ordered-list'
  | 'preserve-svg-emoji'
  | 'capture-x-video-hls'
  | 'preserve-x-media-caption'
  | 'preserve-x-media-layout';

export type PlatformFix = {
  id: PlatformFixId;
  enabledByDefault: boolean;
  description: string;
};

export type SemanticMapConfig = {
  blockSelector?: string;
  paragraphSelector?: string;
  headingSelector?: string;
  quoteSelector?: string;
  orderedListSelector?: string;
  unorderedListSelector?: string;
  imageSelector?: string;
  imageGallerySelector?: string;
  codeSelector?: string;
  tableSelector?: string;
  linkSelector?: string;
  textSelector?: string;
};

export type CleanRulesConfig = {
  removeSelectors?: string[];
  unwrapSelectors?: string[];
  preserveAttributeNames?: string[];
};

export type ReadinessConfig = {
  minTextLength?: number;
  minBlockCount?: number;
  requiredSelectors?: string[];
  stableDomMs?: number;
};

export type CodeThemePair = {
  light: string;
  dark: string;
};

export type TitleStrategy = 'required' | 'optional' | 'fallback-from-h1';
export type EmptyContentStrategy = 'reject' | 'allow-media-only';

export type ValidationConfig = {
  minBlockCount?: number;
  minTextLength?: number;
  titleStrategy?: TitleStrategy;
  emptyContentStrategy?: EmptyContentStrategy;
};

export type ArticleHeaderSelectorsConfig = {
  sourceLabelSelector?: string;
  titleLinkSelector?: string;
  subtitleSelector?: string;
  authorNameSelector?: string;
  authorAvatarSelector?: string;
  publishedAtSelector?: string;
};

export type SpecialComponentType =
  | 'social-card'
  | 'video'
  | 'gif'
  | 'image-gallery'
  | 'embed'
  | 'custom-card';

export type SpecialComponentConfig = {
  id: string;
  type: SpecialComponentType;
  rootSelector: string;
  handlerId: string;
  preserveSelectors?: string[];
  removeSelectors?: string[];
};

export type SpecialComponentHandlerContext = {
  component: SpecialComponentConfig;
  sourceUrl: string;
  debugId: string;
  index: number;
};

export type SpecialComponentHandler = {
  handlerId: string;
  extract(root: Element, context: SpecialComponentHandlerContext): ArticleBlock | null;
};

export type PlatformAdapter = {
  id: string;
  platform: string;
  contentType: 'article' | 'post' | 'thread' | 'answer';
  articleSource?: ArticleSource;
  hosts: string[];
  urlPatterns?: RegExp[];
  enabled: boolean;
  rootSelector: string;
  titleSelector?: string;
  headerSelectors?: ArticleHeaderSelectorsConfig;
  contentSelector?: string;
  semanticMap?: SemanticMapConfig;
  cleanRules?: CleanRulesConfig;
  readiness?: ReadinessConfig;
  validation?: ValidationConfig;
  codeThemePairs?: CodeThemePair[];
  fixes: PlatformFix[];
  enabledFixes: PlatformFixId[];
  styleWhitelist: StyleWhitelistConfig;
  specialComponents?: SpecialComponentConfig[];
};

export type PlatformAdapterUserConfig = {
  enabled?: boolean;
  rootSelector?: string;
  titleSelector?: string;
  headerSelectors?: Partial<ArticleHeaderSelectorsConfig>;
  contentSelector?: string;
  semanticMap?: Partial<SemanticMapConfig>;
  cleanRules?: Partial<CleanRulesConfig>;
  readiness?: Partial<ReadinessConfig>;
  validation?: Partial<ValidationConfig>;
  enabledFixes?: string[];
  styleWhitelist?: Partial<StyleWhitelistConfig>;
  specialComponents?: SpecialComponentConfig[];
};
