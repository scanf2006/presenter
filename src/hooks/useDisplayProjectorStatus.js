import { useCallback, useEffect, useState } from 'react';
import { getTauriDisplays } from '../utils/tauriProjector';

const BROWSER_FALLBACK_DISPLAYS = [
  {
    id: 1,
    label: 'Primary Display',
    bounds: { x: 0, y: 0, width: 1920, height: 1080 },
    isPrimary: true,
    size: { width: 1920, height: 1080 },
  },
  {
    id: 2,
    label: 'Secondary Display',
    bounds: { x: 1920, y: 0, width: 1920, height: 1080 },
    isPrimary: false,
    size: { width: 1920, height: 1080 },
  },
];

export default function useDisplayProjectorStatus({ isElectron, isTauri }) {
  const [displays, setDisplays] = useState(() => (isElectron ? [] : BROWSER_FALLBACK_DISPLAYS));
  const [projectorActive, setProjectorActive] = useState(false);
  const [projectorDisplayId, setProjectorDisplayId] = useState(null);

  const refreshDisplays = useCallback(async () => {
    try {
      if (isElectron) {
        setDisplays(await window.churchDisplay.getDisplays());
      } else if (isTauri) {
        setDisplays(await getTauriDisplays());
      }
    } catch (err) {
      console.warn('[useDisplayProjectorStatus] getDisplays failed:', err);
    }
  }, [isElectron, isTauri]);

  useEffect(() => {
    if (isElectron) {
      let isMounted = true;
      void refreshDisplays();
      const offDisplaysChanged = window.churchDisplay.onDisplaysChanged(setDisplays);
      const offProjectorStatus = window.churchDisplay.onProjectorStatus((status) => {
        setProjectorActive(status.active);
        setProjectorDisplayId(status.displayId || null);
      });
      window.churchDisplay
        .getProjectorStatus()
        .then((status) => {
          if (isMounted) setProjectorActive(status.active);
        })
        .catch((err) => {
          console.warn('[useDisplayProjectorStatus] getProjectorStatus failed:', err);
        });

      return () => {
        isMounted = false;
        if (typeof offDisplaysChanged === 'function') offDisplaysChanged();
        if (typeof offProjectorStatus === 'function') offProjectorStatus();
      };
    }

    if (isTauri) {
      void refreshDisplays();
    }
    // browser fallback is initialized in useState
  }, [isElectron, isTauri, refreshDisplays]);

  return {
    displays,
    projectorActive,
    projectorDisplayId,
    refreshDisplays,
    setProjectorActive,
    setProjectorDisplayId,
  };
}
