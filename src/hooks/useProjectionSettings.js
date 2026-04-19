import { useEffect, useRef, useState } from 'react';
/* eslint-disable react-hooks/set-state-in-effect */
import { SCENE, TRANSITION } from '../constants/ui';

const TRANSITION_STORAGE_KEY = 'churchdisplay.transition.v1';
const SCENE_STORAGE_KEY = 'churchdisplay.scene.v1';
const OBS_MODE_STORAGE_KEY = 'churchdisplay.obsMode.v1';

const DEFAULT_SCENE_CONFIG = {
  mode: SCENE.DEFAULT_MODE,
  splitDirection: SCENE.DEFAULT_SPLIT_DIRECTION,
  cameraDeviceId: '',
  cameraPanePercent: SCENE.CAMERA_PANE_DEFAULT_PERCENT,
  cameraMuted: true,
  cameraCenterCropPercent: SCENE.CAMERA_CROP_DEFAULT_PERCENT,
  enableCameraTestMode: false,
};

export default function useProjectionSettings({ isElectron }) {
  const [transitionEnabled, setTransitionEnabled] = useState(true);
  const [transitionDelayMs, setTransitionDelayMs] = useState(TRANSITION.DEFAULT_DELAY_MS);
  const [transitionDurationMs, setTransitionDurationMs] = useState(TRANSITION.DEFAULT_DURATION_MS);
  const [sceneConfig, setSceneConfig] = useState(DEFAULT_SCENE_CONFIG);
  const [obsModeEnabled, setObsModeEnabled] = useState(false);
  // R3-M: Guard to prevent persist effects from sending default values before hydration.
  const transitionHydrated = useRef(false);
  const sceneHydrated = useRef(false);
  const obsModeHydrated = useRef(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(TRANSITION_STORAGE_KEY);
      if (!raw) {
        transitionHydrated.current = true;
        return;
      }
      const parsed = JSON.parse(raw);
      if (typeof parsed?.enabled === 'boolean') setTransitionEnabled(parsed.enabled);
      if (Number.isFinite(parsed?.delayMs)) {
        setTransitionDelayMs(
          Math.max(TRANSITION.MIN_MS, Math.min(TRANSITION.MAX_MS, parsed.delayMs))
        );
      }
      if (Number.isFinite(parsed?.durationMs)) {
        setTransitionDurationMs(
          Math.max(TRANSITION.MIN_MS, Math.min(TRANSITION.MAX_MS, parsed.durationMs))
        );
      }
    } catch (err) {
      console.warn('[Transition] restore failed:', err);
    }
    transitionHydrated.current = true;
  }, []);

  useEffect(() => {
    if (!transitionHydrated.current) return;
    try {
      window.localStorage.setItem(
        TRANSITION_STORAGE_KEY,
        JSON.stringify({
          enabled: transitionEnabled,
          delayMs: transitionDelayMs,
          durationMs: transitionDurationMs,
        })
      );
    } catch (err) {
      console.warn('[Transition] persist failed:', err);
    }

    if (isElectron && typeof window.churchDisplay?.sendTransition === 'function') {
      window.churchDisplay.sendTransition({
        enabled: transitionEnabled,
        delayMs: transitionDelayMs,
        durationMs: transitionDurationMs,
      });
    }
  }, [transitionEnabled, transitionDelayMs, transitionDurationMs, isElectron]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(SCENE_STORAGE_KEY);
      if (!raw) {
        sceneHydrated.current = true;
        return;
      }
      const parsed = JSON.parse(raw);
      setSceneConfig((prev) => ({
        ...prev,
        mode: SCENE.DEFAULT_MODE,
        splitDirection: parsed?.splitDirection || prev.splitDirection,
        cameraDeviceId:
          typeof parsed?.cameraDeviceId === 'string' ? parsed.cameraDeviceId : prev.cameraDeviceId,
        cameraPanePercent: Number.isFinite(parsed?.cameraPanePercent)
          ? Math.max(
              SCENE.CAMERA_PANE_MIN_PERCENT,
              Math.min(SCENE.CAMERA_PANE_MAX_PERCENT, Number(parsed.cameraPanePercent))
            )
          : prev.cameraPanePercent,
        cameraMuted: parsed?.cameraMuted !== false,
        cameraCenterCropPercent: Number.isFinite(parsed?.cameraCenterCropPercent)
          ? Math.max(
              SCENE.CAMERA_CROP_MIN_PERCENT,
              Math.min(SCENE.CAMERA_CROP_MAX_PERCENT, Number(parsed.cameraCenterCropPercent))
            )
          : prev.cameraCenterCropPercent,
        enableCameraTestMode: parsed?.enableCameraTestMode === true,
      }));
    } catch (err) {
      console.warn('[Scene] restore failed:', err);
    }
    sceneHydrated.current = true;
  }, []);

  useEffect(() => {
    setSceneConfig((prev) =>
      prev.mode === SCENE.DEFAULT_MODE ? prev : { ...prev, mode: SCENE.DEFAULT_MODE }
    );
  }, []);

  useEffect(() => {
    if (!sceneHydrated.current) return;
    try {
      const persistScene = {
        ...sceneConfig,
        mode: SCENE.DEFAULT_MODE,
      };
      window.localStorage.setItem(SCENE_STORAGE_KEY, JSON.stringify(persistScene));
    } catch (err) {
      console.warn('[Scene] persist failed:', err);
    }

    if (isElectron && typeof window.churchDisplay?.sendProjectorScene === 'function') {
      window.churchDisplay.sendProjectorScene(sceneConfig);
    }
  }, [sceneConfig, isElectron]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(OBS_MODE_STORAGE_KEY);
      setObsModeEnabled(raw === '1');
    } catch (err) {
      console.warn('[OBSMode] restore failed:', err);
    }
    obsModeHydrated.current = true;
  }, []);

  useEffect(() => {
    if (!obsModeHydrated.current) return;
    try {
      window.localStorage.setItem(OBS_MODE_STORAGE_KEY, obsModeEnabled ? '1' : '0');
    } catch (err) {
      console.warn('[OBSMode] persist failed:', err);
    }
  }, [obsModeEnabled]);

  return {
    transitionEnabled,
    setTransitionEnabled,
    transitionDelayMs,
    setTransitionDelayMs,
    transitionDurationMs,
    setTransitionDurationMs,
    sceneConfig,
    setSceneConfig,
    obsModeEnabled,
    setObsModeEnabled,
  };
}
