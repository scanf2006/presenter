const fs = require('fs');
const path = require('path');
const { verifyLicenseToken, createReadableLicenseSummary } = require('../license');

function createAppSettingsStore(settingsPath, appVersion = null) {
  function readAppSettings() {
    if (!settingsPath) return { licenseKey: '', acceptedEulaAt: null };
    try {
      if (!fs.existsSync(settingsPath)) {
        return { licenseKey: '', acceptedEulaAt: null };
      }
      const raw = fs.readFileSync(settingsPath, 'utf8');
      const parsed = JSON.parse(raw);
      return {
        licenseKey: typeof parsed?.licenseKey === 'string' ? parsed.licenseKey : '',
        acceptedEulaAt: typeof parsed?.acceptedEulaAt === 'string' ? parsed.acceptedEulaAt : null,
      };
    } catch (_err) {
      return { licenseKey: '', acceptedEulaAt: null };
    }
  }

  function writeAppSettings(nextPatch) {
    if (!settingsPath) return { success: false, error: 'Settings path unavailable.' };
    try {
      const current = readAppSettings();
      const next = { ...current, ...nextPatch };
      fs.writeFileSync(settingsPath, JSON.stringify(next, null, 2), 'utf8');
      return { success: true, settings: next };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  function getLicenseStatus() {
    const settings = readAppSettings();
    if (!settings.licenseKey) {
      return {
        isLicensed: false,
        summary: 'Unlicensed',
        license: null,
        hasAcceptedEula: !!settings.acceptedEulaAt,
        acceptedEulaAt: settings.acceptedEulaAt,
      };
    }

    const verified = verifyLicenseToken(settings.licenseKey, new Date(), appVersion);
    if (!verified.ok) {
      return {
        isLicensed: false,
        summary: `Invalid license (${verified.error})`,
        license: null,
        hasAcceptedEula: !!settings.acceptedEulaAt,
        acceptedEulaAt: settings.acceptedEulaAt,
        error: verified.error,
      };
    }

    return {
      isLicensed: true,
      summary: createReadableLicenseSummary(verified),
      license: verified.payload,
      hasAcceptedEula: !!settings.acceptedEulaAt,
      acceptedEulaAt: settings.acceptedEulaAt,
    };
  }

  return {
    readAppSettings,
    writeAppSettings,
    getLicenseStatus,
  };
}

function readLegalDocument(docType, rootDir) {
  const normalized = docType === 'license' ? 'LICENSE' : docType === 'eula' ? 'EULA.md' : null;
  if (!normalized) return { success: false, error: 'Unsupported legal document.' };

  const docPath = path.resolve(rootDir, normalized);
  try {
    const text = fs.readFileSync(docPath, 'utf8');
    return { success: true, text };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

module.exports = {
  createAppSettingsStore,
  readLegalDocument,
};
