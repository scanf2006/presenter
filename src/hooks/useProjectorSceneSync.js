import { useEffect } from 'react';

export default function useProjectorSceneSync({
  isElectron,
  projectorActive,
  projectorDisplayId,
  sceneConfig,
  currentSlide,
}) {
  useEffect(() => {
    if (!isElectron) return;
    if (!projectorActive) return;
    if (sceneConfig.mode !== 'normal') return;
    if (!currentSlide) return;

    if (typeof window.churchDisplay?.sendProjectorScene === 'function') {
      window.churchDisplay.sendProjectorScene(sceneConfig);
    }
    window.churchDisplay.sendToProjector(currentSlide);
    if (typeof window.churchDisplay?.sendToProjectorBackground === 'function') {
      window.churchDisplay.sendToProjectorBackground(currentSlide?.background || null);
    }
  }, [sceneConfig.mode, sceneConfig, currentSlide, isElectron, projectorActive, projectorDisplayId]);
}
