import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { BUILT_IN_PLATFORM_ADAPTERS } from '../dist/content/adapters/index.js';

const repoRoot = resolve(import.meta.dirname, '..');
const manifest = JSON.parse(readFileSync(resolve(repoRoot, 'dist/manifest.json'), 'utf8'));

const fixtureOnlyAdapterIds = new Set(['fixture.article']);
const allowedExternalHosts = new Set(['video.twimg.com', 'pbs.twimg.com']);

const contentMatches = manifest.content_scripts?.flatMap((script) => script.matches ?? []) ?? [];
const hostPermissions = manifest.host_permissions ?? [];
const webAccessibleMatches = manifest.web_accessible_resources?.flatMap((entry) => entry.matches ?? []) ?? [];

assert(contentMatches.length > 0, 'manifest should declare content script matches');
assert(hostPermissions.length > 0, 'manifest should declare host_permissions');
assert(webAccessibleMatches.length > 0, 'manifest should declare web_accessible_resources matches');

for (const [surfaceName, matches] of [
  ['content_scripts.matches', contentMatches],
  ['host_permissions', hostPermissions],
  ['web_accessible_resources.matches', webAccessibleMatches]
]) {
  for (const match of matches) {
    assert.doesNotMatch(match, /^<all_urls>$/, `${surfaceName} should not use <all_urls>`);
    assert.doesNotMatch(match, /^\*:\/\/\*\/\*$/, `${surfaceName} should not use a global scheme/host wildcard`);
    assert.match(match, /^https:\/\/[^/]+\/.*$/, `${surfaceName} should stay on explicit https origins: ${match}`);
  }
}

for (const adapter of BUILT_IN_PLATFORM_ADAPTERS) {
  if (!adapter.enabled || fixtureOnlyAdapterIds.has(adapter.id)) {
    continue;
  }

  for (const host of adapter.hosts) {
    assert(
      matchListCoversHost(contentMatches, host),
      `${adapter.id} host ${host} should be covered by manifest content_scripts.matches`
    );
    assert(
      matchListCoversHost(hostPermissions, host),
      `${adapter.id} host ${host} should be covered by manifest host_permissions`
    );
    assert(
      matchListCoversHost(webAccessibleMatches, host),
      `${adapter.id} host ${host} should be covered by manifest web_accessible_resources.matches`
    );
  }
}

const adapterHosts = new Set(
  BUILT_IN_PLATFORM_ADAPTERS
    .filter((adapter) => adapter.enabled && !fixtureOnlyAdapterIds.has(adapter.id))
    .flatMap((adapter) => adapter.hosts)
);

for (const match of [...contentMatches, ...hostPermissions, ...webAccessibleMatches]) {
  const hostPattern = parseManifestHost(match);
  if (!hostPattern) continue;
  if (allowedExternalHosts.has(hostPattern.host)) continue;

  assert(
    [...adapterHosts].some((adapterHost) => manifestHostCoversAdapterHost(hostPattern, adapterHost)),
    `manifest scope ${match} should correspond to an enabled built-in adapter host`
  );
}

console.log('verify:adapter-manifest-scope passed');

function matchListCoversHost(matches, host) {
  return matches.some((match) => {
    const hostPattern = parseManifestHost(match);
    return hostPattern ? manifestHostCoversAdapterHost(hostPattern, host) : false;
  });
}

function parseManifestHost(match) {
  const parsed = /^https:\/\/([^/]+)\/.*$/.exec(match);
  if (!parsed) return null;
  const host = parsed[1];
  if (host === '*') {
    return { host, includesSubdomains: true };
  }
  if (host.startsWith('*.')) {
    return { host: host.slice(2), includesSubdomains: true };
  }
  return { host, includesSubdomains: false };
}

function manifestHostCoversAdapterHost(hostPattern, adapterHost) {
  if (hostPattern.host === adapterHost) {
    return true;
  }
  return hostPattern.includesSubdomains && adapterHost.endsWith(`.${hostPattern.host}`);
}
