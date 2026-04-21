import { useCallback, useEffect, useRef, useState } from 'react';

export default function useProjectorPreviewDispatch({
  isElectron,
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
  const deliveryTimeoutMsRef = useRef(1800);

  const waitForAckWithTimeout = useCallback(async (data) => {
    if (!isElectron || !window.churchDisplay) return { ok: true, mode: 'browser' };
    if (typeof window.churchDisplay.sendToProjectorWithAck !== 'function') {
      window.churchDisplay.sendToProjector(data);
      return { ok: true, mode: 'legacy-send' };
    }

    const ackPromise = window.churchDisplay.sendToProjectorWithAck(data);
    const timeoutPromise = new Promise((resolve) =>
      setTimeout(
        () => resolve({ ok: false, reason: 'ack_timeout', message: 'Projector acknowledgment timeout.' }),
        deliveryTimeoutMsRef.current
      )
    );
    return Promise.race([ackPromise, timeoutPromise]);
  }, [isElectron]);

  const clearPreviewTimers = useCallback(() => {
    previewTimersRef.current.forEach((t) => clearTimeout(t));
    previewTimersRef.current = [];
  }, []);

  const applyPreviewTransition = useCallback(
    (nextSlide) => {
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
    },
    [transitionEnabled, transitionDelayMs, transitionDurationMs, clearPreviewTimers]
  );

  useEffect(() => () => clearPreviewTimers(), [clearPreviewTimers]);

  const pushToProjector = useCallback(
    (data) => {
      setCurrentSlide(data);
      applyPreviewTransition(data);
      if (isElectron && window.churchDisplay) {
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
        if (typeof window.churchDisplay.sendToProjectorBackground === 'function') {
          window.churchDisplay.sendToProjectorBackground(data?.background || null);
        }
      }
    },
    [
      isElectron,
      applyPreviewTransition,
      waitForAckWithTimeout,
      showToast,
      suppressDeliveryWarnings,
    ]
  );

  const blackout = useCallback(() => {
    setCurrentSlide(null);
    applyPreviewTransition(null);
    if (isElectron && window.churchDisplay) {
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
