import { useEffect } from 'react';
import { mergeSceneConfig, normalizeTransitionConfig } from '../utils/projectorChannel';

export default function useProjectorChannelSync({
  isElectron,
  transitionRef,
  timeoutRef,
  videoRef,
  setTransitionConfig,
  setSceneConfig,
  setContent,
  setBackgroundContent,
  setIsBlackout,
  setFadeClass,
  setTransitionMaskVisible,
}) {
  useEffect(() => {
    if (!isElectron) return;

    const clearTimers = () => {
      timeoutRef.current.forEach((t) => clearTimeout(t));
      timeoutRef.current = [];
    };

    const offProjectorTransition = window.churchDisplay.onProjectorTransition((data) => {
      const next = normalizeTransitionConfig(data);
      transitionRef.current = next;
      setTransitionConfig(next);
    });

    const offProjectorScene = window.churchDisplay.onProjectorScene((data) => {
      setSceneConfig((prev) => mergeSceneConfig(prev, data));
    });

    const queueTransitionMaskHide = (durationMs) => {
      const maskTimer = setTimeout(() => {
        setTransitionMaskVisible(false);
      }, durationMs);
      timeoutRef.current.push(maskTimer);
    };

    const applyProjectedContent = (nextContent) => {
      setContent(nextContent);
      setBackgroundContent(nextContent?.background || null);
      setIsBlackout(false);
      setFadeClass('projector-view__content--fade-in');
    };

    const runTransitionedUpdate = (cfg, applyFn) => {
      setTransitionMaskVisible(true);
      setFadeClass('projector-view__content--fade-out');
      const firstTimer = setTimeout(() => {
        const secondTimer = setTimeout(() => {
          applyFn();
          queueTransitionMaskHide(cfg.durationMs);
        }, cfg.delayMs);
        timeoutRef.current.push(secondTimer);
      }, cfg.durationMs);
      timeoutRef.current.push(firstTimer);
    };

    const offProjectorContent = window.churchDisplay.onProjectorContent((data) => {
      clearTimers();
      const cfg = transitionRef.current;
      const skipTransitionOnce = data?.disableTransitionOnce === true;
      if (!cfg.enabled || skipTransitionOnce) {
        applyProjectedContent(data);
        setFadeClass('');
        setTransitionMaskVisible(false);
        return;
      }

      runTransitionedUpdate(cfg, () => {
        applyProjectedContent(data);
      });
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

      runTransitionedUpdate(cfg, () => {
        setContent(null);
        setIsBlackout(true);
        setFadeClass('');
        if (videoRef.current) {
          videoRef.current.pause();
        }
      });
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
  }, [
    isElectron,
    setBackgroundContent,
    setContent,
    setFadeClass,
    setIsBlackout,
    setSceneConfig,
    setTransitionConfig,
    setTransitionMaskVisible,
    timeoutRef,
    transitionRef,
    videoRef,
  ]);
}
