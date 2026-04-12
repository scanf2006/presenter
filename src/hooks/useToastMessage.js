import { useCallback, useEffect, useRef, useState } from 'react';

const DURATION_BY_TONE = {
  success: 1600,
  info: 1600,
  warning: 3000,
  error: 4000,
};

export default function useToastMessage() {
  const [toast, setToast] = useState(null);
  const toastTimerRef = useRef(null);

  const showToast = useCallback((message, tone = 'success') => {
    if (!message) return;
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }
    setToast({ message, tone, token: Date.now() });
    toastTimerRef.current = setTimeout(() => {
      setToast(null);
      toastTimerRef.current = null;
    }, DURATION_BY_TONE[tone] || 1600);
  }, []);

  useEffect(
    () => () => {
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
    },
    []
  );

  return {
    toast,
    showToast,
  };
}
