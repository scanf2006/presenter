/**
 * ChurchDisplay Pro - Electron main process.
 * Handles window lifecycle, IPC, media pipeline, and persistence.
 */
const { app, BrowserWindow, screen, ipcMain, dialog, protocol, session, globalShortcut } = require('electron');
const path = require('path');

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
const { createProjectorHealthMonitor } = require('./services/projector-health-monitor');
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
const { verifyLicenseToken, getLocalDeviceId } = require('./license');
const screenManager = new ScreenManager(screen);

let optionalMediaModulesCache = null;
let youtubeResolverCache = null;
function getOptionalMediaModules() {
  if (!optionalMediaModulesCache) {
    optionalMediaModulesCache = loadOptionalMediaModules();
  }
  return optionalMediaModulesCache;
}
function getYTDlpWrap() {
  return getOptionalMediaModules().YTDlpWrap;
}
function resolveYouTubeStream(rawUrl) {
  if (!youtubeResolverCache) {
    const { playDl, ytdl } = getOptionalMediaModules();
    youtubeResolverCache = createYouTubeResolver({ playDl, ytdl });
  }
  return youtubeResolverCache(rawUrl);
}
async function initSqlJsLazy(...args) {
  const sqlJsModule = require('sql.js');
  return sqlJsModule(...args);
}
configureAppBootstrap({ app, protocol });

const dbStore = createDatabaseStore();

function resolveDevRendererUrl() {
  const candidate =
    process.env.ELECTRON_RENDERER_URL || process.env.VITE_DEV_SERVER_URL || 'http://localhost:5199';
  try {
    const parsed = new URL(candidate);
    parsed.hash = '';
    parsed.search = '';
    return parsed.toString().replace(/\/$/, '');
  } catch (_) {
    return 'http://localhost:5199';
  }
}

// Development mode flag.
const isDev = process.env.NODE_ENV !== 'production' && !app.isPackaged;
const devRendererUrl = resolveDevRendererUrl();
if (isDev) {
  // Keep development data isolated from packaged installs so local dev
  // license/trial state cannot leak into installer builds on the same machine.
  const isolatedDevUserData = path.join(app.getPath('appData'), `${app.getName()}-dev`);
  app.setPath('userData', isolatedDevUserData);
  console.log(`[Startup] using isolated dev userData: ${isolatedDevUserData}`);
}

let appSettingsStore = null;
const {
  mediaState,
  bgDebug,
  downloadService,
  sessionHooks,
  ytdlpService,
  licenseRuntime,
  controlCloseController,
} = createMainRuntimeCore({
  session,
  logger: console,
  networkTimeoutMs: NETWORK_TIMEOUT_MS,
  getYTDlpWrap,
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
      trialConsumedMs: settings?.trialConsumedMs ?? 0,
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
  devUrl: devRendererUrl,
  BrowserWindow,
  screenManager,
  electronDir: __dirname,
});
let controlWindow = null; // Control window
let projectorWindow = null; // Projector window
let projectorDisplayId = null; // Locked target display for projector window
let lastKnownProjectorDisplayId = null; // Last resolved display id for fallback.
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
  onProjectorDisplayResolved: (display) => {
    projectorDisplayId = display?.id ?? null;
    lastKnownProjectorDisplayId = display?.id ?? lastKnownProjectorDisplayId;
  },
  notifyProjectorActive,
  setupNavigationRestrictions: sessionHooks.setupNavigationRestrictions,
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
    if (!nextWindow) projectorDisplayId = null;
  },
  projectorWindowDeps,
});

const createControlWindow = () => windowRuntimeManager.createControlWindow();
const createProjectorWindow = (targetDisplay) =>
  windowRuntimeManager.createProjectorWindow(targetDisplay);

function stabilizeProjectorWindowAfterDisplayChange(reason = 'display-change') {
  const current = projectorWindow;
  if (!current || current.isDestroyed()) return false;
  const allDisplays = screenManager.getAllDisplays();
  const displayById =
    projectorDisplayId !== null && projectorDisplayId !== undefined
      ? allDisplays.find((d) => String(d.id) === String(projectorDisplayId))
      : null;
  const displayByLastKnownId =
    !displayById && lastKnownProjectorDisplayId !== null && lastKnownProjectorDisplayId !== undefined
      ? allDisplays.find((d) => String(d.id) === String(lastKnownProjectorDisplayId))
      : null;
  const display = displayById || displayByLastKnownId || screenManager.getDisplayMatching(current.getBounds());
  if (!display || !display.bounds) return false;
  const beforeBounds = current.getBounds();
  projectorDisplayId = display.id;
  lastKnownProjectorDisplayId = display.id;
  try {
    current.setBounds(
      {
        x: display.bounds.x,
        y: display.bounds.y,
        width: display.bounds.width,
        height: display.bounds.height,
      },
      false
    );
    current.setFullScreen(true);
    current.setKiosk(true);
    forceWindowZoom100(current);
    const afterBounds = current.getBounds();
    console.log(
      `[ProjectorStabilize] ${reason} -> display ${display.id} (${display.bounds.width}x${display.bounds.height}), ` +
        `window ${beforeBounds.x},${beforeBounds.y},${beforeBounds.width}x${beforeBounds.height} -> ` +
        `${afterBounds.x},${afterBounds.y},${afterBounds.width}x${afterBounds.height}, ` +
        `fs=${current.isFullScreen()} kiosk=${current.isKiosk()}`
    );
    return true;
  } catch (err) {
    console.warn(
      `[ProjectorStabilize] ${reason} failed:`,
      err?.message || err
    );
    return false;
  }
}

const projectorHealthMonitor = createProjectorHealthMonitor({
  getProjectorWindow: () => projectorWindow,
  getProjectorDisplayId: () => projectorDisplayId,
  screenManager,
  stabilizeProjectorWindow: stabilizeProjectorWindowAfterDisplayChange,
  logger: console,
  intervalMs: 1500,
});
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
    globalShortcut.register('CommandOrControl+Shift+P', () => {
      try {
        const current = projectorWindow;
        if (!current || current.isDestroyed()) return;
        current.setKiosk(false);
        current.setFullScreen(false);
        current.show();
        current.focus();
        console.log('[ProjectorEmergencyExit] Ctrl/Cmd+Shift+P applied');
      } catch (err) {
        console.warn('[ProjectorEmergencyExit] failed:', err?.message || err);
      }
    });
    projectorHealthMonitor.start();
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
        initSqlJs: initSqlJsLazy,
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
        onStabilizeProjector: stabilizeProjectorWindowAfterDisplayChange,
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
      console.warn(
        '[Startup] failed to show startup error dialog:',
        dialogErr?.message || dialogErr
      );
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
      globalShortcut.unregisterAll();
      projectorHealthMonitor.stop();
      // M8: Close all SQLite databases before exit.
      dbStore.closeAll();
      bgDebug.close();
    },
  })
);
