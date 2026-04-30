import { useMemo } from 'react';
import { PREVIEW, SCENE } from '../constants/ui';

export default function usePreviewLayoutMetrics({ sceneConfig }) {
  return useMemo(() => {
    const previewSplitEnabled = false;
    const previewRightPanePercent = Math.max(
      SCENE.CAMERA_PANE_MIN_PERCENT,
      Math.min(
        SCENE.CAMERA_PANE_MAX_PERCENT,
        sceneConfig.cameraPanePercent || SCENE.CAMERA_PANE_DEFAULT_PERCENT
      )
    );
    const previewContentPanePercent = 100 - previewRightPanePercent;
    const previewCameraScale = Math.max(
      1,
      Number(sceneConfig.cameraCenterCropPercent || SCENE.CAMERA_CROP_DEFAULT_PERCENT) /
        SCENE.CAMERA_CROP_DEFAULT_PERCENT
    );

    return {
      previewAspectRatio: PREVIEW.ASPECT_RATIO_16_9,
      previewSplitEnabled,
      previewContentPanePercent,
      previewRightPanePercent,
      previewCameraScale,
    };
  }, [sceneConfig.cameraPanePercent, sceneConfig.cameraCenterCropPercent]);
}
