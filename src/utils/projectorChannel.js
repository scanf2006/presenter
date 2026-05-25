import { SCENE } from '../constants/ui.js';

export function normalizeTransitionConfig(data) {
  return {
    enabled: data?.enabled !== false,
    delayMs: Number.isFinite(data?.delayMs) ? Math.max(0, data.delayMs) : 20,
    durationMs: Number.isFinite(data?.durationMs) ? Math.max(0, data.durationMs) : 60,
  };
}

export function mergeSceneConfig(prev, data) {
  const nextMode = data?.mode === 'split_camera' ? 'split_camera' : 'normal';
  return {
    ...prev,
    mode: nextMode,
    splitDirection: data?.splitDirection || prev.splitDirection,
    cameraDeviceId: typeof data?.cameraDeviceId === 'string' ? data.cameraDeviceId : prev.cameraDeviceId,
    cameraPanePercent: Number.isFinite(data?.cameraPanePercent)
      ? Math.max(SCENE.CAMERA_PANE_MIN_PERCENT, Math.min(SCENE.CAMERA_PANE_MAX_PERCENT, Number(data.cameraPanePercent)))
      : prev.cameraPanePercent,
    cameraMuted: data?.cameraMuted !== false,
    cameraCenterCropPercent: Number.isFinite(data?.cameraCenterCropPercent)
      ? Math.max(SCENE.CAMERA_CROP_MIN_PERCENT, Math.min(SCENE.CAMERA_CROP_MAX_PERCENT, Number(data.cameraCenterCropPercent)))
      : prev.cameraCenterCropPercent,
    enableCameraTestMode: data?.enableCameraTestMode === true,
  };
}
