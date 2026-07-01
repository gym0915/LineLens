import type { PlatformAdapter } from './adapter-types.js';
import { createDefaultSettings, type LineLensSettings } from '../../shared/settings.js';
import { fixtureArticleAdapter } from './fixture-article-adapter.js';
import { substackArticleAdapter } from './substack-article-adapter.js';
import { xArticleAdapter } from './x-article-adapter.js';

export type {
  ArticleHeaderSelectorsConfig,
  CleanRulesConfig,
  EmptyContentStrategy,
  PlatformAdapter,
  PlatformAdapterUserConfig,
  PlatformFix,
  PlatformFixId,
  ReadinessConfig,
  SemanticMapConfig,
  SpecialComponentConfig,
  SpecialComponentHandler,
  SpecialComponentHandlerContext,
  SpecialComponentType,
  TitleStrategy,
  ValidationConfig
} from './adapter-types.js';
export { fixtureArticleAdapter } from './fixture-article-adapter.js';
export { substackArticleAdapter } from './substack-article-adapter.js';
export { xArticleAdapter } from './x-article-adapter.js';
export { EXTERNAL_MEDIA_HOST_ALLOWLIST } from './external-media-hosts.js';
export type { ExternalMediaHostAllowlistEntry, ManifestScopeSurface } from './external-media-hosts.js';

export const BUILT_IN_PLATFORM_ADAPTERS: PlatformAdapter[] = [xArticleAdapter, substackArticleAdapter, fixtureArticleAdapter];
export const DEFAULT_CONTENT_SETTINGS: LineLensSettings = createDefaultSettings(BUILT_IN_PLATFORM_ADAPTERS);

export function resolvePlatformAdapter(url: URL, adapters: PlatformAdapter[] = BUILT_IN_PLATFORM_ADAPTERS): PlatformAdapter | null {
  return (
    adapters.find((adapter) => {
      if (!hostMatches(url.hostname, adapter.hosts)) {
        return false;
      }

      return adapter.urlPatterns?.some((pattern) => pattern.test(url.pathname + url.search)) ?? true;
    }) ?? null
  );
}

function hostMatches(hostname: string, hosts: string[]): boolean {
  return hosts.some((host) => hostname === host || hostname.endsWith(`.${host}`));
}
