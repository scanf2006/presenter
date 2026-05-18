import React from 'react';
import { getPreviewMediaUrl } from '../../../utils/preview';
import { PREVIEW, TEXT_EDITOR } from '../../../constants/ui';
import { PROJECTION_FONT_OPTIONS } from '../../../constants/fontOptions';
import { useProjectorContext } from '../../../contexts/ProjectorContext';
import { useTextEditorContext } from '../../../contexts/TextEditorContext';
import { useI18n } from '../../../contexts/I18nContext';

function TextEditorSection() {
  const { t } = useI18n();
  const { previewAspectRatio } = useProjectorContext();
  const {
    textCanvasRef,
    textBackground,
    textSnapGuide,
    textLayerRef,
    textLayout,
    startTextDrag,
    textEditableRef,
    setTextContent,
    textFontFamily,
    textBold,
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
    setTextBold,
    setTextColor,
    handleSendToProjector,
    handleAddTextToQueue,
  } = useTextEditorContext();

  return (
    <div className="text-editor animate-slide-in-up">
      <h2 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '8px' }}>
        {t('textEditor.title', 'Free Text Projection')}
      </h2>
      <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginBottom: '16px' }}>
        {t('textEditor.intro', 'Type any text and click "Send to Projector".')}
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
              title={t('textEditor.move', 'MOVE')}
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
              {t('textEditor.move', 'MOVE')}
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
                fontWeight: textBold ? 700 : 400,
                color: textColor,
                fontSize: `${textCanvasDisplayFontPx}px`,
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
          {t('textEditor.pickBackgroundFromMedia', 'Pick Background from Media')}
        </button>
        {textBackground && (
          <button className="btn btn--ghost" onClick={() => setTextBackground(null)}>
            {t('textEditor.clearBackground', 'Clear Background')}
          </button>
        )}
        <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
          {textBackground
            ? `${t('common.selected', 'Selected')}: ${textBackground.name || textBackground.path}`
            : t('common.noBackgroundSelected', 'No background selected')}
        </span>
      </div>

      <div className="text-settings-card">
        <div className="text-settings-head">{t('textEditor.textStyleControls', 'Text Style Controls')}</div>

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
                {size === 'small'
                  ? t('textEditor.small', 'Small')
                  : size === 'medium'
                    ? t('textEditor.medium', 'Medium')
                    : t('textEditor.large', 'Large')}
              </button>
            ))}
          </div>
          <label className="cp-label-row" style={{ marginBottom: 0 }}>
            <input
              type="checkbox"
              checked={textBold}
              onChange={(e) => setTextBold(e.target.checked)}
            />
            {t('textEditor.bold', 'Bold')}
          </label>
        </div>

        <div className="text-settings-grid">
          <label className="text-settings-field">
            <span className="text-settings-label">{t('textEditor.sizePx', 'Size (px)')}</span>
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
              title={t('textEditor.sizePx', 'Size (px)')}
            />
          </label>

          <label className="text-settings-field">
            <span className="text-settings-label">{t('textEditor.fontFamily', 'Font Family')}</span>
            <select
              value={textFontFamily}
              onChange={(e) => setTextFontFamily(e.target.value)}
              className="cp-input-md"
            >
              {PROJECTION_FONT_OPTIONS.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </label>

          <label className="text-settings-field">
            <span className="text-settings-label">{t('textEditor.textColor', 'Text Color')}</span>
            <div className="text-color-control">
              <input
                type="color"
                value={textColor}
                onChange={(e) => setTextColor(e.target.value)}
                className="text-color-input"
                title={t('textEditor.textColor', 'Text Color')}
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
        {t('textEditor.sendToProjector', 'Send to Projector')}
      </button>
      <button
        className="btn btn--ghost"
        style={{ width: '100%' }}
        onClick={handleAddTextToQueue}
        disabled={!textContent.trim()}
      >
        {t('textEditor.addToQueue', '+ Add to Queue')}
      </button>
    </div>
  );
}

export default TextEditorSection;
