import { useCallback } from 'react';

export default function useSetupBundleActions({
  isElectron,
  setSetupTransferBusy,
  showToast,
  showAlert,
  showConfirm,
}) {
  const exportSetupBundle = useCallback(async () => {
    if (!isElectron || typeof window.churchDisplay?.exportSetupBundle !== 'function') {
      showToast('Export is available in the desktop app only.', 'warning');
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
          'Export Complete',
          `Export completed (${res.mode || 'minimal'}).\n` +
            `Copied files: ${res.copiedCount || 0}\n` +
            `Bundle size: ${mb} MB\n` +
            `Missing refs: ${missingCount}\n\n` +
            `Folder:\n${res.backupDir}`
        );
      } else {
        showToast(`Export failed: ${res?.error || 'Unknown error'}`, 'error');
      }
    } catch (err) {
      showToast(`Export failed: ${err?.message || 'Unknown error'}`, 'error');
    } finally {
      setSetupTransferBusy(false);
    }
  }, [isElectron, setSetupTransferBusy, showToast, showAlert]);

  const importSetupBundle = useCallback(async () => {
    if (!isElectron || typeof window.churchDisplay?.importSetupBundle !== 'function') {
      showToast('Import is available in the desktop app only.', 'warning');
      return;
    }
    const ok = await showConfirm(
      'Import Setup Bundle',
      'Import will overwrite queue/config/songs, and merge media files without deleting existing local media. Continue?'
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
            ? `\nWarnings: ${res.warnings.length}`
            : '';
        showAlert(
          'Import Complete',
          `Import completed (${res.mode || 'minimal'}).\n` +
            `Copied: ${res.copiedCount || 0}\n` +
            `Skipped existing: ${res.skippedCount || 0}\n` +
            `Data size: ${mb} MB${warningText}\n\n` +
            'Please restart the app now.'
        );
      } else {
        showToast(`Import failed: ${res?.error || 'Unknown error'}`, 'error');
      }
    } catch (err) {
      showToast(`Import failed: ${err?.message || 'Unknown error'}`, 'error');
    } finally {
      setSetupTransferBusy(false);
    }
  }, [isElectron, setSetupTransferBusy, showToast, showAlert, showConfirm]);

  return {
    exportSetupBundle,
    importSetupBundle,
  };
}
