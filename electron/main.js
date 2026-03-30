/**
 * ChurchDisplay Pro - Electron 主进程
 * 负责多窗口管理、多屏检测和 IPC 通信
 */
const { app, BrowserWindow, screen, ipcMain } = require('electron');
const path = require('path');

// 开发模式判断
const isDev = !app.isPackaged;

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
