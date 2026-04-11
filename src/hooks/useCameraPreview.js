import { useCallback, useEffect, useRef, useState } from 'react';
/* eslint-disable react-hooks/set-state-in-effect */

export default function useCameraPreview({ sceneConfig, setSceneConfig }) {
  const [cameraDevices, setCameraDevices] = useState([]);
  const [cameraStatus, setCameraStatus] = useState('idle');
  const [previewTestNow, setPreviewTestNow] = useState(0);
  const cameraPreviewRef = useRef(null);
  const cameraStreamRef = useRef(null);

  const stopCameraPreview = useCallback(() => {
    const stream = cameraStreamRef.current;
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      cameraStreamRef.current = null;
    }
    if (cameraPreviewRef.current) {
      cameraPreviewRef.current.srcObject = null;
    }
  }, []);

  const loadCameraDevices = useCallback(async () => {
    if (!navigator?.mediaDevices?.enumerateDevices) return;
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videos = devices.filter((d) => d.kind === 'videoinput');
      setCameraDevices(videos);
      if (!sceneConfig.cameraDeviceId && videos.length > 0) {
        setSceneConfig((prev) => ({ ...prev, cameraDeviceId: videos[0].deviceId || '' }));
      }
    } catch (err) {
      console.warn('[Camera] enumerate failed:', err);
    }
  }, [sceneConfig.cameraDeviceId, setSceneConfig]);

  // C1-R2: Track mount state so we can discard streams acquired after unmount.
  const mountedRef = useRef(true);

  const startCameraPreview = useCallback(async () => {
    if (sceneConfig.enableCameraTestMode) {
      stopCameraPreview();
      setCameraStatus('idle');
      return;
    }
    if (!navigator?.mediaDevices?.getUserMedia) {
      setCameraStatus('unsupported');
      return;
    }

    try {
      setCameraStatus('loading');
      stopCameraPreview();

      const constraints = sceneConfig.cameraDeviceId
        ? { video: { deviceId: { exact: sceneConfig.cameraDeviceId } }, audio: false }
        : { video: true, audio: false };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      // If component unmounted while awaiting, immediately release the stream.
      if (!mountedRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      cameraStreamRef.current = stream;
      if (cameraPreviewRef.current) {
        cameraPreviewRef.current.srcObject = stream;
        cameraPreviewRef.current.muted = true;
        cameraPreviewRef.current.defaultMuted = true;
        cameraPreviewRef.current.play().catch(() => {});
      }
      setCameraStatus('ok');
      await loadCameraDevices();
    } catch (err) {
      if (!mountedRef.current) return;
      setCameraStatus('error');
      console.warn('[Camera] preview failed:', err);
    }
  }, [
    sceneConfig.cameraDeviceId,
    sceneConfig.enableCameraTestMode,
    stopCameraPreview,
    loadCameraDevices,
  ]);

  useEffect(() => {
    if (sceneConfig.mode !== 'split_camera') {
      stopCameraPreview();
      setCameraStatus('idle');
      return;
    }
    startCameraPreview();
  }, [sceneConfig.mode, sceneConfig.cameraDeviceId, startCameraPreview, stopCameraPreview]);

  useEffect(() => {
    if (!(sceneConfig.mode === 'split_camera' && sceneConfig.enableCameraTestMode)) return;
    const t = setInterval(() => setPreviewTestNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [sceneConfig.mode, sceneConfig.enableCameraTestMode]);

  useEffect(() => {
    loadCameraDevices();
    const handler = () => loadCameraDevices();
    navigator?.mediaDevices?.addEventListener?.('devicechange', handler);
    return () => {
      // C1-R2: Mark unmounted so in-flight getUserMedia can detect and release.
      mountedRef.current = false;
      navigator?.mediaDevices?.removeEventListener?.('devicechange', handler);
      stopCameraPreview();
    };
  }, [loadCameraDevices, stopCameraPreview]);

  useEffect(() => {
    const el = cameraPreviewRef.current;
    const stream = cameraStreamRef.current;
    if (!el || !stream) return;
    if (el.srcObject !== stream) {
      el.srcObject = stream;
      el.muted = true;
      el.defaultMuted = true;
      el.play().catch(() => {});
    }
  }, [cameraStatus, sceneConfig.mode, sceneConfig.cameraDeviceId]);

  return {
    cameraDevices,
    cameraStatus,
    previewTestNow,
    cameraPreviewRef,
  };
}
