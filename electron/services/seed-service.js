const fs = require('fs');
const path = require('path');

function resolveBundledSeedDir(app) {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'data-seed');
  }
  return path.resolve(__dirname, '..', '..', 'data', 'seed');
}

function safeCopyIfMissing(src, dest) {
  if (!fs.existsSync(src)) return false;
  if (fs.existsSync(dest)) return false;
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
  return true;
}

function safeCopyDirIfTargetEmpty(srcDir, destDir) {
  if (!fs.existsSync(srcDir)) return false;
  const srcStat = fs.statSync(srcDir);
  if (!srcStat.isDirectory()) return false;

  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(path.dirname(destDir), { recursive: true });
    fs.cpSync(srcDir, destDir, { recursive: true });
    return true;
  }

  const existing = fs.readdirSync(destDir);
  if (existing.length > 0) return false;
  fs.cpSync(srcDir, destDir, { recursive: true });
  return true;
}

function hydrateUserDataFromBundledSeed(app, markerName = '.seed-applied-v1', logger = console) {
  try {
    const userDataDir = app.getPath('userData');
    const seedDir = resolveBundledSeedDir(app);
    const markerPath = path.join(userDataDir, markerName);

    if (!fs.existsSync(seedDir)) return;
    if (fs.existsSync(markerPath)) return;

    fs.mkdirSync(userDataDir, { recursive: true });

    let copiedAny = false;
    copiedAny =
      safeCopyIfMissing(
        path.join(seedDir, 'app-settings.json'),
        path.join(userDataDir, 'app-settings.json')
      ) || copiedAny;
    copiedAny =
      safeCopyIfMissing(
        path.join(seedDir, 'projector-queue.json'),
        path.join(userDataDir, 'projector-queue.json')
      ) || copiedAny;
    copiedAny =
      safeCopyIfMissing(path.join(seedDir, 'songs.db'), path.join(userDataDir, 'songs.db')) ||
      copiedAny;
    copiedAny =
      safeCopyDirIfTargetEmpty(path.join(seedDir, 'media'), path.join(userDataDir, 'media')) ||
      copiedAny;

    // C4: Resolve relative paths in seed queue to absolute paths for this machine.
    const queuePath = path.join(userDataDir, 'projector-queue.json');
    try {
      if (fs.existsSync(queuePath)) {
        const raw = fs.readFileSync(queuePath, 'utf8');
        const queue = JSON.parse(raw);
        if (Array.isArray(queue)) {
          const resolveMediaPath = (p) => {
            if (!p || typeof p !== 'string') return p;
            // Already absolute — leave as-is
            if (path.isAbsolute(p)) return p;
            return path.join(userDataDir, p);
          };
          for (const item of queue) {
            if (item?.payload?.path) {
              item.payload.path = resolveMediaPath(item.payload.path);
            }
            if (item?.payload?.background?.path) {
              item.payload.background.path = resolveMediaPath(item.payload.background.path);
            }
          }
          fs.writeFileSync(queuePath, JSON.stringify(queue, null, 2), 'utf8');
        }
      }
    } catch (queueErr) {
      logger.warn('[SeedHydrate] Failed to resolve queue paths:', queueErr.message);
    }

    fs.writeFileSync(
      markerPath,
      JSON.stringify(
        {
          appliedAt: new Date().toISOString(),
          copiedAny,
          seedDir,
        },
        null,
        2
      ),
      'utf8'
    );

    logger.log(`[SeedHydrate] completed. copiedAny=${copiedAny}`);
  } catch (err) {
    logger.warn('[SeedHydrate] failed:', err.message);
  }
}

module.exports = {
  hydrateUserDataFromBundledSeed,
};
