const fs = require('fs');
const path = require('path');
const {
  verifyLicenseToken,
  createReadableLicenseSummary,
  createEulaAcceptanceProof,
} = require('../license');

function createAppSettingsStore(settingsPath, appVersion = null, getDeviceId = null) {
  // R3-M: Simple mutex to serialize read-modify-write operations.
  let writeLock = false;
  const writeQueue = [];

  function readAppSettings() {
    if (!settingsPath) {
      return {
        licenseKey: '',
        acceptedEulaAt: null,
        acceptedEulaProof: '',
        trialStartedAtMs: null,
        trialLastSeenAtMs: null,
        trialClockTampered: false,
      };
    }
    try {
      if (!fs.existsSync(settingsPath)) {
        return {
          licenseKey: '',
          acceptedEulaAt: null,
          acceptedEulaProof: '',
          trialStartedAtMs: null,
          trialLastSeenAtMs: null,
          trialClockTampered: false,
        };
      }
      const raw = fs.readFileSync(settingsPath, 'utf8');
      const parsed = JSON.parse(raw);
      const toNullableNumber = (value) =>
        Number.isFinite(value) && value > 0 ? Number(value) : null;
      return {
        licenseKey: typeof parsed?.licenseKey === 'string' ? parsed.licenseKey : '',
        acceptedEulaAt: typeof parsed?.acceptedEulaAt === 'string' ? parsed.acceptedEulaAt : null,
        acceptedEulaProof:
          typeof parsed?.acceptedEulaProof === 'string' ? parsed.acceptedEulaProof : '',
        trialStartedAtMs: toNullableNumber(parsed?.trialStartedAtMs),
        trialLastSeenAtMs: toNullableNumber(parsed?.trialLastSeenAtMs),
        trialClockTampered: parsed?.trialClockTampered === true,
      };
    } catch (_err) {
      return {
        licenseKey: '',
        acceptedEulaAt: null,
        acceptedEulaProof: '',
        trialStartedAtMs: null,
        trialLastSeenAtMs: null,
        trialClockTampered: false,
      };
    }
  }

  function writeAppSettings(nextPatch) {
    if (!settingsPath) return { success: false, error: 'Settings path unavailable.' };
    // R3-M: Serialize writes to prevent read-modify-write race conditions.
    if (writeLock) {
      return new Promise((resolve) => {
        writeQueue.push(() => resolve(writeAppSettings(nextPatch)));
      });
    }
    writeLock = true;
    try {
      const current = readAppSettings();
      const next = { ...current, ...nextPatch };
      fs.writeFileSync(settingsPath, JSON.stringify(next, null, 2), 'utf8');
      return { success: true, settings: next };
    } catch (err) {
      return { success: false, error: err.message };
    } finally {
      writeLock = false;
      if (writeQueue.length > 0) {
        const nextWrite = writeQueue.shift();
        nextWrite();
      }
    }
  }

  function getLicenseStatus() {
    const settings = readAppSettings();
    const deviceId = typeof getDeviceId === 'function' ? getDeviceId() : null;
    const expectedEulaProof =
      settings.acceptedEulaAt && deviceId
        ? createEulaAcceptanceProof(settings.acceptedEulaAt, deviceId)
        : '';
    const hasAcceptedEula =
      !!settings.acceptedEulaAt &&
      !!settings.acceptedEulaProof &&
      !!expectedEulaProof &&
      settings.acceptedEulaProof === expectedEulaProof;
    const eulaTampered = !!settings.acceptedEulaAt && !hasAcceptedEula;

    if (!settings.licenseKey) {
      return {
        isLicensed: false,
        summary: 'Unlicensed',
        license: null,
        hasAcceptedEula,
        acceptedEulaAt: settings.acceptedEulaAt,
        eulaTampered,
      };
    }

    const verified = verifyLicenseToken(settings.licenseKey, new Date(), appVersion, deviceId);
    if (!verified.ok) {
      return {
        isLicensed: false,
        summary: `Invalid license (${verified.error})`,
        license: null,
        hasAcceptedEula,
        acceptedEulaAt: settings.acceptedEulaAt,
        eulaTampered,
        error: verified.error,
      };
    }

    return {
      isLicensed: true,
      summary: createReadableLicenseSummary(verified),
      license: verified.payload,
      hasAcceptedEula,
      acceptedEulaAt: settings.acceptedEulaAt,
      eulaTampered,
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
