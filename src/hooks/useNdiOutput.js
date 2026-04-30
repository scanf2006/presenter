import { useCallback, useEffect, useState } from 'react';

const INITIAL_NDI_STATUS = {
  active: false,
  enabled: false,
  sourceName: 'ChurchDisplay Pro NDI',
  width: 1280,
  height: 720,
  fps: 30,
  connections: 0,
  lastError: null,
};

export default function useNdiOutput({ isElectron, showToast, projectorActive }) {
  const [ndiStatus, setNdiStatus] = useState(INITIAL_NDI_STATUS);

  const refreshNdiStatus = useCallback(async () => {
    if (!isElectron || typeof window.churchDisplay?.ndiGetStatus !== 'function') return null;
    try {
      const nextStatus = await window.churchDisplay.ndiGetStatus();
      if (nextStatus && typeof nextStatus === 'object') {
        setNdiStatus((prev) => ({ ...prev, ...nextStatus }));
        return nextStatus;
      }
      return null;
    } catch (err) {
      return null;
    }
  }, [isElectron]);

  const startNdiOutput = useCallback(async () => {
    if (!isElectron || typeof window.churchDisplay?.ndiStart !== 'function') {
      showToast('NDI is available only in Electron desktop build.', 'warning');
      return { success: false };
    }
    const result = await window.churchDisplay.ndiStart();
    if (result?.status) {
      setNdiStatus((prev) => ({ ...prev, ...result.status }));
    } else {
      await refreshNdiStatus();
    }
    if (!result?.success) {
      showToast(`NDI start failed: ${result?.error || 'Unknown error'}`, 'error');
      return result || { success: false };
    }
    showToast(`NDI started. OBS source: ${result?.status?.sourceName || 'ChurchDisplay Pro NDI'}.`, 'success');
    return result;
  }, [isElectron, refreshNdiStatus, showToast]);

  const stopNdiOutput = useCallback(async () => {
    if (!isElectron || typeof window.churchDisplay?.ndiStop !== 'function') {
      return { success: false };
    }
    const result = await window.churchDisplay.ndiStop();
    if (result?.status) {
      setNdiStatus((prev) => ({ ...prev, ...result.status }));
    } else {
      await refreshNdiStatus();
    }
    if (!result?.success) {
      showToast(`NDI stop failed: ${result?.error || 'Unknown error'}`, 'error');
      return result || { success: false };
    }
    showToast('NDI stopped.', 'info');
    return result;
  }, [isElectron, refreshNdiStatus, showToast]);

  const toggleNdiOutput = useCallback(async () => {
    if (ndiStatus.active || ndiStatus.enabled) {
      return stopNdiOutput();
    }
    return startNdiOutput();
  }, [ndiStatus.active, ndiStatus.enabled, startNdiOutput, stopNdiOutput]);

  useEffect(() => {
    if (!isElectron) return;
    void refreshNdiStatus();
    if (typeof window.churchDisplay?.onNdiStatus !== 'function') return undefined;
    const off = window.churchDisplay.onNdiStatus((nextStatus) => {
      if (!nextStatus || typeof nextStatus !== 'object') return;
      setNdiStatus((prev) => ({ ...prev, ...nextStatus }));
    });
    return () => {
      if (typeof off === 'function') off();
    };
  }, [isElectron, refreshNdiStatus]);

  useEffect(() => {
    if (projectorActive) return;
    if (!ndiStatus.active && !ndiStatus.enabled) return;
    void stopNdiOutput();
  }, [ndiStatus.active, ndiStatus.enabled, projectorActive, stopNdiOutput]);

  return {
    ndiStatus,
    refreshNdiStatus,
    startNdiOutput,
    stopNdiOutput,
    toggleNdiOutput,
  };
}
