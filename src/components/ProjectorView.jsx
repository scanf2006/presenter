import React, { useEffect, useRef, useState } from 'react';

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
  const sampleIntervalRef = useRef(null);
  const timeoutRef = useRef([]);
  const [adaptiveOverlayOpacity, setAdaptiveOverlayOpacity] = useState(0.3);

  const isElectron = typeof window.churchDisplay !== 'undefined';

  useEffect(() => {
    if (!isElectron) return;

    const clearTimers = () => {
      timeoutRef.current.forEach((t) => clearTimeout(t));
      timeoutRef.current = [];
    };

    const offProjectorTransition = window.churchDisplay.onProjectorTransition((data) => {
      const next = {
        enabled: data?.enabled !== false,
        delayMs: Number.isFinite(data?.delayMs) ? Math.max(0, data.delayMs) : 20,
        durationMs: Number.isFinite(data?.durationMs) ? Math.max(0, data.durationMs) : 60,
      };
      transitionRef.current = next;
      setTransitionConfig(next);
    });

    const offProjectorContent = window.churchDisplay.onProjectorContent((data) => {
      clearTimers();
      const cfg = transitionRef.current;
      if (!cfg.enabled) {
        setContent(data);
        if (data?.background) {
          setBackgroundContent(data.background);
        }
        setIsBlackout(false);
        setFadeClass('');
        return;
      }

      setTransitionMaskVisible(true);
      setFadeClass('projector-view__content--fade-out');
      const switchTimer = setTimeout(() => {
        const applyNewTimer = setTimeout(() => {
          setContent(data);
          if (data?.background) {
            setBackgroundContent(data.background);
          }
          setIsBlackout(false);
          setFadeClass('projector-view__content--fade-in');
          const maskTimer = setTimeout(() => {
            setTransitionMaskVisible(false);
          }, cfg.durationMs);
          timeoutRef.current.push(maskTimer);
        }, cfg.delayMs);
        timeoutRef.current.push(applyNewTimer);
      }, cfg.durationMs);
      timeoutRef.current.push(switchTimer);
    });

    const offProjectorBackground = window.churchDisplay.onProjectorBackground((data) => {
      setBackgroundContent(data || null);
      setIsBlackout(false);
    });

    const offProjectorBlackout = window.churchDisplay.onProjectorBlackout(() => {
      clearTimers();
      const cfg = transitionRef.current;
      if (!cfg.enabled) {
        setContent(null);
        setIsBlackout(true);
        setFadeClass('');
        setTransitionMaskVisible(false);
        if (videoRef.current) {
          videoRef.current.pause();
        }
        return;
      }

      setTransitionMaskVisible(true);
      setFadeClass('projector-view__content--fade-out');
      const blackoutTimer = setTimeout(() => {
        const applyBlackoutTimer = setTimeout(() => {
          setContent(null);
          setIsBlackout(true);
          setFadeClass('');
          const maskTimer = setTimeout(() => {
            setTransitionMaskVisible(false);
          }, cfg.durationMs);
          timeoutRef.current.push(maskTimer);

          if (videoRef.current) {
            videoRef.current.pause();
          }
        }, cfg.delayMs);
        timeoutRef.current.push(applyBlackoutTimer);
      }, cfg.durationMs);
      timeoutRef.current.push(blackoutTimer);
    });

    const offMediaCommand = window.churchDisplay.onMediaCommand((command) => {
      if (!videoRef.current) return;

      const { type, value } = command;
      if (type === 'play') videoRef.current.play().catch(console.error);
      if (type === 'pause') videoRef.current.pause();
      if (type === 'seek') videoRef.current.currentTime = value;
    });

    return () => {
      if (typeof offProjectorContent === 'function') offProjectorContent();
      if (typeof offProjectorBackground === 'function') offProjectorBackground();
      if (typeof offProjectorBlackout === 'function') offProjectorBlackout();
      if (typeof offMediaCommand === 'function') offMediaCommand();
      if (typeof offProjectorTransition === 'function') offProjectorTransition();
      clearTimers();
    };
  }, [isElectron]);

  useEffect(() => {
    if (content?.type !== 'video') return;
    const v = videoRef.current;
    if (!v) return;
    v.defaultMuted = true;
    v.muted = true;
    v.volume = 1;
    v.play()
      .then(() => {
        setTimeout(() => {
          v.muted = false;
          v.defaultMuted = false;
          v.volume = 1;
        }, 120);
      })
      .catch((err) => {
        console.error('[ProjectorView] video play failed:', err);
      });
  }, [content]);

  const getTextSizeClass = () => {
    if (!content) return 'projector-text--large';
    if (content.fontSize === 'small') return 'projector-text--small';
    if (content.fontSize === 'medium') return 'projector-text--medium';
    return 'projector-text--large';
  };

  const getProjectorTextSize = () => {
    const px = Number(content?.fontSizePx);
    if (Number.isFinite(px) && px > 0) {
      return `${Math.max(20, Math.min(220, px))}px`;
    }
    if (content?.fontSize === 'small') return '32px';
    if (content?.fontSize === 'medium') return '48px';
    return '72px';
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
    content?.background ||
    content?.payload?.background ||
    content?.bg ||
    backgroundContent ||
    null;

  const standaloneMedia =
    (content?.type === 'image' || content?.type === 'video') && content?.path
      ? { type: content.type, path: content.path, standalone: true }
      : null;

  const effectiveMedia = standaloneMedia || (backgroundMedia ? { ...backgroundMedia, standalone: false } : null);
  const isTextualContent = content && (content.type === 'text' || content.type === 'bible' || content.type === 'lyrics');

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
    if (!Number.isFinite(luma)) return 0.3;
    const normalized = Math.max(0, Math.min(1, luma / 255));
    return 0.2 + normalized * 0.34;
  };

  useEffect(() => {
    if (sampleIntervalRef.current) {
      clearInterval(sampleIntervalRef.current);
      sampleIntervalRef.current = null;
    }

    if (!isTextualContent || !effectiveMedia) {
      setAdaptiveOverlayOpacity(0.25);
      return;
    }

    if (effectiveMedia.type === 'image' && effectiveMedia.path) {
      const img = new Image();
      img.onload = () => {
        const luma = sampleAverageLuma(img, img.naturalWidth, img.naturalHeight);
        setAdaptiveOverlayOpacity(lumaToOverlay(luma));
      };
      img.onerror = () => setAdaptiveOverlayOpacity(0.3);
      img.src = getMediaUrl(effectiveMedia.path);
      return;
    }

    if (effectiveMedia.type === 'video') {
      const sampleFrame = () => {
        const v = mediaSampleVideoRef.current;
        if (!v || v.readyState < 2 || !v.videoWidth || !v.videoHeight) return;
        const luma = sampleAverageLuma(v, v.videoWidth, v.videoHeight);
        if (Number.isFinite(luma)) {
          setAdaptiveOverlayOpacity(lumaToOverlay(luma));
        }
      };

      sampleFrame();
      sampleIntervalRef.current = setInterval(sampleFrame, 1200);
      return () => {
        if (sampleIntervalRef.current) {
          clearInterval(sampleIntervalRef.current);
          sampleIntervalRef.current = null;
        }
      };
    }
  }, [isTextualContent, effectiveMedia?.type, effectiveMedia?.path]);

  const fadeAnimationStyle = transitionConfig.enabled
    ? { animationDuration: `${transitionConfig.durationMs}ms` }
    : { animationDuration: '0ms' };

  const fullScreenMediaStyle = {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    objectPosition: 'center center',
    display: 'block',
    borderRadius: 0,
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
          position: 'fixed',
          inset: 0,
          width: '100%',
          height: '100%',
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
              videoEl.play()
                .then(() => {
                  setTimeout(() => {
                    videoEl.muted = false;
                    videoEl.defaultMuted = false;
                    videoEl.volume = 1;
                  }, 120);
                })
                .catch((err) => {
                  console.error('[ProjectorView] standalone video play failed:', err);
                });
            }}
            style={fullScreenMediaStyle}
          />
        )}

        {!isBlackout && effectiveMedia?.type === 'image' && (
          <img
            key={effectiveMedia.path}
            src={getMediaUrl(effectiveMedia.path)}
            alt="background"
            style={fullScreenMediaStyle}
          />
        )}
      </div>

      {!isBlackout && isTextualContent && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: `rgba(0, 0, 0, ${adaptiveOverlayOpacity})`,
            zIndex: 2,
            pointerEvents: 'none',
            transition: 'background 300ms ease',
          }}
        />
      )}

      <div
        style={{
          position: 'fixed',
          inset: 0,
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
            position: 'fixed',
            inset: 0,
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

      {!isBlackout && content && (content.type === 'text' || content.type === 'bible' || content.type === 'lyrics') && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
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
              width: 'min(88vw, 1800px)',
              textAlign: 'center',
              ...fadeAnimationStyle,
            }}
          >
            <div
              className={`projector-text ${getTextSizeClass()}`}
              style={{
                whiteSpace: 'pre-line',
                textAlign: 'center',
                lineHeight: '1.6',
                textShadow: '3px 3px 10px rgba(0, 0, 0, 0.9)',
                color: content.textColor || '#ffffff',
                fontFamily: content.fontFamily || "'Noto Sans SC', 'Inter', sans-serif",
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
                textAlign: 'right',
                textShadow: '2px 2px 8px rgba(0, 0, 0, 0.9)',
                pointerEvents: 'none',
              }}
            >
              {`- ${content.reference}`}
            </div>
          )}
        </div>
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
