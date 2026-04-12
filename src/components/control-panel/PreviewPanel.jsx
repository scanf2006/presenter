import React, { useEffect, useState } from 'react';
import PdfRenderer from '../PdfRenderer';
import { formatTime, getPreviewTextSize, getPreviewMediaUrl } from '../../utils/preview';
import { PREVIEW, SCENE, TEXT_EDITOR, TRANSITION } from '../../constants/ui';
import { useAppContext } from '../../contexts/AppContext';
import { useProjectorContext } from '../../contexts/ProjectorContext';
import { useQueueContext } from '../../contexts/QueueContext';

function PreviewPanel({ nextQueueTitle }) {
  const { isElectron } = useAppContext();
  const {
    previewStageRef,
    previewSlide,
    previewSplitEnabled,
    previewContentPanePercent,
    previewRightPanePercent,
    previewCameraScale,
    previewStageWidth,
    previewVideoRef,
    handleLoadedMetadata,
    handleTimeUpdate,
    handlePlay,
    handlePause,
    handleVolumeChange,
    togglePauseResume,
    stopPlayback,
    toggleMute,
    previewVideoPaused,
    previewVideoMuted,
    previewVideoCurrent,
    previewVideoDuration,
    getYouTubeEmbedUrl,
    sceneConfig,
    previewTestNow,
    cameraPreviewRef,
    cameraStatus,
    previewMaskVisible,
    transitionDurationMs,
    transitionEnabled,
    setTransitionEnabled,
    transitionDelayMs,
    setTransitionDelayMs,
    setTransitionDurationMs,
    setSceneConfig,
    cameraDevices,
    displays,
    projectorActive,
    handleExportSetupBundle,
    handleImportSetupBundle,
    setupTransferBusy,
  } = useProjectorContext();

  const { projectorQueue } = useQueueContext();

  const previewTypeLabel = (() => {
    const t = previewSlide?.type;
    if (!t) return 'NONE';
    if (t === 'text') return 'TEXT';
    if (t === 'lyrics') return 'LYRICS';
    if (t === 'bible') return 'BIBLE';
    if (t === 'image') return 'IMAGE';
    if (t === 'video') return 'VIDEO';
    if (t === 'pdf') return 'PDF';
    if (t === 'youtube') return 'YOUTUBE';
    return String(t).toUpperCase();
  })();

  const previewPrimaryLabel =
    previewSlide?.songTitle ||
    previewSlide?.name ||
    previewSlide?.reference ||
    previewSlide?.title ||
    '';

  const [showPreviewStatusStrip, setShowPreviewStatusStrip] = useState(false);
  const [compactPreviewStatusStrip, setCompactPreviewStatusStrip] = useState(false);

  useEffect(() => {
    try {
      const savedVisible = window.localStorage.getItem('churchdisplay.ui.previewStatusVisible.v2');
      const savedCompact = window.localStorage.getItem('churchdisplay.ui.previewStatusCompact.v2');
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (savedVisible === '1') setShowPreviewStatusStrip(true);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (savedCompact === '1') setCompactPreviewStatusStrip(true);
    } catch (_) {
      // ignore restore failures
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        'churchdisplay.ui.previewStatusVisible.v2',
        showPreviewStatusStrip ? '1' : '0'
      );
      window.localStorage.setItem(
        'churchdisplay.ui.previewStatusCompact.v2',
        compactPreviewStatusStrip ? '1' : '0'
      );
    } catch (_) {
      // ignore persist failures
    }
  }, [showPreviewStatusStrip, compactPreviewStatusStrip]);

  return (
    <div className="preview-panel">
      <div className="preview-panel__head">
        <div className="preview-panel__title">Live Preview</div>
        <div className="preview-panel__head-actions">
          <button
            className="btn btn--ghost preview-head-btn"
            onClick={() => setShowPreviewStatusStrip((v) => !v)}
            title={showPreviewStatusStrip ? 'Hide status strip' : 'Show status strip'}
          >
            {showPreviewStatusStrip ? 'Hide Info' : 'Show Info'}
          </button>
          {showPreviewStatusStrip && (
            <button
              className="btn btn--ghost preview-head-btn"
              onClick={() => setCompactPreviewStatusStrip((v) => !v)}
              title={compactPreviewStatusStrip ? 'Expand status strip' : 'Compact status strip'}
            >
              {compactPreviewStatusStrip ? 'Expand' : 'Compact'}
            </button>
          )}
        </div>
      </div>

      <div
        ref={previewStageRef}
        className="preview-screen"
        style={{ aspectRatio: PREVIEW.ASPECT_RATIO_16_9 }}
      >
        <span className="preview-screen__label">Projector Output</span>
        <div className="preview-screen__content">
          {previewSlide ? (
            <div
              style={{
                position: 'relative',
                width: '100%',
                height: '100%',
                textAlign: previewSlide?.type === 'bible' ? 'left' : 'center',
                overflow: 'hidden',
                background: '#000',
                color: '#fff',
              }}
            >
              {previewSlide.background && (
                <>
                  {previewSlide.background.type === 'video' ? (
                    <video
                      src={getPreviewMediaUrl(previewSlide.background.path)}
                      autoPlay
                      loop
                      muted
                      style={{
                        position: 'absolute',
                        inset: 0,
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                      }}
                    />
                  ) : (
                    <img
                      src={getPreviewMediaUrl(previewSlide.background.path)}
                      alt=""
                      style={{
                        position: 'absolute',
                        inset: 0,
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                      }}
                    />
                  )}
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      background:
                        previewSlide.background.type === 'video'
                          ? 'rgba(0,0,0,0)'
                          : 'rgba(0,0,0,0.32)',
                      zIndex: 1,
                    }}
                  />
                </>
              )}

              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  zIndex: 2,
                  width: previewSplitEnabled ? `${previewContentPanePercent}%` : '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding:
                    previewSlide.type === 'text' ||
                    previewSlide.type === 'bible' ||
                    previewSlide.type === 'lyrics'
                      ? '12px'
                      : '0px',
                }}
              >
                {previewSlide.type === 'text' && (
                  <div
                    style={{
                      position: 'relative',
                      width: '100%',
                      height: '100%',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        position: 'absolute',
                        left: `${Math.max(TEXT_EDITOR.LAYOUT_X_MIN, Math.min(TEXT_EDITOR.LAYOUT_X_MAX, Number(previewSlide?.textLayout?.xPercent ?? TEXT_EDITOR.LAYOUT_DEFAULT.xPercent)))}%`,
                        top: `${Math.max(TEXT_EDITOR.LAYOUT_Y_MIN, Math.min(TEXT_EDITOR.LAYOUT_Y_MAX, Number(previewSlide?.textLayout?.yPercent ?? TEXT_EDITOR.LAYOUT_DEFAULT.yPercent)))}%`,
                        transform: `translate(-50%, -50%) scale(${Math.max(TEXT_EDITOR.LAYOUT_SCALE_MIN, Math.min(TEXT_EDITOR.LAYOUT_SCALE_MAX, Number(previewSlide?.textLayout?.scale ?? TEXT_EDITOR.LAYOUT_DEFAULT.scale)))})`,
                        transformOrigin: 'center center',
                        width: '90%',
                        maxWidth: '90%',
                        whiteSpace: 'pre-wrap',
                        textAlign: 'center',
                        lineHeight: '1.6',
                        fontSize: getPreviewTextSize(
                          previewSlide,
                          previewSlide.fontSize === 'large'
                            ? 16
                            : previewSlide.fontSize === 'medium'
                              ? 12
                              : 10,
                          previewStageWidth
                        ),
                        fontWeight: 700,
                        color: previewSlide.textColor || '#fff',
                        fontFamily: previewSlide.fontFamily || 'inherit',
                        textShadow: '2px 2px 6px rgba(0,0,0,0.9)',
                      }}
                    >
                      {previewSlide.text}
                    </div>
                  </div>
                )}

                {previewSlide.type === 'image' && (
                  <img
                    src={getPreviewMediaUrl(previewSlide.path)}
                    alt={previewSlide.name}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: previewSlide?.fitMode === 'contain' ? 'contain' : 'cover',
                      borderRadius: 0,
                      display: 'block',
                      background: '#000',
                    }}
                  />
                )}

                {previewSlide.type === 'video' && (
                  <div style={{ width: '100%', height: '100%', position: 'relative' }}>
                    <video
                      ref={previewVideoRef}
                      src={getPreviewMediaUrl(previewSlide.path)}
                      controls={false}
                      onLoadedMetadata={handleLoadedMetadata}
                      onTimeUpdate={handleTimeUpdate}
                      onPlay={handlePlay}
                      onPause={handlePause}
                      onVolumeChange={handleVolumeChange}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: previewSlide?.fitMode === 'contain' ? 'contain' : 'cover',
                        borderRadius: 0,
                        display: 'block',
                        background: '#000',
                      }}
                    />
                    <div
                      style={{
                        position: 'absolute',
                        left: 0,
                        right: 0,
                        bottom: 0,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '4px 6px',
                        background: 'rgba(0,0,0,0.55)',
                        fontSize: '10px',
                      }}
                    >
                      <button
                        className="btn btn--ghost"
                        style={{ padding: '2px 6px', fontSize: '10px' }}
                        onClick={togglePauseResume}
                      >
                        {previewVideoPaused ? 'Resume' : 'Pause'}
                      </button>
                      <button
                        className="btn btn--ghost"
                        style={{ padding: '2px 6px', fontSize: '10px' }}
                        onClick={stopPlayback}
                      >
                        Stop
                      </button>
                      <button
                        className="btn btn--ghost"
                        style={{ padding: '2px 6px', fontSize: '10px' }}
                        onClick={toggleMute}
                      >
                        {previewVideoMuted ? 'Unmute' : 'Mute'}
                      </button>
                      <span style={{ marginLeft: 'auto', color: 'rgba(255,255,255,0.9)' }}>
                        {formatTime(previewVideoCurrent)} / {formatTime(previewVideoDuration)}
                      </span>
                    </div>
                  </div>
                )}

                {previewSlide.type === 'youtube' &&
                  (() => {
                    const embedUrl = getYouTubeEmbedUrl(previewSlide);
                    if (!embedUrl) {
                      return <span style={{ fontSize: '11px' }}>YouTube preview unavailable</span>;
                    }
                    return (
                      <iframe
                        title={previewSlide.name || 'YouTube Preview'}
                        src={embedUrl}
                        allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                        allowFullScreen
                        style={{ width: '100%', height: '100%', border: 0, display: 'block' }}
                      />
                    );
                  })()}

                {previewSlide.type === 'pdf' && (
                  <div
                    style={{
                      width: '100%',
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px',
                    }}
                  >
                    <div
                      style={{
                        flex: 1,
                        minHeight: 0,
                        border: '1px solid rgba(255,255,255,0.15)',
                        borderRadius: '4px',
                        overflow: 'hidden',
                      }}
                    >
                      <PdfRenderer
                        path={previewSlide.path}
                        pageNumber={previewSlide.page || 1}
                        fitMode={previewSlide?.fitMode || 'contain'}
                      />
                    </div>
                    <div
                      style={{
                        fontSize: '10px',
                        color: 'rgba(255,255,255,0.7)',
                        textAlign: 'left',
                      }}
                    >
                      {previewSlide.name} | Page {previewSlide.page || 1}
                    </div>
                  </div>
                )}

                {previewSlide.type === 'bible' && (
                  <div style={{ width: '100%' }}>
                    <div
                      style={{
                        fontSize: getPreviewTextSize(
                          previewSlide,
                          previewSlide.fontSize === 'large'
                            ? 14
                            : previewSlide.fontSize === 'medium'
                              ? 11
                              : 9,
                          previewStageWidth
                        ),
                        color: previewSlide.textColor || '#fff',
                        fontFamily: previewSlide.fontFamily || 'inherit',
                        whiteSpace: 'pre-line',
                        lineHeight: '1.9',
                        letterSpacing: '0.012em',
                        wordBreak: 'break-word',
                        textAlign: 'left',
                      }}
                    >
                      {previewSlide.text}
                    </div>
                    <div
                      style={{
                        marginTop: '10px',
                        fontSize: '10px',
                        color: 'rgba(255,255,255,0.72)',
                        textAlign: 'right',
                      }}
                    >
                      - {previewSlide.reference}
                    </div>
                  </div>
                )}

                {previewSlide.type === 'lyrics' && (
                  <div style={{ width: '100%' }}>
                    {(previewSlide.songTitle || previewSlide.sectionTitle) && (
                      <div
                        style={{
                          marginBottom: '8px',
                          fontSize: '10px',
                          color: 'rgba(255,255,255,0.75)',
                        }}
                      >
                        {previewSlide.songTitle || ''}
                        {previewSlide.songTitle && previewSlide.sectionTitle ? ' | ' : ''}
                        {previewSlide.sectionTitle || ''}
                      </div>
                    )}
                    <div
                      style={{
                        fontSize: getPreviewTextSize(
                          previewSlide,
                          previewSlide.fontSize === 'large'
                            ? 14
                            : previewSlide.fontSize === 'medium'
                              ? 11
                              : 9,
                          previewStageWidth
                        ),
                        color: previewSlide.textColor || '#fff',
                        fontFamily: previewSlide.fontFamily || 'inherit',
                        whiteSpace: 'pre-line',
                        lineHeight: '1.8',
                        textAlign: 'center',
                      }}
                    >
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
                          background:
                            'linear-gradient(135deg, #0b1220 0%, #1f2a44 40%, #22325b 100%)',
                          position: 'relative',
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          style={{
                            position: 'absolute',
                            inset: 0,
                            backgroundImage:
                              'repeating-linear-gradient(45deg, rgba(255,255,255,0.06) 0 12px, rgba(255,255,255,0.02) 12px 24px)',
                          }}
                        />
                        <div
                          style={{
                            position: 'absolute',
                            inset: '14px',
                            border: '1px solid rgba(255,255,255,0.28)',
                          }}
                        />
                        <div
                          style={{
                            position: 'absolute',
                            left: 0,
                            right: 0,
                            top: '50%',
                            height: '1px',
                            background: 'rgba(255,255,255,0.32)',
                          }}
                        />
                        <div
                          style={{
                            position: 'absolute',
                            top: 0,
                            bottom: 0,
                            left: '50%',
                            width: '1px',
                            background: 'rgba(255,255,255,0.32)',
                          }}
                        />
                        <div
                          style={{
                            position: 'absolute',
                            left: '10px',
                            top: '10px',
                            fontSize: '10px',
                            color: '#8ee7ff',
                            fontWeight: 700,
                            letterSpacing: '0.5px',
                          }}
                        >
                          CAMERA
                        </div>
                        <div
                          style={{
                            position: 'absolute',
                            right: '10px',
                            bottom: '10px',
                            fontSize: '10px',
                            color: 'rgba(255,255,255,0.9)',
                            fontFamily: 'monospace',
                          }}
                        >
                          {new Date(previewTestNow).toLocaleTimeString()}
                        </div>
                      </div>
                    ) : (
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
                        {cameraStatus === 'loading'
                          ? 'Loading camera...'
                          : cameraStatus === 'error'
                            ? 'Camera unavailable'
                            : 'Camera idle'}
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

      {showPreviewStatusStrip && (
        <div
          className={`preview-status-strip ${compactPreviewStatusStrip ? 'preview-status-strip--compact' : ''}`}
        >
          <span className="preview-osd__pill">{previewTypeLabel}</span>
          {!compactPreviewStatusStrip && previewPrimaryLabel && (
            <span className="preview-osd__text">{previewPrimaryLabel}</span>
          )}
          <span className="preview-osd__text">Queue {projectorQueue.length}</span>
          <span className="preview-osd__text">
            {transitionEnabled ? `Fade ${transitionDelayMs}/${transitionDurationMs}` : 'Cut'}
          </span>
        </div>
      )}

      <div className="preview-screen" style={{ aspectRatio: PREVIEW.ASPECT_RATIO_16_9 }}>
        <span className="preview-screen__label">Next</span>
        <div className="preview-screen__content">
          {projectorQueue.length > 0 ? (
            <span style={{ fontSize: '11px' }}>{nextQueueTitle}</span>
          ) : (
            <span style={{ fontSize: '11px' }}>No content</span>
          )}
        </div>
      </div>

      <div style={{ marginTop: 'auto' }}>
        <div className="preview-panel__title" style={{ marginBottom: '10px' }}>
          Transition
        </div>
        <div className="cp-panel-box">
          <label className="cp-label-row">
            <input
              type="checkbox"
              checked={transitionEnabled}
              onChange={(e) => setTransitionEnabled(e.target.checked)}
            />
            Fade In/Out
          </label>
          <div className="cp-two-col-grid">
            <div>
              <div className="cp-field-label">Delay (ms)</div>
              <input
                type="number"
                min={TRANSITION.MIN_MS}
                max={TRANSITION.MAX_MS}
                value={transitionDelayMs}
                onChange={(e) =>
                  setTransitionDelayMs(
                    Math.max(
                      TRANSITION.MIN_MS,
                      Math.min(TRANSITION.MAX_MS, Number(e.target.value || TRANSITION.MIN_MS))
                    )
                  )
                }
                className="cp-input-sm"
              />
            </div>
            <div>
              <div className="cp-field-label">Duration (ms)</div>
              <input
                type="number"
                min={TRANSITION.MIN_MS}
                max={TRANSITION.MAX_MS}
                value={transitionDurationMs}
                onChange={(e) =>
                  setTransitionDurationMs(
                    Math.max(
                      TRANSITION.MIN_MS,
                      Math.min(TRANSITION.MAX_MS, Number(e.target.value || TRANSITION.MIN_MS))
                    )
                  )
                }
                className="cp-input-sm"
              />
            </div>
          </div>
        </div>

        <div className="cp-panel-box" style={{ display: 'none' }}>
          <label className="cp-label-row" style={{ marginBottom: '8px' }}>
            <input
              type="checkbox"
              checked={sceneConfig.mode === 'split_camera'}
              onChange={(e) =>
                setSceneConfig((prev) => ({
                  ...prev,
                  mode: e.target.checked ? 'split_camera' : 'normal',
                }))
              }
            />
            Enable Camera Split (Left Content / Right Camera)
          </label>
          <div style={{ marginBottom: '8px' }}>
            <label className="cp-label-row" style={{ marginBottom: '8px' }}>
              <input
                type="checkbox"
                checked={sceneConfig.enableCameraTestMode === true}
                onChange={(e) =>
                  setSceneConfig((prev) => ({ ...prev, enableCameraTestMode: e.target.checked }))
                }
              />
              Camera Test Mode (No physical camera)
            </label>
            <div className="cp-field-label">Camera Device</div>
            <select
              value={sceneConfig.cameraDeviceId || ''}
              onChange={(e) =>
                setSceneConfig((prev) => ({ ...prev, cameraDeviceId: e.target.value }))
              }
              disabled={sceneConfig.enableCameraTestMode === true}
              className="cp-input-sm"
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
            <div className="cp-field-label">
              Right Camera Width (%):{' '}
              {Math.max(
                SCENE.CAMERA_PANE_MIN_PERCENT,
                Math.min(SCENE.CAMERA_PANE_MAX_PERCENT, sceneConfig.cameraPanePercent)
              )}
            </div>
            <input
              type="range"
              min={SCENE.CAMERA_PANE_MIN_PERCENT}
              max={SCENE.CAMERA_PANE_MAX_PERCENT}
              step={1}
              value={Math.max(
                SCENE.CAMERA_PANE_MIN_PERCENT,
                Math.min(SCENE.CAMERA_PANE_MAX_PERCENT, sceneConfig.cameraPanePercent)
              )}
              onChange={(e) =>
                setSceneConfig((prev) => ({ ...prev, cameraPanePercent: Number(e.target.value) }))
              }
              style={{ width: '100%' }}
            />
          </div>
          <div style={{ marginTop: '8px' }}>
            <div className="cp-field-label">
              Camera Center Crop (%):{' '}
              {Math.max(
                SCENE.CAMERA_CROP_MIN_PERCENT,
                Math.min(
                  SCENE.CAMERA_CROP_MAX_PERCENT,
                  sceneConfig.cameraCenterCropPercent || SCENE.CAMERA_CROP_DEFAULT_PERCENT
                )
              )}
            </div>
            <input
              type="range"
              min={SCENE.CAMERA_CROP_MIN_PERCENT}
              max={SCENE.CAMERA_CROP_MAX_PERCENT}
              step={5}
              value={Math.max(
                SCENE.CAMERA_CROP_MIN_PERCENT,
                Math.min(
                  SCENE.CAMERA_CROP_MAX_PERCENT,
                  sceneConfig.cameraCenterCropPercent || SCENE.CAMERA_CROP_DEFAULT_PERCENT
                )
              )}
              onChange={(e) =>
                setSceneConfig((prev) => ({
                  ...prev,
                  cameraCenterCropPercent: Number(e.target.value),
                }))
              }
              style={{ width: '100%' }}
            />
          </div>
        </div>

        <div className="preview-panel__title" style={{ marginBottom: '12px' }}>
          System Info
        </div>
        <div className="cp-meta-list">
          <div className="cp-meta-row">
            <span>Detected Displays</span>
            <span className="cp-meta-value">{displays.length}</span>
          </div>
          <div className="cp-meta-row">
            <span>Projector Status</span>
            <span
              style={{
                color: projectorActive ? 'var(--color-success)' : 'var(--color-text-muted)',
              }}
            >
              {projectorActive ? 'Running' : 'Stopped'}
            </span>
          </div>
          <div className="cp-meta-row">
            <span>Environment</span>
            <span className="cp-meta-value">{isElectron ? 'Electron' : 'Browser'}</span>
          </div>
          <div className="cp-meta-row">
            <span>Export Mode</span>
            <span className="cp-meta-value">Smart Minimal Bundle</span>
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
  );
}

export default PreviewPanel;
