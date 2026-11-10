import React, { useEffect } from 'react';
import { TEXT_RENDER } from '../../constants/text-render';
import { FREE_TEXT_CONTENT_WIDTH_PERCENT } from '../../utils/freeTextLayout';
import useFitText from '../../hooks/useFitText';

function ProjectorTextLayer({
  content,
  contentStageStyle,
  fadeClass,
  fadeAnimationStyle,
  isFreeText,
  textLayout,
  getTextSizeClass,
  getProjectorTextSize,
  onFitChange,
}) {
  const fontSize = getProjectorTextSize();
  // Remeasure whenever anything that changes the rendered height changes.
  const { containerRef, contentRef, reserveRef, scale, tight, overflowing } = useFitText([
    content?.text,
    content?.reference,
    fontSize,
    content?.fontFamily,
    content?.fontWeight,
    content?.type,
  ]);

  useEffect(() => {
    if (typeof onFitChange === 'function') onFitChange({ scale, tight, overflowing });
  }, [onFitChange, scale, tight, overflowing]);

  if (
    !content ||
    (content.type !== 'text' && content.type !== 'bible' && content.type !== 'lyrics')
  ) {
    return null;
  }

  return (
    <div
      ref={containerRef}
      style={{
        ...contentStageStyle,
        zIndex: 10,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: isFreeText
          ? 'clamp(24px, 5vh, 72px) clamp(12px, 3.125vw, 60px)'
          : 'clamp(24px, 5vh, 72px) clamp(28px, 6vw, 120px)',
        pointerEvents: 'none',
      }}
    >
      <div
        className={`projector-view__content ${fadeClass}`}
        style={{
          width: `${FREE_TEXT_CONTENT_WIDTH_PERCENT}%`,
          position: 'relative',
          left: isFreeText ? `${textLayout.xPercent - 50}%` : undefined,
          top: isFreeText ? `${textLayout.yPercent - 50}%` : undefined,
          transform: isFreeText ? `translate(0, 0) scale(${textLayout.scale})` : undefined,
          transformOrigin: isFreeText ? 'center center' : undefined,
          textAlign: content.type === 'bible' ? 'left' : 'center',
          ...fadeAnimationStyle,
        }}
      >
        <div
          ref={contentRef}
          className={`projector-text ${getTextSizeClass()}`}
          style={{
            // Scales the text down when it would otherwise run off the screen.
            // A transform keeps the chosen font size intact and only changes how
            // large it is drawn, so nothing reflows.
            transform: scale === 1 ? undefined : `scale(${scale})`,
            transformOrigin: 'center center',
            whiteSpace: 'pre-line',
            textAlign: content.type === 'bible' ? 'left' : 'center',
            lineHeight:
              content.type === 'bible'
                ? TEXT_RENDER.BIBLE_LINE_HEIGHT
                : TEXT_RENDER.FREE_TEXT_LINE_HEIGHT,
            letterSpacing: content.type === 'bible' ? '0.015em' : 'normal',
            wordBreak: content.type === 'bible' ? 'break-word' : 'normal',
            textShadow: TEXT_RENDER.PROJECTOR_TEXT_SHADOW,
            color: content.textColor || '#ffffff',
            fontFamily: content.fontFamily || "'Noto Sans SC', 'Inter', sans-serif",
            fontWeight: Number(content?.fontWeight || 700),
            fontSize,
          }}
        >
          {content.text}
        </div>
      </div>

      {content.reference && (
        <div
          // Measured and reserved, so the passage is not scaled to "fit" and
          // then left running underneath this line.
          ref={reserveRef}
          style={{
            position: 'absolute',
            right: 'clamp(28px, 4.5vw, 96px)',
            bottom: 'clamp(22px, 4vh, 72px)',
            fontSize: 'clamp(22px, 2vw, 34px)',
            fontStyle: 'italic',
            color: 'rgba(255, 255, 255, 0.96)',
            fontFamily: content.fontFamily || "'Noto Sans SC', 'Inter', sans-serif",
            fontWeight: Number(content?.fontWeight || 700),
            textAlign: 'right',
            textShadow: TEXT_RENDER.REFERENCE_SHADOW,
            pointerEvents: 'none',
          }}
        >
          {`- ${content.reference}`}
        </div>
      )}
    </div>
  );
}

export default ProjectorTextLayer;
