import React from 'react';
import { useProjectorContext } from '../../../contexts/ProjectorContext';
import { useAppContext } from '../../../contexts/AppContext';

function DisplaysSection() {
  const { showToast } = useAppContext();
  const {
    displays,
    projectorDisplayId,
    projectorActive,
    handleStartProjector,
    handleStopProjector,
    ndiStatus,
    toggleNdiOutput,
  } = useProjectorContext();

  return (
    <div className="animate-slide-in-up">
      <h2 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px' }}>Displays</h2>
      <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginBottom: '24px' }}>
        Select an external display to start projection. Content will be fullscreen on the selected
        screen.
      </p>
      <div
        className={`display-card ${ndiStatus?.active ? 'display-card--active' : ''}`}
        style={{
          marginBottom: '14px',
          opacity: projectorActive ? 1 : 0.55,
          cursor: projectorActive ? 'pointer' : 'not-allowed',
        }}
        role="button"
        tabIndex={0}
        onClick={() => {
          if (!projectorActive) {
            showToast('Start projector first, then enable NDI output.', 'warning');
            return;
          }
          void toggleNdiOutput();
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            if (!projectorActive) {
              showToast('Start projector first, then enable NDI output.', 'warning');
              return;
            }
            void toggleNdiOutput();
          }
        }}
      >
        <span className="display-card__icon">NDI</span>
        <div className="display-card__info">
          <div className="display-card__name">NDI Output</div>
          <div className="display-card__resolution">
            Source: {ndiStatus?.sourceName || 'ChurchDisplay Pro NDI'} | Receivers:{' '}
            {ndiStatus?.connections ?? 0}
          </div>
        </div>
        <span className="display-card__badge display-card__badge--projecting">
          {ndiStatus?.active ? 'Enabled' : projectorActive ? 'Disabled' : 'Unavailable'}
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {displays.map((display) => (
          <div
            key={display.id}
            className={`display-card ${projectorDisplayId === display.id ? 'display-card--active' : ''}`}
            onClick={() => !display.isPrimary && handleStartProjector(display.id)}
          >
            <span className="display-card__icon">{display.isPrimary ? 'P' : 'E'}</span>
            <div className="display-card__info">
              <div className="display-card__name">{display.label || `Display ${display.id}`}</div>
              <div className="display-card__resolution">
                {display.size?.width ?? '?'} x {display.size?.height ?? '?'}
                {display.bounds && ` | Position (${display.bounds.x}, ${display.bounds.y})`}
              </div>
            </div>
            {display.isPrimary && (
              <span className="display-card__badge display-card__badge--primary">Primary</span>
            )}
            {projectorDisplayId === display.id && (
              <span className="display-card__badge display-card__badge--projecting">
                Projecting
              </span>
            )}
          </div>
        ))}
      </div>

      {projectorActive && (
        <button
          className="btn btn--danger btn--lg"
          style={{ marginTop: '24px', width: '100%' }}
          onClick={handleStopProjector}
        >
          Stop Projector
        </button>
      )}

      {displays.filter((d) => !d.isPrimary).length === 0 && (
        <div
          style={{
            marginTop: '24px',
            padding: '20px',
            background: 'rgba(245, 158, 11, 0.08)',
            border: '1px solid rgba(245, 158, 11, 0.2)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--color-warning)',
            fontSize: '13px',
          }}
        >
          No external display detected. Connect a projector/monitor and try again.
        </div>
      )}
    </div>
  );
}

export default DisplaysSection;
