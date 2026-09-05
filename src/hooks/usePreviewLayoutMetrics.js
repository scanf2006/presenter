import { useMemo } from 'react';
import { PREVIEW } from '../constants/ui';

export default function usePreviewLayoutMetrics({ displays, projectorDisplayId }) {
  return useMemo(() => {
    const display = displays.find((item) => String(item.id) === String(projectorDisplayId));
    const width = Number(display?.size?.width || display?.bounds?.width);
    const height = Number(display?.size?.height || display?.bounds?.height);
    const previewAspectRatio = width > 0 && height > 0 ? `${width} / ${height}` : PREVIEW.ASPECT_RATIO_16_9;

    return {
      previewAspectRatio,
    };
  }, [displays, projectorDisplayId]);
}
