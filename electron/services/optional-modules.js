function safeRequire(moduleName) {
  try {
    return require(moduleName);
  } catch (_) {
    return null;
  }
}

function loadOptionalMediaModules() {
  const ytdl = safeRequire('@distube/ytdl-core');
  const playDl = safeRequire('play-dl');

  let YTDlpWrap = null;
  try {
    const mod = require('yt-dlp-wrap');
    YTDlpWrap = mod.default || mod;
  } catch (_) {
    YTDlpWrap = null;
  }

  return {
    ytdl,
    playDl,
    YTDlpWrap,
  };
}

module.exports = {
  loadOptionalMediaModules,
};
