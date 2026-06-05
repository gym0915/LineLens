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
  fixes: PlatformFix[];
  enabledFixes: PlatformFixId[];
  styleWhitelist: StyleWhitelistConfig;
};

export type PlatformAdapterUserConfig = {
  enabled?: boolean;
  rootSelector?: string;
  titleSelector?: string;
  contentSelector?: string;
  enabledFixes?: string[];
  styleWhitelist?: Partial<StyleWhitelistConfig>;
};
