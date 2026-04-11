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
      } catch (_err) {
        hostname = '';
        pathname = '';
      }

      const isMediaOrXhr =
        resourceType === 'media' || resourceType === 'xhr' || resourceType === 'fetch';
      const isGoogleVideo = hostname.endsWith('.googlevideo.com');
      const isYtStatic =
        hostname.endsWith('.ytimg.com') ||
        hostname === 'i.ytimg.com' ||
        hostname === 'yt3.ggpht.com';
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

  // H4: Only grant camera/microphone to the app's own origin, not to all content.
  function setupMediaPermissionHandlers() {
    try {
      const ses = session.defaultSession;
      if (!ses) return;
      ses.setPermissionRequestHandler((webContents, permission, callback) => {
        if (permission === 'media' || permission === 'camera' || permission === 'microphone') {
          try {
            const url = webContents.getURL();
            const isLocalApp = url.startsWith('file://') || url.startsWith('http://localhost');
            callback(isLocalApp);
          } catch (_) {
            callback(false);
          }
          return;
        }
        callback(false);
      });
    } catch (err) {
      logger.warn('[MediaPermission] setup failed:', err.message);
    }
  }

  // H5: Inject Content Security Policy headers for all pages.
  function setupContentSecurityPolicy() {
    try {
      const ses = session.defaultSession;
      if (!ses || !ses.webRequest) return;
      ses.webRequest.onHeadersReceived((details, callback) => {
        callback({
          responseHeaders: {
            ...details.responseHeaders,
            'Content-Security-Policy': [
              "default-src 'self' local-media:; " +
                "script-src 'self' 'unsafe-inline'; " +
                "style-src 'self' 'unsafe-inline'; " +
                "img-src 'self' local-media: data: https://i.ytimg.com https://*.ytimg.com; " +
                "media-src 'self' local-media: https://*.googlevideo.com blob:; " +
                "frame-src 'self' https://www.youtube.com; " +
                "connect-src 'self' https://www.youtube.com https://*.youtube.com https://*.googlevideo.com; " +
                "font-src 'self' data:;",
            ],
          },
        });
      });
    } catch (err) {
      logger.warn('[CSP] setup failed:', err.message);
    }
  }

  return {
    setupYouTubeRequestHeaders,
    setupMediaPermissionHandlers,
    setupContentSecurityPolicy,
  };
}

module.exports = {
  createSessionHooks,
};
