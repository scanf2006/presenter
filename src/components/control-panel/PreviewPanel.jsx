import React, { useEffect, useState } from 'react';
import { useProjectorContext } from '../../contexts/ProjectorContext';
import { useQueueContext } from '../../contexts/QueueContext';
import { useI18n } from '../../contexts/I18nContext';
import PreviewStage from './preview/PreviewStage';
import TransitionSettings from './preview/TransitionSettings';
import CameraSettings from './preview/CameraSettings';
import SystemInfoPanel from './preview/SystemInfoPanel';

function PreviewPanel({ nextQueueTitle }) {
  const { locale } = useI18n();
  const isZh = String(locale || 'en').toLowerCase().startsWith('zh');
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
      <div className="preview-panel__live-block">
        <div className="preview-panel__head">
          <div className="preview-panel__title">{isZh ? '实时预览' : 'Live Preview'}</div>
          <div className="preview-panel__head-actions">
            <button
              className="btn btn--ghost preview-head-btn"
              onClick={() => setShowPreviewStatusStrip((v) => !v)}
              title={showPreviewStatusStrip ? (isZh ? '隐藏状态条' : 'Hide status strip') : (isZh ? '显示状态条' : 'Show status strip')}
            >
              {showPreviewStatusStrip ? (isZh ? '隐藏信息' : 'Hide Info') : (isZh ? '显示信息' : 'Show Info')}
            </button>
            {showPreviewStatusStrip && (
              <button
                className="btn btn--ghost preview-head-btn"
                onClick={() => setCompactPreviewStatusStrip((v) => !v)}
                title={compactPreviewStatusStrip ? (isZh ? '展开状态条' : 'Expand status strip') : (isZh ? '紧凑状态条' : 'Compact status strip')}
              >
                {compactPreviewStatusStrip ? (isZh ? '展开' : 'Expand') : (isZh ? '紧凑' : 'Compact')}
              </button>
            )}
          </div>
        </div>
        <PreviewStage />

        <div className="preview-panel__status-slot">
          {showPreviewStatusStrip && (
            <div
              className={`preview-status-strip ${compactPreviewStatusStrip ? 'preview-status-strip--compact' : ''}`}
            >
              <span className="preview-osd__pill">{previewTypeLabel}</span>
              {!compactPreviewStatusStrip && previewPrimaryLabel && (
                <span className="preview-osd__text">{previewPrimaryLabel}</span>
              )}
              <span className="preview-osd__text">{isZh ? '队列' : 'Queue'} {projectorQueue.length}</span>
              <span className="preview-osd__text">
                {transitionEnabled ? `${isZh ? '淡入淡出' : 'Fade'} ${transitionDelayMs}/${transitionDurationMs}` : isZh ? '硬切' : 'Cut'}
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="preview-panel__rest-block">
        <div className="preview-screen preview-screen--next">
          <span className="preview-screen__label">{isZh ? '下一条' : 'Next'}</span>
          <div className="preview-screen__content">
            {projectorQueue.length > 0 ? (
              <span className="preview-next-text">{nextQueueTitle}</span>
            ) : (
              <span className="preview-next-text">{isZh ? '暂无内容' : 'No content'}</span>
            )}
          </div>
        </div>

        <div className="preview-panel__rest-content">
          <TransitionSettings />
          <details className="preview-advanced" open={false}>
            <summary className="preview-advanced__summary">{isZh ? '高级' : 'Advanced'}</summary>
            <div className="preview-advanced__body">
              <CameraSettings />
              <SystemInfoPanel />
            </div>
          </details>
        </div>
      </div>
    </div>
  );
}

export default PreviewPanel;
