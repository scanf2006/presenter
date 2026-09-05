function normalizeYouTubeWatchUrl(rawUrl) {
  const value = typeof rawUrl === 'string' ? rawUrl.trim() : '';
  if (!value) return '';
  try {
    const u = new URL(value);
    const host = (u.hostname || '').toLowerCase();
    const toWatch = (id) => {
      const value = String(id || '').trim();
      return value ? `https://www.youtube.com/watch?v=${encodeURIComponent(value)}` : '';
    };
    if (host === 'youtu.be') {
      const id = (u.pathname || '').replace('/', '').trim();
      return id ? toWatch(id) : '';
    }
    if (host.includes('youtube.com') || host === 'm.youtube.com' || host === 'music.youtube.com') {
      if (u.pathname.startsWith('/watch')) return toWatch((u.searchParams.get('v') || '').trim());
      if (u.pathname.startsWith('/shorts/') || u.pathname.startsWith('/embed/')) {
        return toWatch((u.pathname.split('/')[2] || '').trim());
      }
    }
  } catch (_) {
    return '';
  }
  return '';
}

function getYouTubeVideoIdFromUrl(rawUrl) {
  const watchUrl = normalizeYouTubeWatchUrl(rawUrl);
  if (!watchUrl) return '';
  return new URL(watchUrl).searchParams.get('v') || '';
}

module.exports = { normalizeYouTubeWatchUrl, getYouTubeVideoIdFromUrl };
