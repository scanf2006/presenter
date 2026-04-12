import React from 'react';
import MediaManager from '../MediaManager';
import BibleBrowser from '../BibleBrowser';
import SongManager from '../SongManager';
import { getPreviewMediaUrl } from '../../utils/preview';
import { PREVIEW, TEXT_EDITOR } from '../../constants/ui';
import { useAppContext } from '../../contexts/AppContext';
import { useProjectorContext } from '../../contexts/ProjectorContext';
import { useQueueContext } from '../../contexts/QueueContext';

const TEXT_FONT_OPTIONS = ['Noto Sans SC', 'Microsoft YaHei', 'Arial', 'Times New Roman', 'SimHei'];

function MainContentArea(props) {
  const {
    // Text editor props (remain as props since text editor state lives in ControlPanelInner)
    textCanvasRef,
    textBackground,
    textSnapGuide,
    textLayerRef,
    textLayout,
    startTextDrag,
    textEditableRef,
    setTextContent,
    textFontFamily,
    textColor,
    textCanvasDisplayFontPx,
    textContent,
    startTextResize,
    handleOpenBackgroundPicker,
    setTextBackground,
    fontSize,
    setFontSize,
    setTextSizePx,
    textSizePx,
    setTextFontFamily,
    setTextColor,
    handleSendToProjector,
    handleAddTextToQueue,
    // Media / Bible / Song callbacks
    handleProjectMedia,
    handleAddBibleQueueItem,
    handleUpdateActiveQueueItem,
    handleAddSongQueueItem,
    songPickedBackground,
    songsListOpenToken,
    bibleCatalogOpenToken,
    biblePickedBackground,
    handleAddPlaylistItem,
    mediaHomeOpenToken,
    backgroundPickerTarget,
    handlePickBackgroundFromMedia,
    handleCancelBackgroundPicker,
  } = props;

  // Read from contexts instead of props
  const { activeSection } = useAppContext();
  const {
    displays,
    projectorDisplayId,
    projectorActive,
    handleStartProjector,
    handleStopProjector,
    previewAspectRatio,
  } = useProjectorContext();
  const { activePreloadItem } = useQueueContext();

  return (
    <div className="main-content">
      <div
        className="animate-slide-in-up"
        style={{ display: activeSection === 'displays' ? 'block' : 'none' }}
      >
        <h2 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px' }}>Displays</h2>
        <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginBottom: '24px' }}>
          Select an external display to start projection. Content will be fullscreen on the selected
          screen.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {displays.map((display) => (
            <div
              key={display.id}
              className={`display-card ${projectorDisplayId === display.id ? 'display-card--active' : ''}`}
              onClick={() => !display.isPrimary && handleStartProjector(display.id)}
            >
              <span className="display-card__icon">{display.isPrimary ? 'P' : 'E'}</span>
              <div className="display-card__info">
                <div className="display-card__name">{display.label || `Display ${display.id}`}</div>
                <div className="display-card__resolution">
                  {display.size?.width ?? '?'} x {display.size?.height ?? '?'}
                  {display.bounds && ` | Position (${display.bounds.x}, ${display.bounds.y})`}
                </div>
              </div>
              {display.isPrimary && (
                <span className="display-card__badge display-card__badge--primary">Primary</span>
              )}
              {projectorDisplayId === display.id && (
                <span className="display-card__badge display-card__badge--projecting">
                  Projecting
                </span>
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

        {displays.filter((d) => !d.isPrimary).length === 0 && (
          <div
            style={{
              marginTop: '24px',
              padding: '20px',
              background: 'rgba(245, 158, 11, 0.08)',
              border: '1px solid rgba(245, 158, 11, 0.2)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--color-warning)',
              fontSize: '13px',
            }}
          >
            No external display detected. Connect a projector/monitor and try again.
          </div>
        )}
      </div>

      <div
        className="text-editor animate-slide-in-up"
        style={{ display: activeSection === 'text' ? 'block' : 'none' }}
      >
        <h2 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '8px' }}>
          Free Text Projection
        </h2>
        <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginBottom: '16px' }}>
          Type any text and click "Send to Projector".
        </p>

        <div
          ref={textCanvasRef}
          style={{
            position: 'relative',
            width: '100%',
            aspectRatio: previewAspectRatio || PREVIEW.ASPECT_RATIO_16_9,
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
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                zIndex: 1,
              }}
            />
          )}
          {textBackground?.type === 'video' && textBackground?.path && (
            <video
              src={getPreviewMediaUrl(textBackground.path)}
              autoPlay
              loop
              muted
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                zIndex: 1,
              }}
            />
          )}
          <div
            style={{ position: 'absolute', inset: 0, background: 'rgba(0, 0, 0, 0.22)', zIndex: 2 }}
          />
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
          <div style={{ position: 'absolute', inset: 0, zIndex: 5 }}>
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
                dir="ltr"
                onInput={(e) => setTextContent(e.currentTarget.innerText.replace(/\r/g, ''))}
                onMouseDown={(e) => e.stopPropagation()}
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
                  unicodeBidi: 'isolate',
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
            <button className="btn btn--ghost" onClick={() => setTextBackground(null)}>
              Clear Background
            </button>
          )}
          <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
            {textBackground
              ? `Selected: ${textBackground.name || textBackground.path}`
              : 'No background selected'}
          </span>
        </div>

        <div className="text-settings-card">
          <div className="text-settings-head">Text Style Controls</div>

          <div className="text-settings-row">
            <div className="text-settings-presets">
              {['small', 'medium', 'large'].map((size) => (
                <button
                  key={size}
                  className={`text-size-chip ${fontSize === size ? 'text-size-chip--active' : ''}`}
                  onClick={() => {
                    setFontSize(size);
                    if (size === 'small') setTextSizePx(TEXT_EDITOR.SIZE_SMALL_PX);
                    else if (size === 'medium') setTextSizePx(TEXT_EDITOR.SIZE_MEDIUM_PX);
                    else setTextSizePx(TEXT_EDITOR.SIZE_LARGE_PX);
                  }}
                >
                  {size === 'small' ? 'Small' : size === 'medium' ? 'Medium' : 'Large'}
                </button>
              ))}
            </div>
          </div>

          <div className="text-settings-grid">
            <label className="text-settings-field">
              <span className="text-settings-label">Size (px)</span>
              <input
                type="number"
                min={TEXT_EDITOR.SIZE_INPUT_MIN_PX}
                max={TEXT_EDITOR.SIZE_INPUT_MAX_PX}
                value={textSizePx}
                onChange={(e) =>
                  setTextSizePx(
                    Math.max(
                      TEXT_EDITOR.SIZE_INPUT_MIN_PX,
                      Math.min(
                        TEXT_EDITOR.SIZE_INPUT_MAX_PX,
                        Number(e.target.value || TEXT_EDITOR.DEFAULT_SIZE_PX)
                      )
                    )
                  )
                }
                className="cp-input-md"
                title="Text Size (px)"
              />
            </label>

            <label className="text-settings-field">
              <span className="text-settings-label">Font Family</span>
              <select
                value={textFontFamily}
                onChange={(e) => setTextFontFamily(e.target.value)}
                className="cp-input-md"
              >
                {TEXT_FONT_OPTIONS.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-settings-field">
              <span className="text-settings-label">Text Color</span>
              <div className="text-color-control">
                <input
                  type="color"
                  value={textColor}
                  onChange={(e) => setTextColor(e.target.value)}
                  className="text-color-input"
                  title="Text Color"
                />
                <span className="text-color-value">
                  {String(textColor || '#ffffff').toUpperCase()}
                </span>
              </div>
            </label>
          </div>
        </div>
        <button
          className="btn btn--success btn--lg"
          style={{ width: '100%' }}
          onClick={() => handleSendToProjector()}
          disabled={!textContent.trim()}
        >
          Send to Projector
        </button>
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
  );
}

export default MainContentArea;
