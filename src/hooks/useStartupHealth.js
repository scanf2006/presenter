import { useCallback, useEffect, useState } from 'react';

export default function useStartupHealth({ isElectron, showToast }) {
  const [startupHealthBusy, setStartupHealthBusy] = useState(false);
  const [startupHealthReport, setStartupHealthReport] = useState(null);

  const runStartupHealthCheck = useCallback(
    async ({ silent = false } = {}) => {
      if (!isElectron || typeof window.churchDisplay?.startupHealthCheck !== 'function') return null;
      setStartupHealthBusy(true);
      try {
        const report = await window.churchDisplay.startupHealthCheck();
        setStartupHealthReport(report || null);
        if (!silent && report?.summary) {
          const { errorCount = 0, warnCount = 0 } = report.summary;
          const nonDisplayWarnings = (report?.checks || []).filter(
            (check) => check?.status === 'warn' && check?.id !== 'display'
          );
          const shouldSuppressDisplayOnlyWarningToast =
            errorCount === 0 && warnCount > 0 && nonDisplayWarnings.length === 0;

          if (errorCount > 0) {
            showToast(`Health check found ${errorCount} critical issue(s).`, 'error');
          } else if (warnCount > 0 && !shouldSuppressDisplayOnlyWarningToast) {
            showToast(`Health check found ${warnCount} warning(s).`, 'warning');
          } else if (!shouldSuppressDisplayOnlyWarningToast) {
            showToast('Health check passed.');
          }
        }
        return report || null;
      } catch (err) {
        if (!silent) {
          showToast(`Health check failed: ${err?.message || 'Unknown error'}`, 'error');
        }
        return null;
      } finally {
        setStartupHealthBusy(false);
      }
    },
    [isElectron, showToast]
  );

  useEffect(() => {
    void runStartupHealthCheck({ silent: true });
  }, [runStartupHealthCheck]);

  return {
    startupHealthBusy,
    startupHealthReport,
    runStartupHealthCheck,
  };
}
