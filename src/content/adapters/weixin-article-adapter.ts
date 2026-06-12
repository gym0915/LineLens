import type { PlatformAdapter } from './adapter-types.js';

export const weixinArticleAdapter: PlatformAdapter = {
  id: 'weixin.article',
  platform: 'weixin',
  contentType: 'article',
  hosts: ['weixin.qq.com', 'mp.weixin.qq.com'],
  urlPatterns: [/^\/s\//, /^\/s\?/],
  enabled: false,
  rootSelector: '#js_content',
  titleSelector: '#activity-name',
  contentSelector: '#js_content',
  fixes: [],
  enabledFixes: [],
  styleWhitelist: {
    preserveProps: ['font-weight', 'font-style', 'text-align'],
    preserveColorFor: ['link', 'inline-emphasis', 'custom-selector'],
    preserveWhiteSpaceValues: ['pre', 'pre-wrap'],
    customColorSelectors: ['strong', 'em']
  }
};
