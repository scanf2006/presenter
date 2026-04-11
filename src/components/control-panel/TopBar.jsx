import React from 'react';

function TopBar({
  appVersion,
  projectorActive,
  trialLabel,
  trialExpired,
  onOpenLegal,
  onClear,
  onBlackout,
  onMinimize,
  onToggleMaximize,
  onClose,
}) {
  return (
    <div className="top-bar">
      <div className="top-bar__brand">
        <div className="top-bar__logo">CD</div>
        <span className="top-bar__title">
          ChurchDisplay Pro ({'\u6b64\u7248\u672c\u4e3a\u591a\u4f26\u591a\u795e\u53ec\u4f1a\u6d3b\u77f3\u5802\u7279\u4f9b--\u7248\u6743\u5c5e\u4e8eAiden\u6240\u6709aiden2006.video@gmail.com'}) v
          {appVersion}
        </span>
      </div>
      <div className="top-bar__controls">
        <div className="cp-status-inline">
          <span className={`status-dot ${projectorActive ? 'status-dot--active' : 'status-dot--inactive'}`} />
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
        <button className="btn btn--ghost cp-btn-license" onClick={onOpenLegal}>
          License
        </button>
        <button className="btn btn--ghost btn--icon" onClick={onClear} title="Clear">
          Clr
        </button>
        <button className="btn btn--ghost btn--icon" onClick={onBlackout} title="Blackout">
          Blk
        </button>
        <button className="btn btn--ghost btn--icon" onClick={onMinimize} title="Minimize">
          _
        </button>
        <button className="btn btn--ghost btn--icon" onClick={onToggleMaximize} title="Maximize / Restore">
          [ ]
        </button>
        <button className="btn btn--ghost btn--icon" onClick={onClose} title="Close" style={{ color: '#ff6b6b' }}>
          x
        </button>
      </div>
    </div>
  );
}

export default TopBar;
