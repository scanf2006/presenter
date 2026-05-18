import { useCallback } from 'react';
import { useI18n } from '../contexts/I18nContext';

export default function useSetupBundleActions({
  isElectron,
  setSetupTransferBusy,
  showToast,
  showAlert,
  showConfirm,
}) {
  const { t } = useI18n();
  const exportSetupBundle = useCallback(async () => {
    if (!isElectron || typeof window.churchDisplay?.exportSetupBundle !== 'function') {
      showToast(t('setup.exportDesktopOnly', 'Export is available in the desktop app only.'), 'warning');
      return;
    }
    try {
      setSetupTransferBusy(true);
      const res = await window.churchDisplay.exportSetupBundle();
      if (res?.cancelled) return;
      if (res?.success) {
        const mb = Number((Number(res.totalBytes || 0) / (1024 * 1024)).toFixed(2));
        const missingCount = Array.isArray(res.missingRefs) ? res.missingRefs.length : 0;
        showAlert(
          t('setup.exportCompleteTitle', 'Export Complete'),
          `${t('setup.exportCompleted', 'Export completed')} (${res.mode || 'minimal'}).\n` +
            `${t('setup.copiedFiles', 'Copied files')}: ${res.copiedCount || 0}\n` +
            `${t('setup.bundleSize', 'Bundle size')}: ${mb} MB\n` +
            `${t('setup.missingRefs', 'Missing refs')}: ${missingCount}\n\n` +
            `${t('setup.folder', 'Folder')}:\n${res.backupDir}`
        );
      } else {
        showToast(`${t('setup.exportFailed', 'Export failed')}: ${res?.error || t('media.unknownError', 'Unknown error')}`, 'error');
      }
    } catch (err) {
      showToast(`${t('setup.exportFailed', 'Export failed')}: ${err?.message || t('media.unknownError', 'Unknown error')}`, 'error');
    } finally {
      setSetupTransferBusy(false);
    }
  }, [isElectron, setSetupTransferBusy, showToast, showAlert, t]);

  const importSetupBundle = useCallback(async () => {
    if (!isElectron || typeof window.churchDisplay?.importSetupBundle !== 'function') {
      showToast(t('setup.importDesktopOnly', 'Import is available in the desktop app only.'), 'warning');
      return;
    }
    const ok = await showConfirm(
      t('setup.importConfirmTitle', 'Import Setup Bundle'),
      t(
        'setup.importConfirmBody',
        'Import will overwrite queue/config/songs, and merge media files without deleting existing local media. Continue?'
      )
    );
    if (!ok) return;
    try {
      setSetupTransferBusy(true);
      const res = await window.churchDisplay.importSetupBundle();
      if (res?.cancelled) return;
      if (res?.success) {
        const mb = Number((Number(res.totalBytes || 0) / (1024 * 1024)).toFixed(2));
        const warningText =
          Array.isArray(res.warnings) && res.warnings.length > 0
            ? `\n${t('setup.warnings', 'Warnings')}: ${res.warnings.length}`
            : '';
        showAlert(
          t('setup.importCompleteTitle', 'Import Complete'),
          `${t('setup.importCompleted', 'Import completed')} (${res.mode || 'minimal'}).\n` +
            `${t('setup.copied', 'Copied')}: ${res.copiedCount || 0}\n` +
            `${t('setup.skippedExisting', 'Skipped existing')}: ${res.skippedCount || 0}\n` +
            `${t('setup.dataSize', 'Data size')}: ${mb} MB${warningText}\n\n` +
            t('setup.restartNow', 'Please restart the app now.')
        );
      } else {
        showToast(`${t('setup.importFailed', 'Import failed')}: ${res?.error || t('media.unknownError', 'Unknown error')}`, 'error');
      }
    } catch (err) {
      showToast(`${t('setup.importFailed', 'Import failed')}: ${err?.message || t('media.unknownError', 'Unknown error')}`, 'error');
    } finally {
      setSetupTransferBusy(false);
    }
  }, [isElectron, setSetupTransferBusy, showToast, showAlert, showConfirm, t]);

  return {
    exportSetupBundle,
    importSetupBundle,
  };
}
