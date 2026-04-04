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
  const timeoutRef = useRef([]);

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
        // 可选延时：在旧内容淡出完成后再等待
        const applyNewTimer = setTimeout(() => {
        setContent(data);
        if (data?.background) {
          setBackgroundContent(data.background);
        }
        setIsBlackout(false);
        setFadeClass('projector-view__content--fade-in');
          // 淡入结束后再撤掉遮罩
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
    // 兼容自动播放策略：先静音启动，再强制开声
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

  const getMediaUrl = (filePath) => {
    if (!filePath) return '';
    return `local-media://${encodeURIComponent(filePath)}`;
  };

  const getYouTubeEmbedUrl = (videoId) => {
    if (!videoId) return '';
    return `https://www.youtube.com/embed/${videoId}?autoplay=1&controls=0&modestbranding=1&rel=0&playsinline=1`;
  };

  const backgroundMedia =
    content?.background ||
    content?.payload?.background ||
    content?.bg ||
    backgroundContent ||
    null;

  const fadeAnimationStyle = transitionConfig.enabled
    ? { animationDuration: `${transitionConfig.durationMs}ms` }
    : { animationDuration: '0ms' };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
        background: '#000',
      }}
    >
      {/* Background layer: always full-screen and independent from foreground text */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          width: '100vw',
          height: '100vh',
          zIndex: 1,
          overflow: 'hidden',
          background: backgroundMedia
            ? 'transparent'
            : 'radial-gradient(ellipse at center, #0a0a2e 0%, #000 100%)',
        }}
      >
        {!isBlackout && backgroundMedia?.type === 'video' && (
          <video
            key={backgroundMedia.path}
            src={getMediaUrl(backgroundMedia.path)}
            autoPlay
            loop
            muted
            playsInline
            style={{
              width: '100vw',
              height: '100vh',
              objectFit: 'cover',
              display: 'block',
            }}
          />
        )}

        {!isBlackout && backgroundMedia?.type === 'image' && (
          <img
            key={backgroundMedia.path}
            src={getMediaUrl(backgroundMedia.path)}
            alt="background"
            style={{
              width: '100vw',
              height: '100vh',
              objectFit: 'cover',
              display: 'block',
            }}
          />
        )}
      </div>

      {/* Optional dim overlay for readability */}
      {!isBlackout && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.25)',
            zIndex: 2,
            pointerEvents: 'none',
          }}
        />
      )}

      {/* Full-screen transition mask for clearer fade effect */}
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

      {/* Foreground media layer (full-screen, independent of text) */}
      {!isBlackout && content?.type === 'image' && (
        <div
          className={fadeClass}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 4,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            ...fadeAnimationStyle,
          }}
        >
          <img
            src={getMediaUrl(content.path)}
            alt={content.name || 'image'}
            style={{
              width: '100vw',
              height: '100vh',
              objectFit: 'contain',
            }}
          />
        </div>
      )}

      {!isBlackout && content?.type === 'video' && (
        <div
          className={fadeClass}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 4,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            ...fadeAnimationStyle,
          }}
        >
          <video
            ref={videoRef}
            src={getMediaUrl(content.path)}
            autoPlay
            playsInline
            muted
            controls={false}
            onLoadedMetadata={(e) => {
              e.currentTarget.muted = true;
              e.currentTarget.volume = 1;
              e.currentTarget.play()
                .then(() => {
                  setTimeout(() => {
                    e.currentTarget.muted = false;
                    e.currentTarget.defaultMuted = false;
                    e.currentTarget.volume = 1;
                  }, 120);
                })
                .catch((err) => {
                  console.error('[ProjectorView] onLoadedMetadata play failed:', err);
                });
            }}
            style={{
              width: '100vw',
              height: '100vh',
              objectFit: 'contain',
            }}
          />
        </div>
      )}

      {!isBlackout && content?.type === 'youtube' && (
        <div
          className={fadeClass}
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
            allow="autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
            style={{
              width: '100vw',
              height: '100vh',
              border: 'none',
              display: 'block',
            }}
          />
        </div>
      )}

      {/* Text/content layer */}
      {!isBlackout && content && (content.type === 'text' || content.type === 'bible' || content.type === 'lyrics') && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '2%',
            pointerEvents: 'none',
          }}
        >
          <div
            className={`projector-view__content ${fadeClass}`}
            style={{
              width: '95%',
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
              }}
            >
              {content.text}
            </div>

          </div>

          {content.reference && (
            <div
              style={{
                position: 'absolute',
                right: '2.5%',
                bottom: '2.5%',
                fontSize: '30px',
                fontStyle: 'italic',
                color: 'rgba(255, 255, 255, 0.96)',
                textAlign: 'right',
                textShadow: '2px 2px 8px rgba(0, 0, 0, 0.9)',
                pointerEvents: 'none',
              }}
            >
              {`— ${content.reference}`}
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
