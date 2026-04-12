const { contextBridge, ipcRenderer } = require('electron');

function onWithCleanup(channel, handler) {
  ipcRenderer.on(channel, handler);
  return () => ipcRenderer.removeListener(channel, handler);
}

const api = {
  // Displays
  getDisplays: () => ipcRenderer.invoke('get-displays'),
  onDisplaysChanged: (callback) =>
    onWithCleanup('displays-changed', (_e, displays) => callback(displays)),

  // Control window
  closeControlWindow: () => ipcRenderer.invoke('close-control-window'),
  minimizeControlWindow: () => ipcRenderer.invoke('minimize-control-window'),
  toggleMaximizeControlWindow: () => ipcRenderer.invoke('toggle-maximize-control-window'),

  // Exit confirmation (main → renderer → main)
  onConfirmExitRequest: (callback) => onWithCleanup('confirm-exit-request', () => callback()),
  confirmExitResponse: (confirmed) => ipcRenderer.send('confirm-exit-response', confirmed),

  // Projector
  startProjector: (displayId) => ipcRenderer.invoke('start-projector', displayId),
  stopProjector: () => ipcRenderer.invoke('stop-projector'),
  getProjectorStatus: () => ipcRenderer.invoke('get-projector-status'),
  onProjectorStatus: (callback) =>
    onWithCleanup('projector-status', (_e, status) => callback(status)),

  // Content push
  sendToProjector: (data) => ipcRenderer.send('send-to-projector', data),
  sendToProjectorBackground: (data) => ipcRenderer.send('send-to-projector-background', data),
  sendTransition: (transitionData) => ipcRenderer.send('projector-transition', transitionData),
  sendProjectorScene: (sceneData) => ipcRenderer.send('projector-scene', sceneData),
  blackout: () => ipcRenderer.send('projector-blackout'),
  sendMediaCommand: (command) => ipcRenderer.send('projector-command', command),

  // Projector listeners
  onProjectorContent: (callback) =>
    onWithCleanup('projector-content', (_e, data) => callback(data)),
  onProjectorBackground: (callback) =>
    onWithCleanup('projector-background', (_e, data) => callback(data)),
  onProjectorTransition: (callback) =>
    onWithCleanup('projector-transition', (_e, data) => callback(data)),
  onProjectorScene: (callback) => onWithCleanup('projector-scene', (_e, data) => callback(data)),
  onProjectorBlackout: (callback) => onWithCleanup('projector-blackout', () => callback()),
  onMediaCommand: (callback) =>
    onWithCleanup('projector-command', (_e, command) => callback(command)),

  // Media
  selectFiles: (options) => ipcRenderer.invoke('select-files', options),
  importFiles: (filePaths) => ipcRenderer.invoke('import-files', filePaths),
  getMediaList: (type) => ipcRenderer.invoke('get-media-list', type),
  deleteMedia: (filePath) => ipcRenderer.invoke('delete-media', filePath),
  getMediaDir: () => ipcRenderer.invoke('get-media-dir'),
  exportSetupBundle: () => ipcRenderer.invoke('export-setup-bundle'),
  importSetupBundle: () => ipcRenderer.invoke('import-setup-bundle'),

  // Queue
  queueSave: (queue) => ipcRenderer.invoke('queue-save', queue),
  queueLoad: () => ipcRenderer.invoke('queue-load'),

  // YouTube
  youtubeResolve: (url) => ipcRenderer.invoke('youtube-resolve', url),
  youtubeCacheDownload: (url) => ipcRenderer.invoke('youtube-cache-download', url),

  // License / legal
  licenseGetStatus: () => ipcRenderer.invoke('license-get-status'),
  licenseGetDeviceId: () => ipcRenderer.invoke('license-get-device-id'),
  licenseActivate: (licenseKey) => ipcRenderer.invoke('license-activate', licenseKey),
  licenseClear: () => ipcRenderer.invoke('license-clear'),
  legalGetDocument: (docType) => ipcRenderer.invoke('legal-get-document', docType),
  legalAcceptEula: () => ipcRenderer.invoke('legal-accept-eula'),
  onTrialWarning: (callback) => onWithCleanup('trial-warning', (_e, data) => callback(data)),

  // PPT
  convertPpt: (pptPath) => ipcRenderer.invoke('convert-ppt', pptPath),

  // Bible
  bibleGetBooks: (version) => ipcRenderer.invoke('bible-get-books', version),
  bibleGetVerses: (version, bookSN, chapter) =>
    ipcRenderer.invoke('bible-get-verses', version, bookSN, chapter),
  bibleSearch: (version, keyword) => ipcRenderer.invoke('bible-search', version, keyword),

  // Songs
  songsList: () => ipcRenderer.invoke('songs-list'),
  songsSave: (song) => ipcRenderer.invoke('songs-save', song),
  songsDelete: (songId) => ipcRenderer.invoke('songs-delete', songId),
};

contextBridge.exposeInMainWorld('churchDisplay', api);
