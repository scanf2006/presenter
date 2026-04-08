const path = require('path');

function createControlWindowInstance({
  BrowserWindow,
  primaryDisplay,
  title,
  preloadPath,
  iconPath,
  isDev,
  devUrl,
  indexPath,
}) {
  const controlWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    x: primaryDisplay.workArea.x + 50,
    y: primaryDisplay.workArea.y + 50,
    title,
    frame: false,
    show: false,
    backgroundColor: '#0a0a0f',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: preloadPath,
      autoplayPolicy: 'no-user-gesture-required',
      backgroundThrottling: false,
    },
    icon: iconPath,
  });

  if (isDev) {
    controlWindow.loadURL(devUrl);
    controlWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    controlWindow.loadFile(indexPath);
  }

  return controlWindow;
}

function createProjectorWindowInstance({
  BrowserWindow,
  display,
  preloadPath,
}) {
  return new BrowserWindow({
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
      preload: preloadPath,
      autoplayPolicy: 'no-user-gesture-required',
      backgroundThrottling: false,
    },
  });
}

function createProjectorShellUrl({ isDev, timestamp }) {
  if (isDev) {
    return {
      mode: 'url',
      target: `http://localhost:5199/#/projector?v=${timestamp}`,
      extraHeaders: 'pragma: no-cache\n',
    };
  }
  return {
    mode: 'file',
    target: path.join(__dirname, '..', '..', 'dist', 'index.html'),
    options: {
      hash: '/projector',
      query: { v: timestamp.toString() },
    },
  };
}

function loadProjectorShellIntoWindow({
  targetWindow,
  isDev,
  timestamp = Date.now(),
}) {
  if (!targetWindow || targetWindow.isDestroyed()) return;
  const shellTarget = createProjectorShellUrl({ isDev, timestamp });
  if (shellTarget.mode === 'url') {
    targetWindow.loadURL(shellTarget.target, {
      extraHeaders: shellTarget.extraHeaders,
    });
    return;
  }
  targetWindow.loadFile(shellTarget.target, shellTarget.options);
}

module.exports = {
  createControlWindowInstance,
  createProjectorWindowInstance,
  createProjectorShellUrl,
  loadProjectorShellIntoWindow,
};
