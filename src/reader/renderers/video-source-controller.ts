import type { VideoBlock } from '../../shared/article-schema.js';

type HlsConstructor = {
  isSupported(): boolean;
  new (config?: Record<string, unknown>): {
    attachMedia(media: HTMLMediaElement): void;
    loadSource(source: string): void;
    destroy(): void;
  };
};

declare global {
  interface Window {
    Hls?: HlsConstructor;
  }
}

export function attachVideoSourceController(video: HTMLVideoElement, block: VideoBlock): () => void {
  const source = document.createElement('source');
  let cleanupBlobUrl: string | null = null;
  let hls: {
    loadSource(source: string): void;
    attachMedia(media: HTMLMediaElement): void;
    destroy(): void;
  } | null = null;

  const useNativeSource = (src: string) => {
    source.src = src;
    if (block.sourceType) {
      source.type = block.sourceType;
    }
    video.append(source);
    video.muted = block.transport !== 'hls';
  };

  if (block.transport !== 'hls') {
    useNativeSource(block.src);
    return () => undefined;
  }

  const hlsSource = resolveHlsSource(block);
  const Hls = window.Hls;

  if (Hls && Hls.isSupported() && hlsSource) {
    hls = new Hls({
      enableWorker: true,
      lowLatencyMode: false,
      maxBufferLength: 60
    });
    hls.attachMedia(video);
    hls.loadSource(hlsSource.source);
    video.muted = true;
    video.defaultMuted = true;
    cleanupBlobUrl = hlsSource.revokeUrl ?? null;
    return () => {
      if (hls) {
        hls.destroy();
        hls = null;
      }
      if (cleanupBlobUrl) {
        URL.revokeObjectURL(cleanupBlobUrl);
        cleanupBlobUrl = null;
      }
    };
  }

  useNativeSource(block.src);
  return () => {
    if (cleanupBlobUrl) {
      URL.revokeObjectURL(cleanupBlobUrl);
      cleanupBlobUrl = null;
    }
  };
}

function resolveHlsSource(block: VideoBlock): { source: string; revokeUrl?: string } | null {
  if (block.hls?.masterPlaylistUrl) {
    return { source: block.hls.masterPlaylistUrl };
  }

  const masterPlaylist = generateMasterPlaylist(block);
  if (!masterPlaylist) {
    return block.src ? { source: block.src } : null;
  }

  const blob = new Blob([masterPlaylist], { type: 'application/vnd.apple.mpegurl' });
  const source = URL.createObjectURL(blob);
  return {
    source,
    revokeUrl: source
  };
}

function generateMasterPlaylist(block: VideoBlock): string | null {
  const audioPlaylistUrl = block.hls?.audioPlaylistUrl;
  const videoPlaylists = block.hls?.videoPlaylists ?? [];
  if (!audioPlaylistUrl || videoPlaylists.length === 0) {
    return null;
  }

  let masterPlaylist = `#EXTM3U
#EXT-X-VERSION:6
#EXT-X-INDEPENDENT-SEGMENTS
#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="audio",NAME="Main",DEFAULT=YES,AUTOSELECT=YES,LANGUAGE="und",URI="${audioPlaylistUrl}"

`;

  for (const playlist of videoPlaylists) {
    const bandwidth = estimateBandwidth(playlist.width, playlist.height);
    const resolution = playlist.width && playlist.height ? `,RESOLUTION=${playlist.width}x${playlist.height}` : '';
    masterPlaylist += `#EXT-X-STREAM-INF:BANDWIDTH=${bandwidth},CODECS="avc1.42c00d,mp4a.40.2"${resolution},AUDIO="audio"
${playlist.url}

`;
  }

  return masterPlaylist;
}

function estimateBandwidth(width?: number, height?: number): number {
  const safeWidth = Number.isFinite(width) ? Number(width) : 640;
  const safeHeight = Number.isFinite(height) ? Number(height) : 360;
  return Math.max(128000, Math.floor(safeWidth * safeHeight * 3));
}
