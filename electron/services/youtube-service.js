function normalizeYouTubeWatchUrl(rawUrl) {
  try {
    const u = new URL(rawUrl);
    const host = u.hostname.toLowerCase();
    const toWatch = (id) => `https://www.youtube.com/watch?v=${encodeURIComponent(id)}`;

    if (host === 'youtu.be') {
      const id = u.pathname.replace('/', '').trim();
      if (!id) return null;
      return toWatch(id);
    }
    if (host.includes('youtube.com') || host === 'm.youtube.com' || host === 'music.youtube.com') {
      if (u.pathname.startsWith('/watch')) {
        const id = (u.searchParams.get('v') || '').trim();
        return id ? toWatch(id) : null;
      }
      if (u.pathname.startsWith('/shorts/')) {
        const id = (u.pathname.split('/')[2] || '').trim();
        return id ? toWatch(id) : null;
      }
      if (u.pathname.startsWith('/embed/')) {
        const id = (u.pathname.split('/')[2] || '').trim();
        return id ? toWatch(id) : null;
      }
    }
  } catch (_) {
    return null;
  }
  return null;
}

function createYouTubeResolver({ playDl, ytdl }) {
  // R3-M: Timeout for YouTube resolution to prevent indefinite hangs.
  const RESOLVE_TIMEOUT_MS = 30000;

  return async function resolveYouTubeStream(rawUrl) {
    const raw = typeof rawUrl === 'string' ? rawUrl.trim() : '';
    if (!raw) {
      return { success: false, error: 'YouTube URL is required.' };
    }

    let lastError = '';

    // Helper: race a promise against a timeout.
    const withTimeout = (promise, ms) =>
      Promise.race([
        promise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('Request timed out')), ms)),
      ]);

    // Resolver #1: play-dl (primary).
    if (playDl) {
      try {
        const info2 = await withTimeout(playDl.video_info(raw), RESOLVE_TIMEOUT_MS);
        const formats = Array.isArray(info2?.format) ? info2.format : [];
        const progressive = formats.filter((fmt) => {
          const mime = String(fmt?.mimeType || '').toLowerCase();
          return !!fmt?.url && mime.includes('video/mp4') && mime.includes('mp4a');
        });
        const ranked2 = progressive.sort((a, b) => Number(b.height || 0) - Number(a.height || 0));
        const selected2 = ranked2[0] || formats.find((fmt) => !!fmt?.url);

        if (selected2?.url) {
          return {
            success: true,
            streamUrl: selected2.url,
            title: info2?.video_details?.title || '',
            videoId: info2?.video_details?.id || '',
            originalUrl: raw,
          };
        }
      } catch (err) {
        lastError = err?.message || 'play-dl resolver failed';
      }
    }

    // Resolver #2: ytdl-core (fallback).
    if (ytdl && ytdl.validateURL(raw)) {
      try {
        const info = await withTimeout(
          ytdl.getInfo(raw, {
            requestOptions: {
              headers: {
                referer: 'https://www.youtube.com/',
                origin: 'https://www.youtube.com',
                'user-agent':
                  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
              },
            },
          }),
          RESOLVE_TIMEOUT_MS
        );

        const candidates = info.formats.filter(
          (fmt) => !!fmt.url && fmt.hasVideo && fmt.hasAudio && !fmt.isHLS
        );
        const mp4Candidates = candidates.filter(
          (fmt) => (fmt.container || '').toLowerCase() === 'mp4'
        );
        const ranked = (mp4Candidates.length > 0 ? mp4Candidates : candidates).sort((a, b) => {
          const ah = Number(a.height || 0);
          const bh = Number(b.height || 0);
          if (ah !== bh) return bh - ah;
          return Number(b.bitrate || 0) - Number(a.bitrate || 0);
        });
        const selected = ranked[0];

        if (selected?.url) {
          return {
            success: true,
            streamUrl: selected.url,
            title: info.videoDetails?.title || '',
            videoId: info.videoDetails?.videoId || '',
            originalUrl: raw,
          };
        }
      } catch (err) {
        lastError = lastError
          ? `${lastError}; ${err?.message || 'ytdl resolver failed'}`
          : err?.message || 'ytdl resolver failed';
      }
    }

    return {
      success: false,
      error: lastError || 'No playable stream found for this video.',
    };
  };
}

module.exports = {
  normalizeYouTubeWatchUrl,
  createYouTubeResolver,
};
