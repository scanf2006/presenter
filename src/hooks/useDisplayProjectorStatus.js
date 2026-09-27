import { useCallback, useEffect, useRef, useState } from 'react';
import { getTauriDisplays, hideTauriProjector, showTauriProjector } from '../utils/tauriProjector';
import { createProjectionController } from '../utils/projectionController';

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
  const [displays, setDisplays] = useState(isTauri ? [] : BROWSER_FALLBACK_DISPLAYS);
  const [projectorActive, setProjectorActive] = useState(false);
  const [projectorDisplayId, updateProjectorDisplayId] = useState(null);
  const [controller] = useState(() => createProjectionController({
    show: (id) => isTauri ? showTauriProjector(id) : Promise.resolve(),
    hide: () => isTauri ? hideTauriProjector() : Promise.resolve(),
    onState: ({ selected, active }) => {
      updateProjectorDisplayId(selected);
      setProjectorActive(active);
    },
  }));
  const refreshing = useRef(false);
  const startProjector = useCallback((id) => controller.select(id, displays), [controller, displays]);
  const stopProjector = useCallback(() => controller.select(null, displays), [controller, displays]);

  const refreshDisplays = useCallback(async () => {
    if (refreshing.current) return;
    refreshing.current = true;
    try {
      if (isTauri) {
        const revision = controller.revision();
        const nextDisplays = await getTauriDisplays();
        setDisplays((current) =>
          JSON.stringify(current) === JSON.stringify(nextDisplays) ? current : nextDisplays
        );
        await controller.refresh(nextDisplays, revision);
      }
    } catch (err) {
      console.warn('[useDisplayProjectorStatus] getDisplays failed:', err);
    } finally {
      refreshing.current = false;
    }
  }, [isTauri, controller]);

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
    startProjector,
    stopProjector,
  };
}
