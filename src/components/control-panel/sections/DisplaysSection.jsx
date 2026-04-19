import React, { useEffect, useRef } from 'react';
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
    obsModeEnabled,
    setObsModeEnabled,
  } = useProjectorContext();
  const prevObsModeRef = useRef(obsModeEnabled);
  const rememberedProjectorDisplayIdRef = useRef(null);

  useEffect(() => {
    const prevObsMode = prevObsModeRef.current;

    if (!prevObsMode && obsModeEnabled) {
      const activeDisplay = displays.find((d) => d.id === projectorDisplayId);
      if (projectorActive && activeDisplay && !activeDisplay.isPrimary) {
        rememberedProjectorDisplayIdRef.current = projectorDisplayId;
        handleStopProjector();
      }
    }

    if (prevObsMode && !obsModeEnabled) {
      const rememberedId = rememberedProjectorDisplayIdRef.current;
      const rememberedDisplay = displays.find((d) => d.id === rememberedId);
      if (!projectorActive && rememberedDisplay && !rememberedDisplay.isPrimary) {
        handleStartProjector(rememberedId);
      }
    }

    prevObsModeRef.current = obsModeEnabled;
  }, [
    obsModeEnabled,
    projectorActive,
    projectorDisplayId,
    displays,
    handleStartProjector,
    handleStopProjector,
  ]);
  const canToggleObsMode = obsModeEnabled || projectorActive;

  return (
    <div className="animate-slide-in-up">
      <h2 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px' }}>Displays</h2>
      <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginBottom: '24px' }}>
        Select an external display to start projection. Content will be fullscreen on the selected
        screen.
      </p>
      <div
        className={`display-card ${obsModeEnabled ? 'display-card--active' : ''}`}
        style={{
          marginBottom: '14px',
          opacity: canToggleObsMode ? 1 : 0.55,
          cursor: canToggleObsMode ? 'pointer' : 'not-allowed',
        }}
        role="button"
        tabIndex={0}
        onClick={() => {
          if (!canToggleObsMode) {
            showToast('Start projector first, then enable OBS Mode.', 'warning');
            return;
          }
          setObsModeEnabled(!obsModeEnabled);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            if (!canToggleObsMode) {
              showToast('Start projector first, then enable OBS Mode.', 'warning');
              return;
            }
            setObsModeEnabled(!obsModeEnabled);
          }
        }}
      >
        <span className="display-card__icon">OBS</span>
        <div className="display-card__info">
          <div className="display-card__name">OBS Mode</div>
          <div className="display-card__resolution">
            Use OBS window capture + Fullscreen Projector on external display.
          </div>
        </div>
        <span className="display-card__badge display-card__badge--projecting">
          {obsModeEnabled ? 'Enabled' : canToggleObsMode ? 'Disabled' : 'Unavailable'}
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {displays.map((display) => (
          <div
            key={display.id}
            className={`display-card ${projectorDisplayId === display.id ? 'display-card--active' : ''}`}
            onClick={() => !obsModeEnabled && !display.isPrimary && handleStartProjector(display.id)}
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

      {projectorActive && !obsModeEnabled && (
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
