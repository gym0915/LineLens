export type ReaderTextRole = 'body' | 'quote' | 'heading' | 'list-item' | 'social-title' | 'social-excerpt' | 'social-body';

export type StyleWhitelistConfig = {
  preserveProps: string[];
  preserveColorFor?: Array<'link' | 'inline-code' | 'custom-selector'>;
  preserveWhiteSpaceValues?: string[];
  customColorSelectors?: string[];
};

export type FocusUnitConfig = {
  sentenceRoles?: ReaderTextRole[];
  blockRoles?: ReaderTextRole[];
};
