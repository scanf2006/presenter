function registerLocalMediaProtocol({
  protocol,
  resolveAbsolutePath,
  isPathWithinRoot,
  getAllowedRoots,
  logger = console,
}) {
  protocol.registerFileProtocol('local-media', (request, callback) => {
    try {
      const rawPath = decodeURIComponent(request.url.replace('local-media://', ''));
      const resolvedPath = resolveAbsolutePath(rawPath);
      const allowedRoots = getAllowedRoots();
      const isAllowed = !!resolvedPath && allowedRoots.some((root) => isPathWithinRoot(root, resolvedPath));

      if (!isAllowed) {
        logger.warn('[MediaProtocol] blocked path outside allowed roots:', resolvedPath);
        callback({ error: -10 }); // ACCESS_DENIED
        return;
      }

      callback({ path: resolvedPath });
    } catch (err) {
      logger.error('[MediaProtocol] resolve failed:', err.message);
      callback({ error: -324 }); // ERR_INVALID_URL
    }
  });
}

module.exports = {
  registerLocalMediaProtocol,
};
