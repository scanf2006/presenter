import { useCallback, useEffect, useRef, useState } from 'react';
import { isTauriRuntime, sendToTauriProjector } from '../utils/tauriProjector';
import { describeError } from '../utils/errorMessage';

// Blackout travels as an explicit payload instead of an absent one so the projector
// can tell "show true black" apart from "nothing has been projected yet", and so a
// display reconnect that restores the last payload stays black.
export const BLACKOUT_PAYLOAD = { type: 'blackout' };

const DELIVERY_RETRY_DELAY_MS = 150;

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

  // Resolves to null on delivery, or to the failure reason after one retry.
  // A rejected invoke is the only real failure signal available: the projector
  // window does not acknowledge payloads, so there is nothing else to wait for.
  const deliverToProjector = useCallback(async (data) => {
    if (!isTauriRuntime()) return null;
    try {
      await sendToTauriProjector(data);
      return null;
    } catch (firstError) {
      // A transient failure is the projector window not being addressable yet;
      // a refusal (expired trial) fails again and reports the backend's reason.
      await new Promise((resolve) => setTimeout(resolve, DELIVERY_RETRY_DELAY_MS));
      try {
        await sendToTauriProjector(data);
        return null;
      } catch (retryError) {
        return retryError || firstError;
      }
    }
  }, []);

  const reportDeliveryFailure = useCallback(
    (error, label) => {
      if (!error || suppressDeliveryWarnings || typeof showToast !== 'function') return;
      showToast(`${label}: ${describeError(error)}`, 'error');
    },
    [showToast, suppressDeliveryWarnings]
  );

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
      void deliverToProjector(data).then((error) =>
        reportDeliveryFailure(error, 'Projector delivery failed')
      );
    },
    [applyPreviewTransition, deliverToProjector, reportDeliveryFailure]
  );

  const resendCurrentSlideToProjector = useCallback(
    (data) => {
      if (!data) return;
      // Best effort after a display change; the visible state is already correct.
      void deliverToProjector(data);
    },
    [deliverToProjector]
  );

  const blackout = useCallback(() => {
    setCurrentSlide(null);
    applyPreviewTransition(null);
    void deliverToProjector(BLACKOUT_PAYLOAD).then((error) =>
      reportDeliveryFailure(error, 'Blackout failed')
    );
  }, [applyPreviewTransition, deliverToProjector, reportDeliveryFailure]);

  return {
    currentSlide,
    previewSlide,
    previewMaskVisible,
    pushToProjector,
    resendCurrentSlideToProjector,
    blackout,
  };
}
