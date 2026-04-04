import React, { useState, useEffect, useCallback, useRef } from 'react';
import MediaManager from './MediaManager';
import BibleBrowser from './BibleBrowser';
import SongManager from './SongManager';
import PdfRenderer from './PdfRenderer';

const QUEUE_STORAGE_KEY = 'churchdisplay.projectorQueue.v1';
const TRANSITION_STORAGE_KEY = 'churchdisplay.transition.v1';

/**
 * 控制台主面板
 * 负责Displays、Content编辑和Projection
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
  // 当前活动的侧边栏项
  const [activeSection, setActiveSection] = useState('text');
  // 文字Content编辑
  const [textContent, setTextContent] = useState('');
  const [fontSize, setFontSize] = useState('large');
  const [textBackground, setTextBackground] = useState(null);
  // Current projected content
  const [currentSlide, setCurrentSlide] = useState(null);
  // Preview side uses its own transition state
  const [previewSlide, setPreviewSlide] = useState(null);
  const [previewMaskVisible, setPreviewMaskVisible] = useState(false);
  const [previewVideoCurrent, setPreviewVideoCurrent] = useState(0);
  const [previewVideoDuration, setPreviewVideoDuration] = useState(0);
  const [previewVideoPaused, setPreviewVideoPaused] = useState(false);
  const [previewVideoMuted, setPreviewVideoMuted] = useState(false);
  const previewTimersRef = useRef([]);
  const previewVideoRef = useRef(null);
  // Queue
  const [projectorQueue, setProjectorQueue] = useState([]);
  const [queueHydrated, setQueueHydrated] = useState(false);
  const [activeQueueIndex, setActiveQueueIndex] = useState(-1);
  const [draggingQueueId, setDraggingQueueId] = useState(null);
  const [activePreloadItem, setActivePreloadItem] = useState(null);
  const [backgroundPickerTarget, setBackgroundPickerTarget] = useState(null); // 'songs' | 'bible' | 'text' | null
  const [songPickedBackground, setSongPickedBackground] = useState(null);
  const [biblePickedBackground, setBiblePickedBackground] = useState(null);
  const [transitionEnabled, setTransitionEnabled] = useState(true);
  const [transitionDelayMs, setTransitionDelayMs] = useState(20);
  const [transitionDurationMs, setTransitionDurationMs] = useState(60);
  const [showLegalModal, setShowLegalModal] = useState(false);
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

  // 检查是否在 Electron 环境
  const isElectron = typeof window.churchDisplay !== 'undefined';

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
      // 非 Electron 环境模拟数据
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

  // 恢复Transition设置
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

  const getYouTubeEmbedUrl = useCallback((videoId) => {
    if (!videoId) return '';
    return `https://www.youtube.com/embed/${videoId}?autoplay=1&controls=1&modestbranding=1&rel=0&playsinline=1`;
  }, []);

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

  // 启动投影
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

  const pushToProjector = useCallback((data) => {
    setCurrentSlide(data);
    applyPreviewTransition(data);
    if (isElectron) {
      window.churchDisplay.sendToProjector(data);
      if (typeof window.churchDisplay.sendToProjectorBackground === 'function') {
        window.churchDisplay.sendToProjectorBackground(data?.background || null);
      }
    }
  }, [isElectron, applyPreviewTransition]);

  // 发送Content到投影
  const handleSendToProjector = useCallback((content) => {
    const data = {
      type: 'text',
      text: content || textContent,
      fontSize: fontSize,
      background: textBackground,
      timestamp: Date.now(),
    };
    pushToProjector(data);
  }, [textContent, fontSize, textBackground, pushToProjector]);

  const handleAddTextToQueue = useCallback(() => {
    if (!textContent.trim()) return;
    const payload = {
      type: 'text',
      text: textContent,
      fontSize,
      background: textBackground,
      timestamp: Date.now(),
    };
    setProjectorQueue((prev) => [...prev, buildQueueItem(payload, getQueueItemTitle(payload), 'text')]);
  }, [textContent, fontSize, textBackground, buildQueueItem, getQueueItemTitle]);

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

  // 媒体投屏回调
  const handleProjectMedia = useCallback((mediaData) => {
    pushToProjector(mediaData);
  }, [pushToProjector]);

  const handleAddPlaylistItem = useCallback((item) => {
    const payload = item?.payload || null;
    if (!payload) return;
    const title = item?.name || getQueueItemTitle(payload);
    setProjectorQueue((prev) => [...prev, buildQueueItem(payload, title, 'media')]);
  }, [buildQueueItem, getQueueItemTitle]);

  const handleAddSongQueueItem = useCallback((payload, title) => {
    if (!payload) return;
    setProjectorQueue((prev) => [...prev, buildQueueItem(payload, title || getQueueItemTitle(payload), 'songs')]);
  }, [buildQueueItem, getQueueItemTitle]);

  const handleAddBibleQueueItem = useCallback((payload, title) => {
    if (!payload) return;
    setProjectorQueue((prev) => [...prev, buildQueueItem(payload, title || getQueueItemTitle(payload), 'bible')]);
  }, [buildQueueItem, getQueueItemTitle]);

  const handlePlayQueueItem = useCallback((index) => {
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
        },
        token: Date.now(),
      });
      return;
    } else if (item.section === 'songs' && item.payload?.type === 'song') {
      if (isElectron && typeof window.churchDisplay?.sendToProjectorBackground === 'function') {
        window.churchDisplay.sendToProjectorBackground(item.payload?.background || null);
      }
      setActivePreloadItem({
        type: 'song',
        payload: {
          songId: item.payload.songId,
          songTitle: item.payload.songTitle || item.title,
        },
        token: Date.now(),
      });
      return;
    } else {
      setActivePreloadItem(null);
    }
    pushToProjector(item.payload);
  }, [projectorQueue, pushToProjector]);

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
      setSongPickedBackground(bg);
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

  // 示例Content
  const sampleContent = [
    {
      id: 1,
      title: '濂囧紓鎭╁吀',
      text: '奇异恩典 何等甘甜\n我罪已得赦免\n前我失丧 今被寻回\n瞎眼今得看见',
    },
    {
      id: 2,
      title: '绾︾堪绂忛煶 3:16',
      text: '神爱世人，甚至将他的独生子赐给他们，\n叫一切信他的，不至灭亡，反得永生。',
    },
    {
      id: 3,
      title: '诗篇 23:1-3',
      text: '耶和华是我的牧者，我必不至缺乏。\n他使我躺卧在青草地上，\n领我在可安歇的水边。\n他使我的灵魂苏醒，\n为自己的名引导我走义路。',
    },
    {
      id: 4,
      title: '鎰熻阿绁',
      text: '鎰熻阿绁?璧愭垜鏁戣祹涓籠n鎰熻阿绁?涓板瘜棰勫\n鎰熻阿绁?杩囧幓鐨勫悓鍦╘n鎰熻阿绁?涓诲湪鎴戞梺',
    },
  ];

  return (
    <div className="app-container">
      {/* === Top Bar === */}
      <div className="top-bar">
        <div className="top-bar__brand">
          <div className="top-bar__logo">✦</div>
          <span className="top-bar__title">ChurchDisplay Pro (多伦多神召会活石堂赠与版, 版权归Aiden所有)</span>
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
            ⊘
          </button>
          {/* Blackout */}
          <button className="btn btn--ghost btn--icon" onClick={handleBlackout} title="Blackout">
            ◼
          </button>
          <button
            className="btn btn--ghost btn--icon"
            onClick={() => {
              if (isElectron && typeof window.churchDisplay?.closeControlWindow === 'function') {
                window.churchDisplay.closeControlWindow();
              }
            }}
            title="Close"
            style={{ color: '#ff6b6b' }}
          >
            ✕
          </button>
        </div>
      </div>

      {/* === Sidebar === */}
      <div className="sidebar">
        <div className="sidebar-nav">
          <div className="sidebar__section-title">Projection</div>
          <div
            className={`sidebar__item ${activeSection === 'displays' ? 'sidebar__item--active' : ''}`}
            onClick={() => setActiveSection('displays')}
          >
            <span className="sidebar__item-icon">🖥</span>
            Displays
          </div>

          <div className="sidebar__section-title">Content</div>
          <div
            className={`sidebar__item ${activeSection === 'text' ? 'sidebar__item--active' : ''}`}
            onClick={() => setActiveSection('text')}
          >
            <span className="sidebar__item-icon">T</span>
            Free Text
          </div>
          <div
            className={`sidebar__item ${activeSection === 'songs' ? 'sidebar__item--active' : ''}`}
            onClick={() => setActiveSection('songs')}
          >
            <span className="sidebar__item-icon">S</span>
            Songs
          </div>
          <div
            className={`sidebar__item ${activeSection === 'bible' ? 'sidebar__item--active' : ''}`}
            onClick={() => setActiveSection('bible')}
          >
            <span className="sidebar__item-icon">B</span>
            Bible
          </div>
          <div
            className={`sidebar__item ${activeSection === 'media' ? 'sidebar__item--active' : ''}`}
            onClick={() => setActiveSection('media')}
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
                  border: index === activeQueueIndex ? '1px solid var(--color-primary)' : '1px solid var(--color-border)',
                  borderRadius: '6px',
                  padding: '5px 6px',
                  background: index === activeQueueIndex ? 'rgba(99,102,241,0.12)' : 'var(--color-surface)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '10px', color: 'var(--color-text-secondary)', minWidth: '16px' }}>{index + 1}.</span>
                  <span
                    onClick={() => handlePlayQueueItem(index)}
                    style={{ flex: 1, fontSize: '11px', cursor: 'pointer', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                    title="Click to project and open source module"
                  >
                    {item.title}
                  </span>
                  <button className="btn btn--ghost" style={{ padding: '1px 5px', fontSize: '10px' }} onClick={() => handleMoveQueueItem(index, Math.max(index - 1, 0))}>↑</button>
                  <button className="btn btn--ghost" style={{ padding: '1px 5px', fontSize: '10px' }} onClick={() => handleMoveQueueItem(index, Math.min(index + 1, projectorQueue.length - 1))}>↓</button>
                  <button className="btn btn--ghost" style={{ padding: '1px 5px', fontSize: '10px', color: '#ff4d4f' }} onClick={() => handleRemoveQueueItem(index)}>✕</button>
                </div>
              </div>
            ))}
          </div>
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
                      {display.bounds && ` · Position (${display.bounds.x}, ${display.bounds.y})`}
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
                ⏹ Stop Projector
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
                ⚠️ No external display detected. Connect a projector/monitor and try again.
              </div>
            )}
          </div>

        <div className="text-editor animate-slide-in-up" style={{ display: activeSection === 'text' ? 'block' : 'none' }}>
            <h2 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '8px' }}>Free Text Projection</h2>
            <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginBottom: '16px' }}>
              Type any text and click "Send to Projector".
            </p>

            <textarea
              className="text-editor__textarea"
              placeholder="Type text to project..."
              value={textContent}
              onChange={(e) => setTextContent(e.target.value)}
            />

            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button className="btn btn--ghost" onClick={() => handleOpenBackgroundPicker('text')}>
                🎬 Pick Background from Media
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
                  onClick={() => setFontSize(size)}
                >
                  {size === 'small' ? 'Small' : size === 'medium' ? 'Medium' : 'Large'}
                </button>
              ))}
            </div>

            <button
              className="btn btn--success btn--lg"
              style={{ width: '100%' }}
              onClick={() => handleSendToProjector()}
              disabled={!textContent.trim()}
            >
              📤 Send to Projector            </button>
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
            onOpenBackgroundPicker={() => handleOpenBackgroundPicker('bible')}
            externalBackground={biblePickedBackground}
          />
        </div>

        <div style={{ display: activeSection === 'songs' ? 'block' : 'none' }}>
          <SongManager
            onProjectContent={handleProjectMedia}
            onQueueContent={handleAddSongQueueItem}
            activePreloadItem={activePreloadItem}
            onOpenBackgroundPicker={() => handleOpenBackgroundPicker('songs')}
            externalBackground={songPickedBackground}
          />
        </div>

        <div style={{ display: activeSection === 'media' ? 'block' : 'none' }}>
          <MediaManager
            onProjectMedia={handleProjectMedia}
            onAddPlaylist={handleAddPlaylistItem}
            activePreloadItem={activePreloadItem}
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
        <div className="preview-screen">
          <span className="preview-screen__label">Projector Output</span>
          <div className="preview-screen__content">
            {previewSlide ? (
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  position: 'relative',
                  textAlign: 'center',
                  overflow: 'hidden',
                  background: '#000',
                }}
              >
                {previewSlide.background && (
                  <div style={{ position: 'absolute', inset: 0, zIndex: 1 }}>
                    {previewSlide.background.type === 'video' ? (
                      <video
                        src={`local-media://${encodeURIComponent(previewSlide.background.path)}`}
                        autoPlay
                        loop
                        muted
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : (
                      <img
                        src={`local-media://${encodeURIComponent(previewSlide.background.path)}`}
                        alt="bg"
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    )}
                    <div style={{ position: 'absolute', inset: 0, background: 'rgba(0, 0, 0, 0.25)' }} />
                  </div>
                )}

                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    zIndex: 2,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '12px',
                  }}
                >
                  {previewSlide.type === 'text' && (
                    <div style={{
                      fontSize: previewSlide.fontSize === 'large' ? '16px' : previewSlide.fontSize === 'medium' ? '12px' : '10px',
                      fontWeight: '700',
                      color: '#fff',
                      whiteSpace: 'pre-line',
                      lineHeight: '1.6',
                    }}>
                      {previewSlide.text}
                    </div>
                  )}
                  {previewSlide.type === 'image' && (
                    <img
                      src={`local-media://${encodeURIComponent(previewSlide.path)}`}
                      alt={previewSlide.name}
                      style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                    />
                  )}
                  {previewSlide.type === 'video' && (
                    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
                      <video
                        ref={previewVideoRef}
                        src={`local-media://${encodeURIComponent(previewSlide.path)}`}
                        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
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
                    <iframe
                      src={getYouTubeEmbedUrl(previewSlide.videoId)}
                      title={previewSlide.name || 'YouTube Preview'}
                      allow="autoplay; encrypted-media; picture-in-picture"
                      allowFullScreen
                      style={{ width: '100%', height: '100%', border: 'none' }}
                    />
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
                        {previewSlide.name} · Page {previewSlide.page || 1}                      </div>
                    </div>
                  )}
                  {previewSlide.type === 'bible' && (
                    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
                      <div style={{
                        position: 'absolute',
                        inset: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '8px',
                        fontSize: previewSlide.fontSize === 'large' ? '14px' : previewSlide.fontSize === 'medium' ? '11px' : '9px',
                        fontWeight: '600',
                        color: '#fff',
                        whiteSpace: 'pre-line',
                        lineHeight: '1.6',
                        textAlign: 'center',
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
                        — {previewSlide.reference}
                      </div>
                    </div>
                  )}
                {previewSlide.type === 'lyrics' && (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                    {(previewSlide.songTitle || previewSlide.sectionTitle) && (
                      <div style={{ fontSize: '9px', color: 'var(--color-primary)', fontWeight: 'bold' }}>
                        {previewSlide.songTitle || ''}
                        {previewSlide.songTitle && previewSlide.sectionTitle ? ' · ' : ''}
                        {previewSlide.sectionTitle || ''}
                      </div>
                    )}
                    <div style={{
                      fontSize: previewSlide.fontSize === 'large' ? '14px' : previewSlide.fontSize === 'medium' ? '11px' : '9px',
                      fontWeight: '700', color: '#fff', whiteSpace: 'pre-line', lineHeight: '1.8', textAlign: 'center',
                    }}>
                        {previewSlide.text}
                      </div>
                    </div>
                  )}
                </div>
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
        <div className="preview-screen">
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
              Copyright Notice: 版权所有归 Aiden 所有；ChurchDisplay Pro 多伦多神召会活石堂版为赠与版（non-transferable gifted edition）。
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
    </div>
  );
}

export default ControlPanel;


