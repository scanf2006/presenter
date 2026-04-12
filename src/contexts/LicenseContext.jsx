import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import useLicenseActions from '../hooks/useLicenseActions';
import { useAppContext } from './AppContext';

const LicenseContext = createContext(null);

export function useLicenseContext() {
  const ctx = useContext(LicenseContext);
  if (!ctx) throw new Error('useLicenseContext must be used within LicenseProvider');
  return ctx;
}

export function LicenseProvider({ children }) {
  const { isElectron, showToast } = useAppContext();

  const [showLegalModal, setShowLegalModal] = useState(false);
  const [licenseStatus, setLicenseStatus] = useState({
    isLicensed: false,
    summary: 'Unlicensed',
    hasAcceptedEula: false,
    acceptedEulaAt: null,
    trial: null,
  });
  const [licenseInput, setLicenseInput] = useState('');
  const [licenseDeviceId, setLicenseDeviceId] = useState('');
  const [licenseActionMsg, setLicenseActionMsg] = useState('');
  const [licenseActionError, setLicenseActionError] = useState('');
  const [eulaText, setEulaText] = useState('');
  const [trialNowMs, setTrialNowMs] = useState(0);

  const { openLegal, activateLicense, clearLicense, acceptEula } = useLicenseActions({
    isElectron,
    setShowLegalModal,
    setLicenseActionError,
    setLicenseActionMsg,
    setEulaText,
    setLicenseStatus,
    setLicenseDeviceId,
    licenseStatus,
    licenseInput,
  });

  // Hydrate license status on mount + poll every 10s
  useEffect(() => {
    const hydrateLicenseStatus = async () => {
      if (!isElectron || typeof window.churchDisplay?.licenseGetStatus !== 'function') return;
      try {
        const status = await window.churchDisplay.licenseGetStatus();
        if (status) setLicenseStatus(status);
      } catch (err) {
        console.warn('[License] load status failed:', err);
      }
    };
    hydrateLicenseStatus();

    let timer = null;
    if (isElectron && typeof window.churchDisplay?.licenseGetStatus === 'function') {
      timer = window.setInterval(hydrateLicenseStatus, 10000);
    }

    let offTrialWarning = null;
    if (isElectron && typeof window.churchDisplay?.onTrialWarning === 'function') {
      offTrialWarning = window.churchDisplay.onTrialWarning((payload) => {
        const msg = payload?.message || 'Trial expired. Please activate license.';
        showToast(msg);
        setLicenseActionError(msg);
        if (payload?.trial) {
          setLicenseStatus((prev) => ({ ...(prev || {}), trial: payload.trial }));
        }
      });
    }

    return () => {
      if (timer) window.clearInterval(timer);
      if (typeof offTrialWarning === 'function') offTrialWarning();
    };
  }, [isElectron, showToast]);

  // Trial countdown ticker
  useEffect(() => {
    const ticker = window.setInterval(() => setTrialNowMs(Date.now()), 1000);
    return () => window.clearInterval(ticker);
  }, []);

  const trialLabel = useMemo(() => {
    const trial = licenseStatus?.trial;
    if (!trial || !trial.enabled) return '';
    if (trial.expired) return 'Trial expired';
    const startedAtMs = Number(trial.startedAtMs || 0);
    const durationMs = Number(trial.durationMs || 0);
    if (startedAtMs > 0 && durationMs > 0) {
      const remainingMs = Math.max(0, durationMs - Math.max(0, trialNowMs - startedAtMs));
      const totalSec = Math.ceil(remainingMs / 1000);
      const min = Math.floor(totalSec / 60);
      const sec = totalSec % 60;
      return `Trial ${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
    }
    if (trial.remainingLabel) return `Trial ${trial.remainingLabel}`;
    return 'Trial mode';
  }, [licenseStatus?.trial, trialNowMs]);

  const handleCloseLegalModal = useCallback(() => setShowLegalModal(false), []);

  const value = useMemo(
    () => ({
      showLegalModal,
      setShowLegalModal,
      licenseStatus,
      licenseInput,
      setLicenseInput,
      licenseDeviceId,
      licenseActionMsg,
      licenseActionError,
      eulaText,
      trialLabel,
      trialExpired: !!licenseStatus?.trial?.expired,
      handleOpenLegal: openLegal,
      handleActivateLicense: activateLicense,
      handleClearLicense: clearLicense,
      handleAcceptEula: acceptEula,
      handleCloseLegalModal,
    }),
    [
      showLegalModal,
      licenseStatus,
      licenseInput,
      licenseDeviceId,
      licenseActionMsg,
      licenseActionError,
      eulaText,
      trialLabel,
      openLegal,
      activateLicense,
      clearLicense,
      acceptEula,
      handleCloseLegalModal,
    ]
  );

  return <LicenseContext.Provider value={value}>{children}</LicenseContext.Provider>;
}

export default LicenseContext;
