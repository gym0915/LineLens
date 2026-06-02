import { BUILT_IN_PLATFORM_ADAPTERS, type PlatformAdapter, type PlatformAdapterUserConfig } from '../content/adapters/index.js';
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
    enabledFixes,
    styleWhitelist: mergeStyleWhitelistConfig(adapter.styleWhitelist, userConfig.styleWhitelist)
  };
}

function mergeStyleWhitelistConfig(defaults: StyleWhitelistConfig, override: Partial<StyleWhitelistConfig> | undefined): StyleWhitelistConfig {
  if (!isPlainObject(override)) {
    return { ...defaults };
  }

  return {
    preserveProps: mergeUnique(defaults.preserveProps, normalizeStringArray(override.preserveProps)),
    preserveColorFor: mergeUnique(defaults.preserveColorFor ?? [], normalizeStringArray(override.preserveColorFor)) as StyleWhitelistConfig['preserveColorFor'],
    preserveWhiteSpaceValues: mergeUnique(defaults.preserveWhiteSpaceValues ?? [], normalizeStringArray(override.preserveWhiteSpaceValues)),
    customColorSelectors: mergeUnique(defaults.customColorSelectors ?? [], normalizeStringArray(override.customColorSelectors))
  };
}

function normalizeSelector(selector: unknown): string | undefined {
  return typeof selector === 'string' && selector.trim() ? selector.trim() : undefined;
}

function normalizeStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0).map((item) => item.trim())
    : [];
}

function mergeUnique(base: readonly string[], override: readonly string[]): string[] {
  return [...new Set([...base, ...override])];
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
