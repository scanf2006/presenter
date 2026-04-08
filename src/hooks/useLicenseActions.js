import { useCallback } from 'react';

export default function useLicenseActions({
  isElectron,
  setShowLegalModal,
  setLicenseActionError,
  setLicenseActionMsg,
  setEulaText,
  setLicenseStatus,
  licenseStatus,
  licenseInput,
}) {
  const refreshLicenseStatus = useCallback(async () => {
    if (!isElectron || typeof window.churchDisplay?.licenseGetStatus !== 'function') return;
    const status = await window.churchDisplay.licenseGetStatus();
    if (status) setLicenseStatus(status);
  }, [isElectron, setLicenseStatus]);

  const openLegal = useCallback(async () => {
    setShowLegalModal(true);
    setLicenseActionError('');
    setLicenseActionMsg('');
    try {
      if (isElectron && typeof window.churchDisplay?.legalGetDocument === 'function') {
        const eula = await window.churchDisplay.legalGetDocument('eula');
        if (eula?.success && typeof eula.text === 'string') setEulaText(eula.text);
      }
      await refreshLicenseStatus();
    } catch (err) {
      console.warn('[Legal] load failed:', err);
    }
  }, [
    isElectron,
    setShowLegalModal,
    setLicenseActionError,
    setLicenseActionMsg,
    setEulaText,
    refreshLicenseStatus,
  ]);

  const activateLicense = useCallback(async () => {
    if (!isElectron || typeof window.churchDisplay?.licenseActivate !== 'function') {
      setLicenseActionError('Current environment does not support license activation.');
      setLicenseActionMsg('');
      return;
    }
    if (!licenseInput.trim()) {
      setLicenseActionError('Please enter a license key.');
      setLicenseActionMsg('');
      return;
    }
    try {
      const result = await window.churchDisplay.licenseActivate(licenseInput.trim());
      if (result?.success) {
        setLicenseStatus(result.status || licenseStatus);
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
    isElectron,
    licenseInput,
    licenseStatus,
    setLicenseStatus,
    setLicenseActionMsg,
    setLicenseActionError,
  ]);

  const clearLicense = useCallback(async () => {
    if (!isElectron || typeof window.churchDisplay?.licenseClear !== 'function') {
      setLicenseActionError('Current environment does not support clearing license.');
      setLicenseActionMsg('');
      return;
    }
    try {
      const result = await window.churchDisplay.licenseClear();
      if (result?.success) {
        setLicenseStatus(result.status || licenseStatus);
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
  }, [
    isElectron,
    licenseStatus,
    setLicenseStatus,
    setLicenseActionMsg,
    setLicenseActionError,
  ]);

  const acceptEula = useCallback(async () => {
    if (!isElectron || typeof window.churchDisplay?.legalAcceptEula !== 'function') {
      setLicenseActionError('Current environment does not support EULA acceptance.');
      setLicenseActionMsg('');
      return;
    }
    try {
      const result = await window.churchDisplay.legalAcceptEula();
      if (result?.success) {
        setLicenseStatus(result.status || licenseStatus);
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
  }, [
    isElectron,
    licenseStatus,
    setLicenseStatus,
    setLicenseActionMsg,
    setLicenseActionError,
  ]);

  return {
    openLegal,
    activateLicense,
    clearLicense,
    acceptEula,
  };
}
