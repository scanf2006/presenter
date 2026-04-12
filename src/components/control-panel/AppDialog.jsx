import React from 'react';

/**
 * AppDialog — unified modal dialog replacing native alert() and confirm().
 *
 * Props:
 *   dialog: { mode: 'alert'|'confirm', title, body, resolve } | null
 *   onClose: () => void  — called after resolve to clear the dialog
 */
function AppDialog({ dialog, onClose }) {
  if (!dialog) return null;

  const { mode, title, body } = dialog;

  const handleOk = () => {
    dialog.resolve(true);
    onClose();
  };

  const handleCancel = () => {
    dialog.resolve(false);
    onClose();
  };

  return (
    <div className="cp-modal-overlay" onClick={mode === 'alert' ? handleOk : handleCancel}>
      <div className="cp-dialog-card" onClick={(e) => e.stopPropagation()}>
        {title && <div className="cp-dialog-title">{title}</div>}
        <div className="cp-dialog-body">{body}</div>
        <div className="cp-dialog-actions">
          {mode === 'confirm' && (
            <button className="btn btn--ghost cp-dialog-btn" onClick={handleCancel}>
              Cancel
            </button>
          )}
          <button
            className={`btn ${mode === 'confirm' ? 'btn--primary' : 'btn--ghost'} cp-dialog-btn`}
            onClick={handleOk}
            autoFocus
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}

export default AppDialog;
