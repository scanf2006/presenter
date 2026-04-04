/**
 * ChurchDisplay Pro - Electron 主进程
 * 负责多窗口管理、多屏检测和 IPC 通信
 */
const { app, BrowserWindow, screen, ipcMain, dialog, protocol } = require('electron');
const path = require('path');
const fs = require('fs');
const initSqlJs = require('sql.js');
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
let BG_DEBUG_LOG = null;
const BG_DEBUG_ENABLED = isDev;
let APP_SETTINGS_PATH;

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
 * 初始化媒体存储目录
 */
function initMediaDirs() {
  [MEDIA_DIR, MEDIA_IMAGES_DIR, MEDIA_VIDEOS_DIR, MEDIA_PDF_DIR, MEDIA_PPT_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
  console.log(`[MediaManager] 媒体目录已初始化: ${MEDIA_DIR}`);
}

// 窗口引用
let controlWindow = null;   // 控制台窗口
let projectorWindow = null;  // 投影窗口

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
    title: 'ChurchDisplay Pro (多伦多神召会活石堂赠与版, 版权归Aiden所有)',
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

  // 开发模式加载 Vite 开发服务器 (使用 5199 端口)，生产模式加载构建产物
  if (isDev) {
    controlWindow.loadURL('http://localhost:5199');
    controlWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    controlWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  controlWindow.on('closed', () => {
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

  // 加载投影页面 (强制禁用缓存并注入时间戳，使用 5199 端口)
  const timestamp = Date.now();
  if (isDev) {
    const projectorUrl = `http://localhost:5199/#/projector?v=${timestamp}`;
    console.log(`[Projector] loadURL => ${projectorUrl}`);
    projectorWindow.loadURL(projectorUrl, {
      extraHeaders: 'pragma: no-cache\n'
    });
  } else {
    projectorWindow.loadFile(path.join(__dirname, '../dist/index.html'), {
      hash: '/projector',
      query: { v: timestamp.toString() }
    });
  }

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
    if (controlWindow && !controlWindow.isDestroyed()) {
      controlWindow.close();
    }
    return { success: true };
  });

  // 发送内容到投影窗口
  ipcMain.on('send-to-projector', (event, data) => {
    appendBgDebug('send-to-projector', {
      type: data?.type,
      hasBackground: !!data?.background,
      backgroundType: data?.background?.type,
      backgroundPath: data?.background?.path,
    });
    if (projectorWindow && !projectorWindow.isDestroyed()) {
      try { projectorWindow.webContents.setAudioMuted(false); } catch (_) {}
      projectorWindow.webContents.send('projector-content', data);
    }
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
  BG_DEBUG_LOG = path.join(app.getPath('userData'), 'bg-debug.log');
  APP_SETTINGS_PATH = path.join(app.getPath('userData'), 'app-settings.json');
  appendBgDebug('app-ready', { userData: app.getPath('userData') });

  // 初始化媒体目录路径（app ready 之后才能调用 getPath）
  MEDIA_DIR = path.join(app.getPath('userData'), 'media');
  MEDIA_IMAGES_DIR = path.join(MEDIA_DIR, 'images');
  MEDIA_VIDEOS_DIR = path.join(MEDIA_DIR, 'videos');
  MEDIA_PDF_DIR = path.join(MEDIA_DIR, 'pdf');
  MEDIA_PPT_DIR = path.join(MEDIA_DIR, 'ppt');

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
