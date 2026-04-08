import { useCallback } from 'react';

export default function useSetupBundleActions({
  isElectron,
  setSetupTransferBusy,
}) {
  const exportSetupBundle = useCallback(async () => {
    if (!isElectron || typeof window.churchDisplay?.exportSetupBundle !== 'function') {
      alert('Export is available in the desktop app only.');
      return;
    }
    try {
      setSetupTransferBusy(true);
      const res = await window.churchDisplay.exportSetupBundle();
      if (res?.cancelled) return;
      if (res?.success) {
        const mb = Number((Number(res.totalBytes || 0) / (1024 * 1024)).toFixed(2));
        const missingCount = Array.isArray(res.missingRefs) ? res.missingRefs.length : 0;
        alert(
          `Export completed (${res.mode || 'minimal'}).\n`
          + `Copied files: ${res.copiedCount || 0}\n`
          + `Bundle size: ${mb} MB\n`
          + `Missing refs: ${missingCount}\n\n`
          + `Folder:\n${res.backupDir}`
        );
      } else {
        alert(`Export failed: ${res?.error || 'Unknown error'}`);
      }
    } catch (err) {
      alert(`Export failed: ${err?.message || 'Unknown error'}`);
    } finally {
      setSetupTransferBusy(false);
    }
  }, [isElectron, setSetupTransferBusy]);

  const importSetupBundle = useCallback(async () => {
    if (!isElectron || typeof window.churchDisplay?.importSetupBundle !== 'function') {
      alert('Import is available in the desktop app only.');
      return;
    }
    const ok = window.confirm('Import will overwrite queue/config/songs, and merge media files without deleting existing local media. Continue?');
    if (!ok) return;
    try {
      setSetupTransferBusy(true);
      const res = await window.churchDisplay.importSetupBundle();
      if (res?.cancelled) return;
      if (res?.success) {
        const mb = Number((Number(res.totalBytes || 0) / (1024 * 1024)).toFixed(2));
        const warningText = Array.isArray(res.warnings) && res.warnings.length > 0
          ? `\nWarnings: ${res.warnings.length}`
          : '';
        alert(
          `Import completed (${res.mode || 'minimal'}).\n`
          + `Copied: ${res.copiedCount || 0}\n`
          + `Skipped existing: ${res.skippedCount || 0}\n`
          + `Data size: ${mb} MB${warningText}\n\n`
          + 'Please restart the app now.'
        );
      } else {
        alert(`Import failed: ${res?.error || 'Unknown error'}`);
      }
    } catch (err) {
      alert(`Import failed: ${err?.message || 'Unknown error'}`);
    } finally {
      setSetupTransferBusy(false);
    }
  }, [isElectron, setSetupTransferBusy]);

  return {
    exportSetupBundle,
    importSetupBundle,
  };
}
