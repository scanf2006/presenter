import { useCallback } from 'react';
import {
  closeTauriWindow,
  isTauriRuntime,
  minimizeTauriWindow,
  toggleMaximizeTauriWindow,
} from '../utils/tauriProjector';

export default function useWindowProjectorControls({ startProjector, stopProjector, showConfirm }) {

  const minimizeWindow = useCallback(() => {
    if (isTauriRuntime()) {
      minimizeTauriWindow().catch((err) => console.warn('[Window] minimize failed:', err));
    }
  }, []);

  const toggleMaximizeWindow = useCallback(() => {
    if (isTauriRuntime()) {
      toggleMaximizeTauriWindow().catch((err) => console.warn('[Window] maximize failed:', err));
    }
  }, []);

  const closeWindow = useCallback(async () => {
    if (isTauriRuntime()) {
      const ok = await showConfirm(
        'Confirm Exit',
        'Are you sure you want to exit ChurchDisplay Pro?\nUnsaved temporary changes may be lost.'
      );
      if (ok) closeTauriWindow().catch((err) => console.warn('[Window] close failed:', err));
    }
  }, [showConfirm]);

  return {
    startProjector,
    stopProjector,
    minimizeWindow,
    toggleMaximizeWindow,
    closeWindow,
  };
}
