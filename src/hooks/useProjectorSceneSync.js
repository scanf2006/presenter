import { useEffect, useRef } from 'react';

export default function useProjectorSceneSync({
  isElectron,
  projectorActive,
  projectorDisplayId,
  sceneConfig,
  currentSlide,
}) {
  const lastResyncKeyRef = useRef('');

  useEffect(() => {
    if (!isElectron) return;
    if (!projectorActive) return;
    if (sceneConfig.mode !== 'normal') return;
    if (!currentSlide) return;
    const nextKey = JSON.stringify({
      projectorActive,
      projectorDisplayId: projectorDisplayId || '',
      sceneMode: sceneConfig.mode || 'normal',
      splitDirection: sceneConfig.splitDirection || '',
      cameraDeviceId: sceneConfig.cameraDeviceId || '',
      cameraPanePercent: Number(sceneConfig.cameraPanePercent || 0),
    });
    if (nextKey === lastResyncKeyRef.current) return;
    lastResyncKeyRef.current = nextKey;

    if (typeof window.churchDisplay?.sendProjectorScene === 'function') {
      window.churchDisplay.sendProjectorScene(sceneConfig);
    }
    window.churchDisplay.sendToProjector(currentSlide);
  }, [sceneConfig.mode, sceneConfig, currentSlide, isElectron, projectorActive, projectorDisplayId]);
}
