import { useCallback } from 'react';
import {
  closeTauriWindow,
  hideTauriProjector,
  minimizeTauriWindow,
  showTauriProjector,
  toggleMaximizeTauriWindow,
} from '../utils/tauriProjector';

export default function useWindowProjectorControls({
  isElectron,
  isTauri,
  setProjectorActive,
  setProjectorDisplayId,
  showConfirm,
}) {
  const startProjector = useCallback(
    async (displayId) => {
      if (isElectron) {
        try {
          window.churchDisplay.startProjector(displayId);
        } catch (err) {
          console.error('[useWindowProjectorControls] startProjector failed:', err);
        }
        return;
      }
      if (isTauri) {
        await showTauriProjector(displayId);
      }
      setProjectorActive(true);
      setProjectorDisplayId(displayId);
    },
    [isElectron, isTauri, setProjectorActive, setProjectorDisplayId]
  );

  const stopProjector = useCallback(async () => {
    if (isElectron) {
      try {
        window.churchDisplay.stopProjector();
      } catch (err) {
        console.error('[useWindowProjectorControls] stopProjector failed:', err);
      }
      return;
    }
    if (isTauri) await hideTauriProjector();
    setProjectorActive(false);
    setProjectorDisplayId(null);
  }, [isElectron, isTauri, setProjectorActive, setProjectorDisplayId]);

  const minimizeWindow = useCallback(() => {
    if (isElectron && typeof window.churchDisplay?.minimizeControlWindow === 'function') {
      window.churchDisplay.minimizeControlWindow();
    } else if (isTauri) {
      minimizeTauriWindow().catch((err) => console.warn('[Window] minimize failed:', err));
    }
  }, [isElectron, isTauri]);

  const toggleMaximizeWindow = useCallback(() => {
    if (isElectron && typeof window.churchDisplay?.toggleMaximizeControlWindow === 'function') {
      window.churchDisplay.toggleMaximizeControlWindow();
    } else if (isTauri) {
      toggleMaximizeTauriWindow().catch((err) => console.warn('[Window] maximize failed:', err));
    }
  }, [isElectron, isTauri]);

  const closeWindow = useCallback(async () => {
    if (isElectron && typeof window.churchDisplay?.closeControlWindow === 'function') {
      const ok = await showConfirm(
        'Confirm Exit',
        'Are you sure you want to exit ChurchDisplay Pro?\nUnsaved temporary changes may be lost.'
      );
      if (!ok) return;
      window.churchDisplay.closeControlWindow();
    }
    if (isTauri) {
      const ok = await showConfirm(
        'Confirm Exit',
        'Are you sure you want to exit ChurchDisplay Pro?\nUnsaved temporary changes may be lost.'
      );
      if (ok) closeTauriWindow().catch((err) => console.warn('[Window] close failed:', err));
    }
  }, [isElectron, isTauri, showConfirm]);

  return {
    startProjector,
    stopProjector,
    minimizeWindow,
    toggleMaximizeWindow,
    closeWindow,
  };
}
