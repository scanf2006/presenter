const path = require('path');

async function bootstrapCoreServices({
  protocol,
  registerLocalMediaProtocol,
  resolveAbsolutePath,
  isPathWithinRoot,
  mediaDir,
  userDataDir,
  logger = console,
  initBibleAndSongsDatabases,
  initSqlJs,
  dbStore,
  electronDir,
}) {
  registerLocalMediaProtocol({
    protocol,
    resolveAbsolutePath,
    isPathWithinRoot,
    getAllowedRoots: () => [mediaDir, userDataDir],
    logger,
  });

  await initBibleAndSongsDatabases({
    initSqlJs,
    userDataDir,
    dataDir: path.join(electronDir, '..', 'data'),
    dbStore,
    logger,
  });
}

module.exports = {
  bootstrapCoreServices,
};
