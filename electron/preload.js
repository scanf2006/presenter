/**
 * ChurchDisplay Pro - Preload 脚本
 * 通过 contextBridge 安全地暴露 IPC 接口给渲染进程
 */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('churchDisplay', {
  // ===== 显示器管理 =====
  
  /** 获取所有显示器列表 */
  getDisplays: () => ipcRenderer.invoke('get-displays'),

  /** 监听显示器变化事件 */
  onDisplaysChanged: (callback) => {
    ipcRenderer.on('displays-changed', (event, displays) => callback(displays));
  },

  // ===== 投影控制 =====
  
  /** 启动投影到指定显示器 */
  startProjector: (displayId) => ipcRenderer.invoke('start-projector', displayId),

  /** 停止投影 */
  stopProjector: () => ipcRenderer.invoke('stop-projector'),

  /** 获取投影状态 */
  getProjectorStatus: () => ipcRenderer.invoke('get-projector-status'),

  /** 监听投影状态变化 */
  onProjectorStatus: (callback) => {
    ipcRenderer.on('projector-status', (event, status) => callback(status));
  },

  // ===== 内容推送 =====
  
  /** 发送内容到投影窗口 */
  sendToProjector: (data) => ipcRenderer.send('send-to-projector', data),

  /** 发送过渡效果 */
  sendTransition: (transitionData) => ipcRenderer.send('projector-transition', transitionData),

  /** 投影黑屏 */
  blackout: () => ipcRenderer.send('projector-blackout'),

  // ===== 投影窗口接收 =====
  
  /** 监听投影内容更新（投影窗口使用） */
  onProjectorContent: (callback) => {
    ipcRenderer.on('projector-content', (event, data) => callback(data));
  },

  /** 监听过渡效果（投影窗口使用） */
  onProjectorTransition: (callback) => {
    ipcRenderer.on('projector-transition', (event, data) => callback(data));
  },

  /** 监听黑屏命令（投影窗口使用） */
  onProjectorBlackout: (callback) => {
    ipcRenderer.on('projector-blackout', () => callback());
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
