import React, { useEffect, useState } from 'react';
import { PREVIEW } from '../../constants/ui';
import { useProjectorContext } from '../../contexts/ProjectorContext';
import { useQueueContext } from '../../contexts/QueueContext';
import PreviewStage from './preview/PreviewStage';
import TransitionSettings from './preview/TransitionSettings';
import CameraSettings from './preview/CameraSettings';
import SystemInfoPanel from './preview/SystemInfoPanel';

function PreviewPanel({ nextQueueTitle }) {
  const { previewSlide, transitionEnabled, transitionDelayMs, transitionDurationMs } =
    useProjectorContext();
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

      <PreviewStage />

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
        <TransitionSettings />
        <CameraSettings />
        <SystemInfoPanel />
      </div>
    </div>
  );
}

export default PreviewPanel;
