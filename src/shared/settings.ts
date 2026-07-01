import type { ArticleSource } from './article.js';
import {
  DEFAULT_READER_SETTINGS,
  READER_COLUMN_WIDTH_SETTINGS,
  READER_FOCUS_GRANULARITY_SETTINGS,
  READER_FONT_SCALE_SETTINGS,
  READER_LINE_HEIGHT_SETTINGS,
  READER_READING_MODE_SETTINGS,
  READER_THEME_SETTINGS,
  type ReaderSettingsConfig,
  type ReaderSettingsUserConfig,
  type StyleWhitelistConfig
} from './reader-config.js';

export const LINE_LENS_SETTINGS_STORAGE_KEY = 'linelens.settings.v1';

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
  dividerSelector?: string;
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
  articleSource?: ArticleSource;
  hosts: string[];
  urlPatterns?: RegExp[];
  enabled: boolean;
  rootSelector: string;
  titleSelector?: string;
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
  contentSelector?: string;
  semanticMap?: Partial<SemanticMapConfig>;
  cleanRules?: Partial<CleanRulesConfig>;
  readiness?: Partial<ReadinessConfig>;
  validation?: Partial<ValidationConfig>;
  enabledFixes?: string[];
  styleWhitelist?: Partial<StyleWhitelistConfig>;
  specialComponents?: SpecialComponentConfig[];
};

export type LineLensSettings = {
  schemaVersion: 1;
  platformAdapters: Record<string, PlatformAdapter>;
  reader: ReaderSettingsConfig;
};

export type LineLensUserSettings = {
  schemaVersion?: unknown;
  platformAdapters?: Record<string, PlatformAdapterUserConfig | unknown>;
  reader?: ReaderSettingsUserConfig | unknown;
};

export const DEFAULT_SETTINGS: LineLensSettings = createDefaultSettings();

export function createDefaultSettings(adapters: PlatformAdapter[] = []): LineLensSettings {
  return {
    schemaVersion: 1,
    platformAdapters: Object.fromEntries(adapters.map((adapter) => [adapter.id, adapter])),
    reader: DEFAULT_READER_SETTINGS
  };
}

export function loadSettingsFromLocalStorage(storage?: Storage | null, defaults: LineLensSettings = DEFAULT_SETTINGS): LineLensSettings {
  try {
    const readableStorage = storage ?? globalThis.localStorage;
    if (!readableStorage) {
      return defaults;
    }

    const raw = readableStorage.getItem(LINE_LENS_SETTINGS_STORAGE_KEY);
    if (!raw) {
      return defaults;
    }

    return normalizeSettings(JSON.parse(raw), defaults);
  } catch {
    return defaults;
  }
}

export function normalizeSettings(input: unknown, defaults: LineLensSettings = DEFAULT_SETTINGS): LineLensSettings {
  if (!isPlainObject(input)) {
    return defaults;
  }

  return mergeSettings(defaults, input as LineLensUserSettings);
}

export function mergeSettings(defaults: LineLensSettings, userSettings: LineLensUserSettings): LineLensSettings {
  const platformAdapters: Record<string, PlatformAdapter> = { ...defaults.platformAdapters };
  const userAdapters = isPlainObject(userSettings.platformAdapters) ? userSettings.platformAdapters : {};

  for (const [adapterId, userConfig] of Object.entries(userAdapters)) {
    const builtInAdapter = defaults.platformAdapters[adapterId];
    if (!builtInAdapter || !isPlainObject(userConfig)) {
      continue;
    }

    platformAdapters[adapterId] = mergePlatformAdapterConfig(builtInAdapter, userConfig as PlatformAdapterUserConfig);
  }

  return {
    schemaVersion: 1,
    platformAdapters,
    reader: mergeReaderSettingsConfig(defaults.reader, userSettings.reader)
  };
}

export function mergePlatformAdapterConfig(adapter: PlatformAdapter, userConfig: PlatformAdapterUserConfig): PlatformAdapter {
  const rootSelector = normalizeSelector(userConfig.rootSelector) ?? adapter.rootSelector;
  const titleSelector = normalizeSelector(userConfig.titleSelector) ?? adapter.titleSelector;
  const contentSelector = normalizeSelector(userConfig.contentSelector) ?? adapter.contentSelector;
  const allowedFixes = new Set(adapter.fixes.map((fix) => fix.id));
  const enabledFixes = Array.isArray(userConfig.enabledFixes)
    ? userConfig.enabledFixes.filter((fixId): fixId is PlatformAdapter['enabledFixes'][number] => allowedFixes.has(fixId as PlatformAdapter['enabledFixes'][number]))
    : adapter.enabledFixes;

  return {
    ...adapter,
    enabled: typeof userConfig.enabled === 'boolean' ? userConfig.enabled : adapter.enabled,
    rootSelector,
    ...(titleSelector ? { titleSelector } : {}),
    ...(contentSelector ? { contentSelector } : {}),
    semanticMap: mergeSemanticMapConfig(adapter.semanticMap, userConfig.semanticMap),
    cleanRules: mergeCleanRulesConfig(adapter.cleanRules, userConfig.cleanRules),
    readiness: mergeReadinessConfig(adapter.readiness, userConfig.readiness),
    validation: mergeValidationConfig(adapter.validation, userConfig.validation),
    enabledFixes,
    styleWhitelist: mergeStyleWhitelistConfig(adapter.styleWhitelist, userConfig.styleWhitelist),
    specialComponents: mergeSpecialComponentsConfig(adapter.specialComponents, userConfig.specialComponents)
  };
}

function mergeSemanticMapConfig(defaults: SemanticMapConfig | undefined, override: Partial<SemanticMapConfig> | undefined): SemanticMapConfig | undefined {
  if (!isPlainObject(override)) {
    return defaults ? { ...defaults } : undefined;
  }

  const merged: SemanticMapConfig = { ...(defaults ?? {}) };
  for (const key of SEMANTIC_MAP_KEYS) {
    if (!Object.hasOwn(override, key)) {
      continue;
    }

    const selector = normalizeSelector(override[key]);
    if (selector) {
      merged[key] = selector;
    }
  }

  return Object.keys(merged).length > 0 ? merged : undefined;
}

function mergeStyleWhitelistConfig(defaults: StyleWhitelistConfig, override: Partial<StyleWhitelistConfig> | undefined): StyleWhitelistConfig {
  if (!isPlainObject(override)) {
    return { ...defaults };
  }

  return {
    preserveProps: Object.hasOwn(override, 'preserveProps') ? normalizeStringArray(override.preserveProps) : [...defaults.preserveProps],
    preserveColorFor: (
      Object.hasOwn(override, 'preserveColorFor')
        ? normalizeStringArray(override.preserveColorFor)
        : [...(defaults.preserveColorFor ?? [])]
    ) as StyleWhitelistConfig['preserveColorFor'],
    preserveWhiteSpaceValues: Object.hasOwn(override, 'preserveWhiteSpaceValues')
      ? normalizeStringArray(override.preserveWhiteSpaceValues)
      : [...(defaults.preserveWhiteSpaceValues ?? [])],
    customColorSelectors: Object.hasOwn(override, 'customColorSelectors')
      ? normalizeStringArray(override.customColorSelectors)
      : [...(defaults.customColorSelectors ?? [])]
  };
}

function mergeCleanRulesConfig(defaults: CleanRulesConfig | undefined, override: Partial<CleanRulesConfig> | undefined): CleanRulesConfig | undefined {
  if (!isPlainObject(override)) {
    return cloneCleanRulesConfig(defaults);
  }

  const removeSelectors = Object.hasOwn(override, 'removeSelectors')
    ? normalizeSelectorArray(override.removeSelectors) ?? defaults?.removeSelectors
    : defaults?.removeSelectors;
  const unwrapSelectors = Object.hasOwn(override, 'unwrapSelectors')
    ? normalizeSelectorArray(override.unwrapSelectors) ?? defaults?.unwrapSelectors
    : defaults?.unwrapSelectors;
  const preserveAttributeNames = Object.hasOwn(override, 'preserveAttributeNames')
    ? normalizeStringArrayOrUndefined(override.preserveAttributeNames) ?? defaults?.preserveAttributeNames
    : defaults?.preserveAttributeNames;

  return compactConfig({
    ...(removeSelectors ? { removeSelectors: [...removeSelectors] } : {}),
    ...(unwrapSelectors ? { unwrapSelectors: [...unwrapSelectors] } : {}),
    ...(preserveAttributeNames ? { preserveAttributeNames: [...preserveAttributeNames] } : {})
  });
}

function cloneCleanRulesConfig(config: CleanRulesConfig | undefined): CleanRulesConfig | undefined {
  if (!config) {
    return undefined;
  }

  return compactConfig({
    ...(config.removeSelectors ? { removeSelectors: [...config.removeSelectors] } : {}),
    ...(config.unwrapSelectors ? { unwrapSelectors: [...config.unwrapSelectors] } : {}),
    ...(config.preserveAttributeNames ? { preserveAttributeNames: [...config.preserveAttributeNames] } : {})
  });
}

function mergeReadinessConfig(defaults: ReadinessConfig | undefined, override: Partial<ReadinessConfig> | undefined): ReadinessConfig | undefined {
  if (!isPlainObject(override)) {
    return cloneReadinessConfig(defaults);
  }

  return compactConfig({
    minTextLength: Object.hasOwn(override, 'minTextLength') ? normalizePositiveNumber(override.minTextLength) ?? defaults?.minTextLength : defaults?.minTextLength,
    minBlockCount: Object.hasOwn(override, 'minBlockCount') ? normalizePositiveNumber(override.minBlockCount) ?? defaults?.minBlockCount : defaults?.minBlockCount,
    requiredSelectors: Object.hasOwn(override, 'requiredSelectors')
      ? normalizeSelectorArray(override.requiredSelectors) ?? defaults?.requiredSelectors
      : defaults?.requiredSelectors,
    stableDomMs: Object.hasOwn(override, 'stableDomMs') ? normalizePositiveNumber(override.stableDomMs) ?? defaults?.stableDomMs : defaults?.stableDomMs
  });
}

function cloneReadinessConfig(config: ReadinessConfig | undefined): ReadinessConfig | undefined {
  if (!config) {
    return undefined;
  }

  return compactConfig({
    ...config,
    ...(config.requiredSelectors ? { requiredSelectors: [...config.requiredSelectors] } : {})
  });
}

function mergeValidationConfig(defaults: ValidationConfig | undefined, override: Partial<ValidationConfig> | undefined): ValidationConfig | undefined {
  if (!isPlainObject(override)) {
    return cloneValidationConfig(defaults);
  }

  return compactConfig({
    minBlockCount: Object.hasOwn(override, 'minBlockCount') ? normalizePositiveNumber(override.minBlockCount) ?? defaults?.minBlockCount : defaults?.minBlockCount,
    minTextLength: Object.hasOwn(override, 'minTextLength') ? normalizePositiveNumber(override.minTextLength) ?? defaults?.minTextLength : defaults?.minTextLength,
    titleStrategy: Object.hasOwn(override, 'titleStrategy') ? normalizeTitleStrategy(override.titleStrategy) ?? defaults?.titleStrategy : defaults?.titleStrategy,
    emptyContentStrategy: Object.hasOwn(override, 'emptyContentStrategy')
      ? normalizeEmptyContentStrategy(override.emptyContentStrategy) ?? defaults?.emptyContentStrategy
      : defaults?.emptyContentStrategy
  });
}

function cloneValidationConfig(config: ValidationConfig | undefined): ValidationConfig | undefined {
  return config ? { ...config } : undefined;
}

function mergeSpecialComponentsConfig(defaults: SpecialComponentConfig[] | undefined, override: unknown): SpecialComponentConfig[] | undefined {
  if (override === undefined) {
    return defaults ? cloneSpecialComponents(defaults) : undefined;
  }

  if (!Array.isArray(override)) {
    return defaults ? cloneSpecialComponents(defaults) : undefined;
  }

  const normalized = override
    .map(normalizeSpecialComponentConfig)
    .filter((component): component is SpecialComponentConfig => component !== null);

  if (normalized.length !== override.length) {
    return defaults ? cloneSpecialComponents(defaults) : undefined;
  }

  return normalized;
}

function mergeReaderSettingsConfig(defaults: ReaderSettingsConfig, override: unknown): ReaderSettingsConfig {
  if (!isPlainObject(override)) {
    return { ...defaults };
  }

  return {
    theme: normalizeStringEnum(override.theme, READER_THEME_SETTINGS) ?? defaults.theme,
    fontScale: normalizeStringEnum(override.fontScale, READER_FONT_SCALE_SETTINGS) ?? defaults.fontScale,
    lineHeight: normalizeStringEnum(override.lineHeight, READER_LINE_HEIGHT_SETTINGS) ?? defaults.lineHeight,
    columnWidth: normalizeStringEnum(override.columnWidth, READER_COLUMN_WIDTH_SETTINGS) ?? defaults.columnWidth,
    focusGranularity: normalizeStringEnum(override.focusGranularity, READER_FOCUS_GRANULARITY_SETTINGS) ?? defaults.focusGranularity,
    readingMode: normalizeStringEnum(override.readingMode, READER_READING_MODE_SETTINGS) ?? defaults.readingMode
  };
}

function normalizeSpecialComponentConfig(input: unknown): SpecialComponentConfig | null {
  if (!isPlainObject(input)) {
    return null;
  }

  const id = normalizeString(input.id);
  const type = normalizeSpecialComponentType(input.type);
  const rootSelector = normalizeSelector(input.rootSelector);
  const handlerId = normalizeString(input.handlerId);
  if (!id || !type || !rootSelector || !handlerId) {
    return null;
  }

  const preserveSelectors = Object.hasOwn(input, 'preserveSelectors')
    ? normalizeSelectorArray(input.preserveSelectors)
    : undefined;
  const removeSelectors = Object.hasOwn(input, 'removeSelectors')
    ? normalizeSelectorArray(input.removeSelectors)
    : undefined;

  return {
    id,
    type,
    rootSelector,
    handlerId,
    ...(preserveSelectors ? { preserveSelectors } : {}),
    ...(removeSelectors ? { removeSelectors } : {})
  };
}

function cloneSpecialComponents(components: SpecialComponentConfig[]): SpecialComponentConfig[] {
  return components.map((component) => ({
    ...component,
    ...(component.preserveSelectors ? { preserveSelectors: [...component.preserveSelectors] } : {}),
    ...(component.removeSelectors ? { removeSelectors: [...component.removeSelectors] } : {})
  }));
}

function normalizeSelector(selector: unknown): string | undefined {
  return typeof selector === 'string' && selector.trim() ? selector.trim() : undefined;
}

function normalizeString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function normalizeStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0).map((item) => item.trim())
    : [];
}

function normalizeStringArrayOrUndefined(value: unknown): string[] | undefined {
  const values = normalizeStringArray(value);
  return values.length > 0 ? values : undefined;
}

function normalizeSelectorArray(value: unknown): string[] | undefined {
  const selectors = normalizeStringArray(value);
  return selectors.length > 0 ? selectors : undefined;
}

function normalizePositiveNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : undefined;
}

function normalizeSpecialComponentType(value: unknown): SpecialComponentType | undefined {
  return typeof value === 'string' && SPECIAL_COMPONENT_TYPES.includes(value as SpecialComponentType)
    ? value as SpecialComponentType
    : undefined;
}

function normalizeStringEnum<const T extends readonly string[]>(value: unknown, allowedValues: T): T[number] | undefined {
  return typeof value === 'string' && allowedValues.includes(value) ? value : undefined;
}

function normalizeTitleStrategy(value: unknown): TitleStrategy | undefined {
  return typeof value === 'string' && TITLE_STRATEGIES.includes(value as TitleStrategy)
    ? value as TitleStrategy
    : undefined;
}

function normalizeEmptyContentStrategy(value: unknown): EmptyContentStrategy | undefined {
  return typeof value === 'string' && EMPTY_CONTENT_STRATEGIES.includes(value as EmptyContentStrategy)
    ? value as EmptyContentStrategy
    : undefined;
}

function compactConfig<T extends Record<string, unknown>>(config: T): T | undefined {
  const entries = Object.entries(config).filter(([, value]) => value !== undefined);
  return entries.length > 0 ? Object.fromEntries(entries) as T : undefined;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const SEMANTIC_MAP_KEYS: Array<keyof SemanticMapConfig> = [
  'blockSelector',
  'paragraphSelector',
  'dividerSelector',
  'headingSelector',
  'quoteSelector',
  'orderedListSelector',
  'unorderedListSelector',
  'imageSelector',
  'imageGallerySelector',
  'codeSelector',
  'tableSelector',
  'linkSelector',
  'textSelector'
];

const SPECIAL_COMPONENT_TYPES: SpecialComponentType[] = [
  'social-card',
  'video',
  'gif',
  'image-gallery',
  'embed',
  'custom-card'
];

const TITLE_STRATEGIES: TitleStrategy[] = [
  'required',
  'optional',
  'fallback-from-h1'
];

const EMPTY_CONTENT_STRATEGIES: EmptyContentStrategy[] = [
  'reject',
  'allow-media-only'
];
