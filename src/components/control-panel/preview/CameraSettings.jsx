import React from 'react';
import { SCENE } from '../../../constants/ui';
import { useProjectorContext } from '../../../contexts/ProjectorContext';

/**
 * CameraSettings renders the camera split configuration panel.
 * Currently hidden (display: none) — reserved for future release.
 */
function CameraSettings() {
  const { sceneConfig, setSceneConfig, cameraDevices } = useProjectorContext();

  return (
    <div className="cp-panel-box" style={{ display: 'none' }}>
      <label className="cp-label-row" style={{ marginBottom: '8px' }}>
        <input
          type="checkbox"
          checked={sceneConfig.mode === 'split_camera'}
          onChange={(e) =>
            setSceneConfig((prev) => ({
              ...prev,
              mode: e.target.checked ? 'split_camera' : 'normal',
            }))
          }
        />
        Enable Camera Split (Left Content / Right Camera)
      </label>
      <div style={{ marginBottom: '8px' }}>
        <label className="cp-label-row" style={{ marginBottom: '8px' }}>
          <input
            type="checkbox"
            checked={sceneConfig.enableCameraTestMode === true}
            onChange={(e) =>
              setSceneConfig((prev) => ({ ...prev, enableCameraTestMode: e.target.checked }))
            }
          />
          Camera Test Mode (No physical camera)
        </label>
        <div className="cp-field-label">Camera Device</div>
        <select
          value={sceneConfig.cameraDeviceId || ''}
          onChange={(e) => setSceneConfig((prev) => ({ ...prev, cameraDeviceId: e.target.value }))}
          disabled={sceneConfig.enableCameraTestMode === true}
          className="cp-input-sm"
        >
          {cameraDevices.length === 0 && <option value="">No camera detected</option>}
          {cameraDevices.map((d, idx) => (
            <option key={d.deviceId || idx} value={d.deviceId || ''}>
              {d.label || `Camera ${idx + 1}`}
            </option>
          ))}
        </select>
      </div>
      <div>
        <div className="cp-field-label">
          Right Camera Width (%):{' '}
          {Math.max(
            SCENE.CAMERA_PANE_MIN_PERCENT,
            Math.min(SCENE.CAMERA_PANE_MAX_PERCENT, sceneConfig.cameraPanePercent)
          )}
        </div>
        <input
          type="range"
          min={SCENE.CAMERA_PANE_MIN_PERCENT}
          max={SCENE.CAMERA_PANE_MAX_PERCENT}
          step={1}
          value={Math.max(
            SCENE.CAMERA_PANE_MIN_PERCENT,
            Math.min(SCENE.CAMERA_PANE_MAX_PERCENT, sceneConfig.cameraPanePercent)
          )}
          onChange={(e) =>
            setSceneConfig((prev) => ({ ...prev, cameraPanePercent: Number(e.target.value) }))
          }
          style={{ width: '100%' }}
        />
      </div>
      <div style={{ marginTop: '8px' }}>
        <div className="cp-field-label">
          Camera Center Crop (%):{' '}
          {Math.max(
            SCENE.CAMERA_CROP_MIN_PERCENT,
            Math.min(
              SCENE.CAMERA_CROP_MAX_PERCENT,
              sceneConfig.cameraCenterCropPercent || SCENE.CAMERA_CROP_DEFAULT_PERCENT
            )
          )}
        </div>
        <input
          type="range"
          min={SCENE.CAMERA_CROP_MIN_PERCENT}
          max={SCENE.CAMERA_CROP_MAX_PERCENT}
          step={5}
          value={Math.max(
            SCENE.CAMERA_CROP_MIN_PERCENT,
            Math.min(
              SCENE.CAMERA_CROP_MAX_PERCENT,
              sceneConfig.cameraCenterCropPercent || SCENE.CAMERA_CROP_DEFAULT_PERCENT
            )
          )}
          onChange={(e) =>
            setSceneConfig((prev) => ({
              ...prev,
              cameraCenterCropPercent: Number(e.target.value),
            }))
          }
          style={{ width: '100%' }}
        />
      </div>
    </div>
  );
}

export default CameraSettings;
