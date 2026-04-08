function createMediaState() {
  let mediaDir = '';
  let mediaImagesDir = '';
  let mediaVideosDir = '';
  let mediaPdfDir = '';
  let mediaPptDir = '';
  let mediaYouTubeCacheDir = '';
  let ytdlpBinPath = '';

  function applyRuntimePaths(runtimePaths) {
    mediaDir = runtimePaths.mediaDir;
    mediaImagesDir = runtimePaths.mediaImagesDir;
    mediaVideosDir = runtimePaths.mediaVideosDir;
    mediaPdfDir = runtimePaths.mediaPdfDir;
    mediaPptDir = runtimePaths.mediaPptDir;
    mediaYouTubeCacheDir = runtimePaths.mediaYouTubeCacheDir;
    ytdlpBinPath = runtimePaths.ytdlpBinPath;
  }

  return {
    applyRuntimePaths,
    getMediaDir: () => mediaDir,
    getMediaImagesDir: () => mediaImagesDir,
    getMediaVideosDir: () => mediaVideosDir,
    getMediaPdfDir: () => mediaPdfDir,
    getMediaPptDir: () => mediaPptDir,
    getMediaYouTubeCacheDir: () => mediaYouTubeCacheDir,
    getYtDlpBinPath: () => ytdlpBinPath,
  };
}

module.exports = {
  createMediaState,
};
