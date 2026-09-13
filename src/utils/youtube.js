export function normalizeYouTubeWatchUrl(rawUrl) {
  const value = typeof rawUrl === 'string' ? rawUrl.trim() : '';
  if (!value) return '';
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    const toWatchUrl = (videoId) =>
      videoId ? `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}` : '';
    if (host === 'youtu.be') return toWatchUrl(url.pathname.slice(1).trim());
    if (host.includes('youtube.com')) {
      if (url.pathname.startsWith('/watch')) return toWatchUrl((url.searchParams.get('v') || '').trim());
      if (url.pathname.startsWith('/shorts/') || url.pathname.startsWith('/embed/')) {
        return toWatchUrl((url.pathname.split('/')[2] || '').trim());
      }
    }
  } catch (_) {
    return '';
  }
  return '';
}

export function getYouTubeVideoIdFromUrl(rawUrl) {
  const watchUrl = normalizeYouTubeWatchUrl(rawUrl);
  return watchUrl ? new URL(watchUrl).searchParams.get('v') || '' : '';
}

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
