import { useCallback } from 'react';
import { normalizeYouTubeWatchUrl, getYouTubeVideoIdFromPayload, buildYouTubeEmbedUrl } from '../utils/youtube';
import { downloadTauriYouTube, isTauriRuntime } from '../utils/tauriProjector';

export default function useYouTubeProjection() {
  const normalizeYouTubeUrl = useCallback((payload) => {
    const direct = payload?.url?.trim();
    if (direct) {
      return normalizeYouTubeWatchUrl(direct) || direct;
    }
    const vid = payload?.videoId?.trim();
    return vid ? `https://www.youtube.com/watch?v=${encodeURIComponent(vid)}` : '';
  }, []);

  const getYouTubeVideoId = useCallback((payload) => getYouTubeVideoIdFromPayload(payload), []);

  const getYouTubeEmbedUrl = useCallback((payload) => buildYouTubeEmbedUrl(payload), []);

  const resolveYouTubePayload = useCallback(async (payload) => {
    if (!payload || payload.type !== 'youtube') return payload;

    const inputUrl = normalizeYouTubeUrl(payload);

    // Queue items may carry a warm cache path from queue-time pre-download.
    // Use it directly only when no recoverable URL/ID is available.
    if (payload.cachedLocalPath && !inputUrl) {
      return {
        type: 'video',
        path: payload.cachedLocalPath,
        name: payload.cachedTitle || payload.name || 'YouTube Video',
        source: 'youtube-cache',
        videoId: payload.videoId || '',
        originalUrl: payload.url || '',
      };
    }

    if (!inputUrl) return payload;

    if (isTauriRuntime()) {
      const resolved = await downloadTauriYouTube(inputUrl);
      if (!resolved?.success || !resolved?.localPath) {
        throw new Error(resolved?.error || 'YouTube cache download failed.');
      }
      return {
        type: 'video',
        path: resolved.localPath,
        name: resolved.title || payload.name || 'YouTube Video',
        source: 'youtube-cache',
        videoId: resolved.videoId || payload.videoId || '',
        originalUrl: resolved.originalUrl || inputUrl,
      };
    }

    return {
      type: 'youtube',
      videoId: payload.videoId || '',
      url: inputUrl,
      name: payload.name || 'YouTube',
      youtubeMode: 'watch-page',
    };
  }, [normalizeYouTubeUrl]);

  return {
    normalizeYouTubeUrl,
    getYouTubeVideoId,
    getYouTubeEmbedUrl,
    resolveYouTubePayload,
  };
}
