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
    obsModeEnabled,
    handleExportSetupBundle,
    handleImportSetupBundle,
    setupTransferBusy,
    startupHealthBusy,
    startupHealthReport,
    runStartupHealthCheck,
  } = useProjectorContext();

  const healthSummary = startupHealthReport?.summary || { okCount: 0, warnCount: 0, errorCount: 0 };
  const healthStatusText = startupHealthReport
    ? healthSummary.errorCount > 0
      ? `${healthSummary.errorCount} Error(s)`
      : healthSummary.warnCount > 0
        ? `${healthSummary.warnCount} Warning(s)`
        : 'Healthy'
    : 'Not checked';
  const topIssues = (startupHealthReport?.checks || []).filter((c) => c.status !== 'ok').slice(0, 2);

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
              color: obsModeEnabled
                ? 'var(--color-warning)'
                : projectorActive
                  ? 'var(--color-success)'
                  : 'var(--color-text-muted)',
            }}
          >
            {obsModeEnabled ? 'Managed by OBS' : projectorActive ? 'Running' : 'Stopped'}
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
        <div className="cp-meta-row">
          <span>Startup Check</span>
          <span
            style={{
              color:
                healthSummary.errorCount > 0
                  ? 'var(--color-danger)'
                  : healthSummary.warnCount > 0
                    ? 'var(--color-warning)'
                    : 'var(--color-success)',
            }}
          >
            {healthStatusText}
          </span>
        </div>
        <button
          className="btn btn--ghost"
          style={{ width: '100%', padding: '6px 8px', fontSize: '11px', marginTop: '6px' }}
          onClick={() => runStartupHealthCheck()}
          disabled={startupHealthBusy}
        >
          {startupHealthBusy ? 'Checking...' : 'Run Startup Check'}
        </button>
        {topIssues.map((issue) => (
          <div
            key={issue.id}
            style={{
              marginTop: '8px',
              fontSize: '11px',
              color: issue.status === 'error' ? 'var(--color-danger)' : 'var(--color-warning)',
            }}
          >
            {issue.label}: {issue.detail}
          </div>
        ))}
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
