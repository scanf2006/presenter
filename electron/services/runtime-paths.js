const path = require('path');

function buildRuntimePaths(userDataDir) {
  const mediaDir = path.join(userDataDir, 'media');
  return {
    mediaDir,
    mediaImagesDir: path.join(mediaDir, 'images'),
    mediaVideosDir: path.join(mediaDir, 'videos'),
    mediaPdfDir: path.join(mediaDir, 'pdf'),
    mediaPptDir: path.join(mediaDir, 'ppt'),
    mediaYouTubeCacheDir: path.join(mediaDir, 'youtube-cache'),
    ytdlpBinPath: path.join(userDataDir, 'tools', 'yt-dlp.exe'),
  };
}

module.exports = {
  buildRuntimePaths,
};
