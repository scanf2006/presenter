import React, { useEffect, useRef, useState } from 'react';
/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable react-hooks/exhaustive-deps */

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
  const [adaptiveOverlayOpacity, setAdaptiveOverlayOpacity] = useState(0.1);
  const [sceneConfig, setSceneConfig] = useState({
    mode: 'normal',
    splitDirection: 'content_left_camera_right',
    cameraDeviceId: '',
    cameraPanePercent: 30,
    cameraMuted: true,
    cameraCenterCropPercent: 100,
    enableCameraTestMode: false,
  });
  const cameraPaneVideoRef = useRef(null);
  const cameraPaneStreamRef = useRef(null);
  const [cameraPaneStatus, setCameraPaneStatus] = useState('idle');
  const [cameraTestNow, setCameraTestNow] = useState(0);

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
    const offProjectorScene = window.churchDisplay.onProjectorScene((data) => {
      const nextMode = data?.mode === 'split_camera' ? 'split_camera' : 'normal';
      setSceneConfig((prev) => ({
        ...prev,
        mode: nextMode,
        splitDirection: data?.splitDirection || prev.splitDirection,
        cameraDeviceId:
          typeof data?.cameraDeviceId === 'string' ? data.cameraDeviceId : prev.cameraDeviceId,
        cameraPanePercent: Number.isFinite(data?.cameraPanePercent)
          ? Math.max(20, Math.min(40, Number(data.cameraPanePercent)))
          : prev.cameraPanePercent,
        cameraMuted: data?.cameraMuted !== false,
        cameraCenterCropPercent: Number.isFinite(data?.cameraCenterCropPercent)
          ? Math.max(100, Math.min(220, Number(data.cameraCenterCropPercent)))
          : prev.cameraCenterCropPercent,
        enableCameraTestMode: data?.enableCameraTestMode === true,
      }));
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
      if (typeof offProjectorScene === 'function') offProjectorScene();
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
    const px = Number(content?.fontSizePx);
    const paneRatio = splitEnabled ? (100 - rightPanePercent) / 100 : 1;
    const scale = splitEnabled ? Math.max(0.72, paneRatio) : 1;
    if (Number.isFinite(px) && px > 0) {
      const scaled = Math.max(20, Math.min(220, Math.round(px * scale)));
      return `${scaled}px`;
    }
    const base = content?.fontSize === 'small' ? 32 : content?.fontSize === 'medium' ? 48 : 72;
    return `${Math.round(base * scale)}px`;
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

  const standaloneMedia =
    (content?.type === 'image' || content?.type === 'video') && content?.path
      ? { type: content.type, path: content.path, standalone: true }
      : null;

  const effectiveMedia =
    standaloneMedia || (backgroundMedia ? { ...backgroundMedia, standalone: false } : null);
  const mediaPathForDetect = String(content?.path || effectiveMedia?.path || '');
  const mediaNameForDetect = String(content?.name || '');
  const isPptImage =
    effectiveMedia?.type === 'image' &&
    (content?.originType === 'ppt' ||
      /ppt/i.test(mediaNameForDetect) ||
      /[\\/]media[\\/]ppt[\\/]/i.test(mediaPathForDetect));
  const isTextualContent =
    content && (content.type === 'text' || content.type === 'bible' || content.type === 'lyrics');
  const hasVideoBackgroundForText = Boolean(
    isTextualContent && effectiveMedia?.type === 'video' && !effectiveMedia?.standalone
  );
  const textOverlayOpacity = hasVideoBackgroundForText ? 0 : adaptiveOverlayOpacity;
  const isFreeText = content?.type === 'text';
  const textLayout = {
    xPercent: Math.max(8, Math.min(92, Number(content?.textLayout?.xPercent ?? 50))),
    yPercent: Math.max(10, Math.min(90, Number(content?.textLayout?.yPercent ?? 50))),
    scale: Math.max(0.5, Math.min(3.2, Number(content?.textLayout?.scale ?? 1))),
  };
  const rightPanePercent = Math.max(20, Math.min(40, Number(sceneConfig.cameraPanePercent || 30)));
  const rightCameraScale = Math.max(1, Number(sceneConfig.cameraCenterCropPercent || 100) / 100);
  const splitEnabled = false;
  const contentPaneWidth = `${100 - rightPanePercent}%`;

  useEffect(() => {
    const stop = () => {
      const stream = cameraPaneStreamRef.current;
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
        cameraPaneStreamRef.current = null;
      }
      if (cameraPaneVideoRef.current) {
        cameraPaneVideoRef.current.srcObject = null;
      }
    };

    if (!splitEnabled) {
      stop();
      setCameraPaneStatus('idle');
      return;
    }

    if (sceneConfig.enableCameraTestMode) {
      stop();
      setCameraPaneStatus('ok');
      return;
    }

    const start = async () => {
      if (!navigator?.mediaDevices?.getUserMedia) {
        setCameraPaneStatus('unsupported');
        return;
      }
      try {
        setCameraPaneStatus('loading');
        stop();
        const constraints = sceneConfig.cameraDeviceId
          ? { video: { deviceId: { exact: sceneConfig.cameraDeviceId } }, audio: false }
          : { video: true, audio: false };
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        cameraPaneStreamRef.current = stream;
        if (cameraPaneVideoRef.current) {
          cameraPaneVideoRef.current.srcObject = stream;
          cameraPaneVideoRef.current.muted = true;
          cameraPaneVideoRef.current.defaultMuted = true;
          cameraPaneVideoRef.current.play().catch(() => {});
        }
        setCameraPaneStatus('ok');
      } catch (err) {
        setCameraPaneStatus('error');
        console.warn('[ProjectorCamera] start failed:', err);
      }
    };
    start();

    return () => {
      stop();
    };
  }, [splitEnabled, sceneConfig.cameraDeviceId, sceneConfig.enableCameraTestMode]);

  useEffect(() => {
    if (!(splitEnabled && sceneConfig.enableCameraTestMode)) return;
    const t = setInterval(() => setCameraTestNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [splitEnabled, sceneConfig.enableCameraTestMode]);

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
    if (sampleIntervalRef.current) {
      clearInterval(sampleIntervalRef.current);
      sampleIntervalRef.current = null;
    }

    if (!isTextualContent || !effectiveMedia) {
      setAdaptiveOverlayOpacity(0.08);
      return;
    }

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
      setAdaptiveOverlayOpacity(0);
      return;
    }
  }, [isTextualContent, effectiveMedia?.type, effectiveMedia?.path]);

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

  const contentStageStyle = splitEnabled
    ? {
        position: 'fixed',
        top: 0,
        left: 0,
        bottom: 0,
        width: contentPaneWidth,
      }
    : {
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
                transform: isPptImage ? 'scale(1.05)' : undefined,
                transformOrigin: isPptImage ? 'center center' : undefined,
              }}
            />
          </>
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

      {!isBlackout &&
        content &&
        (content.type === 'text' || content.type === 'bible' || content.type === 'lyrics') && (
          <div
            style={{
              ...contentStageStyle,
              zIndex: 10,
              display: isFreeText ? 'block' : 'flex',
              alignItems: isFreeText ? undefined : 'center',
              justifyContent: isFreeText ? undefined : 'center',
              padding: 'clamp(24px, 5vh, 72px) clamp(28px, 6vw, 120px)',
              pointerEvents: 'none',
            }}
          >
            <div
              className={`projector-view__content ${fadeClass}`}
              style={{
                width: '88%',
                position: isFreeText ? 'absolute' : 'relative',
                left: isFreeText ? `${textLayout.xPercent}%` : undefined,
                top: isFreeText ? `${textLayout.yPercent}%` : undefined,
                transform: isFreeText
                  ? `translate(-50%, -50%) scale(${textLayout.scale})`
                  : undefined,
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
                  lineHeight: content.type === 'bible' ? '1.9' : '1.6',
                  letterSpacing: content.type === 'bible' ? '0.015em' : 'normal',
                  wordBreak: content.type === 'bible' ? 'break-word' : 'normal',
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

      {splitEnabled && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            right: 0,
            bottom: 0,
            width: `${rightPanePercent}%`,
            zIndex: 30,
            background: '#000',
            overflow: 'hidden',
            borderLeft: '1px solid rgba(255,255,255,0.24)',
          }}
        >
          {sceneConfig.enableCameraTestMode ? (
            <div
              style={{
                width: '100%',
                height: '100%',
                transform: `scale(${rightCameraScale})`,
                transformOrigin: 'center center',
                background: 'linear-gradient(135deg, #081525 0%, #152b4a 50%, #1f3a63 100%)',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  backgroundImage:
                    'repeating-linear-gradient(45deg, rgba(255,255,255,0.06) 0 18px, rgba(255,255,255,0.02) 18px 36px)',
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  inset: '24px',
                  border: '2px solid rgba(255,255,255,0.3)',
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  top: '50%',
                  height: '1px',
                  background: 'rgba(255,255,255,0.35)',
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  bottom: 0,
                  left: '50%',
                  width: '1px',
                  background: 'rgba(255,255,255,0.35)',
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  left: '20px',
                  top: '16px',
                  fontSize: '28px',
                  color: '#8ee7ff',
                  fontWeight: 700,
                  letterSpacing: '1px',
                }}
              >
                CAMERA
              </div>
              <div
                style={{
                  position: 'absolute',
                  right: '20px',
                  bottom: '16px',
                  fontSize: '26px',
                  color: 'rgba(255,255,255,0.95)',
                  fontFamily: 'monospace',
                }}
              >
                {new Date(cameraTestNow).toLocaleTimeString()}
              </div>
            </div>
          ) : (
            <video
              ref={cameraPaneVideoRef}
              autoPlay
              playsInline
              muted={sceneConfig.cameraMuted !== false}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                transform: `scale(${rightCameraScale})`,
                transformOrigin: 'center center',
              }}
            />
          )}
          {!sceneConfig.enableCameraTestMode && cameraPaneStatus !== 'ok' && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'rgba(255,255,255,0.92)',
                fontSize: '28px',
                textAlign: 'center',
                background: 'rgba(0,0,0,0.55)',
                padding: '28px',
                lineHeight: 1.5,
              }}
            >
              {cameraPaneStatus === 'loading'
                ? 'Loading camera...'
                : cameraPaneStatus === 'error'
                  ? 'Camera unavailable'
                  : cameraPaneStatus === 'unsupported'
                    ? 'Camera not supported'
                    : 'Camera idle'}
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
