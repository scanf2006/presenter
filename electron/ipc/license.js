const { createEulaAcceptanceProof } = require('../license');

function registerLicenseIPC({
  ipcMain,
  verifyLicenseToken,
  getDeviceId,
  getLicenseStatus,
  getTrialStatus,
  writeAppSettings,
  readLegalDocument,
  appVersion,
}) {
  const withTrial = (status) => ({
    ...(status || {}),
    trial: typeof getTrialStatus === 'function' ? getTrialStatus() : null,
  });

  ipcMain.handle('license-get-status', () => withTrial(getLicenseStatus()));
  ipcMain.handle('license-get-device-id', () => {
    try {
      const deviceId = typeof getDeviceId === 'function' ? getDeviceId() : '';
      return { success: true, deviceId };
    } catch (err) {
      return { success: false, error: err?.message || 'Failed to read device ID.' };
    }
  });

  ipcMain.handle('license-activate', (_event, licenseKey) => {
    const currentStatus = getLicenseStatus();
    if (!currentStatus?.hasAcceptedEula) {
      return {
        success: false,
        error: 'Please accept EULA before activation.',
        status: withTrial(currentStatus),
      };
    }

    const normalized = typeof licenseKey === 'string' ? licenseKey.trim() : '';
    if (!normalized) {
      return { success: false, error: 'License key is required.' };
    }

    const verified = verifyLicenseToken(
      normalized,
      new Date(),
      appVersion || null,
      typeof getDeviceId === 'function' ? getDeviceId() : null
    );
    if (!verified.ok) {
      return { success: false, error: verified.error };
    }

    const saved = writeAppSettings({ licenseKey: normalized });
    if (!saved.success) {
      return { success: false, error: saved.error };
    }

    return { success: true, status: withTrial(getLicenseStatus()) };
  });

  ipcMain.handle('license-clear', () => {
    const saved = writeAppSettings({ licenseKey: '', acceptedEulaAt: null, acceptedEulaProof: '' });
    if (!saved.success) {
      return { success: false, error: saved.error };
    }
    return { success: true, status: withTrial(getLicenseStatus()) };
  });

  ipcMain.handle('legal-get-document', (_event, docType) => readLegalDocument(docType));

  ipcMain.handle('legal-accept-eula', () => {
    const acceptedEulaAt = new Date().toISOString();
    const deviceId = typeof getDeviceId === 'function' ? getDeviceId() : '';
    if (!deviceId) {
      return { success: false, error: 'Unable to read device ID for EULA proof.' };
    }
    const acceptedEulaProof = createEulaAcceptanceProof(acceptedEulaAt, deviceId);
    const saved = writeAppSettings({ acceptedEulaAt, acceptedEulaProof });
    if (!saved.success) {
      return { success: false, error: saved.error };
    }
    return { success: true, status: withTrial(getLicenseStatus()) };
  });
}

module.exports = {
  registerLicenseIPC,
};
