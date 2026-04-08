const fs = require('fs');
const path = require('path');

function resolveAbsolutePath(rawPath) {
  if (typeof rawPath !== 'string' || !rawPath.trim()) return null;
  try {
    return path.resolve(rawPath);
  } catch (_) {
    return null;
  }
}

function normalizeForCompare(p) {
  return process.platform === 'win32' ? p.toLowerCase() : p;
}

function isPathWithinRoot(rootDir, targetPath) {
  let root = resolveAbsolutePath(rootDir);
  let target = resolveAbsolutePath(targetPath);
  if (!root || !target) return false;
  try {
    if (fs.existsSync(root)) root = fs.realpathSync.native(root);
  } catch (_) {}
  try {
    if (fs.existsSync(target)) target = fs.realpathSync.native(target);
  } catch (_) {}
  const rel = path.relative(root, target);
  if (!rel) return true;
  const outside = rel.startsWith('..') || path.isAbsolute(rel);
  return !outside;
}

function isLikelyMediaFilePath(filePath) {
  if (typeof filePath !== 'string') return false;
  const ext = path.extname(filePath).toLowerCase();
  return ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg', '.mp4', '.webm', '.mkv', '.avi', '.mov', '.pdf', '.ppt', '.pptx'].includes(ext);
}

function normalizeWithin(baseDir, filePath) {
  const resolvedBase = path.resolve(baseDir);
  const resolvedPath = path.resolve(filePath);
  return resolvedPath.startsWith(resolvedBase + path.sep) ? resolvedPath : null;
}

module.exports = {
  resolveAbsolutePath,
  normalizeForCompare,
  isPathWithinRoot,
  isLikelyMediaFilePath,
  normalizeWithin,
};
