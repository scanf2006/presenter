import { PREVIEW, TEXT_EDITOR } from '../constants/ui.js';

export const FREE_TEXT_CONTENT_WIDTH_PERCENT = 88;
export const TEXTUAL_SLIDE_TYPES = ['text', 'bible', 'lyrics'];

export function isTextualSlideType(type) {
  return TEXTUAL_SLIDE_TYPES.includes(type);
}

export function getFallbackTextBasePx(fontSize) {
  if (fontSize === 'small') return 32;
  if (fontSize === 'medium') return 48;
  return 72;
}

export function getPreviewFallbackEditorTextPx(fontSize) {
  if (fontSize === 'large') return 16;
  if (fontSize === 'medium') return 12;
  return 10;
}

export function clampFreeTextLayout(rawLayout) {
  const x = Number(rawLayout?.xPercent);
  const y = Number(rawLayout?.yPercent);
  const scale = Number(rawLayout?.scale);
  return {
    xPercent: Number.isFinite(x)
      ? Math.max(TEXT_EDITOR.LAYOUT_X_MIN, Math.min(TEXT_EDITOR.LAYOUT_X_MAX, x))
      : TEXT_EDITOR.LAYOUT_DEFAULT.xPercent,
    yPercent: Number.isFinite(y)
      ? Math.max(TEXT_EDITOR.LAYOUT_Y_MIN, Math.min(TEXT_EDITOR.LAYOUT_Y_MAX, y))
      : TEXT_EDITOR.LAYOUT_DEFAULT.yPercent,
    scale: Number.isFinite(scale)
      ? Math.max(TEXT_EDITOR.LAYOUT_SCALE_MIN, Math.min(TEXT_EDITOR.LAYOUT_SCALE_MAX, scale))
      : TEXT_EDITOR.LAYOUT_DEFAULT.scale,
  };
}

export function getScaledFreeTextFontPx(rawFontPx, widthRatio) {
  const raw = Number(rawFontPx);
  if (!Number.isFinite(raw) || raw <= 0) return null;
  const scaled = Math.round(
    Math.max(20, Math.min(TEXT_EDITOR.SIZE_CLAMP_MAX_PX, raw)) * Math.max(PREVIEW.MIN_WIDTH_RATIO, Number(widthRatio) || 1)
  );
  return Math.max(PREVIEW.TEXT_MIN_PX, scaled);
}
