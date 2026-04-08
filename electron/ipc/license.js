function registerLicenseIPC({
  ipcMain,
  verifyLicenseToken,
  getLicenseStatus,
  writeAppSettings,
  readLegalDocument,
}) {
  ipcMain.handle('license-get-status', () => getLicenseStatus());

  ipcMain.handle('license-activate', (_event, licenseKey) => {
    const normalized = typeof licenseKey === 'string' ? licenseKey.trim() : '';
    if (!normalized) {
      return { success: false, error: 'License key is required.' };
    }

    const verified = verifyLicenseToken(normalized);
    if (!verified.ok) {
      return { success: false, error: verified.error };
    }

    const saved = writeAppSettings({ licenseKey: normalized });
    if (!saved.success) {
      return { success: false, error: saved.error };
    }

    return { success: true, status: getLicenseStatus() };
  });

  ipcMain.handle('license-clear', () => {
    const saved = writeAppSettings({ licenseKey: '' });
    if (!saved.success) {
      return { success: false, error: saved.error };
    }
    return { success: true, status: getLicenseStatus() };
  });

  ipcMain.handle('legal-get-document', (_event, docType) => readLegalDocument(docType));

  ipcMain.handle('legal-accept-eula', () => {
    const saved = writeAppSettings({ acceptedEulaAt: new Date().toISOString() });
    if (!saved.success) {
      return { success: false, error: saved.error };
    }
    return { success: true, status: getLicenseStatus() };
  });
}

module.exports = {
  registerLicenseIPC,
};
