import React from 'react';
import PdfRenderer from '../../PdfRenderer';
import { formatTime, getPreviewTextSize, getPreviewMediaUrl } from '../../../utils/preview';
import { PREVIEW, TEXT_EDITOR } from '../../../constants/ui';
import { useProjectorContext } from '../../../contexts/ProjectorContext';
import CameraPane from './CameraPane';

/**
 * PreviewStage renders the main live-preview display area showing the current
 * projector slide content (text, image, video, YouTube, PDF, bible, lyrics),
 * background media, camera split pane, and the transition mask overlay.
 */
function PreviewStage() {
  const {
    previewStageRef,
    previewSlide,
    previewSplitEnabled,
    previewContentPanePercent,
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
    previewMaskVisible,
    transitionDurationMs,
  } = useProjectorContext();
  const previewPathForDetect = String(previewSlide?.path || '');
  const previewNameForDetect = String(previewSlide?.name || '');
  const isPreviewPptImage =
    previewSlide?.type === 'image' &&
    (previewSlide?.originType === 'ppt' ||
      /ppt/i.test(previewNameForDetect) ||
      /[\\/]media[\\/]ppt[\\/]/i.test(previewPathForDetect));

  return (
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
                      fontWeight: Number(previewSlide?.fontWeight || 700),
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
                <>
                  {isPreviewPptImage && (
                    <img
                      src={getPreviewMediaUrl(previewSlide.path)}
                      alt=""
                      style={{
                        position: 'absolute',
                        inset: 0,
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        borderRadius: 0,
                        display: 'block',
                        filter: 'blur(16px) brightness(0.62)',
                        transform: 'scale(1.08)',
                      }}
                    />
                  )}
                  <img
                    src={getPreviewMediaUrl(previewSlide.path)}
                    alt={previewSlide.name}
                    style={{
                      position: isPreviewPptImage ? 'relative' : 'static',
                      zIndex: isPreviewPptImage ? 1 : 'auto',
                      width: '100%',
                      height: '100%',
                      objectFit: isPreviewPptImage ? 'contain' : 'cover',
                      borderRadius: 0,
                      display: 'block',
                      background: '#000',
                    }}
                  />
                </>
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
                      fontWeight: Number(previewSlide?.fontWeight || 700),
                    }}
                  >
                    {previewSlide.text}
                  </div>
                  <div
                    style={{
                      marginTop: '10px',
                      fontSize: '10px',
                      color: 'rgba(255,255,255,0.72)',
                      fontFamily: previewSlide.fontFamily || 'inherit',
                      fontWeight: Number(previewSlide?.fontWeight || 700),
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
                      fontWeight: Number(previewSlide?.fontWeight || 700),
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

            {previewSplitEnabled && <CameraPane />}

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
  );
}

export default PreviewStage;
