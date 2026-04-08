import { useCallback, useEffect, useRef, useState } from 'react';

export default function useProjectorPreviewDispatch({
  isElectron,
  transitionEnabled,
  transitionDelayMs,
  transitionDurationMs,
}) {
  const [currentSlide, setCurrentSlide] = useState(null);
  const [previewSlide, setPreviewSlide] = useState(null);
  const [previewMaskVisible, setPreviewMaskVisible] = useState(false);
  const previewTimersRef = useRef([]);

  const clearPreviewTimers = useCallback(() => {
    previewTimersRef.current.forEach((t) => clearTimeout(t));
    previewTimersRef.current = [];
  }, []);

  const applyPreviewTransition = useCallback((nextSlide) => {
    clearPreviewTimers();

    if (!transitionEnabled) {
      setPreviewSlide(nextSlide);
      setPreviewMaskVisible(false);
      return;
    }

    setPreviewMaskVisible(true);
    const fadeOutTimer = setTimeout(() => {
      const delayTimer = setTimeout(() => {
        setPreviewSlide(nextSlide);
        const fadeInTimer = setTimeout(() => {
          setPreviewMaskVisible(false);
        }, transitionDurationMs);
        previewTimersRef.current.push(fadeInTimer);
      }, transitionDelayMs);
      previewTimersRef.current.push(delayTimer);
    }, transitionDurationMs);
    previewTimersRef.current.push(fadeOutTimer);
  }, [transitionEnabled, transitionDelayMs, transitionDurationMs, clearPreviewTimers]);

  useEffect(() => () => clearPreviewTimers(), [clearPreviewTimers]);

  const pushToProjector = useCallback((data) => {
    setCurrentSlide(data);
    applyPreviewTransition(data);
    if (isElectron) {
      window.churchDisplay.sendToProjector(data);
      if (typeof window.churchDisplay.sendToProjectorBackground === 'function') {
        window.churchDisplay.sendToProjectorBackground(data?.background || null);
      }
    }
  }, [isElectron, applyPreviewTransition]);

  const blackout = useCallback(() => {
    setCurrentSlide(null);
    applyPreviewTransition(null);
    if (isElectron) {
      window.churchDisplay.blackout();
    }
  }, [isElectron, applyPreviewTransition]);

  return {
    currentSlide,
    previewSlide,
    previewMaskVisible,
    pushToProjector,
    blackout,
  };
}
