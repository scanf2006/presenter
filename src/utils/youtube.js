import youtube from '../../shared/youtube.cjs';

export const { normalizeYouTubeWatchUrl, getYouTubeVideoIdFromUrl } = youtube;

export function getYouTubeVideoIdFromPayload(payload) {
  const directId = typeof payload?.videoId === 'string' ? payload.videoId.trim() : '';
  if (directId) return directId;
  return getYouTubeVideoIdFromUrl(payload?.url || '');
}

export function buildYouTubeEmbedUrl(payload) {
  const videoId = getYouTubeVideoIdFromPayload(payload);
  if (!videoId) return '';
  const origin = encodeURIComponent('https://www.youtube.com');
  return `https://www.youtube.com/embed/${videoId}?autoplay=1&controls=1&modestbranding=1&rel=0&playsinline=1&origin=${origin}&enablejsapi=1`;
}
