export type ManifestScopeSurface = 'content_scripts.matches' | 'host_permissions' | 'web_accessible_resources.matches';

export type ExternalMediaHostAllowlistEntry = {
  host: string;
  platform: string;
  purpose: string;
  allowedSurfaces: ManifestScopeSurface[];
};

export const EXTERNAL_MEDIA_HOST_ALLOWLIST: ExternalMediaHostAllowlistEntry[] = [
  {
    host: 'video.twimg.com',
    platform: 'x',
    purpose: 'X video and HLS playlist requests for embedded article media.',
    allowedSurfaces: ['host_permissions']
  },
  {
    host: 'pbs.twimg.com',
    platform: 'x',
    purpose: 'X image requests for article media and embedded tweet media.',
    allowedSurfaces: ['host_permissions']
  }
];
