import React from 'react';
import { useLicenseContext } from '../../contexts/LicenseContext';
import { useI18n } from '../../contexts/I18nContext';

function LegalModal() {
  const { t } = useI18n();
  const {
    showLegalModal,
    handleCloseLegalModal,
    licenseStatus,
    licenseDeviceId,
    licenseInput,
    setLicenseInput,
    handleActivateLicense,
    handleClearLicense,
    handleAcceptEula,
    licenseActionError,
    licenseActionMsg,
    eulaText,
  } = useLicenseContext();

  const handleCopyDeviceId = async () => {
    if (!licenseDeviceId) return;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(licenseDeviceId);
        return;
      }
    } catch (_err) {
      // fall back to execCommand path below
    }

    const temp = document.createElement('textarea');
    temp.value = licenseDeviceId;
    temp.style.position = 'fixed';
    temp.style.opacity = '0';
    document.body.appendChild(temp);
    temp.focus();
    temp.select();
    try {
      document.execCommand('copy');
    } finally {
      document.body.removeChild(temp);
    }
  };
  const eulaAccepted = !!licenseStatus?.hasAcceptedEula;

  if (!showLegalModal) return null;

  return (
    <div className="cp-modal-overlay" onClick={handleCloseLegalModal}>
      <div className="cp-modal-card" onClick={(e) => e.stopPropagation()}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '10px',
          }}
        >
          <div style={{ fontSize: '16px', fontWeight: 600 }}>{t('legal.title', 'License')}</div>
          <button
            className="btn btn--ghost"
            onClick={handleCloseLegalModal}
            style={{ padding: '4px 10px' }}
          >
            {t('legal.close', 'Close')}
          </button>
        </div>

        <div
          style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginBottom: '10px' }}
        >
          {t('legal.currentStatus', 'Current Status')}: {licenseStatus.isLicensed ? t('legal.licensed', 'Licensed') : t('legal.unlicensed', 'Unlicensed')} |{' '}
          {licenseStatus.summary || t('legal.unlicensed', 'Unlicensed')}
        </div>
        <div
          style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginBottom: '12px' }}
        >
          {t('legal.eula', 'EULA')}:{' '}
          {licenseStatus.hasAcceptedEula
            ? `${t('legal.accepted', 'Accepted')} (${licenseStatus.acceptedEulaAt || ''})`
            : t('legal.notAccepted', 'Not accepted')}
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '12px' }}>
          <input
            type="text"
            value={licenseDeviceId || ''}
            readOnly
            style={{
              flex: 1,
              padding: '8px 10px',
              borderRadius: '6px',
              border: '1px solid rgba(255,255,255,0.2)',
              background: '#0d0d16',
              color: '#9ad6ff',
              fontSize: '12px',
            }}
          />
          <button
            className="btn btn--ghost"
            onClick={handleCopyDeviceId}
            disabled={!licenseDeviceId}
          >
            {t('legal.copyDeviceId', 'Copy Device ID')}
          </button>
        </div>
        <div style={{ fontSize: '12px', color: '#f6d365', marginBottom: '12px' }}>
          {t('legal.copyrightNotice', 'Copyright Notice')}:{' '}
          {
            t(
              'legal.giftedEdition',
              'All rights reserved by Aiden; ChurchDisplay Pro Toronto Living Stone Church edition is a non-transferable gifted edition.'
            )
          }
        </div>

        <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
          <input
            type="text"
            placeholder={t('legal.enterLicenseKey', 'Enter license key (CDP1....)')}
            value={licenseInput}
            onChange={(e) => setLicenseInput(e.target.value)}
            style={{
              flex: 1,
              padding: '8px 10px',
              borderRadius: '6px',
              border: '1px solid rgba(255,255,255,0.2)',
              background: '#0d0d16',
              color: '#fff',
              fontSize: '12px',
            }}
          />
          <button
            className="btn btn--primary"
            onClick={handleActivateLicense}
            disabled={!eulaAccepted}
            title={!eulaAccepted ? t('legal.eulaRequiredBeforeActivation', 'Please accept EULA before activation.') : ''}
          >
            {t('legal.activate', 'Activate')}
          </button>
          <button className="btn btn--ghost" onClick={handleClearLicense}>
            {t('legal.clearLicense', 'Clear License')}
          </button>
          <button className="btn btn--ghost" onClick={handleAcceptEula}>
            {t('legal.acceptEula', 'Accept EULA')}
          </button>
        </div>
        {!eulaAccepted && (
          <div style={{ color: '#f6d365', fontSize: '12px', marginBottom: '6px' }}>
            {t('legal.acceptEulaHint', 'Please click "Accept EULA" before activation.')}
          </div>
        )}

        {licenseActionError && (
          <div style={{ color: '#ff8080', fontSize: '12px', marginBottom: '6px' }}>
            {licenseActionError}
          </div>
        )}
        {licenseActionMsg && (
          <div style={{ color: '#8af5a4', fontSize: '12px', marginBottom: '6px' }}>
            {licenseActionMsg}
          </div>
        )}

        <div style={{ marginTop: '10px', fontSize: '12px', color: 'var(--color-text-secondary)' }}>
          {t(
            'legal.recommendation',
            'Recommendation: use code signing, disable devtools in release, and issue keys server-side.'
          )}
        </div>
        <pre
          style={{
            marginTop: '10px',
            whiteSpace: 'pre-wrap',
            fontSize: '11px',
            lineHeight: 1.45,
            background: 'rgba(0,0,0,0.3)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '8px',
            padding: '10px',
            maxHeight: '42vh',
            overflow: 'auto',
          }}
        >
          {eulaText || t('legal.loadingEula', 'Loading EULA...')}
        </pre>
      </div>
    </div>
  );
}

export default LegalModal;
