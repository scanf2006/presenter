/**
 * ChurchDisplay Pro - Electron 主进程
 * 负责多窗口管理、多屏检测和 IPC 通信
 */
const { app, BrowserWindow, screen, ipcMain, dialog, protocol, session } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const https = require('https');
const initSqlJs = require('sql.js');
let ytdl = null;
try {
  ytdl = require('@distube/ytdl-core');
} catch (_) {
  ytdl = null;
}
let playDl = null;
try {
  playDl = require('play-dl');
} catch (_) {
  playDl = null;
}
let YTDlpWrap = null;
try {
  YTDlpWrap = require('yt-dlp-wrap').default || require('yt-dlp-wrap');
} catch (_) {
  YTDlpWrap = null;
}
const {
  verifyLicenseToken,
  createReadableLicenseSummary,
} = require('./license');

// 允许媒体带声音自动播放（避免无用户手势时被静音/拦截）
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

// 数据库实例（延迟初始化）
let bibleDbCuvs = null; // 中文和合本
let bibleDbKjv = null;  // 英文 KJV
let songsDb = null;     // 歌曲数据库

// 注册自定义协议的特权，必须在 app ready 之前调用
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'local-media',
    privileges: {
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
      bypassCSP: true
    }
  }
]);

// 开发模式判断
const isDev = process.env.NODE_ENV !== 'production' && !app.isPackaged;

// 媒体文件存储目录（延迟初始化，在 app ready 之后赋值）
let MEDIA_DIR;
let MEDIA_IMAGES_DIR;
let MEDIA_VIDEOS_DIR;
let MEDIA_PDF_DIR;
let MEDIA_PPT_DIR;
let MEDIA_YOUTUBE_CACHE_DIR;
let YTDLP_BIN_PATH;
let ytdlpInstance = null;
let BG_DEBUG_LOG = null;
const BG_DEBUG_ENABLED = true;
let APP_SETTINGS_PATH;
let youtubeHeaderHookInstalled = false;

function readAppSettings() {
  if (!APP_SETTINGS_PATH) return { licenseKey: '', acceptedEulaAt: null };
  try {
    if (!fs.existsSync(APP_SETTINGS_PATH)) {
      return { licenseKey: '', acceptedEulaAt: null };
    }
    const raw = fs.readFileSync(APP_SETTINGS_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    return {
      licenseKey: typeof parsed?.licenseKey === 'string' ? parsed.licenseKey : '',
      acceptedEulaAt: typeof parsed?.acceptedEulaAt === 'string' ? parsed.acceptedEulaAt : null,
    };
  } catch (err) {
    console.warn('[AppSettings] read failed:', err.message);
    return { licenseKey: '', acceptedEulaAt: null };
  }
}

function writeAppSettings(nextPatch) {
  if (!APP_SETTINGS_PATH) return { success: false, error: 'Settings path unavailable.' };
  try {
    const current = readAppSettings();
    const next = { ...current, ...nextPatch };
    fs.writeFileSync(APP_SETTINGS_PATH, JSON.stringify(next, null, 2), 'utf8');
    return { success: true, settings: next };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

function getLicenseStatus() {
  const settings = readAppSettings();
  if (!settings.licenseKey) {
    return {
      isLicensed: false,
      summary: 'Unlicensed',
      license: null,
      hasAcceptedEula: !!settings.acceptedEulaAt,
      acceptedEulaAt: settings.acceptedEulaAt,
    };
  }

  const verified = verifyLicenseToken(settings.licenseKey);
  if (!verified.ok) {
    return {
      isLicensed: false,
      summary: `Invalid license (${verified.error})`,
      license: null,
      hasAcceptedEula: !!settings.acceptedEulaAt,
      acceptedEulaAt: settings.acceptedEulaAt,
      error: verified.error,
    };
  }

  return {
    isLicensed: true,
    summary: createReadableLicenseSummary(verified),
    license: verified.payload,
    hasAcceptedEula: !!settings.acceptedEulaAt,
    acceptedEulaAt: settings.acceptedEulaAt,
  };
}

function readLegalDocument(docType) {
  const normalized = docType === 'license' ? 'LICENSE' : docType === 'eula' ? 'EULA.md' : null;
  if (!normalized) return { success: false, error: 'Unsupported legal document.' };

  // In dev and packaged runs, app root is one level above electron/.
  const docPath = path.resolve(__dirname, '..', normalized);
  try {
    const text = fs.readFileSync(docPath, 'utf8');
    return { success: true, text };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

function appendBgDebug(tag, payload = {}) {
  if (!BG_DEBUG_ENABLED || !BG_DEBUG_LOG) return;
  try {
    const line = `[${new Date().toISOString()}] ${tag} ${JSON.stringify(payload)}\n`;
    fs.appendFileSync(BG_DEBUG_LOG, line, 'utf8');
  } catch (err) {
    console.error('[BG_DEBUG] write failed:', err.message);
  }
}

/**
 * 修复安装版(file://)下 YouTube embed 可能出现的 Error 153
 * 为 YouTube 相关请求补齐必要头信息（Referer/Origin/User-Agent）。
 */
function setupYouTubeRequestHeaders() {
  if (youtubeHeaderHookInstalled) return;

  const ses = session.defaultSession;
  if (!ses || !ses.webRequest) return;

  const youtubeFilter = {
    urls: [
      'https://www.youtube.com/*',
      'https://*.youtube.com/*',
      'https://*.googlevideo.com/*',
      'https://i.ytimg.com/*',
      'https://yt3.ggpht.com/*',
      'https://*.ytimg.com/*',
    ],
  };

  ses.webRequest.onBeforeSendHeaders(youtubeFilter, (details, callback) => {
    const headers = { ...(details.requestHeaders || {}) };
    const resourceType = details.resourceType || '';
    let hostname = '';
    let pathname = '';
    try {
      const u = new URL(details.url);
      hostname = (u.hostname || '').toLowerCase();
      pathname = u.pathname || '';
    } catch (_) {}

    const isMediaOrXhr = resourceType === 'media' || resourceType === 'xhr' || resourceType === 'fetch';
    const isGoogleVideo = hostname.endsWith('.googlevideo.com');
    const isYtStatic = hostname.endsWith('.ytimg.com') || hostname === 'i.ytimg.com' || hostname === 'yt3.ggpht.com';
    const isEmbedPath = pathname.startsWith('/embed/');

    // 仅对媒体资源和 embed 流程补头，避免污染 watch 主页面请求。
    if ((isMediaOrXhr && (isGoogleVideo || isYtStatic)) || isEmbedPath) {
      if (!headers.Referer) headers.Referer = 'https://www.youtube.com/';
      if (!headers.Origin) headers.Origin = 'https://www.youtube.com';
      if (!headers['User-Agent']) {
        headers['User-Agent'] =
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
      }
    }

    callback({ requestHeaders: headers });
  });

  youtubeHeaderHookInstalled = true;
}

/**
 * 初始化媒体存储目录
 */
function initMediaDirs() {
  [MEDIA_DIR, MEDIA_IMAGES_DIR, MEDIA_VIDEOS_DIR, MEDIA_PDF_DIR, MEDIA_PPT_DIR, MEDIA_YOUTUBE_CACHE_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
  console.log(`[MediaManager] 媒体目录已初始化: ${MEDIA_DIR}`);
}

function sanitizeFileName(input) {
  return String(input || '')
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
}

function downloadUrlToFile(fileUrl, outputPath, headers = {}, maxRedirects = 6) {
  return new Promise((resolve, reject) => {
    const visit = (url, redirectsLeft) => {
      const client = url.startsWith('https://') ? https : http;
      const req = client.get(url, { headers }, (res) => {
        const code = res.statusCode || 0;
        if ([301, 302, 303, 307, 308].includes(code) && res.headers.location && redirectsLeft > 0) {
          const nextUrl = new URL(res.headers.location, url).toString();
          res.resume();
          visit(nextUrl, redirectsLeft - 1);
          return;
        }
        if (code < 200 || code >= 300) {
          res.resume();
          reject(new Error(`Download failed with status ${code}`));
          return;
        }
        const tmpPath = `${outputPath}.download`;
        const ws = fs.createWriteStream(tmpPath);
        res.pipe(ws);
        ws.on('finish', () => {
          ws.close(() => {
            fs.rename(tmpPath, outputPath, (err) => {
              if (err) reject(err);
              else resolve();
            });
          });
        });
        ws.on('error', (err) => reject(err));
      });
      req.on('error', (err) => reject(err));
      req.setTimeout(120000, () => {
        req.destroy(new Error('Download timeout'));
      });
    };
    visit(fileUrl, maxRedirects);
  });
}

async function downloadUrlToFileWithRetry(fileUrl, outputPath) {
  const attempts = [
    {},
    { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36' },
    {
      Referer: 'https://www.youtube.com/',
      Origin: 'https://www.youtube.com',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
    },
  ];

  let lastErr = null;
  for (let i = 0; i < attempts.length; i += 1) {
    const hdr = attempts[i];
    try {
      appendBgDebug('youtube-download-attempt', { index: i + 1, headers: Object.keys(hdr) });
      await downloadUrlToFile(fileUrl, outputPath, hdr);
      return;
    } catch (err) {
      lastErr = err;
      appendBgDebug('youtube-download-attempt-failed', { index: i + 1, error: err?.message || String(err) });
    }
  }
  throw lastErr || new Error('Download failed.');
}

async function getYtDlpInstance() {
  if (!YTDlpWrap) return null;
  if (ytdlpInstance) return ytdlpInstance;
  if (!YTDLP_BIN_PATH) return null;

  try {
    if (!fs.existsSync(YTDLP_BIN_PATH)) {
      appendBgDebug('ytdlp-download-start', { binPath: YTDLP_BIN_PATH });
      fs.mkdirSync(path.dirname(YTDLP_BIN_PATH), { recursive: true });
      await YTDlpWrap.downloadFromGithub(YTDLP_BIN_PATH);
      appendBgDebug('ytdlp-download-done', { binPath: YTDLP_BIN_PATH });
    }
    ytdlpInstance = new YTDlpWrap(YTDLP_BIN_PATH);
    return ytdlpInstance;
  } catch (err) {
    appendBgDebug('ytdlp-init-failed', { error: err?.message || String(err) });
    return null;
  }
}

async function downloadWithYtDlp(url, outputPath) {
  const yt = await getYtDlpInstance();
  if (!yt) throw new Error('yt-dlp unavailable');
  const outDir = path.dirname(outputPath);
  const outName = path.basename(outputPath);
  fs.mkdirSync(outDir, { recursive: true });

  // Prefer progressive mp4 to avoid ffmpeg dependency.
  await yt.execPromise([
    '--no-playlist',
    '--no-warnings',
    '-f',
    'b[ext=mp4]/b',
    '--output',
    outName,
    url,
  ], { cwd: outDir });

  if (!fs.existsSync(outputPath) || fs.statSync(outputPath).size < 1024 * 100) {
    throw new Error('yt-dlp output file missing or too small');
  }
}

// 窗口引用
let controlWindow = null;   // 控制台窗口
let projectorWindow = null;  // 投影窗口
let projectorExternalMode = false;
let projectorPendingPayload = null;
let allowControlWindowClose = false;

function confirmCloseControlWindow() {
  if (!controlWindow || controlWindow.isDestroyed()) return { confirmed: false };
  const choice = dialog.showMessageBoxSync(controlWindow, {
    type: 'question',
    buttons: ['Exit', 'Cancel'],
    defaultId: 1,
    cancelId: 1,
    noLink: true,
    title: 'Confirm Exit',
    message: 'Are you sure you want to exit ChurchDisplay Pro?',
    detail: 'Unsaved temporary changes may be lost.',
  });
  return { confirmed: choice === 0 };
}

function requestCloseControlWindow() {
  if (!controlWindow || controlWindow.isDestroyed()) {
    return { success: false, cancelled: true };
  }
  const result = confirmCloseControlWindow();
  if (!result.confirmed) {
    return { success: false, cancelled: true };
  }
  allowControlWindowClose = true;
  controlWindow.close();
  return { success: true };
}

function loadProjectorShell() {
  if (!projectorWindow || projectorWindow.isDestroyed()) return;
  const timestamp = Date.now();
  if (isDev) {
    const projectorUrl = `http://localhost:5199/#/projector?v=${timestamp}`;
    projectorWindow.loadURL(projectorUrl, {
      extraHeaders: 'pragma: no-cache\n'
    });
  } else {
    projectorWindow.loadFile(path.join(__dirname, '../dist/index.html'), {
      hash: '/projector',
      query: { v: timestamp.toString() }
    });
  }
}

function normalizeYouTubeWatchUrl(rawUrl) {
  try {
    const u = new URL(rawUrl);
    const host = u.hostname.toLowerCase();
    const toWatch = (id) => `https://www.youtube.com/watch?v=${encodeURIComponent(id)}`;

    if (host === 'youtu.be') {
      const id = u.pathname.replace('/', '').trim();
      if (!id) return null;
      return toWatch(id);
    }
    if (host.includes('youtube.com') || host === 'm.youtube.com' || host === 'music.youtube.com') {
      if (u.pathname.startsWith('/watch')) {
        const id = (u.searchParams.get('v') || '').trim();
        return id ? toWatch(id) : null;
      }
      if (u.pathname.startsWith('/shorts/')) {
        const id = (u.pathname.split('/')[2] || '').trim();
        return id ? toWatch(id) : null;
      }
      if (u.pathname.startsWith('/embed/')) {
        const id = (u.pathname.split('/')[2] || '').trim();
        return id ? toWatch(id) : null;
      }
    }
  } catch (_) {
    return null;
  }
  return null;
}

function openYouTubeWatchInProjector(rawUrl) {
  if (!projectorWindow || projectorWindow.isDestroyed()) return false;
  const watchUrl = normalizeYouTubeWatchUrl(rawUrl);
  if (!watchUrl) return false;
  projectorExternalMode = true;
  try {
    projectorWindow.webContents.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'
    );
  } catch (_) {}
  projectorWindow.loadURL(watchUrl);
  return true;
}

function sendToProjectorShell(data) {
  if (!projectorWindow || projectorWindow.isDestroyed()) return;

  if (projectorExternalMode) {
    projectorPendingPayload = data;
    projectorWindow.webContents.once('did-finish-load', () => {
      projectorExternalMode = false;
      try { projectorWindow.webContents.setUserAgent(''); } catch (_) {}
      const payload = projectorPendingPayload;
      projectorPendingPayload = null;
      if (payload && projectorWindow && !projectorWindow.isDestroyed()) {
        try { projectorWindow.webContents.setAudioMuted(false); } catch (_) {}
        projectorWindow.webContents.send('projector-content', payload);
      }
    });
    loadProjectorShell();
    return;
  }

  try { projectorWindow.webContents.setAudioMuted(false); } catch (_) {}
  projectorWindow.webContents.send('projector-content', data);
}

/**
 * ScreenManager - 多屏管理器
 * 自动检测系统中的显示器，并为投影窗口选择最佳屏幕
 */
class ScreenManager {
  /**
   * 获取所有可用显示器
   */
  static getAllDisplays() {
    return screen.getAllDisplays();
  }

  /**
   * 获取主显示器
   */
  static getPrimaryDisplay() {
    return screen.getPrimaryDisplay();
  }

  /**
   * 获取外部显示器（非主显示器）列表
   */
  static getExternalDisplays() {
    const primary = screen.getPrimaryDisplay();
    return screen.getAllDisplays().filter(d => d.id !== primary.id);
  }

  /**
   * 获取投影目标显示器
   * 优先返回第一个外部显示器，如果没有则返回主显示器
   */
  static getProjectorDisplay() {
    const externals = this.getExternalDisplays();
    if (externals.length > 0) {
      return externals[0];
    }
    return null;
  }

  /**
   * 获取所有显示器的信息（用于发送给渲染进程）
   */
  static getDisplaysInfo() {
    const primary = screen.getPrimaryDisplay();
    return screen.getAllDisplays().map(d => ({
      id: d.id,
      label: d.label || `显示器 ${d.id}`,
      bounds: d.bounds,
      workArea: d.workArea,
      scaleFactor: d.scaleFactor,
      isPrimary: d.id === primary.id,
      size: d.size,
    }));
  }
}

/**
 * 创建控制台窗口（主操作界面）
 */
function createControlWindow() {
  const primaryDisplay = ScreenManager.getPrimaryDisplay();

  controlWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    x: primaryDisplay.workArea.x + 50,
    y: primaryDisplay.workArea.y + 50,
    title: 'ChurchDisplay Pro (此版本为多伦多神召会活石堂特供--版权属于Aiden所有scanf2006@gmail.com)',
    frame: false,
    backgroundColor: '#0a0a0f',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      autoplayPolicy: 'no-user-gesture-required',
      backgroundThrottling: false,
    },
    icon: path.join(__dirname, '../public/icon.png'),
  });
  allowControlWindowClose = false;

  // 开发模式加载 Vite 开发服务器 (使用 5199 端口)，生产模式加载构建产物
  if (isDev) {
    controlWindow.loadURL('http://localhost:5199');
    controlWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    controlWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  controlWindow.on('close', (event) => {
    if (allowControlWindowClose) return;
    event.preventDefault();
    const result = confirmCloseControlWindow();
    if (result.confirmed) {
      allowControlWindowClose = true;
      controlWindow.close();
    }
  });

  controlWindow.on('closed', () => {
    allowControlWindowClose = false;
    controlWindow = null;
    // 关闭控制台时同时关闭投影窗口
    if (projectorWindow && !projectorWindow.isDestroyed()) {
      projectorWindow.close();
    }
  });
}

/**
 * 创建投影窗口
 * @param {Object} targetDisplay - 目标显示器对象
 */
function createProjectorWindow(targetDisplay) {
  // 如果已有投影窗口，先关闭
  if (projectorWindow && !projectorWindow.isDestroyed()) {
    projectorWindow.close();
  }

  const display = targetDisplay || ScreenManager.getProjectorDisplay();

  if (!display) {
    console.log('[ScreenManager] 未检测到外部显示器，投影窗口将不会创建');
    // 通知控制台
    if (controlWindow && !controlWindow.isDestroyed()) {
      controlWindow.webContents.send('projector-status', {
        active: false,
        reason: 'no-external-display',
      });
    }
    return;
  }

  projectorWindow = new BrowserWindow({
    x: display.bounds.x,
    y: display.bounds.y,
    width: display.bounds.width,
    height: display.bounds.height,
    fullscreen: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    backgroundColor: '#000000',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      autoplayPolicy: 'no-user-gesture-required',
      backgroundThrottling: false,
    },
  });
  projectorExternalMode = false;
  projectorPendingPayload = null;

  // 加载投影页面 (强制禁用缓存并注入时间戳，使用 5199 端口)
  loadProjectorShell();

  projectorWindow.on('closed', () => {
    projectorWindow = null;
    // 通知控制台投影已关闭
    if (controlWindow && !controlWindow.isDestroyed()) {
      controlWindow.webContents.send('projector-status', { active: false });
    }
  });

  // 通知控制台投影已开启
  if (controlWindow && !controlWindow.isDestroyed()) {
    controlWindow.webContents.send('projector-status', {
      active: true,
      displayId: display.id,
      displayBounds: display.bounds,
    });
  }

  // 确保投影窗口音频未被系统静音策略挂起
  try {
    projectorWindow.webContents.setAudioMuted(false);
    projectorWindow.webContents.on('did-finish-load', () => {
      try {
        projectorWindow?.webContents?.setAudioMuted(false);
      } catch (_) {}
    });
  } catch (_) {}

  console.log(`[ScreenManager] 投影窗口已在显示器 ${display.id} 上启动 (${display.bounds.width}x${display.bounds.height})`);
}

/**
 * 注册 IPC 通信处理器
 */
function setupIPC() {
  // 获取显示器列表
  ipcMain.handle('get-displays', () => {
    return ScreenManager.getDisplaysInfo();
  });

  // 启动投影
  ipcMain.handle('start-projector', (event, displayId) => {
    let targetDisplay = null;
    if (displayId) {
      targetDisplay = screen.getAllDisplays().find(d => d.id === displayId);
    }
    createProjectorWindow(targetDisplay);
    return { success: true };
  });

  // 停止投影
  ipcMain.handle('stop-projector', () => {
    if (projectorWindow && !projectorWindow.isDestroyed()) {
      projectorWindow.close();
    }
    return { success: true };
  });

  // 关闭主窗口
  ipcMain.handle('close-control-window', () => {
    return requestCloseControlWindow();
  });

  // 最小化主窗口
  ipcMain.handle('minimize-control-window', () => {
    if (controlWindow && !controlWindow.isDestroyed()) {
      controlWindow.minimize();
      return { success: true };
    }
    return { success: false };
  });

  // 最大化/还原主窗口
  ipcMain.handle('toggle-maximize-control-window', () => {
    if (controlWindow && !controlWindow.isDestroyed()) {
      if (controlWindow.isMaximized()) {
        controlWindow.unmaximize();
      } else {
        controlWindow.maximize();
      }
      return { success: true, isMaximized: controlWindow.isMaximized() };
    }
    return { success: false, isMaximized: false };
  });

  // 发送内容到投影窗口
  ipcMain.on('send-to-projector', (event, data) => {
    appendBgDebug('send-to-projector', {
      type: data?.type,
      hasBackground: !!data?.background,
      backgroundType: data?.background?.type,
      backgroundPath: data?.background?.path,
    });
    if (!projectorWindow || projectorWindow.isDestroyed()) return;

    if (data?.type === 'youtube') {
      const youtubeUrl = data?.url || (data?.videoId ? `https://www.youtube.com/watch?v=${encodeURIComponent(data.videoId)}` : '');
      const opened = openYouTubeWatchInProjector(youtubeUrl);
      if (!opened) {
        sendToProjectorShell({
          type: 'text',
          text: 'Failed to open YouTube URL',
          fontSize: 'medium',
          timestamp: Date.now(),
        });
      }
      return;
    }

    sendToProjectorShell(data);
  });

  // 发送动态专门背景到底层面板
  ipcMain.on('send-to-projector-background', (event, data) => {
    appendBgDebug('send-to-projector-background', {
      hasBackground: !!data,
      backgroundType: data?.type,
      backgroundPath: data?.path,
    });
    if (projectorWindow && !projectorWindow.isDestroyed()) {
      projectorWindow.webContents.send('projector-background', data);
    }
  });

  // 发送过渡效果命令
  ipcMain.on('projector-transition', (event, transitionData) => {
    if (projectorWindow && !projectorWindow.isDestroyed()) {
      projectorWindow.webContents.send('projector-transition', transitionData);
    }
  });

  // 投影窗口清屏（黑屏）
  ipcMain.on('projector-blackout', () => {
    if (projectorWindow && !projectorWindow.isDestroyed()) {
      projectorWindow.webContents.send('projector-blackout');
    }
  });

  // 投影指令中转 (播放/暂停/跳转)
  ipcMain.on('projector-command', (event, data) => {
    if (projectorWindow && !projectorWindow.isDestroyed()) {
      projectorWindow.webContents.send('projector-command', data);
    }
  });

  // 获取投影状态
  ipcMain.handle('get-projector-status', () => {
    return {
      active: projectorWindow !== null && !projectorWindow.isDestroyed(),
    };
  });

  // 解析 YouTube 为可播放直链（规避 embed 限制 152/153）
  ipcMain.handle('youtube-resolve', async (event, inputUrl) => {
    const raw = typeof inputUrl === 'string' ? inputUrl.trim() : '';
    if (!raw) {
      return { success: false, error: 'YouTube URL is required.' };
    }

    let lastError = '';

    // Resolver #1: play-dl (primary, currently more tolerant to YouTube changes)
    if (playDl) {
      try {
        const info2 = await playDl.video_info(raw);
        const formats = Array.isArray(info2?.format) ? info2.format : [];
        const progressive = formats.filter((fmt) => {
          const mime = String(fmt?.mimeType || '').toLowerCase();
          return !!fmt?.url && mime.includes('video/mp4') && mime.includes('mp4a');
        });
        const ranked2 = progressive.sort((a, b) => Number(b.height || 0) - Number(a.height || 0));
        const selected2 = ranked2[0] || formats.find((fmt) => !!fmt?.url);

        if (selected2?.url) {
          return {
            success: true,
            streamUrl: selected2.url,
            title: info2?.video_details?.title || '',
            videoId: info2?.video_details?.id || '',
            originalUrl: raw,
          };
        }
      } catch (err) {
        lastError = err?.message || 'play-dl resolver failed';
      }
    }

    // Resolver #2: @distube/ytdl-core (fallback)
    if (ytdl && ytdl.validateURL(raw)) {
      try {
        const info = await ytdl.getInfo(raw, {
          requestOptions: {
            headers: {
              referer: 'https://www.youtube.com/',
              origin: 'https://www.youtube.com',
              'user-agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
            },
          },
        });

        const candidates = info.formats.filter((fmt) => !!fmt.url && fmt.hasVideo && fmt.hasAudio && !fmt.isHLS);
        const mp4Candidates = candidates.filter((fmt) => (fmt.container || '').toLowerCase() === 'mp4');
        const ranked = (mp4Candidates.length > 0 ? mp4Candidates : candidates).sort((a, b) => {
          const ah = Number(a.height || 0);
          const bh = Number(b.height || 0);
          if (ah !== bh) return bh - ah;
          return Number(b.bitrate || 0) - Number(a.bitrate || 0);
        });
        const selected = ranked[0];

        if (selected?.url) {
          return {
            success: true,
            streamUrl: selected.url,
            title: info.videoDetails?.title || '',
            videoId: info.videoDetails?.videoId || '',
            originalUrl: raw,
          };
        }
      } catch (err) {
        lastError = lastError
          ? `${lastError}; ${err?.message || 'ytdl resolver failed'}`
          : (err?.message || 'ytdl resolver failed');
      }
    }

    return {
      success: false,
      error: lastError || 'No playable stream found for this video.',
    };
  });

  ipcMain.handle('youtube-cache-download', async (event, inputUrl) => {
    const raw = typeof inputUrl === 'string' ? inputUrl.trim() : '';
    if (!raw) return { success: false, error: 'YouTube URL is required.' };
    appendBgDebug('youtube-cache-download-start', { url: raw });

    const resolved = await (async () => {
      let lastError = '';
      if (playDl) {
        try {
          const info2 = await playDl.video_info(raw);
          const formats = Array.isArray(info2?.format) ? info2.format : [];
          const progressive = formats.filter((fmt) => {
            const mime = String(fmt?.mimeType || '').toLowerCase();
            return !!fmt?.url && mime.includes('video/mp4') && mime.includes('mp4a');
          });
          const ranked2 = progressive.sort((a, b) => Number(b.height || 0) - Number(a.height || 0));
          const selected2 = ranked2[0] || formats.find((fmt) => !!fmt?.url);
          if (selected2?.url) {
            return {
              success: true,
              streamUrl: selected2.url,
              title: info2?.video_details?.title || '',
              videoId: info2?.video_details?.id || '',
              originalUrl: raw,
            };
          }
        } catch (err) {
          lastError = err?.message || 'play-dl resolver failed';
        }
      }
      if (ytdl && ytdl.validateURL(raw)) {
        try {
          const info = await ytdl.getInfo(raw, {
            requestOptions: {
              headers: {
                referer: 'https://www.youtube.com/',
                origin: 'https://www.youtube.com',
                'user-agent':
                  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
              },
            },
          });
          const candidates = info.formats.filter((fmt) => !!fmt.url && fmt.hasVideo && fmt.hasAudio && !fmt.isHLS);
          const mp4Candidates = candidates.filter((fmt) => (fmt.container || '').toLowerCase() === 'mp4');
          const ranked = (mp4Candidates.length > 0 ? mp4Candidates : candidates).sort((a, b) => Number(b.height || 0) - Number(a.height || 0));
          const selected = ranked[0];
          if (selected?.url) {
            return {
              success: true,
              streamUrl: selected.url,
              title: info.videoDetails?.title || '',
              videoId: info.videoDetails?.videoId || '',
              originalUrl: raw,
            };
          }
        } catch (err) {
          lastError = lastError ? `${lastError}; ${err?.message || 'ytdl resolver failed'}` : (err?.message || 'ytdl resolver failed');
        }
      }
      return { success: false, error: lastError || 'No playable stream found for this video.' };
    })();

    if (!resolved?.success || !resolved?.streamUrl) {
      appendBgDebug('youtube-cache-download-resolve-failed', { url: raw, error: resolved?.error });
      return { success: false, error: resolved?.error || 'No playable stream found.' };
    }

    try {
      const fileBase = sanitizeFileName(`${resolved.videoId || 'youtube'}_${resolved.title || 'video'}`) || 'youtube_video';
      const outputPath = path.join(MEDIA_YOUTUBE_CACHE_DIR, `${fileBase}.mp4`);
      if (!fs.existsSync(outputPath) || fs.statSync(outputPath).size < 1024 * 100) {
        try {
          await downloadUrlToFileWithRetry(resolved.streamUrl, outputPath);
        } catch (primaryErr) {
          appendBgDebug('youtube-download-primary-failed', { error: primaryErr?.message || String(primaryErr) });
          appendBgDebug('youtube-download-fallback-ytdlp-start', { url: raw });
          await downloadWithYtDlp(raw, outputPath);
          appendBgDebug('youtube-download-fallback-ytdlp-success', { outputPath });
        }
      }
      appendBgDebug('youtube-cache-download-success', {
        url: raw,
        outputPath,
        size: fs.existsSync(outputPath) ? fs.statSync(outputPath).size : 0,
      });
      return {
        success: true,
        localPath: outputPath,
        title: resolved.title || 'YouTube Video',
        videoId: resolved.videoId || '',
        originalUrl: resolved.originalUrl || raw,
      };
    } catch (err) {
      appendBgDebug('youtube-cache-download-failed', { url: raw, error: err?.message || 'Download failed.' });
      return { success: false, error: err?.message || 'Download failed.' };
    }
  });

  // ===== Copyright / License =====
  ipcMain.handle('license-get-status', () => {
    return getLicenseStatus();
  });

  ipcMain.handle('license-activate', (event, licenseKey) => {
    const normalized = typeof licenseKey === 'string' ? licenseKey.trim() : '';
    if (!normalized) {
      return { success: false, error: 'License key is required.' };
    }

    const verified = verifyLicenseToken(normalized);
    if (!verified.ok) {
      return { success: false, error: verified.error };
    }

    const saved = writeAppSettings({ licenseKey: normalized });
    if (!saved.success) {
      return { success: false, error: saved.error };
    }

    return { success: true, status: getLicenseStatus() };
  });

  ipcMain.handle('license-clear', () => {
    const saved = writeAppSettings({ licenseKey: '' });
    if (!saved.success) {
      return { success: false, error: saved.error };
    }
    return { success: true, status: getLicenseStatus() };
  });

  ipcMain.handle('legal-get-document', (event, docType) => {
    return readLegalDocument(docType);
  });

  ipcMain.handle('legal-accept-eula', () => {
    const saved = writeAppSettings({ acceptedEulaAt: new Date().toISOString() });
    if (!saved.success) {
      return { success: false, error: saved.error };
    }
    return { success: true, status: getLicenseStatus() };
  });

  // ===== 文件管理 IPC =====

  // 打开文件选择对话框
  ipcMain.handle('select-files', async (event, options) => {
    const filters = [];
    switch (options?.type) {
      case 'image':
        filters.push({ name: 'Image Files', extensions: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg'] });
        break;
      case 'video':
        filters.push({ name: 'Video Files', extensions: ['mp4', 'webm', 'mkv', 'avi', 'mov'] });
        break;
      case 'pdf':
        filters.push({ name: 'PDF Files', extensions: ['pdf'] });
        break;
      case 'ppt':
        filters.push({ name: 'PPT Files', extensions: ['pptx', 'ppt'] });
        break;
      default:
        filters.push({ name: 'All Supported Files', extensions: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg', 'mp4', 'webm', 'mkv', 'avi', 'mov', 'pdf', 'pptx', 'ppt'] });
    }
    const result = await dialog.showOpenDialog(controlWindow, {
      properties: ['openFile', 'multiSelections'],
      filters,
    });
    return result.canceled ? [] : result.filePaths;
  });

  // 导入文件到媒体库
  ipcMain.handle('import-files', async (event, filePaths) => {
    const imported = [];
    for (const filePath of filePaths) {
      const ext = path.extname(filePath).toLowerCase();
      const fileName = `${Date.now()}_${path.basename(filePath)}`;

      let targetDir;
      let fileType;
      if (['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg'].includes(ext)) {
        targetDir = MEDIA_IMAGES_DIR;
        fileType = 'image';
      } else if (['.mp4', '.webm', '.mkv', '.avi', '.mov'].includes(ext)) {
        targetDir = MEDIA_VIDEOS_DIR;
        fileType = 'video';
      } else if (ext === '.pdf') {
        targetDir = MEDIA_PDF_DIR;
        fileType = 'pdf';
      } else if (['.pptx', '.ppt'].includes(ext)) {
        targetDir = MEDIA_PPT_DIR;
        fileType = 'ppt';
      } else {
        continue;
      }

      const destPath = path.join(targetDir, fileName);
      fs.copyFileSync(filePath, destPath);

      imported.push({
        id: fileName,
        name: path.basename(filePath),
        type: fileType,
        path: destPath,
        size: fs.statSync(destPath).size,
        createdAt: Date.now(),
      });
    }
    return imported;
  });

  // 获取媒体库文件列表
  ipcMain.handle('get-media-list', async (event, type) => {
    const dirs = {
      image: MEDIA_IMAGES_DIR,
      video: MEDIA_VIDEOS_DIR,
      pdf: MEDIA_PDF_DIR,
      ppt: MEDIA_PPT_DIR,
    };

    const results = [];
    const scanDir = (dirPath, fileType) => {
      if (!fs.existsSync(dirPath)) return;
      const files = fs.readdirSync(dirPath);
      for (const file of files) {
        const fullPath = path.join(dirPath, file);
        const stat = fs.statSync(fullPath);
        if (stat.isFile()) {
          // 提取原始文件名（去掉时间戳前缀）
          const originalName = file.replace(/^\d+_/, '');
          results.push({
            id: file,
            name: originalName,
            type: fileType,
            path: fullPath,
            size: stat.size,
            createdAt: stat.birthtimeMs,
          });
        }
      }
    };

    if (type && dirs[type]) {
      scanDir(dirs[type], type);
    } else {
      // 扫描所有类型
      Object.entries(dirs).forEach(([t, d]) => scanDir(d, t));
    }

    return results.sort((a, b) => b.createdAt - a.createdAt);
  });

  // 删除媒体文件
  ipcMain.handle('delete-media', async (event, filePath) => {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // 获取媒体目录路径
  ipcMain.handle('get-media-dir', () => {
    return MEDIA_DIR;
  });

  // 持久化投屏队列（存储到 userData）
  ipcMain.handle('queue-save', async (event, queue) => {
    try {
      const queuePath = path.join(app.getPath('userData'), 'projector-queue.json');
      const safeQueue = Array.isArray(queue) ? queue : [];
      fs.writeFileSync(queuePath, JSON.stringify(safeQueue, null, 2), 'utf8');
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('queue-load', async () => {
    try {
      const queuePath = path.join(app.getPath('userData'), 'projector-queue.json');
      if (!fs.existsSync(queuePath)) return [];
      const raw = fs.readFileSync(queuePath, 'utf8');
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      console.warn('[Queue] load failed:', err.message);
      return [];
    }
  });

  // PPT 转图片
  ipcMain.handle('convert-ppt', async (event, pptPath) => {
    let stat;
    try {
      stat = fs.statSync(pptPath);
    } catch (err) {
      return { success: false, error: '文件不存在' };
    }
    
    // 使用文件路径和最后修改时间生成特征哈希，具备内容缓存能力
    const crypto = require('crypto');
    const hashId = crypto.createHash('md5').update(`${pptPath}_${stat.mtimeMs}`).digest('hex');
    const outputDir = path.join(MEDIA_PPT_DIR, `slides_${hashId}`);

    // 如果目录已经存在，并且内部有之前成功转出的图片，则直接秒回
    if (fs.existsSync(outputDir)) {
      const existingSlides = fs.readdirSync(outputDir)
        .filter(f => /\.(png|jpg|jpeg)$/i.test(f))
        .sort((a, b) => {
          // 按文件名中的数字部分自然排序，防止 10.png 排在 2.png 前面
          const numA = parseInt(a.match(/\d+/) || [0], 10);
          const numB = parseInt(b.match(/\d+/) || [0], 10);
          return numA - numB;
        })
        .map((f, index) => ({
          index,
          path: path.join(outputDir, f),
          name: f,
        }));
        
      if (existingSlides.length > 0) {
        console.log('[PPT转换] 命中缓存目录:', outputDir);
        return {
          success: true,
          slides: existingSlides,
          outputDir,
          slideCount: existingSlides.length,
        };
      }
    }

    // 缓存未命中，创建新目录并转换
    fs.mkdirSync(outputDir, { recursive: true });

    const scriptPath = path.join(__dirname, 'ppt-convert.ps1');

    return new Promise((resolve, reject) => {
      const { exec } = require('child_process');
      const cmd = `powershell -ExecutionPolicy Bypass -File "${scriptPath}" -PptPath "${pptPath}" -OutputDir "${outputDir}"`;

      exec(cmd, { timeout: 120000 }, (error, stdout, stderr) => {
        if (error) {
          console.error('[PPT转换] 执行被中断或报错:', error.message);
          let errorMessage = stderr || error.message;
          
          // 捕获 exec 因为超时触发的自动查杀
          if (error.killed || error.code === 'ETIMEDOUT' || error.message.includes('timeout')) {
            errorMessage = 'TIMEOUT';
          }
          
          resolve({ success: false, error: errorMessage });
          return;
        }

        // 读取导出的图片列表
        const slides = fs.readdirSync(outputDir)
          .filter(f => /\.(png|jpg|jpeg)$/i.test(f))
          .sort((a, b) => {
            const numA = parseInt(a.match(/\d+/) || [0], 10);
            const numB = parseInt(b.match(/\d+/) || [0], 10);
            return numA - numB;
          })
          .map((f, index) => ({
            index,
            path: path.join(outputDir, f),
            name: f,
          }));

        resolve({
          success: true,
          slides,
          outputDir,
          slideCount: slides.length,
        });
      });
    });
  });
}

/**
 * 初始化圣经和歌曲数据库
 */
async function initBibleDatabase() {
  const SQL = await initSqlJs();

  // 加载中文和合本
  const cuvsPath = path.join(__dirname, '..', 'data', 'bible_cuvs.db');
  if (fs.existsSync(cuvsPath)) {
    const data = fs.readFileSync(cuvsPath);
    bibleDbCuvs = new SQL.Database(data);
    console.log('[BibleDB] 中文和合本已加载');
  }

  // 加载英文 KJV
  const kjvPath = path.join(__dirname, '..', 'data', 'bible_kjv.db');
  if (fs.existsSync(kjvPath)) {
    const data = fs.readFileSync(kjvPath);
    bibleDbKjv = new SQL.Database(data);
    console.log('[BibleDB] 英文 KJV 已加载');
  }

  // 初始化歌曲数据库
  const songsPath = path.join(app.getPath('userData'), 'songs.db');
  if (fs.existsSync(songsPath)) {
    const data = fs.readFileSync(songsPath);
    songsDb = new SQL.Database(data);
  } else {
    songsDb = new SQL.Database();
  }
  // 创建歌曲表（如不存在）
  songsDb.run(`CREATE TABLE IF NOT EXISTS songs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    author TEXT DEFAULT '',
    lyrics TEXT NOT NULL,
    background_type TEXT DEFAULT '',
    background_path TEXT DEFAULT '',
    created_at INTEGER DEFAULT (strftime('%s','now')),
    updated_at INTEGER DEFAULT (strftime('%s','now'))
  )`);
  // 兼容旧版本数据库，补齐背景字段
  try {
    songsDb.run(`ALTER TABLE songs ADD COLUMN background_type TEXT DEFAULT ''`);
  } catch (_) {}
  try {
    songsDb.run(`ALTER TABLE songs ADD COLUMN background_path TEXT DEFAULT ''`);
  } catch (_) {}
  console.log('[SongsDB] 歌曲数据库已初始化');
}

/**
 * 保存歌曲数据库到磁盘
 */
function saveSongsDb() {
  if (!songsDb) return;
  const data = songsDb.export();
  const songsPath = path.join(app.getPath('userData'), 'songs.db');
  fs.writeFileSync(songsPath, Buffer.from(data));
}

/**
 * 获取指定版本的圣经数据库
 */
function getBibleDb(version) {
  return version === 'kjv' ? bibleDbKjv : bibleDbCuvs;
}

/**
 * 注册圣经和歌曲 IPC 处理器
 */
function setupBibleIPC() {
  // 获取书卷列表
  ipcMain.handle('bible-get-books', (event, version) => {
    const db = getBibleDb(version);
    if (!db) return [];
    const result = db.exec('SELECT SN, ShortName, FullName, ChapterNumber, NewOrOld FROM BibleID ORDER BY SN');
    if (!result.length) return [];
    return result[0].values.map(row => ({
      sn: row[0], shortName: row[1], fullName: row[2],
      chapterCount: row[3], isNewTestament: row[4] === 1
    }));
  });

  // 获取经文
  ipcMain.handle('bible-get-verses', (event, version, bookSN, chapter) => {
    const db = getBibleDb(version);
    if (!db) return [];
    const result = db.exec(
      'SELECT VerseSN, Lection FROM Bible WHERE VolumeSN = ? AND ChapterSN = ? ORDER BY VerseSN',
      [bookSN, chapter]
    );
    if (!result.length) return [];
    return result[0].values.map(row => ({ verse: row[0], text: row[1] }));
  });

  // 搜索经文
  ipcMain.handle('bible-search', (event, version, keyword) => {
    const db = getBibleDb(version);
    if (!db) return [];
    const result = db.exec(
      `SELECT b.VolumeSN, b.ChapterSN, b.VerseSN, b.Lection, bi.ShortName, bi.FullName
       FROM Bible b JOIN BibleID bi ON b.VolumeSN = bi.SN
       WHERE b.Lection LIKE '%' || ? || '%'
       LIMIT 100`,
      [keyword]
    );
    if (!result.length) return [];
    return result[0].values.map(row => ({
      bookSN: row[0], chapter: row[1], verse: row[2],
      text: row[3], shortName: row[4], fullName: row[5]
    }));
  });

  // 歌曲列表
  ipcMain.handle('songs-list', () => {
    if (!songsDb) return [];
    const result = songsDb.exec('SELECT id, title, author, lyrics, background_type, background_path, created_at, updated_at FROM songs ORDER BY updated_at DESC');
    if (!result.length) return [];
    return result[0].values.map(row => ({
      id: row[0], title: row[1], author: row[2],
      lyrics: row[3],
      backgroundType: row[4] || '',
      backgroundPath: row[5] || '',
      createdAt: row[6],
      updatedAt: row[7]
    }));
  });

  // 保存歌曲
  ipcMain.handle('songs-save', (event, song) => {
    if (!songsDb) return { success: false };
    try {
      if (song.id) {
        songsDb.run('UPDATE songs SET title=?, author=?, lyrics=?, background_type=?, background_path=?, updated_at=strftime(\'%s\',\'now\') WHERE id=?',
          [song.title, song.author || '', song.lyrics, song.backgroundType || '', song.backgroundPath || '', song.id]);
      } else {
        songsDb.run('INSERT INTO songs (title, author, lyrics, background_type, background_path) VALUES (?, ?, ?, ?, ?)',
          [song.title, song.author || '', song.lyrics, song.backgroundType || '', song.backgroundPath || '']);
      }
      saveSongsDb();
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // 删除歌曲
  ipcMain.handle('songs-delete', (event, songId) => {
    if (!songsDb) return { success: false };
    try {
      songsDb.run('DELETE FROM songs WHERE id=?', [songId]);
      saveSongsDb();
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });
}

/**
 * 监控显示器变化事件
 */
function watchDisplayChanges() {
  screen.on('display-added', (event, newDisplay) => {
    console.log(`[ScreenManager] 检测到新显示器: ${newDisplay.id}`);
    if (controlWindow && !controlWindow.isDestroyed()) {
      controlWindow.webContents.send('displays-changed', ScreenManager.getDisplaysInfo());
    }
  });

  screen.on('display-removed', (event, oldDisplay) => {
    console.log(`[ScreenManager] 显示器已断开: ${oldDisplay.id}`);
    if (controlWindow && !controlWindow.isDestroyed()) {
      controlWindow.webContents.send('displays-changed', ScreenManager.getDisplaysInfo());
    }
  });
}

// ================= 应用生命周期 =================

app.whenReady().then(async () => {
  setupYouTubeRequestHeaders();

  BG_DEBUG_LOG = path.join(app.getPath('userData'), 'bg-debug.log');
  APP_SETTINGS_PATH = path.join(app.getPath('userData'), 'app-settings.json');
  appendBgDebug('app-ready', { userData: app.getPath('userData') });

  // 初始化媒体目录路径（app ready 之后才能调用 getPath）
  MEDIA_DIR = path.join(app.getPath('userData'), 'media');
  MEDIA_IMAGES_DIR = path.join(MEDIA_DIR, 'images');
  MEDIA_VIDEOS_DIR = path.join(MEDIA_DIR, 'videos');
  MEDIA_PDF_DIR = path.join(MEDIA_DIR, 'pdf');
  MEDIA_PPT_DIR = path.join(MEDIA_DIR, 'ppt');
  MEDIA_YOUTUBE_CACHE_DIR = path.join(MEDIA_DIR, 'youtube-cache');
  YTDLP_BIN_PATH = path.join(app.getPath('userData'), 'tools', 'yt-dlp.exe');

  initMediaDirs();

  // 注册本地文件协议，允许渲染进程安全加载本地媒体文件
  protocol.registerFileProtocol('local-media', (request, callback) => {
    try {
      const rawPath = decodeURIComponent(request.url.replace('local-media://', ''));
      const resolvedPath = path.resolve(rawPath);
      const allowedRoots = [MEDIA_DIR, app.getPath('userData')].map((p) => path.resolve(p) + path.sep);
      const normalizedTarget = resolvedPath.endsWith(path.sep) ? resolvedPath : resolvedPath + path.sep;
      const isAllowed = allowedRoots.some((root) => normalizedTarget.startsWith(root)) || allowedRoots.some((root) => resolvedPath === root.slice(0, -1));

      if (!isAllowed) {
        console.warn('[MediaProtocol] blocked path outside allowed roots:', resolvedPath);
        callback({ error: -10 }); // ACCESS_DENIED
        return;
      }

      callback({ path: resolvedPath });
    } catch (err) {
      console.error('[MediaProtocol] resolve failed:', err.message);
      callback({ error: -324 }); // ERR_INVALID_URL
    }
  });

  // 初始化圣经数据库
  await initBibleDatabase();

  setupIPC();
  setupBibleIPC();
  createControlWindow();
  watchDisplayChanges();
});

app.on('window-all-closed', () => {
  app.quit();
});

app.on('activate', () => {
  if (controlWindow === null) {
    createControlWindow();
  }
});
