import { useEffect, useRef, useState } from 'react';
/* eslint-disable react-hooks/set-state-in-effect */
import { TRANSITION } from '../constants/ui';
import { isTauriRuntime, sendTauriProjectorTransition } from '../utils/tauriProjector';

const TRANSITION_STORAGE_KEY = 'churchdisplay.transition.v1';

export default function useProjectionSettings({ isElectron }) {
  const [transitionEnabled, setTransitionEnabled] = useState(true);
  const [transitionDelayMs, setTransitionDelayMs] = useState(TRANSITION.DEFAULT_DELAY_MS);
  const [transitionDurationMs, setTransitionDurationMs] = useState(TRANSITION.DEFAULT_DURATION_MS);
  // R3-M: Guard to prevent persist effects from sending default values before hydration.
  const transitionHydrated = useRef(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(TRANSITION_STORAGE_KEY);
      if (!raw) {
        transitionHydrated.current = true;
        return;
      }
      const parsed = JSON.parse(raw);
      if (typeof parsed?.enabled === 'boolean') setTransitionEnabled(parsed.enabled);
      if (Number.isFinite(parsed?.delayMs)) {
        setTransitionDelayMs(
          Math.max(TRANSITION.MIN_MS, Math.min(TRANSITION.MAX_MS, parsed.delayMs))
        );
      }
      if (Number.isFinite(parsed?.durationMs)) {
        setTransitionDurationMs(
          Math.max(TRANSITION.MIN_MS, Math.min(TRANSITION.MAX_MS, parsed.durationMs))
        );
      }
    } catch (err) {
      console.warn('[Transition] restore failed:', err);
    }
    transitionHydrated.current = true;
  }, []);

  useEffect(() => {
    if (!transitionHydrated.current) return;
    try {
      window.localStorage.setItem(
        TRANSITION_STORAGE_KEY,
        JSON.stringify({
          enabled: transitionEnabled,
          delayMs: transitionDelayMs,
          durationMs: transitionDurationMs,
        })
      );
    } catch (err) {
      console.warn('[Transition] persist failed:', err);
    }

    if (isElectron && typeof window.churchDisplay?.sendTransition === 'function') {
      window.churchDisplay.sendTransition({
        enabled: transitionEnabled,
        delayMs: transitionDelayMs,
        durationMs: transitionDurationMs,
      });
    } else if (isTauriRuntime()) {
      void sendTauriProjectorTransition({
        enabled: transitionEnabled,
        delayMs: transitionDelayMs,
        durationMs: transitionDurationMs,
      });
    }
  }, [transitionEnabled, transitionDelayMs, transitionDurationMs, isElectron]);

  return {
    transitionEnabled,
    setTransitionEnabled,
    transitionDelayMs,
    setTransitionDelayMs,
    transitionDurationMs,
    setTransitionDurationMs,
  };
}
