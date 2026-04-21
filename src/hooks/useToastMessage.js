import { useCallback, useEffect, useRef, useState } from 'react';

const DURATION_BY_TONE = {
  success: 1600,
  info: 1600,
  warning: 3000,
  error: 4000,
};

export default function useToastMessage() {
  const [toast, setToast] = useState(null);
  const [autosaveToast, setAutosaveToast] = useState(null);
  const toastTimerRef = useRef({ default: null, autosave: null });

  const showToast = useCallback((message, tone = 'success', options = {}) => {
    if (!message) return;
    const channel = options?.channel === 'autosave' ? 'autosave' : 'default';
    const setChannelToast = channel === 'autosave' ? setAutosaveToast : setToast;

    if (toastTimerRef.current[channel]) {
      clearTimeout(toastTimerRef.current[channel]);
      toastTimerRef.current[channel] = null;
    }
    setChannelToast({ message, tone, token: Date.now(), channel });
    toastTimerRef.current[channel] = setTimeout(() => {
      setChannelToast(null);
      toastTimerRef.current[channel] = null;
    }, DURATION_BY_TONE[tone] || 1600);
  }, []);

  useEffect(
    () => () => {
      if (toastTimerRef.current.default) {
        clearTimeout(toastTimerRef.current.default);
      }
      if (toastTimerRef.current.autosave) {
        clearTimeout(toastTimerRef.current.autosave);
      }
    },
    []
  );

  return {
    toast,
    autosaveToast,
    showToast,
  };
}
