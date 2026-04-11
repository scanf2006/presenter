/**
 * ChurchDisplay Pro - Electron main process.
 * Handles window lifecycle, IPC, media pipeline, and persistence.
 */
const { app, BrowserWindow, screen, ipcMain, dialog, protocol, session } = require('electron');

// C2: Global error handlers — prevent silent crashes.
process.on('uncaughtException', (err) => {
  console.error('[FATAL] Uncaught Exception:', err);
  try {
    dialog.showErrorBox(
      'ChurchDisplay Pro - Unexpected Error',
      `An unexpected error occurred:\n\n${err?.message || String(err)}\n\nThe application will now exit.`
    );
  } catch (dialogErr) {
    console.warn('[Startup] unable to show fatal error dialog:', dialogErr?.message || dialogErr);
  }
  app.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('[FATAL] Unhandled Rejection:', reason);
});
const initSqlJs = require('sql.js');
const { ScreenManager } = require('./services/screen-manager');
const {
  resolveAbsolutePath,
  normalizeForCompare,
  isPathWithinRoot,
} = require('./services/path-utils');
const { normalizeYouTubeWatchUrl, createYouTubeResolver } = require('./services/youtube-service');
const {
  collectReferencedMediaPathsFromQueue,
  copyDirectoryMerge,
} = require('./services/setup-bundle');
const { watchDisplayTopology } = require('./services/display-watch');
const { buildRuntimePaths } = require('./services/runtime-paths');
const { registerLocalMediaProtocol } = require('./services/media-protocol');
const { hydrateUserDataFromBundledSeed } = require('./services/seed-service');
const { resolveRuntimePptConvertScriptPath } = require('./services/ppt-runtime');
const { forceWindowZoom100, confirmExitDialog } = require('./services/window-utils');
const { ensureMediaDirs, sanitizeMediaFileName } = require('./services/media-runtime');
const { loadOptionalMediaModules } = require('./services/optional-modules');
const { configureAppBootstrap } = require('./services/app-bootstrap-config');
const { forceCloseProjectorWindowInstance } = require('./services/projector-window');
const {
  recoverDesktopAfterDisplaySwitch: recoverDisplayDesktop,
} = require('./services/display-recovery');
const { formatBackupStamp } = require('./services/date-utils');
const { registerAppLifecycleHandlers } = require('./services/app-lifecycle');
const { setupLifecycleRuntime } = require('./services/lifecycle-runtime');
const { buildLifecycleOptions } = require('./services/lifecycle-options');
const { createMainSetupIpc } = require('./services/main-setup-ipc');
const { bootstrapCoreServices } = require('./services/bootstrap-services');
const { registerDisplayWatchRuntime } = require('./services/display-watch-runtime');
const { runStartupUiRuntime } = require('./services/startup-ui-runtime');
const { runWhenReadyRuntime } = require('./services/when-ready-runtime');
const { buildWhenReadyOptions } = require('./services/when-ready-options');
const { createAndWireControlWindow } = require('./services/control-open-runtime');
const { openProjectorWindowWithRuntime } = require('./services/projector-open-orchestrator');
const { createWindowRuntimeManager } = require('./services/window-runtime-manager');
const { buildWindowRuntimeDeps } = require('./services/window-runtime-deps');
const { createMainUiRuntime } = require('./services/main-ui-runtime');
const { createMainRuntimeCore } = require('./services/main-runtime-core');
const { createProjectorControlBridge } = require('./services/projector-control-bridge');
const { createProjectorRecoveryBridge } = require('./services/projector-recovery-bridge');
const {
  notifyProjectorUnavailable,
  notifyProjectorActive,
  bindProjectorWindowEvents,
} = require('./services/projector-window-runtime');
const {
  resolveProjectorDisplay,
  createAndWireProjectorWindow,
} = require('./services/projector-open-runtime');
const { bindControlWindowEvents } = require('./services/control-window-runtime');
const {
  createControlWindowInstance,
  createProjectorWindowInstance,
  loadProjectorShellIntoWindow,
} = require('./services/window-factory');
const {
  CONTROL_WINDOW_TITLE,
  USERDATA_SEED_MARKER,
  CONTROL_WINDOW_REVEAL_TIMEOUT_MS,
  SPLASH_MIN_VISIBLE_MS,
  NETWORK_TIMEOUT_MS,
  PPT_CONVERT_TIMEOUT_MS,
} = require('./services/app-constants');
const { initializeStartupRuntime } = require('./services/startup-runtime');
const { createAppSettingsStore, readLegalDocument } = require('./services/app-settings');
const { createDatabaseStore, initBibleAndSongsDatabases } = require('./services/database-service');
const { createTrialGuard } = require('./services/trial-guard');
const { registerBibleSongsIPC } = require('./ipc/bible-songs');
const { registerAllIPC } = require('./ipc');
const { ytdl, playDl, YTDlpWrap } = loadOptionalMediaModules();
const { verifyLicenseToken, getLocalDeviceId } = require('./license');
const screenManager = new ScreenManager(screen);
const resolveYouTubeStream = createYouTubeResolver({ playDl, ytdl });
configureAppBootstrap({ app, protocol });

const dbStore = createDatabaseStore();

// Development mode flag.
const isDev = process.env.NODE_ENV !== 'production' && !app.isPackaged;

let appSettingsStore = null;
const {
  mediaState,
  bgDebug,
  downloadService,
  sessionHooks,
  ytdlpService,
  licenseRuntime,
  controlCloseController,
  projectorSceneState,
} = createMainRuntimeCore({
  session,
  logger: console,
  networkTimeoutMs: NETWORK_TIMEOUT_MS,
  YTDlpWrap,
  getAppSettingsStore: () => appSettingsStore,
  confirmExitDialog,
});
const trialGuard = createTrialGuard({
  getLicenseStatus: () => licenseRuntime.getCurrentLicenseStatus(),
  readTrialState: () => {
    const store = appSettingsStore;
    if (!store || typeof store.readAppSettings !== 'function') return null;
    const settings = store.readAppSettings();
    return {
      trialStartedAtMs: settings?.trialStartedAtMs ?? null,
      trialLastSeenAtMs: settings?.trialLastSeenAtMs ?? null,
      trialClockTampered: settings?.trialClockTampered === true,
    };
  },
  writeTrialState: (trialPatch) => {
    const store = appSettingsStore;
    if (!store || typeof store.writeAppSettings !== 'function') {
      return { success: false, error: 'Settings store unavailable.' };
    }
    return store.writeAppSettings(trialPatch);
  },
});
const { projectorChannel, splashController } = createMainUiRuntime({
  normalizeYouTubeWatchUrl,
  loadProjectorShellIntoWindow,
  isDev,
  BrowserWindow,
  screenManager,
  electronDir: __dirname,
});
let controlWindow = null; // Control window
let projectorWindow = null; // Projector window
const projectorControlBridge = createProjectorControlBridge({
  controlCloseController,
  controlWindowRef: () => controlWindow,
  dialog,
  projectorChannel,
  projectorWindowRef: () => projectorWindow,
});
const projectorRecoveryBridge = createProjectorRecoveryBridge({
  getProjectorWindow: () => projectorWindow,
  setProjectorWindow: (nextWindow) => {
    projectorWindow = nextWindow;
  },
  appendBgDebug: (tag, payload) => bgDebug.append(tag, payload),
  forceCloseProjectorWindowInstance,
  recoverDisplayDesktop,
  BrowserWindow,
  getControlWindow: () => controlWindow,
});
const { controlWindowDeps, projectorWindowDeps } = buildWindowRuntimeDeps({
  BrowserWindow,
  createControlWindowInstance,
  screenManager,
  controlWindowTitle: CONTROL_WINDOW_TITLE,
  electronDir: __dirname,
  isDev,
  controlCloseController,
  bindControlWindowEvents,
  splashController,
  controlWindowRevealTimeoutMs: CONTROL_WINDOW_REVEAL_TIMEOUT_MS,
  dialog,
  forceWindowZoom100,
  forceCloseProjectorWindow: projectorRecoveryBridge.forceCloseProjectorWindow,
  onControlWindowClosed: () => {
    controlWindow = null;
  },
  splashMinVisibleMs: SPLASH_MIN_VISIBLE_MS,
  logger: console,
  notifyProjectorUnavailable,
  controlWindowRef: () => controlWindow,
  resolveProjectorDisplay,
  createAndWireProjectorWindow,
  createProjectorWindowInstance,
  projectorChannel,
  bindProjectorWindowEvents,
  getProjectorScene: projectorSceneState.getScene,
  notifyProjectorActive,
});

const windowRuntimeManager = createWindowRuntimeManager({
  createAndWireControlWindow,
  setControlWindow: (nextWindow) => {
    controlWindow = nextWindow;
  },
  controlWindowDeps,
  openProjectorWindowWithRuntime,
  projectorWindowRef: () => projectorWindow,
  setProjectorWindow: (nextWindow) => {
    projectorWindow = nextWindow;
  },
  projectorWindowDeps,
});

const createControlWindow = () => windowRuntimeManager.createControlWindow();
const createProjectorWindow = (targetDisplay) =>
  windowRuntimeManager.createProjectorWindow(targetDisplay);
const setupIPC = createMainSetupIpc({
  registerAllIPC,
  ipcMain,
  screenManager,
  createProjectorWindow,
  projectorRecoveryBridge,
  projectorControlBridge,
  getControlWindow: () => controlWindow,
  getProjectorWindow: () => projectorWindow,
  appendBgDebug: (tag, payload) => bgDebug.append(tag, payload),
  projectorSceneState,
  resolveYouTubeStream,
  sanitizeMediaFileName,
  mediaState,
  downloadService,
  ytdlpService,
  verifyLicenseToken,
  getDeviceId: getLocalDeviceId,
  licenseRuntime,
  trialGuard,
  readLegalDocument,
  dialog,
  resolveAbsolutePath,
  normalizeForCompare,
  isPathWithinRoot,
  pptConvertTimeoutMs: PPT_CONVERT_TIMEOUT_MS,
  resolveRuntimePptConvertScriptPath,
  app,
  electronDir: __dirname,
  processResourcesPath: process.resourcesPath,
  formatBackupStamp,
  collectReferencedMediaPathsFromQueue,
  copyDirectoryMerge,
});

// =================  =================

// C1: Add .catch() to prevent silent startup failures.
app
  .whenReady()
  .then(async () => {
    await runWhenReadyRuntime(
      buildWhenReadyOptions({
        sessionHooks,
        hydrateUserDataFromBundledSeed,
        app,
        userDataSeedMarker: USERDATA_SEED_MARKER,
        createAppSettingsStore,
        getDeviceId: getLocalDeviceId,
        buildRuntimePaths,
        ensureMediaDirs,
        bgDebug,
        initializeStartupRuntime,
        mediaState,
        ytdlpService,
        bootstrapCoreServices,
        protocol,
        registerLocalMediaProtocol,
        resolveAbsolutePath,
        isPathWithinRoot,
        initBibleAndSongsDatabases,
        initSqlJs,
        dbStore,
        electronDir: __dirname,
        runStartupUiRuntime,
        setupIPC,
        registerBibleSongsIPC,
        ipcMain,
        getBibleDb: (version) => dbStore.getBibleDb(version),
        getSongsDb: () => dbStore.getSongsDb(),
        saveSongsDb: (userDataDir) => dbStore.saveSongsDb(userDataDir),
        registerDisplayWatchRuntime,
        watchDisplayTopology,
        screen,
        controlWindowRef: () => controlWindow,
        screenManager,
        onRecover: projectorRecoveryBridge.recoverDesktopAfterDisplaySwitch,
        splashController,
        createControlWindow,
        setAppSettingsStore: (store) => {
          appSettingsStore = store;
        },
        logger: console,
      })
    );
  })
  .catch((err) => {
    console.error('[FATAL] Startup failed:', err);
    try {
      dialog.showErrorBox(
        'ChurchDisplay Pro - Startup Error',
        `Failed to start the application:\n\n${err?.message || String(err)}`
      );
    } catch (dialogErr) {
      console.warn('[Startup] failed to show startup error dialog:', dialogErr?.message || dialogErr);
    }
    app.quit();
  });

setupLifecycleRuntime(
  buildLifecycleOptions({
    registerAppLifecycleHandlers,
    app,
    forceCloseProjectorWindow: projectorRecoveryBridge.forceCloseProjectorWindow,
    controlCloseController,
    controlWindowRef: () => controlWindow,
    createControlWindow,
    onBeforeQuitExtra: () => {
      // M8: Close all SQLite databases before exit.
      dbStore.closeAll();
      bgDebug.close();
    },
  })
);
