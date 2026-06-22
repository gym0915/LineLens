import {
  BUILT_IN_PLATFORM_ADAPTERS,
  type PlatformAdapter,
  type PlatformAdapterUserConfig,
  type SemanticMapConfig,
  type SpecialComponentConfig,
  type SpecialComponentType
} from '../content/adapters/index.js';
import type { StyleWhitelistConfig } from './reader-config.js';

export const LINE_LENS_SETTINGS_STORAGE_KEY = 'linelens.settings.v1';

export type LineLensSettings = {
  schemaVersion: 1;
  platformAdapters: Record<string, PlatformAdapter>;
};

export type LineLensUserSettings = {
  schemaVersion?: unknown;
  platformAdapters?: Record<string, PlatformAdapterUserConfig | unknown>;
};

export const DEFAULT_SETTINGS: LineLensSettings = {
  schemaVersion: 1,
  platformAdapters: Object.fromEntries(BUILT_IN_PLATFORM_ADAPTERS.map((adapter) => [adapter.id, adapter]))
};

export function loadSettingsFromLocalStorage(storage?: Storage | null): LineLensSettings {
  try {
    const readableStorage = storage ?? globalThis.localStorage;
    if (!readableStorage) {
      return DEFAULT_SETTINGS;
    }

    const raw = readableStorage.getItem(LINE_LENS_SETTINGS_STORAGE_KEY);
    if (!raw) {
      return DEFAULT_SETTINGS;
    }

    return normalizeSettings(JSON.parse(raw));
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function normalizeSettings(input: unknown): LineLensSettings {
  if (!isPlainObject(input)) {
    return DEFAULT_SETTINGS;
  }

  return mergeSettings(DEFAULT_SETTINGS, input as LineLensUserSettings);
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
    platformAdapters
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

function normalizeSelectorArray(value: unknown): string[] | undefined {
  const selectors = normalizeStringArray(value);
  return selectors.length > 0 ? selectors : undefined;
}

function normalizeSpecialComponentType(value: unknown): SpecialComponentType | undefined {
  return typeof value === 'string' && SPECIAL_COMPONENT_TYPES.includes(value as SpecialComponentType)
    ? value as SpecialComponentType
    : undefined;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const SEMANTIC_MAP_KEYS: Array<keyof SemanticMapConfig> = [
  'blockSelector',
  'paragraphSelector',
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
