import { useCallback } from 'react';

export default function useWindowProjectorControls({
  isElectron,
  setProjectorActive,
  setProjectorDisplayId,
}) {
  const startProjector = useCallback(
    (displayId) => {
      if (isElectron) {
        try {
          window.churchDisplay.startProjector(displayId);
        } catch (err) {
          console.error('[useWindowProjectorControls] startProjector failed:', err);
        }
        return;
      }
      setProjectorActive(true);
      setProjectorDisplayId(displayId);
    },
    [isElectron, setProjectorActive, setProjectorDisplayId]
  );

  const stopProjector = useCallback(() => {
    if (isElectron) {
      try {
        window.churchDisplay.stopProjector();
      } catch (err) {
        console.error('[useWindowProjectorControls] stopProjector failed:', err);
      }
      return;
    }
    setProjectorActive(false);
    setProjectorDisplayId(null);
  }, [isElectron, setProjectorActive, setProjectorDisplayId]);

  const minimizeWindow = useCallback(() => {
    if (isElectron && typeof window.churchDisplay?.minimizeControlWindow === 'function') {
      window.churchDisplay.minimizeControlWindow();
    }
  }, [isElectron]);

  const toggleMaximizeWindow = useCallback(() => {
    if (isElectron && typeof window.churchDisplay?.toggleMaximizeControlWindow === 'function') {
      window.churchDisplay.toggleMaximizeControlWindow();
    }
  }, [isElectron]);

  const closeWindow = useCallback(() => {
    if (isElectron && typeof window.churchDisplay?.closeControlWindow === 'function') {
      window.churchDisplay.closeControlWindow();
    }
  }, [isElectron]);

  return {
    startProjector,
    stopProjector,
    minimizeWindow,
    toggleMaximizeWindow,
    closeWindow,
  };
}
