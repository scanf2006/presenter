import { useCallback } from 'react';
import {
  acceptTauriEula, activateTauriLicense, clearTauriLicense, getTauriLegalDocument,
  getTauriLicenseDeviceId, getTauriLicenseStatus, isTauriRuntime,
} from '../utils/tauriProjector';

export default function useLicenseActions({
  setShowLegalModal,
  setLicenseActionError,
  setLicenseActionMsg,
  setEulaText,
  setLicenseStatus,
  setLicenseDeviceId,
  licenseStatus,
  licenseInput,
}) {
  const refreshLicenseStatus = useCallback(async () => {
    const status = isTauriRuntime() ? await getTauriLicenseStatus() : null;
    if (status) setLicenseStatus(status);
  }, [setLicenseStatus]);

  const openLegal = useCallback(async () => {
    setShowLegalModal(true);
    setLicenseActionError('');
    setLicenseActionMsg('');
    try {
      if (isTauriRuntime()) {
        const eula = await getTauriLegalDocument('eula');
        if (eula?.success && typeof eula.text === 'string') setEulaText(eula.text);
      }
      if (isTauriRuntime()) {
        const device = await getTauriLicenseDeviceId();
        if (device?.success && typeof device.deviceId === 'string') {
          setLicenseDeviceId(device.deviceId);
        }
      }
      await refreshLicenseStatus();
    } catch (err) {
      console.warn('[Legal] load failed:', err);
      setLicenseDeviceId('');
      setLicenseActionError(String(err));
    }
  }, [
    setShowLegalModal,
    setLicenseActionError,
    setLicenseActionMsg,
    setEulaText,
    setLicenseDeviceId,
    refreshLicenseStatus,
  ]);

  const activateLicense = useCallback(async () => {
    if (!isTauriRuntime()) {
      setLicenseActionError('Current environment does not support license activation.');
      setLicenseActionMsg('');
      return;
    }
    if (!licenseInput.trim()) {
      setLicenseActionError('Please enter a license key.');
      setLicenseActionMsg('');
      return;
    }
    // M14-R2: Read licenseStatus via functional update to avoid stale closure.
    // We only need hasAcceptedEula here which doesn't change mid-call.
    if (!licenseStatus?.hasAcceptedEula) {
      setLicenseActionError('Please accept EULA before activation.');
      setLicenseActionMsg('');
      return;
    }
    try {
      const result = await activateTauriLicense(licenseInput.trim());
      if (result?.success) {
        setLicenseStatus((prev) => result.status || prev);
        setLicenseActionMsg('License activated.');
        setLicenseActionError('');
      } else {
        setLicenseActionError(result?.error || 'License activation failed.');
        setLicenseActionMsg('');
      }
    } catch (err) {
      setLicenseActionError(err.message || 'License activation failed.');
      setLicenseActionMsg('');
    }
  }, [
    licenseInput,
    licenseStatus?.hasAcceptedEula,
    setLicenseStatus,
    setLicenseActionMsg,
    setLicenseActionError,
  ]);

  const clearLicense = useCallback(async () => {
    if (!isTauriRuntime()) {
      setLicenseActionError('Current environment does not support clearing license.');
      setLicenseActionMsg('');
      return;
    }
    try {
      const result = await clearTauriLicense();
      if (result?.success) {
        // M14-R2: Use functional update to avoid stale closure.
        setLicenseStatus((prev) => result.status || prev);
        setLicenseActionMsg('Local license cleared.');
        setLicenseActionError('');
      } else {
        setLicenseActionError(result?.error || 'Failed to clear license.');
        setLicenseActionMsg('');
      }
    } catch (err) {
      setLicenseActionError(err.message || 'Failed to clear license.');
      setLicenseActionMsg('');
    }
  }, [setLicenseStatus, setLicenseActionMsg, setLicenseActionError]);

  const acceptEula = useCallback(async () => {
    if (!isTauriRuntime()) {
      setLicenseActionError('Current environment does not support EULA acceptance.');
      setLicenseActionMsg('');
      return;
    }
    try {
      const result = await acceptTauriEula();
      if (result?.success) {
        // M14-R2: Use functional update to avoid stale closure.
        setLicenseStatus((prev) => result.status || prev);
        setLicenseActionMsg('EULA acceptance recorded.');
        setLicenseActionError('');
      } else {
        setLicenseActionError(result?.error || 'Operation failed.');
        setLicenseActionMsg('');
      }
    } catch (err) {
      setLicenseActionError(err.message || 'Operation failed.');
      setLicenseActionMsg('');
    }
  }, [setLicenseStatus, setLicenseActionMsg, setLicenseActionError]);

  return {
    openLegal,
    activateLicense,
    clearLicense,
    acceptEula,
  };
}
