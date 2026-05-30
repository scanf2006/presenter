import React from 'react';
import { useAppContext } from '../../../contexts/AppContext';
import { useProjectorContext } from '../../../contexts/ProjectorContext';
import { useI18n } from '../../../contexts/I18nContext';

/**
 * SystemInfoPanel renders system information (displays, projector status,
 * environment) and setup export/import buttons.
 */
function SystemInfoPanel() {
  const { locale } = useI18n();
  const isZh = String(locale || 'en').toLowerCase().startsWith('zh');
  const { isElectron } = useAppContext();
  const {
    displays,
    projectorActive,
    ndiStatus,
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
      ? `${healthSummary.errorCount} ${isZh ? '个错误' : 'Error(s)'}`
      : healthSummary.warnCount > 0
        ? `${healthSummary.warnCount} ${isZh ? '个警告' : 'Warning(s)'}`
        : isZh ? '健康' : 'Healthy'
    : isZh ? '未检查' : 'Not checked';
  const topIssues = (startupHealthReport?.checks || []).filter((c) => c.status !== 'ok').slice(0, 2);

  return (
    <>
      <div className="preview-panel__title" style={{ marginBottom: '12px' }}>
        {isZh ? '系统信息' : 'System Info'}
      </div>
      <div className="cp-meta-list">
        <div className="cp-meta-row">
          <span>{isZh ? '检测到的显示器' : 'Detected Displays'}</span>
          <span className="cp-meta-value">{displays.length}</span>
        </div>
        <div className="cp-meta-row">
          <span>{isZh ? '投影状态' : 'Projector Status'}</span>
          <span
            style={{
              color: projectorActive ? 'var(--color-success)' : 'var(--color-text-muted)',
            }}
          >
            {projectorActive ? (isZh ? '运行中' : 'Running') : (isZh ? '已停止' : 'Stopped')}
          </span>
        </div>
        <div className="cp-meta-row">
          <span>{isZh ? '运行环境' : 'Environment'}</span>
          <span className="cp-meta-value">{isElectron ? 'Electron' : isZh ? '浏览器' : 'Browser'}</span>
        </div>
        <div className="cp-meta-row">
          <span>{isZh ? 'NDI 输出' : 'NDI Output'}</span>
          <span
            style={{
              color: ndiStatus?.active ? 'var(--color-success)' : 'var(--color-text-muted)',
            }}
          >
            {ndiStatus?.active ? (isZh ? '已启用' : 'Enabled') : (isZh ? '已禁用' : 'Disabled')}
          </span>
        </div>
        <div className="cp-meta-row">
          <span>{isZh ? 'NDI 接收端' : 'NDI Receivers'}</span>
          <span className="cp-meta-value">{ndiStatus?.connections ?? 0}</span>
        </div>
        <div className="cp-meta-row">
          <span>{isZh ? '导出模式' : 'Export Mode'}</span>
          <span className="cp-meta-value">{isZh ? '智能最小包' : 'Smart Minimal Bundle'}</span>
        </div>
        <div className="cp-meta-row">
          <span>{isZh ? '启动检查' : 'Startup Check'}</span>
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
          {startupHealthBusy ? (isZh ? '检查中...' : 'Checking...') : (isZh ? '运行启动检查' : 'Run Startup Check')}
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
            {isZh ? '导出配置' : 'Export Setup'}
          </button>
          <button
            className="btn btn--ghost"
            style={{ flex: 1, padding: '6px 8px', fontSize: '11px' }}
            onClick={handleImportSetupBundle}
            disabled={setupTransferBusy}
          >
            {isZh ? '导入配置' : 'Import Setup'}
          </button>
        </div>
        {setupTransferBusy && (
          <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
            {isZh ? '正在处理配置包...' : 'Processing setup package...'}
          </div>
        )}
      </div>
    </>
  );
}

export default SystemInfoPanel;
