import { useEffect, useState } from 'react';

export default function useDisplayProjectorStatus({ isElectron }) {
  const [displays, setDisplays] = useState([]);
  const [projectorActive, setProjectorActive] = useState(false);
  const [projectorDisplayId, setProjectorDisplayId] = useState(null);

  useEffect(() => {
    if (isElectron) {
      let isMounted = true;
      window.churchDisplay.getDisplays().then((data) => {
        if (isMounted) setDisplays(data);
      });
      const offDisplaysChanged = window.churchDisplay.onDisplaysChanged(setDisplays);
      const offProjectorStatus = window.churchDisplay.onProjectorStatus((status) => {
        setProjectorActive(status.active);
        setProjectorDisplayId(status.displayId || null);
      });
      window.churchDisplay.getProjectorStatus().then((status) => {
        if (isMounted) setProjectorActive(status.active);
      });

      return () => {
        isMounted = false;
        if (typeof offDisplaysChanged === 'function') offDisplaysChanged();
        if (typeof offProjectorStatus === 'function') offProjectorStatus();
      };
    }

    setDisplays([
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
    ]);
  }, [isElectron]);

  return {
    displays,
    projectorActive,
    projectorDisplayId,
    setProjectorActive,
    setProjectorDisplayId,
  };
}
