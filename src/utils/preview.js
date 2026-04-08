import { PREVIEW } from '../constants/ui';

export function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '00:00';
  const s = Math.floor(seconds % 60).toString().padStart(2, '0');
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export function getPreviewTextSize(slide, fallbackPx, previewStageWidth) {
  const raw = Number(slide?.fontSizePx);
  const widthRatio = Math.max(PREVIEW.MIN_WIDTH_RATIO, (previewStageWidth || PREVIEW.STAGE_FALLBACK_WIDTH_PX) / PREVIEW.STAGE_BASE_WIDTH_PX);
  if (Number.isFinite(raw) && raw > 0) {
    const scaled = Math.round(raw * widthRatio);
    return `${Math.max(PREVIEW.TEXT_MIN_PX, Math.min(PREVIEW.TEXT_MAX_PX, scaled))}px`;
  }
  const fallbackScaled = Math.round(Number(fallbackPx || 14) * Math.max(PREVIEW.FALLBACK_SCALE_FLOOR, widthRatio * PREVIEW.FALLBACK_SCALE_MULTIPLIER));
  return `${Math.max(PREVIEW.TEXT_MIN_PX, Math.min(PREVIEW.FALLBACK_TEXT_MAX_PX, fallbackScaled))}px`;
}

export function getPreviewMediaUrl(filePath) {
  if (!filePath) return '';
  if (/^https?:\/\//i.test(filePath)) return filePath;
  return `local-media://${encodeURIComponent(filePath)}`;
}
