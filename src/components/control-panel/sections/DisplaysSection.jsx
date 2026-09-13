import React from 'react';
import { useProjectorContext } from '../../../contexts/ProjectorContext';
import { useI18n } from '../../../contexts/I18nContext';

function DisplaysSection() {
  const { t } = useI18n();
  const {
    displays,
    projectorDisplayId,
    projectorActive,
    handleStartProjector,
    handleStopProjector,
    refreshDisplays,
  } = useProjectorContext();

  return (
    <div className="animate-slide-in-up">
      <h2 className="cp-page-title">
        {t('displays.title', 'Displays')}
      </h2>
      <p className="cp-page-intro cp-page-intro--spacious">
        {t(
          'displays.intro',
          'Select an external display to start projection. Content will be fullscreen on the selected screen.'
        )}
      </p>
      <button className="btn btn--ghost" onClick={refreshDisplays} style={{ marginBottom: '12px' }}>
        {t('displays.refresh', 'Refresh Displays')}
      </button>
      <div className="cp-stack-md">
        {displays.map((display) => (
          <div
            key={display.id}
            className={`display-card ${projectorDisplayId === display.id ? 'display-card--active' : ''}`}
            onClick={() => !display.isPrimary && handleStartProjector(display.id)}
          >
            <span className="display-card__icon">{display.isPrimary ? 'P' : 'E'}</span>
            <div className="display-card__info">
              <div className="display-card__name">
                {display.label || `${t('displays.displayLabel', 'Display')} ${display.id}`}
              </div>
              <div className="display-card__resolution">
                {display.size?.width ?? '?'} x {display.size?.height ?? '?'}
                {display.bounds &&
                  ` | ${t('displays.position', 'Position')} (${display.bounds.x}, ${display.bounds.y})`}
              </div>
            </div>
            {display.isPrimary && (
              <span className="display-card__badge display-card__badge--primary">
                {t('displays.primary', 'Primary')}
              </span>
            )}
            {projectorDisplayId === display.id && (
              <span className="display-card__badge display-card__badge--projecting">
                {t('displays.projecting', 'Projecting')}
              </span>
            )}
          </div>
        ))}
      </div>

      {projectorActive && (
        <button
          className="btn btn--danger btn--lg cp-btn-block cp-gap-top-lg"
          onClick={handleStopProjector}
        >
          {t('displays.stopProjector', 'Stop Projector')}
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
          {t(
            'displays.noExternalDisplay',
            'No external display detected. Connect a projector/monitor and try again.'
          )}
        </div>
      )}
    </div>
  );
}

export default DisplaysSection;
