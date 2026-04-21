import React from 'react';
import { useProjectorContext } from '../../contexts/ProjectorContext';
import { useLicenseContext } from '../../contexts/LicenseContext';

/* ── Inline SVG icons (16×16, no external deps) ── */
const IconClear = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M2.5 5h11M5.5 5V3.5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1V5M6.5 7.5v4M9.5 7.5v4" />
    <path d="M3.5 5l.7 7.5a1.5 1.5 0 0 0 1.5 1.3h4.6a1.5 1.5 0 0 0 1.5-1.3L12.5 5" />
  </svg>
);

const IconBlackout = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
    <rect x="2" y="2" width="12" height="12" rx="2" />
  </svg>
);

const IconMinimize = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
  >
    <line x1="4" y1="12" x2="12" y2="12" />
  </svg>
);

const IconMaximize = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinejoin="round"
  >
    <rect x="3" y="3" width="10" height="10" rx="1.5" />
  </svg>
);

const IconClose = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
  >
    <line x1="4" y1="4" x2="12" y2="12" />
    <line x1="12" y1="4" x2="4" y2="12" />
  </svg>
);

function TopBar({ appVersion, onClear }) {
  const {
    projectorActive,
    handleBlackout,
    handleMinimizeWindow,
    handleToggleMaximizeWindow,
    handleCloseWindow,
  } = useProjectorContext();

  const { trialLabel, trialExpired, handleOpenLegal } = useLicenseContext();
  const copyrightNotice =
    '\u6b64\u7248\u672c\u4e3a\u591a\u4f26\u591a\u795e\u53ec\u4f1a\u6d3b\u77f3\u5802\u7279\u4f9b--\u7248\u6743\u5c5e\u4e8eAiden\u6240\u6709aiden2006.video@gmail.com';

  return (
    <div className="top-bar">
      <div className="top-bar__brand">
        <div className="top-bar__logo">CD</div>
        <div className="top-bar__brand-inline">
          <span className="top-bar__title">ChurchDisplay Pro</span>
          <span className="top-bar__notice-inline">{copyrightNotice}</span>
          <span className="top-bar__version-inline">v{appVersion}</span>
        </div>
      </div>
      <div className="top-bar__controls">
        <div className="cp-status-inline">
          <span
            className={`status-dot ${projectorActive ? 'status-dot--active' : 'status-dot--inactive'}`}
          />
          {projectorActive ? 'Projecting' : 'Idle'}
        </div>
        {!!trialLabel && (
          <div
            className="cp-status-inline"
            style={{
              color: trialExpired ? '#ff8080' : '#f6d365',
              borderColor: trialExpired ? 'rgba(255,128,128,0.35)' : 'rgba(246,211,101,0.35)',
            }}
            title="Trial status"
          >
            {trialLabel}
          </div>
        )}
        <button className="btn btn--ghost cp-btn-license" onClick={handleOpenLegal}>
          License
        </button>
        <button className="btn btn--ghost btn--icon" onClick={onClear} title="Clear">
          <IconClear />
        </button>
        <button className="btn btn--ghost btn--icon" onClick={handleBlackout} title="Blackout">
          <IconBlackout />
        </button>
        <button
          className="btn btn--ghost btn--icon"
          onClick={handleMinimizeWindow}
          title="Minimize"
        >
          <IconMinimize />
        </button>
        <button
          className="btn btn--ghost btn--icon"
          onClick={handleToggleMaximizeWindow}
          title="Maximize / Restore"
        >
          <IconMaximize />
        </button>
        <button
          className="btn btn--ghost btn--icon"
          onClick={handleCloseWindow}
          title="Close"
          style={{ color: '#ff6b6b' }}
        >
          <IconClose />
        </button>
      </div>
    </div>
  );
}

export default TopBar;
