import { useCallback } from 'react';

export default function useWindowProjectorControls({
  isElectron,
  setProjectorActive,
  setProjectorDisplayId,
}) {
  const startProjector = useCallback((displayId) => {
    if (isElectron) {
      window.churchDisplay.startProjector(displayId);
      return;
    }
    setProjectorActive(true);
    setProjectorDisplayId(displayId);
  }, [isElectron, setProjectorActive, setProjectorDisplayId]);

  const stopProjector = useCallback(() => {
    if (isElectron) {
      window.churchDisplay.stopProjector();
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
