export type ReaderTextRole = 'body' | 'quote' | 'heading' | 'list-item' | 'social-title' | 'social-excerpt' | 'social-body';

export type StyleWhitelistConfig = {
  preserveProps: string[];
  preserveColorFor?: Array<'link' | 'inline-emphasis' | 'custom-selector'>;
  preserveWhiteSpaceValues?: string[];
  customColorSelectors?: string[];
};

export type FocusUnitConfig = {
  sentenceRoles?: ReaderTextRole[];
  blockRoles?: ReaderTextRole[];
};

export const READER_THEME_SETTINGS = [
  'system',
  'warm-white',
  'warm-yellow',
  'soft-rose',
  'soft-blue',
  'soft-sage',
  'soft-lavender',
  'soft-peach',
  'cool-gray'
] as const;

export const READER_FONT_SCALE_SETTINGS = [
  'small',
  'medium',
  'large'
] as const;

export const READER_LINE_HEIGHT_SETTINGS = [
  'compact',
  'comfortable',
  'spacious'
] as const;

export const READER_COLUMN_WIDTH_SETTINGS = [
  'narrow',
  'standard',
  'wide'
] as const;

export const READER_FOCUS_GRANULARITY_SETTINGS = [
  'sentence',
  'paragraph',
  'block'
] as const;

export const READER_READING_MODE_SETTINGS = [
  'focus',
  'continuous'
] as const;

export type ReaderThemeSetting = typeof READER_THEME_SETTINGS[number];
export type ReaderFontScaleSetting = typeof READER_FONT_SCALE_SETTINGS[number];
export type ReaderLineHeightSetting = typeof READER_LINE_HEIGHT_SETTINGS[number];
export type ReaderColumnWidthSetting = typeof READER_COLUMN_WIDTH_SETTINGS[number];
export type ReaderFocusGranularitySetting = typeof READER_FOCUS_GRANULARITY_SETTINGS[number];
export type ReaderReadingModeSetting = typeof READER_READING_MODE_SETTINGS[number];

export type ReaderSettingsConfig = {
  theme: ReaderThemeSetting;
  fontScale: ReaderFontScaleSetting;
  lineHeight: ReaderLineHeightSetting;
  columnWidth: ReaderColumnWidthSetting;
  focusGranularity: ReaderFocusGranularitySetting;
  readingMode: ReaderReadingModeSetting;
};

export type ReaderSettingsUserConfig = Partial<ReaderSettingsConfig>;

export const DEFAULT_READER_SETTINGS: ReaderSettingsConfig = {
  theme: 'system',
  fontScale: 'medium',
  lineHeight: 'comfortable',
  columnWidth: 'standard',
  focusGranularity: 'sentence',
  readingMode: 'focus'
};
