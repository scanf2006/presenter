function createSessionHooks({ session, logger = console }) {
  let youtubeHeaderHookInstalled = false;

  function setupYouTubeRequestHeaders() {
    if (youtubeHeaderHookInstalled) return;

    const ses = session.defaultSession;
    if (!ses || !ses.webRequest) return;

    const youtubeFilter = {
      urls: [
        'https://www.youtube.com/*',
        'https://*.youtube.com/*',
        'https://*.googlevideo.com/*',
        'https://i.ytimg.com/*',
        'https://yt3.ggpht.com/*',
        'https://*.ytimg.com/*',
      ],
    };

    ses.webRequest.onBeforeSendHeaders(youtubeFilter, (details, callback) => {
      const headers = { ...(details.requestHeaders || {}) };
      const resourceType = details.resourceType || '';
      let hostname = '';
      let pathname = '';
      try {
        const u = new URL(details.url);
        hostname = (u.hostname || '').toLowerCase();
        pathname = u.pathname || '';
      } catch (_) {}

      const isMediaOrXhr = resourceType === 'media' || resourceType === 'xhr' || resourceType === 'fetch';
      const isGoogleVideo = hostname.endsWith('.googlevideo.com');
      const isYtStatic = hostname.endsWith('.ytimg.com') || hostname === 'i.ytimg.com' || hostname === 'yt3.ggpht.com';
      const isEmbedPath = pathname.startsWith('/embed/');

      // Only patch media/embed requests; do not affect watch-page document requests.
      if ((isMediaOrXhr && (isGoogleVideo || isYtStatic)) || isEmbedPath) {
        if (!headers.Referer) headers.Referer = 'https://www.youtube.com/';
        if (!headers.Origin) headers.Origin = 'https://www.youtube.com';
        if (!headers['User-Agent']) {
          headers['User-Agent'] =
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
        }
      }

      callback({ requestHeaders: headers });
    });

    youtubeHeaderHookInstalled = true;
  }

  function setupMediaPermissionHandlers() {
    try {
      const ses = session.defaultSession;
      if (!ses) return;
      ses.setPermissionRequestHandler((_webContents, permission, callback) => {
        if (permission === 'media' || permission === 'camera' || permission === 'microphone') {
          callback(true);
          return;
        }
        callback(false);
      });
    } catch (err) {
      logger.warn('[MediaPermission] setup failed:', err.message);
    }
  }

  return {
    setupYouTubeRequestHeaders,
    setupMediaPermissionHandlers,
  };
}

module.exports = {
  createSessionHooks,
};
