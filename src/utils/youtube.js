export function normalizeYouTubeWatchUrl(rawUrl) {
  const value = typeof rawUrl === 'string' ? rawUrl.trim() : '';
  if (!value) return '';

  try {
    const u = new URL(value);
    const host = (u.hostname || '').toLowerCase();
    const toWatch = (id) => `https://www.youtube.com/watch?v=${encodeURIComponent(id)}`;

    if (host === 'youtu.be') {
      const id = (u.pathname || '').replace('/', '').trim();
      return id ? toWatch(id) : '';
    }
    if (host.includes('youtube.com') || host === 'm.youtube.com' || host === 'music.youtube.com') {
      if (u.pathname.startsWith('/watch')) {
        const id = (u.searchParams.get('v') || '').trim();
        return id ? toWatch(id) : '';
      }
      if (u.pathname.startsWith('/shorts/')) {
        const id = (u.pathname.split('/')[2] || '').trim();
        return id ? toWatch(id) : '';
      }
      if (u.pathname.startsWith('/embed/')) {
        const id = (u.pathname.split('/')[2] || '').trim();
        return id ? toWatch(id) : '';
      }
    }
  } catch (_) {
    return '';
  }

  return '';
}

export function getYouTubeVideoIdFromUrl(rawUrl) {
  const watchUrl = normalizeYouTubeWatchUrl(rawUrl);
  if (!watchUrl) return '';
  try {
    const u = new URL(watchUrl);
    return (u.searchParams.get('v') || '').trim();
  } catch (_) {
    return '';
  }
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
