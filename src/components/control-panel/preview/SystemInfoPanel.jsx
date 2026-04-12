import React from 'react';
import { useAppContext } from '../../../contexts/AppContext';
import { useProjectorContext } from '../../../contexts/ProjectorContext';

/**
 * SystemInfoPanel renders system information (displays, projector status,
 * environment) and setup export/import buttons.
 */
function SystemInfoPanel() {
  const { isElectron } = useAppContext();
  const {
    displays,
    projectorActive,
    handleExportSetupBundle,
    handleImportSetupBundle,
    setupTransferBusy,
  } = useProjectorContext();

  return (
    <>
      <div className="preview-panel__title" style={{ marginBottom: '12px' }}>
        System Info
      </div>
      <div className="cp-meta-list">
        <div className="cp-meta-row">
          <span>Detected Displays</span>
          <span className="cp-meta-value">{displays.length}</span>
        </div>
        <div className="cp-meta-row">
          <span>Projector Status</span>
          <span
            style={{
              color: projectorActive ? 'var(--color-success)' : 'var(--color-text-muted)',
            }}
          >
            {projectorActive ? 'Running' : 'Stopped'}
          </span>
        </div>
        <div className="cp-meta-row">
          <span>Environment</span>
          <span className="cp-meta-value">{isElectron ? 'Electron' : 'Browser'}</span>
        </div>
        <div className="cp-meta-row">
          <span>Export Mode</span>
          <span className="cp-meta-value">Smart Minimal Bundle</span>
        </div>
        <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
          <button
            className="btn btn--ghost"
            style={{ flex: 1, padding: '6px 8px', fontSize: '11px' }}
            onClick={handleExportSetupBundle}
            disabled={setupTransferBusy}
          >
            Export Setup
          </button>
          <button
            className="btn btn--ghost"
            style={{ flex: 1, padding: '6px 8px', fontSize: '11px' }}
            onClick={handleImportSetupBundle}
            disabled={setupTransferBusy}
          >
            Import Setup
          </button>
        </div>
        {setupTransferBusy && (
          <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
            Processing setup package...
          </div>
        )}
      </div>
    </>
  );
}

export default SystemInfoPanel;
