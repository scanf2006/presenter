import React from 'react';

function ToastOverlay({ toast }) {
  if (!toast) return null;

  return (
    <div className={`cp-toast ${toast.tone === 'success' ? 'cp-toast--success' : 'cp-toast--info'}`}>
      {toast.message}
    </div>
  );
}

export default ToastOverlay;
