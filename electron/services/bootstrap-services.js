const path = require('path');
const fs = require('fs');

function resolveBibleDataDir({ electronDir, logger = console }) {
  const candidateDirs = [];

  // Packaged app: <install>/resources/data
  if (process.resourcesPath) {
    candidateDirs.push(path.join(process.resourcesPath, 'data'));
  }

  // Dev fallback: repo/data
  candidateDirs.push(path.join(electronDir, '..', 'data'));

  for (const dir of candidateDirs) {
    const cuvsPath = path.join(dir, 'bible_cuvs.db');
    const kjvPath = path.join(dir, 'bible_kjv.db');
    if (fs.existsSync(cuvsPath) || fs.existsSync(kjvPath)) {
      logger.log(`[BibleDB] using data directory: ${dir}`);
      return dir;
    }
  }

  const fallback = candidateDirs[candidateDirs.length - 1];
  logger.warn(`[BibleDB] data directory not found, fallback to: ${fallback}`);
  return fallback;
}

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
  const bibleDataDir = resolveBibleDataDir({ electronDir, logger });

  await initBibleAndSongsDatabases({
    initSqlJs,
    userDataDir,
    dataDir: bibleDataDir,
    dbStore,
    logger,
  });
}

module.exports = {
  bootstrapCoreServices,
};
