import React from 'react';
import { TRANSITION } from '../../../constants/ui';
import { useProjectorContext } from '../../../contexts/ProjectorContext';

/**
 * TransitionSettings renders the fade transition controls
 * (enable/disable, delay, duration).
 */
function TransitionSettings() {
  const {
    transitionEnabled,
    setTransitionEnabled,
    transitionDelayMs,
    setTransitionDelayMs,
    transitionDurationMs,
    setTransitionDurationMs,
  } = useProjectorContext();

  return (
    <>
      <div className="preview-panel__title" style={{ marginBottom: '10px' }}>
        Transition
      </div>
      <div className="cp-panel-box">
        <label className="cp-label-row">
          <input
            type="checkbox"
            checked={transitionEnabled}
            onChange={(e) => setTransitionEnabled(e.target.checked)}
          />
          Fade In/Out
        </label>
        <div className="cp-two-col-grid">
          <div>
            <div className="cp-field-label">Delay (ms)</div>
            <input
              type="number"
              min={TRANSITION.MIN_MS}
              max={TRANSITION.MAX_MS}
              value={transitionDelayMs}
              onChange={(e) =>
                setTransitionDelayMs(
                  Math.max(
                    TRANSITION.MIN_MS,
                    Math.min(TRANSITION.MAX_MS, Number(e.target.value || TRANSITION.MIN_MS))
                  )
                )
              }
              className="cp-input-sm"
            />
          </div>
          <div>
            <div className="cp-field-label">Duration (ms)</div>
            <input
              type="number"
              min={TRANSITION.MIN_MS}
              max={TRANSITION.MAX_MS}
              value={transitionDurationMs}
              onChange={(e) =>
                setTransitionDurationMs(
                  Math.max(
                    TRANSITION.MIN_MS,
                    Math.min(TRANSITION.MAX_MS, Number(e.target.value || TRANSITION.MIN_MS))
                  )
                )
              }
              className="cp-input-sm"
            />
          </div>
        </div>
      </div>
    </>
  );
}

export default TransitionSettings;
