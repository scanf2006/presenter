import React from 'react';

function LegalModal({
  show,
  onClose,
  licenseStatus,
  licenseInput,
  setLicenseInput,
  handleActivateLicense,
  handleClearLicense,
  handleAcceptEula,
  licenseActionError,
  licenseActionMsg,
  eulaText,
}) {
  if (!show) return null;

  return (
    <div className="cp-modal-overlay" onClick={onClose}>
      <div className="cp-modal-card" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <div style={{ fontSize: '16px', fontWeight: 600 }}>License</div>
          <button className="btn btn--ghost" onClick={onClose} style={{ padding: '4px 10px' }}>
            Close
          </button>
        </div>

        <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginBottom: '10px' }}>
          Current Status: {licenseStatus.isLicensed ? 'Licensed' : 'Unlicensed'} | {licenseStatus.summary || 'Unlicensed'}
        </div>
        <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginBottom: '12px' }}>
          EULA: {licenseStatus.hasAcceptedEula ? `Accepted (${licenseStatus.acceptedEulaAt || ''})` : 'Not accepted'}
        </div>
        <div style={{ fontSize: '12px', color: '#f6d365', marginBottom: '12px' }}>
          Copyright Notice: {'\u7248\u6743\u6240\u6709\u5f52 Aiden \u6240\u6709\uff1bChurchDisplay Pro \u591a\u4f26\u591a\u795e\u53ec\u4f1a\u6d3b\u77f3\u5802\u7248\u4e3a\u8d60\u4e0e\u7248\uff08non-transferable gifted edition\uff09\u3002'}
        </div>

        <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
          <input
            type="text"
            placeholder="Enter license key (CDP1....)"
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
          <button className="btn btn--primary" onClick={handleActivateLicense}>
            Activate
          </button>
          <button className="btn btn--ghost" onClick={handleClearLicense}>
            Clear License
          </button>
          <button className="btn btn--ghost" onClick={handleAcceptEula}>
            Accept EULA
          </button>
        </div>

        {licenseActionError && <div style={{ color: '#ff8080', fontSize: '12px', marginBottom: '6px' }}>{licenseActionError}</div>}
        {licenseActionMsg && <div style={{ color: '#8af5a4', fontSize: '12px', marginBottom: '6px' }}>{licenseActionMsg}</div>}

        <div style={{ marginTop: '10px', fontSize: '12px', color: 'var(--color-text-secondary)' }}>
          Recommendation: use code signing, disable devtools in release, and issue keys server-side.
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
          {eulaText || 'Loading EULA...'}
        </pre>
      </div>
    </div>
  );
}

export default LegalModal;
