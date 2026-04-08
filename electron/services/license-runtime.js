function createLicenseRuntimeBridge({ getAppSettingsStore }) {
  function writeSettings(nextPatch) {
    const store = getAppSettingsStore();
    if (!store) return { success: false, error: 'Settings store unavailable.' };
    return store.writeAppSettings(nextPatch);
  }

  function getCurrentLicenseStatus() {
    const store = getAppSettingsStore();
    if (!store) {
      return {
        isLicensed: false,
        summary: 'Unlicensed',
        license: null,
        hasAcceptedEula: false,
        acceptedEulaAt: null,
      };
    }
    return store.getLicenseStatus();
  }

  return {
    writeSettings,
    getCurrentLicenseStatus,
  };
}

module.exports = {
  createLicenseRuntimeBridge,
};
