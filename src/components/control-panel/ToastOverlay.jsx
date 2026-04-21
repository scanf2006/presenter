import React from 'react';

const TONE_CLASS = {
  success: 'cp-toast--success',
  info: 'cp-toast--info',
  warning: 'cp-toast--warning',
  error: 'cp-toast--error',
};

function ToastOverlay({ toast, slot = 'default' }) {
  if (!toast) return null;

  return (
    <div
      className={`cp-toast ${slot === 'autosave' ? 'cp-toast--autosave-slot' : ''} ${TONE_CLASS[toast.tone] || TONE_CLASS.info}`}
    >
      {toast.message}
    </div>
  );
}

export default ToastOverlay;
