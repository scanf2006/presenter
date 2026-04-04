/**
 * ChurchDisplay Pro - Preload 脚本
 * 通过 contextBridge 安全地暴露 IPC 接口给渲染进程
 */
const { contextBridge, ipcRenderer } = require('electron');

function onWithCleanup(channel, handler) {
  ipcRenderer.on(channel, handler);
  return () => {
    ipcRenderer.removeListener(channel, handler);
  };
}

contextBridge.exposeInMainWorld('churchDisplay', {
  // ===== 显示器管理 =====
  
  /** 获取所有显示器列表 */
  getDisplays: () => ipcRenderer.invoke('get-displays'),

  /** 监听显示器变化事件 */
  onDisplaysChanged: (callback) => {
    return onWithCleanup('displays-changed', (event, displays) => callback(displays));
  },

  // ===== 投影控制 =====
  
  /** 启动投影到指定显示器 */
  startProjector: (displayId) => ipcRenderer.invoke('start-projector', displayId),

  /** 停止投影 */
  stopProjector: () => ipcRenderer.invoke('stop-projector'),

  /** 关闭主窗口 */
  closeControlWindow: () => ipcRenderer.invoke('close-control-window'),
  minimizeControlWindow: () => ipcRenderer.invoke('minimize-control-window'),
  toggleMaximizeControlWindow: () => ipcRenderer.invoke('toggle-maximize-control-window'),

  /** 获取投影状态 */
  getProjectorStatus: () => ipcRenderer.invoke('get-projector-status'),

  /** 监听投影状态变化 */
  onProjectorStatus: (callback) => {
    return onWithCleanup('projector-status', (event, status) => callback(status));
  },

  // ===== 内容推送 =====
  
  /** 发送内容到投影窗口 */
  sendToProjector: (data) => ipcRenderer.send('send-to-projector', data),

  /** 发送过渡效果 */
  sendTransition: (transitionData) => ipcRenderer.send('projector-transition', transitionData),

  /** 发送背景内容（专门信道） */
  sendToProjectorBackground: (data) => ipcRenderer.send('send-to-projector-background', data),

  /** 投影黑屏 */
  blackout: () => ipcRenderer.send('projector-blackout'),

  /** 发送媒体控制指令 (play/pause/seek) */
  sendMediaCommand: (command) => ipcRenderer.send('projector-command', command),

  // ===== 投影窗口接收 =====
  
  /** 监听投影内容更新（投影窗口使用） */
  onProjectorContent: (callback) => {
    return onWithCleanup('projector-content', (event, data) => callback(data));
  },

  /** 监听投影背景更新（投影窗口使用） */
  onProjectorBackground: (callback) => {
    return onWithCleanup('projector-background', (event, data) => callback(data));
  },

  /** 监听过渡效果（投影窗口使用） */
  onProjectorTransition: (callback) => {
    return onWithCleanup('projector-transition', (event, data) => callback(data));
  },

  /** 监听黑屏命令（投影窗口使用） */
  onProjectorBlackout: (callback) => {
    return onWithCleanup('projector-blackout', () => callback());
  },

  /** 监听媒体控制指令（投影窗口使用） */
  onMediaCommand: (callback) => {
    return onWithCleanup('projector-command', (event, command) => callback(command));
  },

  // ===== 文件管理 =====

  /** 打开文件选择对话框 */
  selectFiles: (options) => ipcRenderer.invoke('select-files', options),

  /** 导入文件到媒体库 */
  importFiles: (filePaths) => ipcRenderer.invoke('import-files', filePaths),

  /** 获取媒体库文件列表 */
  getMediaList: (type) => ipcRenderer.invoke('get-media-list', type),

  /** 删除媒体文件 */
  deleteMedia: (filePath) => ipcRenderer.invoke('delete-media', filePath),

  /** 获取媒体目录路径 */
  getMediaDir: () => ipcRenderer.invoke('get-media-dir'),

  /** 投屏队列持久化 */
  queueSave: (queue) => ipcRenderer.invoke('queue-save', queue),
  queueLoad: () => ipcRenderer.invoke('queue-load'),
  youtubeResolve: (url) => ipcRenderer.invoke('youtube-resolve', url),
  youtubeCacheDownload: (url) => ipcRenderer.invoke('youtube-cache-download', url),

  /** 版权与授权 */
  licenseGetStatus: () => ipcRenderer.invoke('license-get-status'),
  licenseActivate: (licenseKey) => ipcRenderer.invoke('license-activate', licenseKey),
  licenseClear: () => ipcRenderer.invoke('license-clear'),
  legalGetDocument: (docType) => ipcRenderer.invoke('legal-get-document', docType),
  legalAcceptEula: () => ipcRenderer.invoke('legal-accept-eula'),

  /** PPT 转图片 */
  convertPpt: (pptPath) => ipcRenderer.invoke('convert-ppt', pptPath),

  // ===== 圣经数据库 =====

  /** 获取书卷列表 */
  bibleGetBooks: (version) => ipcRenderer.invoke('bible-get-books', version),

  /** 获取经文 */
  bibleGetVerses: (version, bookSN, chapter) => ipcRenderer.invoke('bible-get-verses', version, bookSN, chapter),

  /** 搜索经文 */
  bibleSearch: (version, keyword) => ipcRenderer.invoke('bible-search', version, keyword),

  // ===== 歌曲管理 =====

  /** 获取歌曲列表 */
  songsList: () => ipcRenderer.invoke('songs-list'),

  /** 保存/更新歌曲 */
  songsSave: (song) => ipcRenderer.invoke('songs-save', song),

  /** 删除歌曲 */
  songsDelete: (songId) => ipcRenderer.invoke('songs-delete', songId),
});
