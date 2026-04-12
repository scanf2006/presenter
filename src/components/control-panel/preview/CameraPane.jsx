import React from 'react';
import { useProjectorContext } from '../../../contexts/ProjectorContext';

/**
 * CameraPane renders the camera split-view area within the preview stage.
 * Shows either a live camera feed or a test-mode placeholder.
 */
function CameraPane() {
  const {
    previewRightPanePercent,
    previewCameraScale,
    previewTestNow,
    cameraPreviewRef,
    cameraStatus,
    sceneConfig,
  } = useProjectorContext();

  return (
    <>
      <div
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          right: `${previewRightPanePercent}%`,
          width: '1px',
          background: 'rgba(255,255,255,0.2)',
          zIndex: 8,
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          right: 0,
          width: `${previewRightPanePercent}%`,
          zIndex: 9,
          background: '#000',
          overflow: 'hidden',
        }}
      >
        {sceneConfig.enableCameraTestMode ? (
          <div
            style={{
              width: '100%',
              height: '100%',
              transform: `scale(${previewCameraScale})`,
              transformOrigin: 'center center',
              background: 'linear-gradient(135deg, #0b1220 0%, #1f2a44 40%, #22325b 100%)',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                position: 'absolute',
                inset: 0,
                backgroundImage:
                  'repeating-linear-gradient(45deg, rgba(255,255,255,0.06) 0 12px, rgba(255,255,255,0.02) 12px 24px)',
              }}
            />
            <div
              style={{
                position: 'absolute',
                inset: '14px',
                border: '1px solid rgba(255,255,255,0.28)',
              }}
            />
            <div
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: '50%',
                height: '1px',
                background: 'rgba(255,255,255,0.32)',
              }}
            />
            <div
              style={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                left: '50%',
                width: '1px',
                background: 'rgba(255,255,255,0.32)',
              }}
            />
            <div
              style={{
                position: 'absolute',
                left: '10px',
                top: '10px',
                fontSize: '10px',
                color: '#8ee7ff',
                fontWeight: 700,
                letterSpacing: '0.5px',
              }}
            >
              CAMERA
            </div>
            <div
              style={{
                position: 'absolute',
                right: '10px',
                bottom: '10px',
                fontSize: '10px',
                color: 'rgba(255,255,255,0.9)',
                fontFamily: 'monospace',
              }}
            >
              {new Date(previewTestNow).toLocaleTimeString()}
            </div>
          </div>
        ) : (
          <video
            ref={cameraPreviewRef}
            muted
            autoPlay
            playsInline
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              transform: `scale(${previewCameraScale})`,
              transformOrigin: 'center center',
            }}
          />
        )}
        {!sceneConfig.enableCameraTestMode && cameraStatus !== 'ok' && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              fontSize: '11px',
              color: 'rgba(255,255,255,0.9)',
              background: 'rgba(0,0,0,0.6)',
              padding: '8px',
            }}
          >
            {cameraStatus === 'loading'
              ? 'Loading camera...'
              : cameraStatus === 'error'
                ? 'Camera unavailable'
                : 'Camera idle'}
          </div>
        )}
      </div>
    </>
  );
}

export default CameraPane;
