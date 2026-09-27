import { useCallback, useEffect, useRef, useState } from 'react';
import { isTauriRuntime, sendToTauriProjector } from '../utils/tauriProjector';

export default function useProjectorPreviewDispatch({
  transitionEnabled,
  transitionDelayMs,
  transitionDurationMs,
  showToast,
  suppressDeliveryWarnings = false,
}) {
  const [currentSlide, setCurrentSlide] = useState(null);
  const [previewSlide, setPreviewSlide] = useState(null);
  const [previewMaskVisible, setPreviewMaskVisible] = useState(false);
  const previewTimersRef = useRef([]);

  const waitForAckWithTimeout = useCallback(async (data) => {
    if (isTauriRuntime()) {
      await sendToTauriProjector(data);
      return { ok: true, mode: 'tauri' };
    }
    return { ok: true, mode: 'browser' };
  }, []);

  const clearPreviewTimers = useCallback(() => {
    previewTimersRef.current.forEach((t) => clearTimeout(t));
    previewTimersRef.current = [];
  }, []);

  const applyPreviewTransition = useCallback(
    (nextSlide) => {
      clearPreviewTimers();
      const skipTransitionOnce = nextSlide?.disableTransitionOnce === true;

      if (!transitionEnabled || skipTransitionOnce) {
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
    },
    [transitionEnabled, transitionDelayMs, transitionDurationMs, clearPreviewTimers]
  );

  useEffect(() => () => clearPreviewTimers(), [clearPreviewTimers]);

  const pushToProjector = useCallback(
    (data) => {
      setCurrentSlide(data);
      applyPreviewTransition(data);
      if (isTauriRuntime()) {
        // Reliability layer: await main-process ACK with timeout and retry once on failure.
        Promise.resolve()
          .then(async () => {
            let ack = await waitForAckWithTimeout(data);
            if (ack?.ok) return;
            const firstReason = ack?.reason || 'unknown';
            ack = await waitForAckWithTimeout(data);
            if (!ack?.ok && !suppressDeliveryWarnings && typeof showToast === 'function') {
              showToast(`Projector delivery delayed (${firstReason}).`, 'warning');
            }
          })
          .catch((err) => {
            if (!suppressDeliveryWarnings && typeof showToast === 'function') {
              showToast(`Projector delivery failed: ${err?.message || 'Unknown error'}`, 'error');
            }
          });
      }
    },
    [
      applyPreviewTransition,
      waitForAckWithTimeout,
      showToast,
      suppressDeliveryWarnings,
    ]
  );

  const resendCurrentSlideToProjector = useCallback(
    (data) => {
      if (!data) return;
      if (isTauriRuntime()) {
        void sendToTauriProjector(data);
        return;
      }
    },
    []
  );

  const blackout = useCallback(() => {
    setCurrentSlide(null);
    applyPreviewTransition(null);
    if (isTauriRuntime()) {
      void sendToTauriProjector(null);
    }
  }, [applyPreviewTransition]);

  return {
    currentSlide,
    previewSlide,
    previewMaskVisible,
    pushToProjector,
    resendCurrentSlideToProjector,
    blackout,
  };
}
