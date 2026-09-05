import React, { useEffect, useMemo, useRef, useState } from 'react';
import useProjectorChannelSync from '../hooks/useProjectorChannelSync';
import ProjectorTextLayer from './projector/ProjectorTextLayer';
import PdfRenderer from './PdfRenderer';
import {
  clampFreeTextLayout,
  getFallbackTextBasePx,
  getScaledFreeTextFontPx,
  isTextualSlideType,
} from '../utils/freeTextLayout';
function ProjectorView() {
  const [content, setContent] = useState(null);
  const [backgroundContent, setBackgroundContent] = useState(null);
  const [isBlackout, setIsBlackout] = useState(false);
  const [fadeClass, setFadeClass] = useState('');
  const [transitionMaskVisible, setTransitionMaskVisible] = useState(false);
  const [transitionConfig, setTransitionConfig] = useState({
    enabled: true,
    delayMs: 20,
    durationMs: 60,
  });
  const transitionRef = useRef({
    enabled: true,
    delayMs: 20,
    durationMs: 60,
  });
  const videoRef = useRef(null);
  const mediaSampleVideoRef = useRef(null);
  const sampleCanvasRef = useRef(null);
  const timeoutRef = useRef([]);
  const [adaptiveOverlayOpacity, setAdaptiveOverlayOpacity] = useState(0.1);

  const isElectron = typeof window.churchDisplay !== 'undefined';

  useProjectorChannelSync({
    isElectron,
    transitionRef,
    timeoutRef,
    videoRef,
    setTransitionConfig,
    setContent,
    setBackgroundContent,
    setIsBlackout,
    setFadeClass,
    setTransitionMaskVisible,
  });

  useEffect(() => {
    if (content?.type !== 'video') return;
    const v = videoRef.current;
    if (!v) return;
    v.defaultMuted = true;
    v.muted = true;
    v.volume = 1;
    let unmuteTimer = null;
    v.play()
      .then(() => {
        unmuteTimer = setTimeout(() => {
          v.muted = false;
          v.defaultMuted = false;
          v.volume = 1;
        }, 120);
      })
      .catch((err) => {
        console.error('[ProjectorView] video play failed:', err);
      });
    return () => {
      if (unmuteTimer !== null) clearTimeout(unmuteTimer);
    };
  }, [content]);

  const getTextSizeClass = () => {
    if (!content) return 'projector-text--large';
    if (content.fontSize === 'small') return 'projector-text--small';
    if (content.fontSize === 'medium') return 'projector-text--medium';
    return 'projector-text--large';
  };

  const getProjectorTextSize = () => {
    const scaledPx = getScaledFreeTextFontPx(content?.fontSizePx, 1);
    if (scaledPx !== null) {
      return `${scaledPx}px`;
    }
    const base = getFallbackTextBasePx(content?.fontSize);
    return `${base}px`;
  };

  const getMediaUrl = (filePath) => {
    if (!filePath) return '';
    if (/^https?:\/\//i.test(filePath)) return filePath;
    return `local-media://${encodeURIComponent(filePath)}`;
  };

  const getYouTubeEmbedUrl = (videoId) => {
    if (!videoId) return '';
    const origin = encodeURIComponent('https://www.youtube.com');
    return `https://www.youtube.com/embed/${videoId}?autoplay=1&controls=0&modestbranding=1&rel=0&playsinline=1&origin=${origin}&enablejsapi=1`;
  };

  const backgroundMedia =
    content?.background || content?.payload?.background || content?.bg || backgroundContent || null;

  const standaloneMedia = useMemo(
    () =>
      (content?.type === 'image' || content?.type === 'video') && content?.path
        ? { type: content.type, path: content.path, standalone: true }
        : null,
    [content]
  );

  const effectiveMedia = useMemo(
    () => standaloneMedia || (backgroundMedia ? { ...backgroundMedia, standalone: false } : null),
    [standaloneMedia, backgroundMedia]
  );
  const mediaPathForDetect = String(content?.path || effectiveMedia?.path || '');
  const mediaNameForDetect = String(content?.name || '');
  const isPptImage =
    effectiveMedia?.type === 'image' &&
    (content?.originType === 'ppt' ||
      /ppt/i.test(mediaNameForDetect) ||
      /[\\/]media[\\/]ppt[\\/]/i.test(mediaPathForDetect));
  const isTextualContent = content && isTextualSlideType(content.type);
  const hasVideoBackgroundForText = Boolean(
    isTextualContent && effectiveMedia?.type === 'video' && !effectiveMedia?.standalone
  );
  const textOverlayOpacity = hasVideoBackgroundForText ? 0 : adaptiveOverlayOpacity;
  const isFreeText = content?.type === 'text';
  const textLayout = clampFreeTextLayout(content?.textLayout);
  const sampleAverageLuma = (drawable, width, height) => {
    try {
      if (!drawable || !width || !height) return null;
      if (!sampleCanvasRef.current) {
        sampleCanvasRef.current = document.createElement('canvas');
      }
      const canvas = sampleCanvasRef.current;
      const sampleW = 64;
      const sampleH = 36;
      canvas.width = sampleW;
      canvas.height = sampleH;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return null;

      ctx.drawImage(drawable, 0, 0, sampleW, sampleH);
      const data = ctx.getImageData(0, 0, sampleW, sampleH).data;
      if (!data?.length) return null;

      let total = 0;
      let count = 0;
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        total += 0.2126 * r + 0.7152 * g + 0.0722 * b;
        count += 1;
      }
      if (!count) return null;
      return total / count;
    } catch (_) {
      return null;
    }
  };

  const lumaToOverlay = (luma) => {
    if (!Number.isFinite(luma)) return 0.1;
    const normalized = Math.max(0, Math.min(1, luma / 255));
    return 0.05 + normalized * 0.1;
  };

  useEffect(() => {
    if (!isTextualContent || !effectiveMedia) return;

    if (effectiveMedia.type === 'image' && effectiveMedia.path) {
      let cancelled = false;
      const img = new Image();
      img.onload = () => {
        if (cancelled) return;
        const luma = sampleAverageLuma(img, img.naturalWidth, img.naturalHeight);
        setAdaptiveOverlayOpacity(lumaToOverlay(luma));
      };
      img.onerror = () => {
        if (cancelled) return;
        setAdaptiveOverlayOpacity(0.1);
      };
      img.src = getMediaUrl(effectiveMedia.path);
      return () => {
        cancelled = true;
        img.onload = null;
        img.onerror = null;
        img.src = '';
      };
    }

    if (effectiveMedia.type === 'video') {
      // Keep video backgrounds bright when text overlays are active.
      return;
    }
  }, [isTextualContent, effectiveMedia]);

  const fadeAnimationStyle = transitionConfig.enabled
    ? { animationDuration: `${transitionConfig.durationMs}ms` }
    : { animationDuration: '0ms' };

  const fullScreenMediaStyle = {
    width: '100%',
    height: '100%',
    objectFit: isPptImage ? 'contain' : 'cover',
    objectPosition: 'center center',
    display: 'block',
    borderRadius: 0,
  };

  const contentStageStyle = {
    position: 'fixed',
    inset: 0,
    width: '100%',
    height: '100%',
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        background: '#000',
      }}
    >
      <div
        style={{
          ...contentStageStyle,
          zIndex: 1,
          overflow: 'hidden',
          background: effectiveMedia
            ? 'transparent'
            : 'radial-gradient(ellipse at center, #0a0a2e 0%, #000 100%)',
        }}
      >
        {!isBlackout && effectiveMedia?.type === 'video' && (
          <video
            key={`${effectiveMedia.path}-${effectiveMedia.standalone ? 'standalone' : 'background'}`}
            ref={(el) => {
              mediaSampleVideoRef.current = el || null;
              if (effectiveMedia.standalone) {
                videoRef.current = el || null;
              }
            }}
            src={getMediaUrl(effectiveMedia.path)}
            autoPlay
            loop
            muted={!effectiveMedia.standalone}
            playsInline
            controls={false}
            onLoadedMetadata={(e) => {
              const videoEl = e.currentTarget;
              if (!effectiveMedia.standalone) return;
              videoEl.muted = true;
              videoEl.volume = 1;
              videoEl
                .play()
                .then(() => {
                  // M11-R2: Track this timer so it can be cleaned up if the element
                  // is removed before it fires (via the timeoutRef array).
                  const t = setTimeout(() => {
                    videoEl.muted = false;
                    videoEl.defaultMuted = false;
                    videoEl.volume = 1;
                  }, 120);
                  timeoutRef.current.push(t);
                })
                .catch((err) => {
                  console.error('[ProjectorView] standalone video play failed:', err);
                });
            }}
            style={fullScreenMediaStyle}
          />
        )}

        {!isBlackout && effectiveMedia?.type === 'image' && (
          <>
            {isPptImage && (
              <img
                key={`${effectiveMedia.path}-fill`}
                src={getMediaUrl(effectiveMedia.path)}
                alt=""
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  objectPosition: 'center center',
                  display: 'block',
                  borderRadius: 0,
                  filter: 'blur(26px) brightness(0.58)',
                  transform: 'scale(1.08)',
                }}
              />
            )}
            <img
              key={effectiveMedia.path}
              src={getMediaUrl(effectiveMedia.path)}
              alt="background"
              style={{
                ...fullScreenMediaStyle,
                position: isPptImage ? 'absolute' : 'static',
                inset: isPptImage ? 0 : undefined,
                zIndex: isPptImage ? 2 : undefined,
              }}
            />
          </>
        )}

        {!isBlackout && content?.type === 'pdf' && (
          <PdfRenderer
            path={content.path}
            pageNumber={content.page || 1}
            fitMode={content.fitMode || 'contain'}
          />
        )}
      </div>

      {!isBlackout && isTextualContent && (
        <div
          style={{
            ...contentStageStyle,
            background: `rgba(0, 0, 0, ${textOverlayOpacity})`,
            zIndex: 2,
            pointerEvents: 'none',
            transition: 'background 300ms ease',
          }}
        />
      )}

      <div
        style={{
          ...contentStageStyle,
          background: '#000',
          opacity: transitionMaskVisible ? 0.45 : 0,
          transition: `opacity ${transitionConfig.durationMs}ms ease`,
          zIndex: 8,
          pointerEvents: 'none',
        }}
      />

      {!isBlackout && content?.type === 'youtube' && (
        <div
          style={{
            ...contentStageStyle,
            zIndex: 4,
            overflow: 'hidden',
            ...fadeAnimationStyle,
          }}
        >
          <iframe
            src={getYouTubeEmbedUrl(content.videoId)}
            title={content.name || 'YouTube'}
            referrerPolicy="origin"
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            style={{
              width: '100%',
              height: '100%',
              border: 'none',
              display: 'block',
              borderRadius: 0,
            }}
          />
        </div>
      )}

      {!isBlackout && isTextualSlideType(content?.type) && (
        <ProjectorTextLayer
          content={content}
          contentStageStyle={contentStageStyle}
          fadeClass={fadeClass}
          fadeAnimationStyle={fadeAnimationStyle}
          isFreeText={isFreeText}
          textLayout={textLayout}
          getTextSizeClass={getTextSizeClass}
          getProjectorTextSize={getProjectorTextSize}
        />
      )}

      {isBlackout && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: '#000',
            zIndex: 100,
          }}
        />
      )}
    </div>
  );
}

export default ProjectorView;
