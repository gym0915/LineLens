import type { StyleWhitelistConfig } from '../../shared/reader-config.js';

export type PlatformFixId =
  | 'expand-folded-tweet-text'
  | 'normalize-handwritten-ordered-list'
  | 'preserve-svg-emoji'
  | 'capture-x-video-hls'
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

export type PlatformAdapter = {
  id: string;
  platform: string;
  contentType: 'article' | 'post' | 'thread' | 'answer';
  hosts: string[];
  urlPatterns?: RegExp[];
  enabled: boolean;
  rootSelector: string;
  titleSelector?: string;
  contentSelector?: string;
  semanticMap?: SemanticMapConfig;
  fixes: PlatformFix[];
  enabledFixes: PlatformFixId[];
  styleWhitelist: StyleWhitelistConfig;
  specialComponents?: SpecialComponentConfig[];
};

export type PlatformAdapterUserConfig = {
  enabled?: boolean;
  rootSelector?: string;
  titleSelector?: string;
  contentSelector?: string;
  semanticMap?: Partial<SemanticMapConfig>;
  enabledFixes?: string[];
  styleWhitelist?: Partial<StyleWhitelistConfig>;
  specialComponents?: SpecialComponentConfig[];
};
