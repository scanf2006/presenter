const fs = require('fs');
const path = require('path');
const { isLikelyMediaFilePath, normalizeWithin } = require('./path-utils');

function collectReferencedMediaPathsFromQueue(queue, mediaRootDir) {
  const refs = new Set();
  const missingRefs = [];
  const visited = new Set();

  const walk = (node) => {
    if (!node) return;
    if (typeof node === 'string') {
      if (isLikelyMediaFilePath(node)) {
        const safe = normalizeWithin(mediaRootDir, node);
        if (safe) refs.add(safe);
      }
      return;
    }
    if (typeof node !== 'object') return;
    if (visited.has(node)) return;
    visited.add(node);

    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }

    for (const [key, value] of Object.entries(node)) {
      if (typeof value === 'string') {
        if ((key === 'path' || key === 'backgroundPath' || key === 'filePath' || key === 'cachedPath' || key === 'localPath') && isLikelyMediaFilePath(value)) {
          const safe = normalizeWithin(mediaRootDir, value);
          if (safe) refs.add(safe);
        }
        continue;
      }
      walk(value);
    }
  };

  if (Array.isArray(queue)) {
    queue.forEach((item) => walk(item?.payload || item));
  }

  const existing = [];
  for (const p of refs) {
    try {
      if (fs.existsSync(p) && fs.statSync(p).isFile()) {
        existing.push(p);
      } else {
        missingRefs.push(p);
      }
    } catch (_) {
      missingRefs.push(p);
    }
  }
  return { existing, missingRefs };
}

function copyDirectoryMerge(srcDir, destDir, stats) {
  if (!fs.existsSync(srcDir)) return;
  fs.mkdirSync(destDir, { recursive: true });
  const entries = fs.readdirSync(srcDir, { withFileTypes: true });
  for (const entry of entries) {
    const src = path.join(srcDir, entry.name);
    const dst = path.join(destDir, entry.name);
    if (entry.isDirectory()) {
      copyDirectoryMerge(src, dst, stats);
      continue;
    }
    if (!entry.isFile()) continue;
    if (fs.existsSync(dst)) {
      stats.skippedCount += 1;
      continue;
    }
    try {
      fs.mkdirSync(path.dirname(dst), { recursive: true });
      fs.copyFileSync(src, dst);
      const sz = fs.statSync(src).size || 0;
      stats.copiedCount += 1;
      stats.totalBytes += sz;
    } catch (err) {
      stats.warnings.push(`Failed to copy ${src}: ${err.message}`);
    }
  }
}

module.exports = {
  collectReferencedMediaPathsFromQueue,
  copyDirectoryMerge,
};
