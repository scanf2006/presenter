const fs = require('fs');

function ensureMediaDirs(dirs, logger = console) {
  dirs.forEach((dir) => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
  if (dirs[0]) {
    logger.log(`[MediaManager] Media directory initialized: ${dirs[0]}`);
  }
}

function sanitizeMediaFileName(input) {
  return String(input || '')
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
}

module.exports = {
  ensureMediaDirs,
  sanitizeMediaFileName,
};
