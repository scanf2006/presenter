/**
 * ChurchDisplay Pro - Electron 主进程
 * 负责多窗口管理、多屏检测和 IPC 通信
 */
const { app, BrowserWindow, screen, ipcMain, dialog, protocol } = require('electron');
const path = require('path');
const fs = require('fs');

// 开发模式判断
const isDev = !app.isPackaged;

// 媒体文件存储目录
const MEDIA_DIR = path.join(app.getPath('userData'), 'media');
const MEDIA_IMAGES_DIR = path.join(MEDIA_DIR, 'images');
const MEDIA_VIDEOS_DIR = path.join(MEDIA_DIR, 'videos');
const MEDIA_PDF_DIR = path.join(MEDIA_DIR, 'pdf');
const MEDIA_PPT_DIR = path.join(MEDIA_DIR, 'ppt');

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
    title: 'ChurchDisplay Pro - 控制台',
    backgroundColor: '#0a0a0f',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    icon: path.join(__dirname, '../public/icon.png'),
  });

  // 开发模式加载 Vite 开发服务器，生产模式加载构建产物
  if (isDev) {
    controlWindow.loadURL('http://localhost:5173');
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
    },
  });

  // 加载投影页面
  if (isDev) {
    projectorWindow.loadURL('http://localhost:5173/#/projector');
  } else {
    projectorWindow.loadFile(path.join(__dirname, '../dist/index.html'), {
      hash: '/projector',
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

  // 发送内容到投影窗口
  ipcMain.on('send-to-projector', (event, data) => {
    if (projectorWindow && !projectorWindow.isDestroyed()) {
      projectorWindow.webContents.send('projector-content', data);
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

  // 获取投影状态
  ipcMain.handle('get-projector-status', () => {
    return {
      active: projectorWindow !== null && !projectorWindow.isDestroyed(),
    };
  });

  // ===== 文件管理 IPC =====

  // 打开文件选择对话框
  ipcMain.handle('select-files', async (event, options) => {
    const filters = [];
    switch (options?.type) {
      case 'image':
        filters.push({ name: '图片文件', extensions: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg'] });
        break;
      case 'video':
        filters.push({ name: '视频文件', extensions: ['mp4', 'webm', 'mkv', 'avi', 'mov'] });
        break;
      case 'pdf':
        filters.push({ name: 'PDF 文件', extensions: ['pdf'] });
        break;
      case 'ppt':
        filters.push({ name: 'PPT 文件', extensions: ['pptx', 'ppt'] });
        break;
      default:
        filters.push({ name: '所有支持的文件', extensions: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg', 'mp4', 'webm', 'mkv', 'avi', 'mov', 'pdf', 'pptx', 'ppt'] });
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

  // PPT 转图片
  ipcMain.handle('convert-ppt', async (event, pptPath) => {
    const outputDir = path.join(MEDIA_PPT_DIR, `slides_${Date.now()}`);
    fs.mkdirSync(outputDir, { recursive: true });

    const scriptPath = path.join(__dirname, 'ppt-convert.ps1');

    return new Promise((resolve, reject) => {
      const { exec } = require('child_process');
      const cmd = `powershell -ExecutionPolicy Bypass -File "${scriptPath}" -PptPath "${pptPath}" -OutputDir "${outputDir}"`;

      exec(cmd, { timeout: 120000 }, (error, stdout, stderr) => {
        if (error) {
          console.error('[PPT转换] 错误:', stderr);
          resolve({ success: false, error: stderr || error.message });
          return;
        }

        // 读取导出的图片列表
        const slides = fs.readdirSync(outputDir)
          .filter(f => /\.(png|jpg|jpeg)$/i.test(f))
          .sort()
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

app.whenReady().then(() => {
  initMediaDirs();

  // 注册本地文件协议，允许渲染进程安全加载本地媒体文件
  protocol.registerFileProtocol('local-media', (request, callback) => {
    const filePath = decodeURIComponent(request.url.replace('local-media://', ''));
    callback({ path: filePath });
  });

  setupIPC();
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
