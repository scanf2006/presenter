import { useCallback, useEffect, useState } from 'react';
import { useI18n } from '../contexts/I18nContext';

export default function useStartupHealth({ isElectron, showToast }) {
  const { t } = useI18n();
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
            showToast(
              `${t('health.criticalFound', 'Health check found critical issue(s)')}: ${errorCount}`,
              'error'
            );
          } else if (warnCount > 0 && !shouldSuppressDisplayOnlyWarningToast) {
            showToast(
              `${t('health.warningFound', 'Health check found warning(s)')}: ${warnCount}`,
              'warning'
            );
          } else if (!shouldSuppressDisplayOnlyWarningToast) {
            showToast(t('health.passed', 'Health check passed.'));
          }
        }
        return report || null;
      } catch (err) {
        if (!silent) {
          showToast(
            `${t('health.failed', 'Health check failed')}: ${err?.message || t('media.unknownError', 'Unknown error')}`,
            'error'
          );
        }
        return null;
      } finally {
        setStartupHealthBusy(false);
      }
    },
    [isElectron, showToast, t]
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
