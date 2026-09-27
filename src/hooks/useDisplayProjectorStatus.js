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

export default function useDisplayProjectorStatus({ isTauri }) {
  const [displays, setDisplays] = useState(BROWSER_FALLBACK_DISPLAYS);
  const [projectorActive, setProjectorActive] = useState(false);
  const [projectorDisplayId, setProjectorDisplayId] = useState(null);

  const refreshDisplays = useCallback(async () => {
    try {
      if (isTauri) {
        const nextDisplays = await getTauriDisplays();
        setDisplays((current) =>
          JSON.stringify(current) === JSON.stringify(nextDisplays) ? current : nextDisplays
        );
      }
    } catch (err) {
      console.warn('[useDisplayProjectorStatus] getDisplays failed:', err);
    }
  }, [isTauri]);

  useEffect(() => {
    if (isTauri) {
      const initialRefresh = window.setTimeout(() => {
        void refreshDisplays();
      }, 0);
      const refreshTimer = window.setInterval(() => {
        void refreshDisplays();
      }, 5000);
      return () => {
        window.clearTimeout(initialRefresh);
        window.clearInterval(refreshTimer);
      };
    }
    // browser fallback is initialized in useState
  }, [isTauri, refreshDisplays]);

  return {
    displays,
    projectorActive,
    projectorDisplayId,
    refreshDisplays,
    setProjectorActive,
    setProjectorDisplayId,
  };
}
