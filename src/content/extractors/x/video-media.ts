import type { VideoBlock } from '../../../shared/article.js';
import type { CapturedXVideo } from '../../../shared/messages.js';

const AMPLIFY_VIDEO_ID_PATTERN = /amplify_video(?:_thumb)?\/(\d+)/;

export function matchCapturedVideo(video: HTMLVideoElement, capturedVideos: CapturedXVideo[]): CapturedXVideo | undefined {
  const candidates = [
    video.poster,
    video.getAttribute('poster') ?? '',
    video.currentSrc,
    video.src
  ];

  for (const candidate of candidates) {
    const videoId = getAmplifyVideoId(candidate);
    if (!videoId) {
      continue;
    }

    const matched = capturedVideos.find((item) => item.videoId === videoId);
    if (matched) {
      return matched;
    }
  }

  return capturedVideos.find((item) => item.poster && item.poster === video.poster);
}

export function buildVideoHlsPayload(video: CapturedXVideo | undefined): VideoBlock['hls'] | undefined {
  if (!video) {
    return undefined;
  }

  const masterPlaylistUrl = video.masterPlaylistUrl;
  const audioPlaylistUrl = pickAudioPlaylist(video);
  const videoPlaylists = Object.entries(video.videoPlaylists ?? {})
    .sort(([left], [right]) => compareResolutionLabel(right) - compareResolutionLabel(left))
    .map(([resolution, url]) => {
      const [width, height] = resolution.split('x').map((part) => Number(part));
      return {
        resolution,
        ...(Number.isFinite(width) ? { width } : {}),
        ...(Number.isFinite(height) ? { height } : {}),
        url
      };
    });

  if (!masterPlaylistUrl && !audioPlaylistUrl && videoPlaylists.length === 0) {
    return undefined;
  }

  return {
    masterPlaylistUrl,
    audioPlaylistUrl,
    videoPlaylists
  };
}

export function chooseCapturedVideoSource(video: CapturedXVideo | undefined, hls: VideoBlock['hls'] | undefined): string {
  if (hls?.masterPlaylistUrl) {
    return hls.masterPlaylistUrl;
  }

  if (!video) {
    return '';
  }

  const preferredVideo = hls?.videoPlaylists?.[0]?.url;
  if (preferredVideo) {
    return preferredVideo;
  }

  const resolutionEntries = Object.entries(video.videoPlaylists ?? {});
  if (resolutionEntries.length === 0) {
    return '';
  }

  return resolutionEntries
    .sort(([left], [right]) => compareResolutionLabel(right) - compareResolutionLabel(left))[0]?.[1] ?? '';
}

function getAmplifyVideoId(value: string | null | undefined): string | undefined {
  return value ? AMPLIFY_VIDEO_ID_PATTERN.exec(value)?.[1] : undefined;
}

function compareResolutionLabel(value: string): number {
  const [width, height] = value.split('x').map((part) => Number(part));
  return (Number.isFinite(width) ? width : 0) * (Number.isFinite(height) ? height : 0);
}

function pickAudioPlaylist(video: CapturedXVideo): string | undefined {
  const audioEntries = Object.entries(video.audioPlaylists ?? {});
  if (audioEntries.length === 0) {
    return undefined;
  }

  return audioEntries
    .sort(([left], [right]) => Number(right) - Number(left))[0]?.[1];
}
