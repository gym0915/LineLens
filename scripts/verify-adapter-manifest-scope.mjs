import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  BUILT_IN_PLATFORM_ADAPTERS,
  EXTERNAL_MEDIA_HOST_ALLOWLIST
} from '../dist/content/adapters/index.js';

const repoRoot = resolve(import.meta.dirname, '..');
const manifest = JSON.parse(readFileSync(resolve(repoRoot, 'dist/manifest.json'), 'utf8'));

const fixtureOnlyAdapterIds = new Set(['fixture.article']);
const externalMediaHostEntries = new Map(EXTERNAL_MEDIA_HOST_ALLOWLIST.map((entry) => [entry.host, entry]));

const contentMatches = manifest.content_scripts?.flatMap((script) => script.matches ?? []) ?? [];
const hostPermissions = manifest.host_permissions ?? [];
const webAccessibleMatches = manifest.web_accessible_resources?.flatMap((entry) => entry.matches ?? []) ?? [];

assert(contentMatches.length > 0, 'manifest should declare content script matches');
assert(hostPermissions.length > 0, 'manifest should declare host_permissions');
assert(webAccessibleMatches.length > 0, 'manifest should declare web_accessible_resources matches');
assert(EXTERNAL_MEDIA_HOST_ALLOWLIST.length > 0, 'external media host allowlist should be explicit and non-empty');

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

for (const entry of EXTERNAL_MEDIA_HOST_ALLOWLIST) {
  assert.equal(typeof entry.host, 'string', 'external media allowlist entries should declare host');
  assert.match(entry.host, /^[a-z0-9.-]+$/, `external media host should be a concrete hostname: ${entry.host}`);
  assert.equal(typeof entry.platform, 'string', `external media host ${entry.host} should declare owner platform`);
  assert.equal(typeof entry.purpose, 'string', `external media host ${entry.host} should declare purpose`);
  assert(entry.purpose.length > 20, `external media host ${entry.host} should have an auditable purpose`);
  assert(entry.allowedSurfaces.length > 0, `external media host ${entry.host} should declare allowed manifest surfaces`);
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

for (const adapter of BUILT_IN_PLATFORM_ADAPTERS.filter((candidate) => fixtureOnlyAdapterIds.has(candidate.id))) {
  for (const host of adapter.hosts) {
    assert.equal(
      matchListCoversHost([...contentMatches, ...hostPermissions, ...webAccessibleMatches], host),
      false,
      `fixture-only adapter host ${host} should not appear in production manifest scope`
    );
  }
}

for (const [surfaceName, matches] of [
  ['content_scripts.matches', contentMatches],
  ['host_permissions', hostPermissions],
  ['web_accessible_resources.matches', webAccessibleMatches]
]) {
  for (const match of matches) {
    const hostPattern = parseManifestHost(match);
    if (!hostPattern) continue;

    const externalMediaEntry = externalMediaHostEntries.get(hostPattern.host);
    if (externalMediaEntry) {
      assert.equal(
        hostPattern.includesSubdomains,
        false,
        `external media host ${match} should not use subdomain wildcards`
      );
      assert(
        externalMediaEntry.allowedSurfaces.includes(surfaceName),
        `external media host ${match} should only appear in allowlisted manifest surfaces`
      );
      continue;
    }

    assert(
      [...adapterHosts].some((adapterHost) => manifestHostCoversAdapterHost(hostPattern, adapterHost)),
      `manifest scope ${match} should correspond to an enabled built-in adapter host`
    );
  }
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
