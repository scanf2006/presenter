import React, { useState, useEffect, useCallback, useRef } from 'react';
import MediaManager from './MediaManager';
import BibleBrowser from './BibleBrowser';
import SongManager from './SongManager';
import PdfRenderer from './PdfRenderer';
import appPkg from '../../package.json';

const QUEUE_STORAGE_KEY = 'churchdisplay.projectorQueue.v1';
const TRANSITION_STORAGE_KEY = 'churchdisplay.transition.v1';
const SCENE_STORAGE_KEY = 'churchdisplay.scene.v1';
const APP_VERSION = appPkg.version;
const TEXT_FONT_OPTIONS = ['Noto Sans SC', 'Microsoft YaHei', 'Arial', 'Times New Roman', 'SimHei'];
const DEFAULT_SCENE_CONFIG = {
  mode: 'normal',
  splitDirection: 'content_left_camera_right',
  cameraDeviceId: '',
  cameraPanePercent: 30,
  cameraMuted: true,
  cameraCenterCropPercent: 100,
  enableCameraTestMode: false,
};

/**
 */
function ControlPanel() {
  const resolveSectionForPayload = useCallback((payload) => {
    if (!payload?.type) return 'media';
    if (payload.type === 'text') return 'text';
    if (payload.type === 'bible') return 'bible';
    if (payload.type === 'lyrics') return 'songs';
    if (payload.type === 'song') return 'songs';
    return 'media';
  }, []);

  const buildQueueItem = useCallback((payload, title, section) => ({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: title || payload?.name || payload?.reference || payload?.type || 'Untitled Content',
    type: payload?.type || 'text',
    payload,
    section: section || resolveSectionForPayload(payload),
    createdAt: Date.now(),
  }), [resolveSectionForPayload]);

  const getQueueItemTitle = useCallback((payload) => {
    if (!payload) return 'Untitled Content';
    if (payload.type === 'text') return payload.text?.split('\n')?.[0]?.slice(0, 24) || 'Free Text';
    if (payload.type === 'lyrics') return payload.text?.split('\n')?.[0]?.slice(0, 24) || 'Lyrics Section';
    if (payload.type === 'bible') return payload.reference || 'Bible';
    if (payload.type === 'song') return payload.songTitle || 'Song';
    if (payload.type === 'image' || payload.type === 'video' || payload.type === 'pdf') return payload.name || 'Media';
    return payload.name || payload.type || 'Untitled Content';
  }, []);

  // Display list
  const [displays, setDisplays] = useState([]);
  // Projector Status
  const [projectorActive, setProjectorActive] = useState(false);
  const [projectorDisplayId, setProjectorDisplayId] = useState(null);
  const [activeSection, setActiveSection] = useState('text');
  const [textContent, setTextContent] = useState('');
  const [fontSize, setFontSize] = useState('large');
  const [textFontFamily, setTextFontFamily] = useState('Noto Sans SC');
  const [textColor, setTextColor] = useState('#ffffff');
  const [textSizePx, setTextSizePx] = useState(72);
  const [textCanvasWidth, setTextCanvasWidth] = useState(0);
  const [textBackground, setTextBackground] = useState(null);
  const [textLayout, setTextLayout] = useState({ xPercent: 50, yPercent: 50, scale: 1 });
  const [textSnapGuide, setTextSnapGuide] = useState({ vertical: false, horizontal: false });
  // Current projected content
  const [currentSlide, setCurrentSlide] = useState(null);
  // Preview side uses its own transition state
  const [previewSlide, setPreviewSlide] = useState(null);
  const [previewStageWidth, setPreviewStageWidth] = useState(0);
  const [previewMaskVisible, setPreviewMaskVisible] = useState(false);
  const [previewVideoCurrent, setPreviewVideoCurrent] = useState(0);
  const [previewVideoDuration, setPreviewVideoDuration] = useState(0);
  const [previewVideoPaused, setPreviewVideoPaused] = useState(false);
  const [previewVideoMuted, setPreviewVideoMuted] = useState(false);
  const previewTimersRef = useRef([]);
  const previewVideoRef = useRef(null);
  const textCanvasRef = useRef(null);
  const textLayerRef = useRef(null);
  const textEditableRef = useRef(null);
  const textTransformRef = useRef({
    mode: null,
    startX: 0,
    startY: 0,
    startLayout: null,
    startTextSizePx: 72,
  });
  // Queue
  const [projectorQueue, setProjectorQueue] = useState([]);
  const [queueHydrated, setQueueHydrated] = useState(false);
  const [activeQueueIndex, setActiveQueueIndex] = useState(-1);
  const [draggingQueueId, setDraggingQueueId] = useState(null);
  const [editingQueueId, setEditingQueueId] = useState(null);
  const [editingQueueTitle, setEditingQueueTitle] = useState('');
  const [songsListOpenToken, setSongsListOpenToken] = useState(0);
  const [bibleCatalogOpenToken, setBibleCatalogOpenToken] = useState(0);
  const [mediaHomeOpenToken, setMediaHomeOpenToken] = useState(0);
  const [activePreloadItem, setActivePreloadItem] = useState(null);
  const [backgroundPickerTarget, setBackgroundPickerTarget] = useState(null); // 'songs' | 'bible' | 'text' | null
  const [songPickedBackground, setSongPickedBackground] = useState(null);
  const [biblePickedBackground, setBiblePickedBackground] = useState(null);
  const [transitionEnabled, setTransitionEnabled] = useState(true);
  const [transitionDelayMs, setTransitionDelayMs] = useState(20);
  const [transitionDurationMs, setTransitionDurationMs] = useState(60);
  const [sceneConfig, setSceneConfig] = useState(DEFAULT_SCENE_CONFIG);
  const [cameraDevices, setCameraDevices] = useState([]);
  const [cameraStatus, setCameraStatus] = useState('idle');
  const [previewTestNow, setPreviewTestNow] = useState(Date.now());
  const cameraPreviewRef = useRef(null);
  const previewStageRef = useRef(null);
  const cameraStreamRef = useRef(null);
  const [showLegalModal, setShowLegalModal] = useState(false);
  const [setupTransferBusy, setSetupTransferBusy] = useState(false);
  const [licenseStatus, setLicenseStatus] = useState({
    isLicensed: false,
    summary: 'Unlicensed',
    hasAcceptedEula: false,
    acceptedEulaAt: null,
  });
  const [licenseInput, setLicenseInput] = useState('');
  const [licenseActionMsg, setLicenseActionMsg] = useState('');
  const [licenseActionError, setLicenseActionError] = useState('');
  const [eulaText, setEulaText] = useState('');
  const [toast, setToast] = useState(null);
  const toastTimerRef = useRef(null);

  const isElectron = typeof window.churchDisplay !== 'undefined';
  const previewSplitEnabled = false;
  const previewRightPanePercent = Math.max(20, Math.min(40, sceneConfig.cameraPanePercent || 30));
  const previewContentPanePercent = 100 - previewRightPanePercent;
  const previewCameraScale = Math.max(1, Number(sceneConfig.cameraCenterCropPercent || 100) / 100);
  const activeProjectorDisplay = displays.find((d) => d.id === projectorDisplayId) || null;
  const clamp = useCallback((v, min, max) => Math.max(min, Math.min(max, v)), []);

  const startTextDrag = useCallback((event) => {
    if (!textCanvasRef.current) return;
    if (event.button !== 0) return;
    if (event.target?.closest?.('[contenteditable="true"]')) return;
    event.preventDefault();
    textTransformRef.current = {
      mode: 'drag',
      startX: event.clientX,
      startY: event.clientY,
      startLayout: { ...textLayout },
    };
  }, [textLayout]);

  const startTextResize = useCallback((event) => {
    if (!textCanvasRef.current) return;
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    textTransformRef.current = {
      mode: 'resize',
      startX: event.clientX,
      startY: event.clientY,
      startLayout: { ...textLayout },
      startTextSizePx: textSizePx,
    };
  }, [textLayout, textSizePx]);

  useEffect(() => {
    const onMouseMove = (event) => {
      const state = textTransformRef.current;
      if (!state?.mode || !textCanvasRef.current || !state.startLayout) return;
      const rect = textCanvasRef.current.getBoundingClientRect();
      if (!rect.width || !rect.height) return;

      if (state.mode === 'drag') {
        const deltaXPct = ((event.clientX - state.startX) / rect.width) * 100;
        const deltaYPct = ((event.clientY - state.startY) / rect.height) * 100;
        const layerRect = textLayerRef.current?.getBoundingClientRect?.();
        const halfWidthPct = layerRect?.width ? (layerRect.width / rect.width) * 50 : 8;
        const halfHeightPct = layerRect?.height ? (layerRect.height / rect.height) * 50 : 10;
        const minX = Math.max(2, Math.min(50, halfWidthPct));
        const maxX = Math.min(98, Math.max(50, 100 - halfWidthPct));
        const minY = Math.max(2, Math.min(50, halfHeightPct));
        const maxY = Math.min(98, Math.max(50, 100 - halfHeightPct));
        let nextX = clamp(state.startLayout.xPercent + deltaXPct, minX, maxX);
        let nextY = clamp(state.startLayout.yPercent + deltaYPct, minY, maxY);
        const guide = { vertical: false, horizontal: false };
        const snapThreshold = 1.5;
        if (Math.abs(nextX - 50) <= snapThreshold && 50 >= minX && 50 <= maxX) {
          nextX = 50;
          guide.vertical = true;
        }
        if (Math.abs(nextY - 50) <= snapThreshold && 50 >= minY && 50 <= maxY) {
          nextY = 50;
          guide.horizontal = true;
        }
        setTextSnapGuide(guide);
        setTextLayout((prev) => ({ ...prev, xPercent: nextX, yPercent: nextY }));
        return;
      }

      if (state.mode === 'resize') {
        const delta = (event.clientX - state.startX) + (event.clientY - state.startY);
        const baseSize = Number(state.startTextSizePx || textSizePx || 72) * Number(state.startLayout?.scale || 1);
        const nextSizePx = Math.round(clamp(baseSize + (delta / 3), 24, 220));
        setTextSizePx(nextSizePx);
        setTextLayout((prev) => ({ ...prev, scale: 1 }));
      }
    };

    const onMouseUp = () => {
      if (textTransformRef.current?.mode) {
        textTransformRef.current = { mode: null, startX: 0, startY: 0, startLayout: null, startTextSizePx: 72 };
        setTextSnapGuide({ vertical: false, horizontal: false });
      }
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [clamp, textSizePx]);
  const showToast = useCallback((message, tone = 'success') => {
    if (!message) return;
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }
    setToast({ message, tone, token: Date.now() });
    toastTimerRef.current = setTimeout(() => {
      setToast(null);
      toastTimerRef.current = null;
    }, 1600);
  }, []);

  useEffect(() => () => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
  }, []);

  const previewAspectRatio = (() => {
    const w = activeProjectorDisplay?.bounds?.width || activeProjectorDisplay?.size?.width;
    const h = activeProjectorDisplay?.bounds?.height || activeProjectorDisplay?.size?.height;
    if (Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0) {
      const ratio = w / h;
      // Keep preview panel visually usable; avoid over-wide "thin strip" preview.
      if (ratio >= 1.45 && ratio <= 1.9) {
        return `${w} / ${h}`;
      }
    }
    return '16 / 9';
  })();

  // Get display list
  useEffect(() => {
    if (isElectron) {
      let isMounted = true;
      window.churchDisplay.getDisplays().then((data) => {
        if (isMounted) setDisplays(data);
      });
      const offDisplaysChanged = window.churchDisplay.onDisplaysChanged(setDisplays);
      const offProjectorStatus = window.churchDisplay.onProjectorStatus((status) => {
        setProjectorActive(status.active);
        setProjectorDisplayId(status.displayId || null);
      });
      // Check initial projector status
      window.churchDisplay.getProjectorStatus().then((status) => {
        if (isMounted) setProjectorActive(status.active);
      });

      return () => {
        isMounted = false;
        if (typeof offDisplaysChanged === 'function') offDisplaysChanged();
        if (typeof offProjectorStatus === 'function') offProjectorStatus();
      };
    } else {
      setDisplays([
        { id: 1, label: 'Primary Display', bounds: { x: 0, y: 0, width: 1920, height: 1080 }, isPrimary: true, size: { width: 1920, height: 1080 } },
        { id: 2, label: 'Secondary Display', bounds: { x: 1920, y: 0, width: 1920, height: 1080 }, isPrimary: false, size: { width: 1920, height: 1080 } },
      ]);
    }
  }, [isElectron]);

  // Restore queue from persistence
  useEffect(() => {
    const restoreQueue = async () => {
      try {
        if (isElectron && typeof window.churchDisplay?.queueLoad === 'function') {
          const parsed = await window.churchDisplay.queueLoad();
          if (Array.isArray(parsed)) {
            setProjectorQueue(parsed);
          }
          return;
        }
        const raw = window.localStorage.getItem(QUEUE_STORAGE_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setProjectorQueue(parsed);
        }
      } catch (err) {
        console.warn('[Queue] restore failed:', err);
      } finally {
        setQueueHydrated(true);
      }
    };
    restoreQueue();
  }, [isElectron]);

  useEffect(() => {
    const hydrateLicenseStatus = async () => {
      if (!isElectron || typeof window.churchDisplay?.licenseGetStatus !== 'function') return;
      try {
        const status = await window.churchDisplay.licenseGetStatus();
        if (status) setLicenseStatus(status);
      } catch (err) {
        console.warn('[License] load status failed:', err);
      }
    };
    hydrateLicenseStatus();
  }, [isElectron]);

  // Persist queue when changed
  useEffect(() => {
    if (!queueHydrated) return;
    const persistQueue = async () => {
      try {
        if (isElectron && typeof window.churchDisplay?.queueSave === 'function') {
          await window.churchDisplay.queueSave(projectorQueue);
          return;
        }
        window.localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(projectorQueue));
      } catch (err) {
        console.warn('[Queue] persist failed:', err);
      }
    };
    persistQueue();
  }, [projectorQueue, isElectron, queueHydrated]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(TRANSITION_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (typeof parsed?.enabled === 'boolean') setTransitionEnabled(parsed.enabled);
      if (Number.isFinite(parsed?.delayMs)) setTransitionDelayMs(Math.max(0, Math.min(5000, parsed.delayMs)));
      if (Number.isFinite(parsed?.durationMs)) setTransitionDurationMs(Math.max(0, Math.min(5000, parsed.durationMs)));
    } catch (err) {
      console.warn('[Transition] restore failed:', err);
    }
  }, []);

  // Persist and broadcast transition settings
  useEffect(() => {
    try {
      window.localStorage.setItem(TRANSITION_STORAGE_KEY, JSON.stringify({
        enabled: transitionEnabled,
        delayMs: transitionDelayMs,
        durationMs: transitionDurationMs,
      }));
    } catch (err) {
      console.warn('[Transition] persist failed:', err);
    }

    if (isElectron && typeof window.churchDisplay?.sendTransition === 'function') {
      window.churchDisplay.sendTransition({
        enabled: transitionEnabled,
        delayMs: transitionDelayMs,
        durationMs: transitionDurationMs,
      });
    }
  }, [transitionEnabled, transitionDelayMs, transitionDurationMs, isElectron]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(SCENE_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      setSceneConfig((prev) => ({
        ...prev,
        // Always boot in normal mode to avoid stale split layout persisting across restarts.
        mode: 'normal',
        splitDirection: parsed?.splitDirection || prev.splitDirection,
        cameraDeviceId: typeof parsed?.cameraDeviceId === 'string' ? parsed.cameraDeviceId : prev.cameraDeviceId,
        cameraPanePercent: Number.isFinite(parsed?.cameraPanePercent)
          ? Math.max(20, Math.min(40, Number(parsed.cameraPanePercent)))
          : prev.cameraPanePercent,
        cameraMuted: parsed?.cameraMuted !== false,
        cameraCenterCropPercent: Number.isFinite(parsed?.cameraCenterCropPercent)
          ? Math.max(100, Math.min(220, Number(parsed.cameraCenterCropPercent)))
          : prev.cameraCenterCropPercent,
        enableCameraTestMode: parsed?.enableCameraTestMode === true,
      }));
    } catch (err) {
      console.warn('[Scene] restore failed:', err);
    }
  }, []);

  useEffect(() => {
    // Startup hard reset: always begin in normal mode to avoid stale split deformation.
    setSceneConfig((prev) => (prev.mode === 'normal' ? prev : { ...prev, mode: 'normal' }));
  }, []);

  useEffect(() => {
    try {
      const persistScene = {
        ...sceneConfig,
        // Do not persist split-mode ON state across app restarts.
        mode: 'normal',
      };
      window.localStorage.setItem(SCENE_STORAGE_KEY, JSON.stringify(persistScene));
    } catch (err) {
      console.warn('[Scene] persist failed:', err);
    }

    if (isElectron && typeof window.churchDisplay?.sendProjectorScene === 'function') {
      window.churchDisplay.sendProjectorScene(sceneConfig);
    }
  }, [sceneConfig, isElectron, projectorActive]);

  useEffect(() => {
    if (!isElectron) return;
    if (sceneConfig.mode !== 'normal') return;
    if (!currentSlide) return;
    // Force a full-width re-render immediately after disabling split mode.
    if (typeof window.churchDisplay?.sendProjectorScene === 'function') {
      window.churchDisplay.sendProjectorScene(sceneConfig);
    }
    window.churchDisplay.sendToProjector(currentSlide);
    if (typeof window.churchDisplay?.sendToProjectorBackground === 'function') {
      window.churchDisplay.sendToProjectorBackground(currentSlide?.background || null);
    }
  }, [sceneConfig.mode, sceneConfig, currentSlide, isElectron]);

  const stopCameraPreview = useCallback(() => {
    const stream = cameraStreamRef.current;
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      cameraStreamRef.current = null;
    }
    if (cameraPreviewRef.current) {
      cameraPreviewRef.current.srcObject = null;
    }
  }, []);

  const loadCameraDevices = useCallback(async () => {
    if (!navigator?.mediaDevices?.enumerateDevices) return;
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videos = devices.filter((d) => d.kind === 'videoinput');
      setCameraDevices(videos);
      if (!sceneConfig.cameraDeviceId && videos.length > 0) {
        setSceneConfig((prev) => ({ ...prev, cameraDeviceId: videos[0].deviceId || '' }));
      }
    } catch (err) {
      console.warn('[Camera] enumerate failed:', err);
    }
  }, [sceneConfig.cameraDeviceId]);

  const startCameraPreview = useCallback(async () => {
    if (sceneConfig.enableCameraTestMode) {
      stopCameraPreview();
      setCameraStatus('idle');
      return;
    }
    if (!navigator?.mediaDevices?.getUserMedia) {
      setCameraStatus('unsupported');
      return;
    }

    try {
      setCameraStatus('loading');
      stopCameraPreview();

      const constraints = sceneConfig.cameraDeviceId
        ? { video: { deviceId: { exact: sceneConfig.cameraDeviceId } }, audio: false }
        : { video: true, audio: false };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      cameraStreamRef.current = stream;
      if (cameraPreviewRef.current) {
        cameraPreviewRef.current.srcObject = stream;
        cameraPreviewRef.current.muted = true;
        cameraPreviewRef.current.defaultMuted = true;
        cameraPreviewRef.current.play().catch(() => {});
      }
      setCameraStatus('ok');
      await loadCameraDevices();
    } catch (err) {
      setCameraStatus('error');
      console.warn('[Camera] preview failed:', err);
    }
  }, [sceneConfig.cameraDeviceId, sceneConfig.enableCameraTestMode, stopCameraPreview, loadCameraDevices]);

  useEffect(() => {
    if (sceneConfig.mode !== 'split_camera') {
      stopCameraPreview();
      setCameraStatus('idle');
      return;
    }
    startCameraPreview();
  }, [sceneConfig.mode, sceneConfig.cameraDeviceId, startCameraPreview, stopCameraPreview]);

  useEffect(() => {
    if (!(sceneConfig.mode === 'split_camera' && sceneConfig.enableCameraTestMode)) return;
    const t = setInterval(() => setPreviewTestNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [sceneConfig.mode, sceneConfig.enableCameraTestMode]);

  useEffect(() => {
    loadCameraDevices();
    const handler = () => loadCameraDevices();
    navigator?.mediaDevices?.addEventListener?.('devicechange', handler);
    return () => {
      navigator?.mediaDevices?.removeEventListener?.('devicechange', handler);
      stopCameraPreview();
    };
  }, [loadCameraDevices, stopCameraPreview]);

  useEffect(() => {
    const el = cameraPreviewRef.current;
    const stream = cameraStreamRef.current;
    if (!el || !stream) return;
    if (el.srcObject !== stream) {
      el.srcObject = stream;
      el.muted = true;
      el.defaultMuted = true;
      el.play().catch(() => {});
    }
  }, [cameraStatus, sceneConfig.mode, sceneConfig.cameraDeviceId]);

  useEffect(() => {
    const el = previewStageRef.current;
    if (!el) return;
    const applySize = () => setPreviewStageWidth(el.clientWidth || 0);
    applySize();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', applySize);
      return () => window.removeEventListener('resize', applySize);
    }
    const observer = new ResizeObserver(() => applySize());
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const el = textCanvasRef.current;
    if (!el) return;
    const applySize = () => setTextCanvasWidth(el.clientWidth || 0);
    applySize();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', applySize);
      return () => window.removeEventListener('resize', applySize);
    }
    const observer = new ResizeObserver(() => applySize());
    observer.observe(el);
    return () => observer.disconnect();
  }, [activeSection]);

  useEffect(() => {
    const el = textEditableRef.current;
    if (!el) return;
    if (document.activeElement === el) return;
    const current = (el.innerText || '').replace(/\r/g, '');
    const next = (textContent || '').replace(/\r/g, '');
    if (current !== next) {
      el.innerText = next;
    }
  }, [textContent, activeSection]);

  const clearPreviewTimers = useCallback(() => {
    previewTimersRef.current.forEach((t) => clearTimeout(t));
    previewTimersRef.current = [];
  }, []);

  const formatTime = useCallback((seconds) => {
    if (!Number.isFinite(seconds) || seconds < 0) return '00:00';
    const s = Math.floor(seconds % 60).toString().padStart(2, '0');
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }, []);

  const getPreviewTextSize = useCallback((slide, fallbackPx) => {
    const raw = Number(slide?.fontSizePx);
    const widthRatio = Math.max(0.12, (previewStageWidth || 384) / 1920);
    if (Number.isFinite(raw) && raw > 0) {
      const scaled = Math.round(raw * widthRatio);
      return `${Math.max(9, Math.min(72, scaled))}px`;
    }
    const fallbackScaled = Math.round(Number(fallbackPx || 14) * Math.max(0.85, widthRatio * 5));
    return `${Math.max(9, Math.min(42, fallbackScaled))}px`;
  }, [previewStageWidth]);

  const getPreviewMediaUrl = useCallback((filePath) => {
    if (!filePath) return '';
    if (/^https?:\/\//i.test(filePath)) return filePath;
    return `local-media://${encodeURIComponent(filePath)}`;
  }, []);

  const textCanvasWidthRatio = Math.max(0.12, (textCanvasWidth || 960) / 1920);
  const textCanvasDisplayFontPx = Math.max(12, Math.min(220, Math.round(textSizePx * textCanvasWidthRatio)));

  const normalizeYouTubeUrl = useCallback((payload) => {
    const direct = payload?.url?.trim();
    if (direct) {
      try {
        const u = new URL(direct);
        const host = u.hostname.toLowerCase();
        const toWatch = (id) => `https://www.youtube.com/watch?v=${encodeURIComponent(id)}`;
        if (host === 'youtu.be') {
          const id = u.pathname.replace('/', '').trim();
          if (id) return toWatch(id);
        }
        if (host.includes('youtube.com') || host === 'm.youtube.com' || host === 'music.youtube.com') {
          if (u.pathname.startsWith('/watch')) {
            const id = (u.searchParams.get('v') || '').trim();
            if (id) return toWatch(id);
          }
          if (u.pathname.startsWith('/shorts/')) {
            const id = (u.pathname.split('/')[2] || '').trim();
            if (id) return toWatch(id);
          }
          if (u.pathname.startsWith('/embed/')) {
            const id = (u.pathname.split('/')[2] || '').trim();
            if (id) return toWatch(id);
          }
        }
      } catch (_) {}
      return direct;
    }
    const vid = payload?.videoId?.trim();
    if (!vid) return '';
    return `https://www.youtube.com/watch?v=${encodeURIComponent(vid)}`;
  }, []);

  const getYouTubeVideoId = useCallback((payload) => {
    const directId = (payload?.videoId || '').trim();
    if (directId) return directId;
    const raw = normalizeYouTubeUrl(payload);
    if (!raw) return '';
    try {
      const u = new URL(raw);
      if (u.hostname.includes('youtu.be')) {
        return u.pathname.replace('/', '').trim();
      }
      if (u.hostname.includes('youtube.com')) {
        if (u.pathname.startsWith('/watch')) return (u.searchParams.get('v') || '').trim();
        if (u.pathname.startsWith('/shorts/')) return (u.pathname.split('/')[2] || '').trim();
        if (u.pathname.startsWith('/embed/')) return (u.pathname.split('/')[2] || '').trim();
      }
    } catch (_) {}
    return '';
  }, [normalizeYouTubeUrl]);

  const getYouTubeEmbedUrl = useCallback((payload) => {
    const videoId = getYouTubeVideoId(payload);
    if (!videoId) return '';
    const origin = encodeURIComponent('https://www.youtube.com');
    return `https://www.youtube.com/embed/${videoId}?autoplay=1&controls=1&modestbranding=1&rel=0&playsinline=1&origin=${origin}&enablejsapi=1`;
  }, [getYouTubeVideoId]);

  const resolveYouTubePayload = useCallback(async (payload) => {
    if (!payload || payload.type !== 'youtube') return payload;

    const inputUrl = normalizeYouTubeUrl(payload);
    if (!inputUrl) return payload;

    if (!isElectron) {
      return {
        type: 'youtube',
        videoId: payload.videoId || '',
        url: inputUrl,
        name: payload.name || 'YouTube',
        youtubeMode: 'watch-page',
      };
    }

    if (typeof window.churchDisplay?.youtubeCacheDownload !== 'function') {
      throw new Error('This build does not include YouTube cache downloader.');
    }

    const resolved = await window.churchDisplay.youtubeCacheDownload(inputUrl);
    if (!resolved?.success || !resolved?.localPath) {
      throw new Error(resolved?.error || 'YouTube cache download failed.');
    }

    return {
      type: 'video',
      path: resolved.localPath,
      name: resolved.title || payload.name || 'YouTube Video',
      source: 'youtube-cache',
      videoId: resolved.videoId || payload.videoId || '',
      originalUrl: resolved.originalUrl || inputUrl,
    };
  }, [isElectron, normalizeYouTubeUrl]);

  const applyPreviewTransition = useCallback((nextSlide) => {
    clearPreviewTimers();

    if (!transitionEnabled) {
      setPreviewSlide(nextSlide);
      setPreviewMaskVisible(false);
      return;
    }

    setPreviewMaskVisible(true);
    const fadeOutTimer = setTimeout(() => {
      const delayTimer = setTimeout(() => {
        setPreviewSlide(nextSlide);
        const fadeInTimer = setTimeout(() => {
          setPreviewMaskVisible(false);
        }, transitionDurationMs);
        previewTimersRef.current.push(fadeInTimer);
      }, transitionDelayMs);
      previewTimersRef.current.push(delayTimer);
    }, transitionDurationMs);
    previewTimersRef.current.push(fadeOutTimer);
  }, [transitionEnabled, transitionDelayMs, transitionDurationMs, clearPreviewTimers]);

  useEffect(() => {
    return () => clearPreviewTimers();
  }, [clearPreviewTimers]);

  const handleStartProjector = useCallback((displayId) => {
    if (isElectron) {
      window.churchDisplay.startProjector(displayId);
    } else {
      setProjectorActive(true);
      setProjectorDisplayId(displayId);
    }
  }, [isElectron]);

  // Stop Projector
  const handleStopProjector = useCallback(() => {
    if (isElectron) {
      window.churchDisplay.stopProjector();
    } else {
      setProjectorActive(false);
      setProjectorDisplayId(null);
    }
  }, [isElectron]);

  const handleMinimizeWindow = useCallback(() => {
    if (isElectron && typeof window.churchDisplay?.minimizeControlWindow === 'function') {
      window.churchDisplay.minimizeControlWindow();
    }
  }, [isElectron]);

  const handleToggleMaximizeWindow = useCallback(() => {
    if (isElectron && typeof window.churchDisplay?.toggleMaximizeControlWindow === 'function') {
      window.churchDisplay.toggleMaximizeControlWindow();
    }
  }, [isElectron]);

  const handleCloseWindow = useCallback(() => {
    if (isElectron && typeof window.churchDisplay?.closeControlWindow === 'function') {
      window.churchDisplay.closeControlWindow();
    }
  }, [isElectron]);

  const pushToProjector = useCallback((data) => {
    setCurrentSlide(data);
    applyPreviewTransition(data);
    if (isElectron) {
      window.churchDisplay.sendToProjector(data);
      if (typeof window.churchDisplay.sendToProjectorBackground === 'function') {
        window.churchDisplay.sendToProjectorBackground(data?.background || null);
      }
    }
  }, [isElectron, applyPreviewTransition, sceneConfig]);

  const handleSendToProjector = useCallback((content) => {
    const data = {
      type: 'text',
      text: content || textContent,
      fontSize: fontSize,
      fontSizePx: textSizePx,
      fontFamily: textFontFamily,
      textColor: textColor,
      background: textBackground,
      textLayout,
      timestamp: Date.now(),
    };
    pushToProjector(data);
  }, [textContent, fontSize, textSizePx, textFontFamily, textColor, textBackground, textLayout, pushToProjector]);

  const handleAddTextToQueue = useCallback(() => {
    if (!textContent.trim()) return;
    const payload = {
      type: 'text',
      text: textContent,
      fontSize,
      fontSizePx: textSizePx,
      fontFamily: textFontFamily,
      textColor: textColor,
      background: textBackground,
      textLayout,
      timestamp: Date.now(),
    };
    setProjectorQueue((prev) => {
      const title = getQueueItemTitle(payload);
      if (activeQueueIndex >= 0 && activeQueueIndex < prev.length) {
        const existing = prev[activeQueueIndex];
        const next = [...prev];
        next[activeQueueIndex] = {
          ...existing,
          title,
          type: payload.type,
          payload,
          section: 'text',
          updatedAt: Date.now(),
        };
        return next;
      }
      return [...prev, buildQueueItem(payload, title, 'text')];
    });
  }, [textContent, fontSize, textSizePx, textFontFamily, textColor, textBackground, textLayout, buildQueueItem, getQueueItemTitle, activeQueueIndex]);

  useEffect(() => {
    if (activeSection === 'text' && textContent.trim() && currentSlide?.type === 'text') {
      handleSendToProjector();
    }
  }, [textBackground]);

  // Blackout
  const handleBlackout = useCallback(() => {
    setCurrentSlide(null);
    applyPreviewTransition(null);
    if (isElectron) {
      window.churchDisplay.blackout();
    }
  }, [isElectron, applyPreviewTransition]);

  const resetFreeTextEditor = useCallback(() => {
    setTextContent('');
    setFontSize('large');
    setTextSizePx(72);
    setTextFontFamily('Noto Sans SC');
    setTextColor('#ffffff');
    setTextBackground(null);
    setTextLayout({ xPercent: 50, yPercent: 50, scale: 1 });
    setTextSnapGuide({ vertical: false, horizontal: false });
    textTransformRef.current = { mode: null, startX: 0, startY: 0, startLayout: null, startTextSizePx: 72 };
  }, []);

  const handleExportSetupBundle = useCallback(async () => {
    if (!isElectron || typeof window.churchDisplay?.exportSetupBundle !== 'function') {
      alert('Export is available in the desktop app only.');
      return;
    }
    try {
      setSetupTransferBusy(true);
      const res = await window.churchDisplay.exportSetupBundle();
      if (res?.cancelled) return;
      if (res?.success) {
        const mb = Number((Number(res.totalBytes || 0) / (1024 * 1024)).toFixed(2));
        const missingCount = Array.isArray(res.missingRefs) ? res.missingRefs.length : 0;
        alert(
          `Export completed (${res.mode || 'minimal'}).\n` +
          `Copied files: ${res.copiedCount || 0}\n` +
          `Bundle size: ${mb} MB\n` +
          `Missing refs: ${missingCount}\n\n` +
          `Folder:\n${res.backupDir}`
        );
      } else {
        alert(`Export failed: ${res?.error || 'Unknown error'}`);
      }
    } catch (err) {
      alert(`Export failed: ${err?.message || 'Unknown error'}`);
    } finally {
      setSetupTransferBusy(false);
    }
  }, [isElectron]);

  const handleImportSetupBundle = useCallback(async () => {
    if (!isElectron || typeof window.churchDisplay?.importSetupBundle !== 'function') {
      alert('Import is available in the desktop app only.');
      return;
    }
    const ok = window.confirm('Import will overwrite queue/config/songs, and merge media files without deleting existing local media. Continue?');
    if (!ok) return;
    try {
      setSetupTransferBusy(true);
      const res = await window.churchDisplay.importSetupBundle();
      if (res?.cancelled) return;
      if (res?.success) {
        const mb = Number((Number(res.totalBytes || 0) / (1024 * 1024)).toFixed(2));
        const warningText = Array.isArray(res.warnings) && res.warnings.length > 0
          ? `\nWarnings: ${res.warnings.length}`
          : '';
        alert(
          `Import completed (${res.mode || 'minimal'}).\n` +
          `Copied: ${res.copiedCount || 0}\n` +
          `Skipped existing: ${res.skippedCount || 0}\n` +
          `Data size: ${mb} MB${warningText}\n\n` +
          `Please restart the app now.`
        );
      } else {
        alert(`Import failed: ${res?.error || 'Unknown error'}`);
      }
    } catch (err) {
      alert(`Import failed: ${err?.message || 'Unknown error'}`);
    } finally {
      setSetupTransferBusy(false);
    }
  }, [isElectron]);

  const handleProjectMedia = useCallback(async (mediaData) => {
    try {
      const playableData = mediaData?.type === 'youtube'
        ? await resolveYouTubePayload({
            ...mediaData,
            videoId: mediaData.videoId || getYouTubeVideoId(mediaData),
            url: normalizeYouTubeUrl(mediaData),
            name: mediaData.name || 'YouTube',
          })
        : mediaData;
      pushToProjector(playableData);
    } catch (err) {
      alert(`YouTube play failed: ${err.message || 'Unknown error'}`);
    }
  }, [pushToProjector, normalizeYouTubeUrl, getYouTubeVideoId, resolveYouTubePayload]);

  const handleAddPlaylistItem = useCallback((item) => {
    const payload = item?.payload || null;
    if (!payload) return;
    const title = item?.name || getQueueItemTitle(payload);
    setProjectorQueue((prev) => {
      if (activeQueueIndex >= 0 && activeQueueIndex < prev.length) {
        const existing = prev[activeQueueIndex];
        const next = [...prev];
        next[activeQueueIndex] = {
          ...existing,
          title,
          type: payload.type || 'media',
          payload,
          section: 'media',
          updatedAt: Date.now(),
        };
        return next;
      }
      return [...prev, buildQueueItem(payload, title, 'media')];
    });
  }, [buildQueueItem, getQueueItemTitle, activeQueueIndex]);

  const handleAddSongQueueItem = useCallback((payload, title) => {
    if (!payload) return;
    const nextTitle = title || getQueueItemTitle(payload);
    setProjectorQueue((prev) => {
      if (activeQueueIndex >= 0 && activeQueueIndex < prev.length) {
        const existing = prev[activeQueueIndex];
        const next = [...prev];
        next[activeQueueIndex] = {
          ...existing,
          title: nextTitle,
          type: payload.type || 'song',
          payload,
          section: 'songs',
          updatedAt: Date.now(),
        };
        return next;
      }
      return [...prev, buildQueueItem(payload, nextTitle, 'songs')];
    });
  }, [buildQueueItem, getQueueItemTitle, activeQueueIndex]);

  const handleAddBibleQueueItem = useCallback((payload, title) => {
    if (!payload) return;
    const nextTitle = title || getQueueItemTitle(payload);
    setProjectorQueue((prev) => {
      if (activeQueueIndex >= 0 && activeQueueIndex < prev.length) {
        const existing = prev[activeQueueIndex];
        const next = [...prev];
        next[activeQueueIndex] = {
          ...existing,
          title: nextTitle,
          type: payload.type || 'bible',
          payload,
          section: 'bible',
          updatedAt: Date.now(),
        };
        return next;
      }
      return [...prev, buildQueueItem(payload, nextTitle, 'bible')];
    });
  }, [buildQueueItem, getQueueItemTitle, activeQueueIndex]);

  const handleUpdateActiveQueueItem = useCallback((payload, title, expectedSection = null) => {
    if (!payload) return;
    let didUpdate = false;
    setProjectorQueue((prev) => {
      if (activeQueueIndex < 0 || activeQueueIndex >= prev.length) return prev;
      const existing = prev[activeQueueIndex];
      if (expectedSection && existing?.section && existing.section !== expectedSection) {
        return prev;
      }
      const resolvedTitle = title || existing?.title || getQueueItemTitle(payload);
      const resolvedType = payload.type || existing?.type || 'text';
      const resolvedSection = expectedSection || existing?.section || resolveSectionForPayload(payload);
      const samePayload = JSON.stringify(existing?.payload ?? null) === JSON.stringify(payload ?? null);
      const sameTitle = (existing?.title || '') === resolvedTitle;
      const sameType = (existing?.type || '') === resolvedType;
      const sameSection = (existing?.section || '') === resolvedSection;
      if (samePayload && sameTitle && sameType && sameSection) {
        return prev;
      }
      const next = [...prev];
      next[activeQueueIndex] = {
        ...existing,
        title: resolvedTitle,
        type: resolvedType,
        payload,
        section: resolvedSection,
        updatedAt: Date.now(),
      };
      didUpdate = true;
      return next;
    });
    if (didUpdate) {
      showToast('Auto-saved to selected queue card');
    }
  }, [activeQueueIndex, getQueueItemTitle, resolveSectionForPayload, showToast]);

  const handlePlayQueueItem = useCallback(async (index) => {
    if (index < 0 || index >= projectorQueue.length) return;
    const item = projectorQueue[index];
    setActiveQueueIndex(index);
    if (item.section) {
      setActiveSection(item.section);
    }
    if (item.section === 'media' && (item.payload?.type === 'ppt' || item.payload?.type === 'pdf')) {
      setActivePreloadItem({
        type: item.payload.type,
        payload: {
          type: item.payload.type,
          path: item.payload.path,
          name: item.payload.name || item.title,
          deferProject: item.payload.type === 'ppt' || item.payload.type === 'pdf',
        },
        token: Date.now(),
      });
      return;
    } else if (item.section === 'songs' && item.payload?.type === 'song') {
      setActivePreloadItem({
        type: 'song',
        payload: {
          songId: item.payload.songId,
          songTitle: item.payload.songTitle || item.title,
        },
        token: Date.now(),
      });
      return;
    } else if (item.section === 'bible' && item.payload?.type === 'bible') {
      setActivePreloadItem({
        type: 'bible',
        payload: {
          ...item.payload,
          title: item.title,
        },
        token: Date.now(),
      });
    } else {
      setActivePreloadItem(null);
    }
    try {
      const playableData = item.payload?.type === 'youtube'
        ? await resolveYouTubePayload({
            ...item.payload,
            videoId: item.payload.videoId || getYouTubeVideoId(item.payload),
            url: normalizeYouTubeUrl(item.payload),
            name: item.payload.name || item.title || 'YouTube',
          })
        : item.payload;
      pushToProjector(playableData);
    } catch (err) {
      alert(`YouTube play failed: ${err.message || 'Unknown error'}`);
    }
  }, [projectorQueue, pushToProjector, normalizeYouTubeUrl, getYouTubeVideoId, resolveYouTubePayload]);

  const handleQueuePrev = useCallback(() => {
    if (projectorQueue.length === 0) return;
    const nextIndex = activeQueueIndex <= 0 ? 0 : activeQueueIndex - 1;
    handlePlayQueueItem(nextIndex);
  }, [activeQueueIndex, projectorQueue.length, handlePlayQueueItem]);

  const handleQueueNext = useCallback(() => {
    if (projectorQueue.length === 0) return;
    const nextIndex = activeQueueIndex < 0 ? 0 : Math.min(activeQueueIndex + 1, projectorQueue.length - 1);
    handlePlayQueueItem(nextIndex);
  }, [activeQueueIndex, projectorQueue.length, handlePlayQueueItem]);

  const handleMoveQueueItem = useCallback((fromIndex, toIndex) => {
    if (fromIndex === toIndex) return;
    if (fromIndex < 0 || toIndex < 0) return;
    setProjectorQueue((prev) => {
      if (fromIndex >= prev.length || toIndex >= prev.length) return prev;
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
    setActiveQueueIndex((prev) => {
      if (prev === fromIndex) return toIndex;
      if (fromIndex < prev && toIndex >= prev) return prev - 1;
      if (fromIndex > prev && toIndex <= prev) return prev + 1;
      return prev;
    });
  }, []);

  const handleRemoveQueueItem = useCallback((index) => {
    setProjectorQueue((prev) => prev.filter((_, i) => i !== index));
    setActiveQueueIndex((prev) => {
      if (prev === index) return -1;
      if (prev > index) return prev - 1;
      return prev;
    });
  }, []);

  const handleRemoveActiveQueueItem = useCallback(() => {
    if (activeQueueIndex < 0 || activeQueueIndex >= projectorQueue.length) return;
    handleRemoveQueueItem(activeQueueIndex);
  }, [activeQueueIndex, projectorQueue.length, handleRemoveQueueItem]);

  const handleStartRenameQueueItem = useCallback((item) => {
    if (!item?.id) return;
    setEditingQueueId(item.id);
    setEditingQueueTitle(item.title || '');
  }, []);

  const handleCommitRenameQueueItem = useCallback(() => {
    if (!editingQueueId) return;
    const nextTitle = editingQueueTitle.trim();
    if (nextTitle) {
      setProjectorQueue((prev) => prev.map((item) => (
        item.id === editingQueueId ? { ...item, title: nextTitle } : item
      )));
    }
    setEditingQueueId(null);
    setEditingQueueTitle('');
  }, [editingQueueId, editingQueueTitle]);

  const handleCancelRenameQueueItem = useCallback(() => {
    setEditingQueueId(null);
    setEditingQueueTitle('');
  }, []);

  const handleClearQueue = useCallback(() => {
    setProjectorQueue([]);
    setActiveQueueIndex(-1);
  }, []);

  const handleOpenBackgroundPicker = useCallback((target) => {
    setBackgroundPickerTarget(target);
    setActiveSection('media');
  }, []);

  const handlePickBackgroundFromMedia = useCallback((bg) => {
    if (!bg || !backgroundPickerTarget) return;
    if (backgroundPickerTarget === 'songs') {
      setSongPickedBackground({
        ...bg,
        pickToken: Date.now(),
      });
      setActiveSection('songs');
    } else if (backgroundPickerTarget === 'bible') {
      setBiblePickedBackground(bg);
      setActiveSection('bible');
    } else if (backgroundPickerTarget === 'text') {
      setTextBackground(bg);
      setActiveSection('text');
    }
    setBackgroundPickerTarget(null);
  }, [backgroundPickerTarget]);

  const handleCancelBackgroundPicker = useCallback(() => {
    if (backgroundPickerTarget === 'songs') setActiveSection('songs');
    if (backgroundPickerTarget === 'bible') setActiveSection('bible');
    if (backgroundPickerTarget === 'text') setActiveSection('text');
    setBackgroundPickerTarget(null);
  }, [backgroundPickerTarget]);

  const refreshLicenseStatus = useCallback(async () => {
    if (!isElectron || typeof window.churchDisplay?.licenseGetStatus !== 'function') return;
    const status = await window.churchDisplay.licenseGetStatus();
    if (status) setLicenseStatus(status);
  }, [isElectron]);

  const handleOpenLegal = useCallback(async () => {
    setShowLegalModal(true);
    setLicenseActionError('');
    setLicenseActionMsg('');
    try {
      if (isElectron && typeof window.churchDisplay?.legalGetDocument === 'function') {
        const eula = await window.churchDisplay.legalGetDocument('eula');
        if (eula?.success && typeof eula.text === 'string') setEulaText(eula.text);
      }
      await refreshLicenseStatus();
    } catch (err) {
      console.warn('[Legal] load failed:', err);
    }
  }, [isElectron, refreshLicenseStatus]);

  const handleActivateLicense = useCallback(async () => {
    if (!isElectron || typeof window.churchDisplay?.licenseActivate !== 'function') {
      setLicenseActionError('Current environment does not support license activation.');
      setLicenseActionMsg('');
      return;
    }
    if (!licenseInput.trim()) {
      setLicenseActionError('Please enter a license key.');
      setLicenseActionMsg('');
      return;
    }
    try {
      const result = await window.churchDisplay.licenseActivate(licenseInput.trim());
      if (result?.success) {
        setLicenseStatus(result.status || licenseStatus);
        setLicenseActionMsg('License activated.');
        setLicenseActionError('');
      } else {
        setLicenseActionError(result?.error || 'License activation failed.');
        setLicenseActionMsg('');
      }
    } catch (err) {
      setLicenseActionError(err.message || 'License activation failed.');
      setLicenseActionMsg('');
    }
  }, [isElectron, licenseInput, licenseStatus]);

  const handleClearLicense = useCallback(async () => {
    if (!isElectron || typeof window.churchDisplay?.licenseClear !== 'function') {
      setLicenseActionError('Current environment does not support clearing license.');
      setLicenseActionMsg('');
      return;
    }
    try {
      const result = await window.churchDisplay.licenseClear();
      if (result?.success) {
        setLicenseStatus(result.status || licenseStatus);
        setLicenseActionMsg('Local license cleared.');
        setLicenseActionError('');
      } else {
        setLicenseActionError(result?.error || 'Failed to clear license.');
        setLicenseActionMsg('');
      }
    } catch (err) {
      setLicenseActionError(err.message || 'Failed to clear license.');
      setLicenseActionMsg('');
    }
  }, [isElectron, licenseStatus]);

  const handleAcceptEula = useCallback(async () => {
    if (!isElectron || typeof window.churchDisplay?.legalAcceptEula !== 'function') {
      setLicenseActionError('Current environment does not support EULA acceptance.');
      setLicenseActionMsg('');
      return;
    }
    try {
      const result = await window.churchDisplay.legalAcceptEula();
      if (result?.success) {
        setLicenseStatus(result.status || licenseStatus);
        setLicenseActionMsg('EULA acceptance recorded.');
        setLicenseActionError('');
      } else {
        setLicenseActionError(result?.error || 'Operation failed.');
        setLicenseActionMsg('');
      }
    } catch (err) {
      setLicenseActionError(err.message || 'Operation failed.');
      setLicenseActionMsg('');
    }
  }, [isElectron, licenseStatus]);


  return (
    <div className="app-container">
      {/* === Top Bar === */}
      <div className="top-bar">
        <div className="top-bar__brand">
          <div className="top-bar__logo">CD</div>
                <span className="top-bar__title">
                  ChurchDisplay Pro ({'\u6b64\u7248\u672c\u4e3a\u591a\u4f26\u591a\u795e\u53ec\u4f1a\u6d3b\u77f3\u5802\u7279\u4f9b--\u7248\u6743\u5c5e\u4e8eAiden\u6240\u6709scanf2006@gmail.com'}) v{APP_VERSION}
                </span>
        </div>
        <div className="top-bar__controls">
          {/* Projector Status */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--color-text-secondary)' }}>
            <span className={`status-dot ${projectorActive ? 'status-dot--active' : 'status-dot--inactive'}`}></span>
            {projectorActive ? 'Projecting' : 'Idle'}
          </div>
          <button className="btn btn--ghost" onClick={handleOpenLegal} style={{ padding: '4px 10px', fontSize: '12px' }}>
            License
          </button>
          <button className="btn btn--ghost btn--icon" onClick={() => handleSendToProjector(' ')} title="Clear">
            Clr
          </button>
          {/* Blackout */}
          <button className="btn btn--ghost btn--icon" onClick={handleBlackout} title="Blackout">
            Blk
          </button>
          <button
            className="btn btn--ghost btn--icon"
            onClick={handleMinimizeWindow}
            title="Minimize"
          >
            _
          </button>
          <button
            className="btn btn--ghost btn--icon"
            onClick={handleToggleMaximizeWindow}
            title="Maximize / Restore"
          >
            [ ]
          </button>
          <button
            className="btn btn--ghost btn--icon"
            onClick={handleCloseWindow}
            title="Close"
            style={{ color: '#ff6b6b' }}
          >
            X
          </button>
        </div>
      </div>

      {/* === Sidebar === */}
      <div className="sidebar">
        <div className="sidebar-nav">
          <div className="sidebar__section-title">Projection</div>
          <div
            className={`sidebar__item ${activeSection === 'displays' ? 'sidebar__item--active' : ''}`}
            onClick={() => {
              setActiveQueueIndex(-1);
              setActiveSection('displays');
            }}
          >
            <span className="sidebar__item-icon">D</span>
            Displays
          </div>

          <div className="sidebar__section-title">Content</div>
          <div
            className={`sidebar__item ${activeSection === 'text' ? 'sidebar__item--active' : ''}`}
            onClick={() => {
              setActiveQueueIndex(-1);
              resetFreeTextEditor();
              setActiveSection('text');
            }}
          >
            <span className="sidebar__item-icon">T</span>
            Free Text
          </div>
          <div
            className={`sidebar__item ${activeSection === 'songs' ? 'sidebar__item--active' : ''}`}
            onClick={() => {
              setActiveQueueIndex(-1);
              setSongsListOpenToken(Date.now());
              setActiveSection('songs');
            }}
          >
            <span className="sidebar__item-icon">S</span>
            Songs
          </div>
          <div
            className={`sidebar__item ${activeSection === 'bible' ? 'sidebar__item--active' : ''}`}
            onClick={() => {
              setActiveQueueIndex(-1);
              setBibleCatalogOpenToken(Date.now());
              setActiveSection('bible');
            }}
          >
            <span className="sidebar__item-icon">B</span>
            Bible
          </div>
          <div
            className={`sidebar__item ${activeSection === 'media' ? 'sidebar__item--active' : ''}`}
            onClick={() => {
              setActiveQueueIndex(-1);
              setMediaHomeOpenToken(Date.now());
              setActiveSection('media');
            }}
          >
            <span className="sidebar__item-icon">M</span>
            Media
          </div>

        </div>

        <div className="sidebar-playlist">
          <div className="sidebar__section-title" style={{ paddingTop: 0 }}>Queue</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1, overflowY: 'auto' }}>
            {projectorQueue.length === 0 && (
              <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', padding: '12px 6px' }}>
                Add items from Media or Free Text.              </div>
            )}
            {projectorQueue.map((item, index) => (
              <div
                key={item.id}
                draggable
                onDragStart={() => setDraggingQueueId(item.id)}
                onDragEnd={() => setDraggingQueueId(null)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  if (!draggingQueueId || draggingQueueId === item.id) return;
                  const fromIndex = projectorQueue.findIndex((q) => q.id === draggingQueueId);
                  handleMoveQueueItem(fromIndex, index);
                  setDraggingQueueId(null);
                }}
                style={{
                  border: index === activeQueueIndex ? '2px solid #ff4d4f' : '1px solid var(--color-border)',
                  borderRadius: '8px',
                  padding: '8px 8px',
                  background: index === activeQueueIndex ? 'rgba(255, 77, 79, 0.14)' : 'var(--color-surface)',
                  boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.03)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span
                    title="Drag to reorder"
                    style={{ fontSize: '10px', color: 'var(--color-text-muted)', cursor: 'grab', userSelect: 'none' }}
                  >
                    ::
                  </span>
                  <span style={{ fontSize: '10px', color: 'var(--color-text-secondary)', minWidth: '16px' }}>{index + 1}.</span>
                  {editingQueueId === item.id ? (
                    <input
                      autoFocus
                      type="text"
                      value={editingQueueTitle}
                      onChange={(e) => setEditingQueueTitle(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleCommitRenameQueueItem();
                        if (e.key === 'Escape') handleCancelRenameQueueItem();
                      }}
                      onBlur={handleCommitRenameQueueItem}
                      style={{
                        flex: 1,
                        fontSize: '11px',
                        padding: '4px 6px',
                        borderRadius: '4px',
                        border: '1px solid var(--color-primary)',
                        background: 'var(--color-surface)',
                        color: 'var(--color-text-primary)',
                        outline: 'none',
                      }}
                    />
                  ) : (
                    <span
                      onClick={() => handlePlayQueueItem(index)}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        handleStartRenameQueueItem(item);
                      }}
                      style={{ flex: 1, fontSize: '11px', cursor: 'pointer', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                      title="Click to project; double-click to rename"
                    >
                      {item.title}
                    </span>
                  )}
                  {editingQueueId !== item.id && (
                    <button
                      className="btn btn--ghost"
                      style={{ padding: '1px 6px', fontSize: '10px' }}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStartRenameQueueItem(item);
                      }}
                      title="Rename card"
                    >
                      Edit
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
          <button
            className="btn btn--ghost"
            style={{ width: '100%', marginTop: '8px', color: '#ff6b6b' }}
            onClick={handleRemoveActiveQueueItem}
            disabled={activeQueueIndex < 0 || activeQueueIndex >= projectorQueue.length}
            title="Delete selected queue card"
          >
            Del Selected
          </button>
              <button className="btn btn--ghost" style={{ width: '100%', marginTop: '8px' }} onClick={handleClearQueue} disabled={projectorQueue.length === 0}>
                Clear Queue
              </button>
            </div>
      </div>

      {/* === Main Content === */}
      <div className="main-content">
        <div className="animate-slide-in-up" style={{ display: activeSection === 'displays' ? 'block' : 'none' }}>
            <h2 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px' }}>Displays</h2>
            <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginBottom: '24px' }}>
              Select an external display to start projection. Content will be fullscreen on the selected screen.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {displays.map((display) => (
                <div
                  key={display.id}
                  className={`display-card ${projectorDisplayId === display.id ? 'display-card--active' : ''}`}
                  onClick={() => !display.isPrimary && handleStartProjector(display.id)}
                >
                  <span className="display-card__icon">
                    {display.isPrimary ? 'P' : 'E'}
                  </span>
                  <div className="display-card__info">
                    <div className="display-card__name">{display.label || `Display ${display.id}`}</div>
                    <div className="display-card__resolution">
                      {display.size.width} x {display.size.height}
                      {display.bounds && ` | Position (${display.bounds.x}, ${display.bounds.y})`}
                    </div>
                  </div>
                  {display.isPrimary && (
                    <span className="display-card__badge display-card__badge--primary">Primary</span>
                  )}
                  {projectorDisplayId === display.id && (
                    <span className="display-card__badge display-card__badge--projecting">Projecting</span>
                  )}
                </div>
              ))}
            </div>

            {projectorActive && (
              <button
                className="btn btn--danger btn--lg"
                style={{ marginTop: '24px', width: '100%' }}
                onClick={handleStopProjector}
              >
                Stop Projector
              </button>
            )}

            {displays.filter(d => !d.isPrimary).length === 0 && (
              <div style={{
                marginTop: '24px',
                padding: '20px',
                background: 'rgba(245, 158, 11, 0.08)',
                border: '1px solid rgba(245, 158, 11, 0.2)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--color-warning)',
                fontSize: '13px',
              }}>
                No external display detected. Connect a projector/monitor and try again.
              </div>
            )}
          </div>

        <div className="text-editor animate-slide-in-up" style={{ display: activeSection === 'text' ? 'block' : 'none' }}>
            <h2 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '8px' }}>Free Text Projection</h2>
            <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginBottom: '16px' }}>
              Type any text and click "Send to Projector".
            </p>

            <div
              ref={textCanvasRef}
              style={{
                position: 'relative',
                width: '100%',
                aspectRatio: previewAspectRatio || '16 / 9',
                border: '1px solid var(--color-border)',
                borderRadius: '10px',
                overflow: 'hidden',
                background: '#000',
                marginBottom: '10px',
              }}
            >
              {textBackground?.type === 'image' && textBackground?.path && (
                <img
                  src={getPreviewMediaUrl(textBackground.path)}
                  alt="text-bg"
                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: 1 }}
                />
              )}
              {textBackground?.type === 'video' && textBackground?.path && (
                <video
                  src={getPreviewMediaUrl(textBackground.path)}
                  autoPlay
                  loop
                  muted
                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: 1 }}
                />
              )}
              <div style={{ position: 'absolute', inset: 0, background: 'rgba(0, 0, 0, 0.22)', zIndex: 2 }} />
              {textSnapGuide.vertical && (
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    bottom: 0,
                    left: '50%',
                    width: '1px',
                    background: 'rgba(76, 201, 240, 0.95)',
                    boxShadow: '0 0 8px rgba(76, 201, 240, 0.8)',
                    zIndex: 4,
                    pointerEvents: 'none',
                  }}
                />
              )}
              {textSnapGuide.horizontal && (
                <div
                  style={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    top: '50%',
                    height: '1px',
                    background: 'rgba(76, 201, 240, 0.95)',
                    boxShadow: '0 0 8px rgba(76, 201, 240, 0.8)',
                    zIndex: 4,
                    pointerEvents: 'none',
                  }}
                />
              )}
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  zIndex: 5,
                }}
              >
                <div
                  ref={textLayerRef}
                  style={{
                    position: 'absolute',
                    left: `${textLayout.xPercent}%`,
                    top: `${textLayout.yPercent}%`,
                    transform: `translate(-50%, -50%) scale(${textLayout.scale})`,
                    transformOrigin: 'center center',
                    width: '88%',
                    maxWidth: '88%',
                  }}
                  onMouseDown={startTextDrag}
                >
                  <div
                    onMouseDown={startTextDrag}
                    title="Drag to move"
                    style={{
                      position: 'absolute',
                      top: '-24px',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      padding: '2px 10px',
                      fontSize: '11px',
                      fontWeight: 700,
                      letterSpacing: '0.4px',
                      borderRadius: '999px',
                      border: '1px solid rgba(255,255,255,0.75)',
                      background: 'rgba(76, 201, 240, 0.9)',
                      color: '#0b1024',
                      cursor: 'move',
                      userSelect: 'none',
                    }}
                  >
                    MOVE
                  </div>
                  <div
                    ref={textEditableRef}
                    contentEditable
                    suppressContentEditableWarning
                    spellCheck={false}
                    onInput={(e) => setTextContent(e.currentTarget.innerText.replace(/\r/g, ''))}
                    style={{
                      width: '100%',
                      minHeight: '56%',
                      maxHeight: '86%',
                      overflowY: 'auto',
                      padding: '8px 6px',
                      outline: 'none',
                      border: '1px dashed rgba(255,255,255,0.28)',
                      borderRadius: '8px',
                      background: 'rgba(0,0,0,0.08)',
                      fontFamily: textFontFamily,
                      color: textColor,
                      fontSize: `${textCanvasDisplayFontPx}px`,
                      fontWeight: 700,
                      lineHeight: 1.6,
                      whiteSpace: 'pre-wrap',
                      textAlign: 'center',
                      direction: 'ltr',
                      unicodeBidi: 'plaintext',
                      writingMode: 'horizontal-tb',
                      textShadow: '2px 2px 8px rgba(0, 0, 0, 0.85)',
                    }}
                  />
                  <div
                    onMouseDown={startTextResize}
                    title="Drag to resize"
                    style={{
                      position: 'absolute',
                      right: '-8px',
                      bottom: '-8px',
                      width: '14px',
                      height: '14px',
                      borderRadius: '3px',
                      background: 'rgba(76, 201, 240, 0.95)',
                      border: '1px solid rgba(255,255,255,0.8)',
                      cursor: 'nwse-resize',
                      boxShadow: '0 0 8px rgba(76, 201, 240, 0.6)',
                    }}
                  />
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button className="btn btn--ghost" onClick={() => handleOpenBackgroundPicker('text')}>
                Pick Background from Media
              </button>
              {textBackground && (
                <button className="btn btn--ghost" onClick={() => setTextBackground(null)}>Clear Background</button>
              )}
              <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                {textBackground ? `Selected: ${textBackground.name || textBackground.path}` : 'No background selected'}
              </span>
            </div>

            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>Font Size:</span>
              {['small', 'medium', 'large'].map((size) => (
                <button
                  key={size}
                  className={`btn ${fontSize === size ? 'btn--primary' : 'btn--ghost'}`}
                  onClick={() => {
                    setFontSize(size);
                    if (size === 'small') setTextSizePx(48);
                    else if (size === 'medium') setTextSizePx(72);
                    else setTextSizePx(96);
                  }}
                >
                  {size === 'small' ? 'Small' : size === 'medium' ? 'Medium' : 'Large'}
                </button>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', alignItems: 'center' }}>
              <input
                type="number"
                min={24}
                max={180}
                value={textSizePx}
                onChange={(e) => setTextSizePx(Math.max(24, Math.min(180, Number(e.target.value || 72))))}
                style={{ padding: '8px', borderRadius: '6px', border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text-primary)' }}
                title="Text Size (px)"
              />
              <select
                value={textFontFamily}
                onChange={(e) => setTextFontFamily(e.target.value)}
                style={{ padding: '8px', borderRadius: '6px', border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text-primary)' }}
              >
                {TEXT_FONT_OPTIONS.map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
              <input
                type="color"
                value={textColor}
                onChange={(e) => setTextColor(e.target.value)}
                style={{ width: '100%', height: '36px', border: '1px solid var(--color-border)', borderRadius: '6px', background: 'transparent' }}
                title="Text Color"
              />
            </div>
            <button
              className="btn btn--success btn--lg"
              style={{ width: '100%' }}
              onClick={() => handleSendToProjector()}
              disabled={!textContent.trim()}
            >
              Send to Projector            </button>
            <button
              className="btn btn--ghost"
              style={{ width: '100%' }}
              onClick={handleAddTextToQueue}
              disabled={!textContent.trim()}
            >
              + Add to Queue
            </button>
          </div>

        <div style={{ display: activeSection === 'bible' ? 'block' : 'none' }}>
          <BibleBrowser
            onProjectContent={handleProjectMedia}
            onQueueContent={handleAddBibleQueueItem}
            onUpdateActiveQueueItem={handleUpdateActiveQueueItem}
            activePreloadItem={activePreloadItem}
            forceShowBibleCatalogToken={bibleCatalogOpenToken}
            onOpenBackgroundPicker={() => handleOpenBackgroundPicker('bible')}
            externalBackground={biblePickedBackground}
          />
        </div>

        <div style={{ display: activeSection === 'songs' ? 'block' : 'none' }}>
          <SongManager
            onProjectContent={handleProjectMedia}
            onQueueContent={handleAddSongQueueItem}
            onUpdateActiveQueueItem={handleUpdateActiveQueueItem}
            activePreloadItem={activePreloadItem}
            onOpenBackgroundPicker={() => handleOpenBackgroundPicker('songs')}
            externalBackground={songPickedBackground}
            forceShowSongListToken={songsListOpenToken}
          />
        </div>

        <div style={{ display: activeSection === 'media' ? 'block' : 'none' }}>
          <MediaManager
            onProjectMedia={handleProjectMedia}
            onAddPlaylist={handleAddPlaylistItem}
            activePreloadItem={activePreloadItem}
            forceShowMediaHomeToken={mediaHomeOpenToken}
            backgroundPickerTarget={backgroundPickerTarget}
            onPickBackground={handlePickBackgroundFromMedia}
            onCancelBackgroundPick={handleCancelBackgroundPicker}
          />
        </div>
      </div>

      {/* === Preview Panel === */}
      <div className="preview-panel">
        <div className="preview-panel__title">Live Preview</div>

        {/* Projector Preview */}
        <div ref={previewStageRef} className="preview-screen" style={{ aspectRatio: '16 / 9' }}>
          <span className="preview-screen__label">Projector Output</span>
          <div className="preview-screen__content">
            {previewSlide ? (
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  position: 'relative',
                  textAlign: previewSlide?.type === 'bible' ? 'left' : 'center',
                  overflow: 'hidden',
                  background: '#000',
                }}
              >
                {previewSlide.background && (
                  <div style={{ position: 'absolute', inset: 0, zIndex: 1 }}>
                    {previewSlide.background.type === 'video' ? (
                      <video
                        src={getPreviewMediaUrl(previewSlide.background.path)}
                        autoPlay
                        loop
                        muted
                        style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center center', borderRadius: 0 }}
                      />
                    ) : (
                      <img
                        src={getPreviewMediaUrl(previewSlide.background.path)}
                        alt="bg"
                        style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center center', borderRadius: 0 }}
                      />
                    )}
                    <div style={{ position: 'absolute', inset: 0, background: 'rgba(0, 0, 0, 0.08)' }} />
                  </div>
                )}

                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    bottom: 0,
                    width: previewSplitEnabled ? `${previewContentPanePercent}%` : '100%',
                    zIndex: 2,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: (previewSlide.type === 'text' || previewSlide.type === 'bible' || previewSlide.type === 'lyrics') ? '12px' : '0px',
                  }}
                >
                  {previewSlide.type === 'text' && (
                    <div
                      style={{
                        position: 'absolute',
                        left: `${Math.max(8, Math.min(92, Number(previewSlide?.textLayout?.xPercent ?? 50)))}%`,
                        top: `${Math.max(10, Math.min(90, Number(previewSlide?.textLayout?.yPercent ?? 50)))}%`,
                        transform: `translate(-50%, -50%) scale(${Math.max(0.5, Math.min(3.2, Number(previewSlide?.textLayout?.scale ?? 1)))})`,
                        width: '88%',
                        textAlign: 'center',
                      }}
                    >
                      <div style={{
                        fontSize: getPreviewTextSize(previewSlide, previewSlide.fontSize === 'large' ? 16 : previewSlide.fontSize === 'medium' ? 12 : 10),
                        fontWeight: '700',
                        color: previewSlide.textColor || '#fff',
                        fontFamily: previewSlide.fontFamily || 'inherit',
                        whiteSpace: 'pre-line',
                        lineHeight: '1.6',
                        textShadow: '1px 1px 4px rgba(0,0,0,0.8)',
                      }}>
                        {previewSlide.text}
                      </div>
                    </div>
                  )}
                  {previewSlide.type === 'image' && (
                    <img
                      src={getPreviewMediaUrl(previewSlide.path)}
                      alt={previewSlide.name}
                      style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center center', borderRadius: 0 }}
                    />
                  )}
                  {previewSlide.type === 'video' && (
                    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
                      <video
                        ref={previewVideoRef}
                        src={getPreviewMediaUrl(previewSlide.path)}
                        style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center center', borderRadius: 0 }}
                        autoPlay
                        loop
                        onLoadedMetadata={(e) => {
                          e.currentTarget.muted = false;
                          e.currentTarget.defaultMuted = false;
                          e.currentTarget.volume = 1;
                          setPreviewVideoDuration(e.currentTarget.duration || 0);
                          e.currentTarget.play().catch(() => {});
                        }}
                        onTimeUpdate={(e) => setPreviewVideoCurrent(e.currentTarget.currentTime || 0)}
                        onPlay={() => setPreviewVideoPaused(false)}
                        onPause={() => setPreviewVideoPaused(true)}
                        onVolumeChange={(e) => setPreviewVideoMuted(!!e.currentTarget.muted)}
                      />
                      <div
                        style={{
                          position: 'absolute',
                          left: '8px',
                          right: '8px',
                          bottom: '8px',
                          zIndex: 4,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '8px',
                          background: 'rgba(0,0,0,0.55)',
                          border: '1px solid rgba(255,255,255,0.14)',
                          borderRadius: '6px',
                          padding: '4px 8px',
                        }}
                      >
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button
                            className="btn btn--ghost"
                            style={{ padding: '2px 8px', fontSize: '11px' }}
                            onClick={() => {
                              const v = previewVideoRef.current;
                              if (!v) return;
                              if (v.paused) v.play().catch(() => {});
                              else v.pause();
                            }}
                          >
                            {previewVideoPaused ? 'Resume' : 'Pause'}
                          </button>
                          <button
                            className="btn btn--ghost"
                            style={{ padding: '2px 8px', fontSize: '11px' }}
                            onClick={() => {
                              const v = previewVideoRef.current;
                              if (!v) return;
                              v.pause();
                              v.currentTime = 0;
                              setPreviewVideoCurrent(0);
                            }}
                          >
                            Stop
                          </button>
                          <button
                            className="btn btn--ghost"
                            style={{ padding: '2px 8px', fontSize: '11px' }}
                            onClick={() => {
                              const v = previewVideoRef.current;
                              if (!v) return;
                              v.muted = !v.muted;
                              setPreviewVideoMuted(v.muted);
                            }}
                          >
                            {previewVideoMuted ? 'Unmute' : 'Mute'}
                          </button>
                        </div>
                        <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.9)', minWidth: '72px', textAlign: 'right' }}>
                          {formatTime(previewVideoCurrent)} / {formatTime(previewVideoDuration)}
                        </div>
                      </div>
                    </div>
                  )}
                  {previewSlide.type === 'youtube' && (
                    (() => {
                      const embedUrl = getYouTubeEmbedUrl(previewSlide);
                      if (!embedUrl) {
                        return (
                          <div style={{ color: '#fff', fontSize: '12px', opacity: 0.85 }}>
                            YouTube preview unavailable
                          </div>
                        );
                      }
                      return (
                        <iframe
                          src={embedUrl}
                          title={previewSlide.name || 'YouTube Preview'}
                          referrerPolicy="origin"
                          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                          allowFullScreen
                          style={{ width: '100%', height: '100%', border: 'none', borderRadius: 0 }}
                        />
                      );
                    })()
                  )}
                  {previewSlide.type === 'pdf' && (
                    <div style={{ width: '100%', height: '100%', position: 'relative', background: '#111' }}>
                      <PdfRenderer
                        path={previewSlide.path}
                        pageNumber={previewSlide.page || 1}
                      />
                      <div
                        style={{
                          position: 'absolute',
                          left: '8px',
                          bottom: '6px',
                          fontSize: '10px',
                          color: 'rgba(255,255,255,0.75)',
                          background: 'rgba(0,0,0,0.45)',
                          padding: '2px 6px',
                          borderRadius: '4px',
                        }}
                      >
                        {previewSlide.name} | Page {previewSlide.page || 1}                      </div>
                    </div>
                  )}
                  {previewSlide.type === 'bible' && (
                    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
                      <div style={{
                        position: 'absolute',
                        inset: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'flex-start',
                        padding: '8px',
                        width: '100%',
                        fontSize: getPreviewTextSize(previewSlide, previewSlide.fontSize === 'large' ? 14 : previewSlide.fontSize === 'medium' ? 11 : 9),
                        fontWeight: '600',
                        color: previewSlide.textColor || '#fff',
                        fontFamily: previewSlide.fontFamily || 'inherit',
                        whiteSpace: 'pre-line',
                        lineHeight: '1.6',
                        textAlign: 'left',
                      }}>
                        {previewSlide.text}
                      </div>
                      <div style={{
                        position: 'absolute',
                        right: '8px',
                        bottom: '6px',
                        fontSize: '11px',
                        color: 'rgba(255,255,255,0.96)',
                        fontStyle: 'italic',
                        textShadow: '1px 1px 4px rgba(0,0,0,0.9)',
                      }}>
                        - {previewSlide.reference}
                      </div>
                    </div>
                  )}
                {previewSlide.type === 'lyrics' && (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                    {(previewSlide.songTitle || previewSlide.sectionTitle) && (
                      <div style={{ fontSize: '9px', color: 'var(--color-primary)', fontWeight: 'bold' }}>
                        {previewSlide.songTitle || ''}
                        {previewSlide.songTitle && previewSlide.sectionTitle ? ' | ' : ''}
                        {previewSlide.sectionTitle || ''}
                      </div>
                    )}
                    <div style={{
                      fontSize: getPreviewTextSize(previewSlide, previewSlide.fontSize === 'large' ? 14 : previewSlide.fontSize === 'medium' ? 11 : 9),
                      fontWeight: '700',
                      color: previewSlide.textColor || '#fff',
                      fontFamily: previewSlide.fontFamily || 'inherit',
                      whiteSpace: 'pre-line',
                      lineHeight: '1.8',
                      textAlign: 'center',
                    }}>
                        {previewSlide.text}
                      </div>
                    </div>
                  )}
                </div>
                {previewSplitEnabled && (
                  <>
                    <div
                      style={{
                        position: 'absolute',
                        top: 0,
                        bottom: 0,
                        right: `${previewRightPanePercent}%`,
                        width: '1px',
                        background: 'rgba(255,255,255,0.2)',
                        zIndex: 8,
                      }}
                    />
                    <div
                      style={{
                        position: 'absolute',
                        top: 0,
                        bottom: 0,
                        right: 0,
                        width: `${previewRightPanePercent}%`,
                        zIndex: 9,
                        background: '#000',
                        overflow: 'hidden',
                      }}
                    >
                      {sceneConfig.enableCameraTestMode ? (
                        <div
                          style={{
                            width: '100%',
                            height: '100%',
                            transform: `scale(${previewCameraScale})`,
                            transformOrigin: 'center center',
                            background: 'linear-gradient(135deg, #0b1220 0%, #1f2a44 40%, #22325b 100%)',
                            position: 'relative',
                            overflow: 'hidden',
                          }}
                        >
                          <div style={{
                            position: 'absolute',
                            inset: 0,
                            backgroundImage: 'repeating-linear-gradient(45deg, rgba(255,255,255,0.06) 0 12px, rgba(255,255,255,0.02) 12px 24px)',
                          }} />
                          <div style={{
                            position: 'absolute',
                            inset: '14px',
                            border: '1px solid rgba(255,255,255,0.28)',
                          }} />
                          <div style={{
                            position: 'absolute',
                            left: 0,
                            right: 0,
                            top: '50%',
                            height: '1px',
                            background: 'rgba(255,255,255,0.32)',
                          }} />
                          <div style={{
                            position: 'absolute',
                            top: 0,
                            bottom: 0,
                            left: '50%',
                            width: '1px',
                            background: 'rgba(255,255,255,0.32)',
                          }} />
                          <div style={{
                            position: 'absolute',
                            left: '10px',
                            top: '10px',
                            fontSize: '10px',
                            color: '#8ee7ff',
                            fontWeight: 700,
                            letterSpacing: '0.5px',
                          }}>
                            CAMERA
                          </div>
                          <div style={{
                            position: 'absolute',
                            right: '10px',
                            bottom: '10px',
                            fontSize: '10px',
                            color: 'rgba(255,255,255,0.9)',
                            fontFamily: 'monospace',
                          }}>
                            {new Date(previewTestNow).toLocaleTimeString()}
                          </div>
                        </div>
                      ) : (
                        <>
                          <video
                            ref={cameraPreviewRef}
                            muted
                            autoPlay
                            playsInline
                            style={{
                              width: '100%',
                              height: '100%',
                              objectFit: 'cover',
                              transform: `scale(${previewCameraScale})`,
                              transformOrigin: 'center center',
                            }}
                          />
                        </>
                      )}
                      {!sceneConfig.enableCameraTestMode && cameraStatus !== 'ok' && (
                        <div
                          style={{
                            position: 'absolute',
                            inset: 0,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            textAlign: 'center',
                            fontSize: '11px',
                            color: 'rgba(255,255,255,0.9)',
                            background: 'rgba(0,0,0,0.6)',
                            padding: '8px',
                          }}
                        >
                          {cameraStatus === 'loading' ? 'Loading camera...' : cameraStatus === 'error' ? 'Camera unavailable' : 'Camera idle'}
                        </div>
                      )}
                    </div>
                  </>
                )}
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background: '#000',
                    opacity: previewMaskVisible ? 0.55 : 0,
                    transition: `opacity ${transitionDurationMs}ms ease`,
                    pointerEvents: 'none',
                    zIndex: 3,
                  }}
                />
              </div>
            ) : (
              <span style={{ fontSize: '11px' }}>No content</span>
            )}
          </div>
        </div>

        {/* Next Preview */}
          <div className="preview-screen" style={{ aspectRatio: '16 / 9' }}>
          <span className="preview-screen__label">Next</span>
          <div className="preview-screen__content">
            {projectorQueue.length > 0 ? (
              <span style={{ fontSize: '11px' }}>
                {projectorQueue[(activeQueueIndex >= 0 ? activeQueueIndex + 1 : 0) >= projectorQueue.length
                  ? projectorQueue.length - 1
                  : (activeQueueIndex >= 0 ? activeQueueIndex + 1 : 0)]?.title || 'No content'}
              </span>
            ) : (
              <span style={{ fontSize: '11px' }}>No content</span>
            )}
          </div>
        </div>

        {/* Display Info */}
        <div style={{ marginTop: 'auto' }}>
          <div className="preview-panel__title" style={{ marginBottom: '10px' }}>Transition</div>
          <div style={{ padding: '8px', border: '1px solid var(--color-border)', borderRadius: '8px', background: 'rgba(255,255,255,0.02)', marginBottom: '12px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', marginBottom: '6px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={transitionEnabled}
                onChange={(e) => setTransitionEnabled(e.target.checked)}
              />
              Fade In/Out
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
              <div>
                <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', marginBottom: '3px' }}>Delay (ms)</div>
                <input
                  type="number"
                  min={0}
                  max={5000}
                  value={transitionDelayMs}
                  onChange={(e) => setTransitionDelayMs(Math.max(0, Math.min(5000, Number(e.target.value || 0))))}
                  style={{ width: '100%', padding: '4px 6px', fontSize: '11px', borderRadius: '6px', border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text-primary)' }}
                />
              </div>
              <div>
                <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', marginBottom: '3px' }}>Duration (ms)</div>
                <input
                  type="number"
                  min={0}
                  max={5000}
                  value={transitionDurationMs}
                  onChange={(e) => setTransitionDurationMs(Math.max(0, Math.min(5000, Number(e.target.value || 0))))}
                  style={{ width: '100%', padding: '4px 6px', fontSize: '11px', borderRadius: '6px', border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text-primary)' }}
                />
              </div>
            </div>
          </div>

          <div style={{ display: 'none', padding: '8px', border: '1px solid var(--color-border)', borderRadius: '8px', background: 'rgba(255,255,255,0.02)', marginBottom: '12px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', marginBottom: '8px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={sceneConfig.mode === 'split_camera'}
                onChange={(e) => setSceneConfig((prev) => ({ ...prev, mode: e.target.checked ? 'split_camera' : 'normal' }))}
              />
              Enable Camera Split (Left Content / Right Camera)
            </label>
            <div style={{ marginBottom: '8px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', marginBottom: '8px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={sceneConfig.enableCameraTestMode === true}
                  onChange={(e) => setSceneConfig((prev) => ({ ...prev, enableCameraTestMode: e.target.checked }))}
                />
                Camera Test Mode (No physical camera)
              </label>
              <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', marginBottom: '3px' }}>Camera Device</div>
              <select
                value={sceneConfig.cameraDeviceId || ''}
                onChange={(e) => setSceneConfig((prev) => ({ ...prev, cameraDeviceId: e.target.value }))}
                disabled={sceneConfig.enableCameraTestMode === true}
                style={{ width: '100%', padding: '4px 6px', fontSize: '11px', borderRadius: '6px', border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text-primary)' }}
              >
                {cameraDevices.length === 0 && <option value="">No camera detected</option>}
                {cameraDevices.map((d, idx) => (
                  <option key={d.deviceId || idx} value={d.deviceId || ''}>
                    {d.label || `Camera ${idx + 1}`}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', marginBottom: '3px' }}>
                Right Camera Width (%): {Math.max(20, Math.min(40, sceneConfig.cameraPanePercent))}
              </div>
              <input
                type="range"
                min={20}
                max={40}
                step={1}
                value={Math.max(20, Math.min(40, sceneConfig.cameraPanePercent))}
                onChange={(e) => setSceneConfig((prev) => ({ ...prev, cameraPanePercent: Number(e.target.value) }))}
                style={{ width: '100%' }}
              />
            </div>
            <div style={{ marginTop: '8px' }}>
              <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', marginBottom: '3px' }}>
                Camera Center Crop (%): {Math.max(100, Math.min(220, sceneConfig.cameraCenterCropPercent || 100))}
              </div>
              <input
                type="range"
                min={100}
                max={220}
                step={5}
                value={Math.max(100, Math.min(220, sceneConfig.cameraCenterCropPercent || 100))}
                onChange={(e) => setSceneConfig((prev) => ({ ...prev, cameraCenterCropPercent: Number(e.target.value) }))}
                style={{ width: '100%' }}
              />
            </div>
          </div>

          <div className="preview-panel__title" style={{ marginBottom: '12px' }}>System Info</div>
          <div style={{
            fontSize: '12px',
            color: 'var(--color-text-muted)',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Detected Displays</span>
              <span style={{ color: 'var(--color-text-secondary)' }}>{displays.length}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Projector Status</span>
              <span style={{ color: projectorActive ? 'var(--color-success)' : 'var(--color-text-muted)' }}>
                {projectorActive ? 'Running' : 'Stopped'}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Environment</span>
              <span style={{ color: 'var(--color-text-secondary)' }}>
                {isElectron ? 'Electron' : 'Browser'}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Export Mode</span>
              <span style={{ color: 'var(--color-text-secondary)' }}>Smart Minimal Bundle</span>
            </div>
            <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
              <button
                className="btn btn--ghost"
                style={{ flex: 1, padding: '6px 8px', fontSize: '11px' }}
                onClick={handleExportSetupBundle}
                disabled={setupTransferBusy}
              >
                Export Setup
              </button>
              <button
                className="btn btn--ghost"
                style={{ flex: 1, padding: '6px 8px', fontSize: '11px' }}
                onClick={handleImportSetupBundle}
                disabled={setupTransferBusy}
              >
                Import Setup
              </button>
            </div>
            {setupTransferBusy && (
              <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                Processing setup package...
              </div>
            )}
          </div>
        </div>
      </div>

      {showLegalModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000,
          }}
          onClick={() => setShowLegalModal(false)}
        >
          <div
            style={{
              width: 'min(920px, 92vw)',
              maxHeight: '84vh',
              overflow: 'auto',
              background: '#12121f',
              border: '1px solid rgba(255,255,255,0.14)',
              borderRadius: '10px',
              padding: '16px',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <div style={{ fontSize: '16px', fontWeight: 600 }}>License</div>
              <button className="btn btn--ghost" onClick={() => setShowLegalModal(false)} style={{ padding: '4px 10px' }}>Close</button>
            </div>

            <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginBottom: '10px' }}>
              Current Status: {licenseStatus.isLicensed ? 'Licensed' : 'Unlicensed'} | {licenseStatus.summary || 'Unlicensed'}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginBottom: '12px' }}>
              EULA: {licenseStatus.hasAcceptedEula ? `Accepted (${licenseStatus.acceptedEulaAt || ''})` : 'Not accepted'}
            </div>
            <div style={{ fontSize: '12px', color: '#f6d365', marginBottom: '12px' }}>
              Copyright Notice: {'\u7248\u6743\u6240\u6709\u5f52 Aiden \u6240\u6709\uff1bChurchDisplay Pro \u591a\u4f26\u591a\u795e\u53ec\u4f1a\u6d3b\u77f3\u5802\u7248\u4e3a\u8d60\u4e0e\u7248\uff08non-transferable gifted edition\uff09\u3002'}
            </div>

            <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
              <input
                type="text"
                placeholder="Enter license key (CDP1....)"
                value={licenseInput}
                onChange={(e) => setLicenseInput(e.target.value)}
                style={{
                  flex: 1,
                  padding: '8px 10px',
                  borderRadius: '6px',
                  border: '1px solid rgba(255,255,255,0.2)',
                  background: '#0d0d16',
                  color: '#fff',
                  fontSize: '12px',
                }}
              />
              <button className="btn btn--primary" onClick={handleActivateLicense}>Activate</button>
              <button className="btn btn--ghost" onClick={handleClearLicense}>Clear License</button>
              <button className="btn btn--ghost" onClick={handleAcceptEula}>Accept EULA</button>
            </div>

            {licenseActionError && (
              <div style={{ color: '#ff8080', fontSize: '12px', marginBottom: '6px' }}>{licenseActionError}</div>
            )}
            {licenseActionMsg && (
              <div style={{ color: '#8af5a4', fontSize: '12px', marginBottom: '6px' }}>{licenseActionMsg}</div>
            )}

            <div style={{ marginTop: '10px', fontSize: '12px', color: 'var(--color-text-secondary)' }}>
              Recommendation: use code signing, disable devtools in release, and issue keys server-side.
            </div>
            <pre
              style={{
                marginTop: '10px',
                whiteSpace: 'pre-wrap',
                fontSize: '11px',
                lineHeight: 1.45,
                background: 'rgba(0,0,0,0.3)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '8px',
                padding: '10px',
                maxHeight: '42vh',
                overflow: 'auto',
              }}
            >
              {eulaText || 'Loading EULA...'}
            </pre>
          </div>
        </div>
      )}
      {toast && (
        <div
          style={{
            position: 'fixed',
            right: '16px',
            bottom: '16px',
            zIndex: 2100,
            padding: '10px 12px',
            borderRadius: '8px',
            border: '1px solid rgba(255,255,255,0.16)',
            background: toast.tone === 'success' ? 'rgba(16,185,129,0.18)' : 'rgba(59,130,246,0.18)',
            color: '#eafaf3',
            fontSize: '12px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.28)',
            backdropFilter: 'blur(4px)',
          }}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}

export default ControlPanel;








