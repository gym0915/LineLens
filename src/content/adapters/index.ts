import type { PlatformAdapter } from './adapter-types.js';
import { weixinArticleAdapter } from './weixin-article-adapter.js';
import { xArticleAdapter } from './x-article-adapter.js';

export type { PlatformAdapter, PlatformAdapterUserConfig, PlatformFix, PlatformFixId } from './adapter-types.js';
export { weixinArticleAdapter } from './weixin-article-adapter.js';
export { xArticleAdapter } from './x-article-adapter.js';

export const BUILT_IN_PLATFORM_ADAPTERS: PlatformAdapter[] = [xArticleAdapter, weixinArticleAdapter];

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
