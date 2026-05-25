import React from 'react';
import { TEXT_RENDER } from '../../constants/text-render';
import { FREE_TEXT_CONTENT_WIDTH_PERCENT } from '../../utils/freeTextLayout';

function ProjectorTextLayer({
  content,
  contentStageStyle,
  fadeClass,
  fadeAnimationStyle,
  isFreeText,
  textLayout,
  getTextSizeClass,
  getProjectorTextSize,
}) {
  if (!content || (content.type !== 'text' && content.type !== 'bible' && content.type !== 'lyrics')) {
    return null;
  }

  return (
    <div
      style={{
        ...contentStageStyle,
        zIndex: 10,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'clamp(24px, 5vh, 72px) clamp(28px, 6vw, 120px)',
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
          className={`projector-text ${getTextSizeClass()}`}
          style={{
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
            fontSize: getProjectorTextSize(),
          }}
        >
          {content.text}
        </div>
      </div>

      {content.reference && (
        <div
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
