import { TEXT_EDITOR } from '../constants/ui';

export function buildTextPayload({
  text,
  fontSize,
  fontSizePx,
  fontFamily,
  fontWeight,
  textColor,
  background,
  textLayout,
}) {
  return {
    type: 'text',
    text: text || '',
    fontSize: fontSize || 'large',
    fontSizePx: Number(fontSizePx || TEXT_EDITOR.DEFAULT_SIZE_PX),
    fontFamily: fontFamily || TEXT_EDITOR.DEFAULT_FONT_FAMILY,
    fontWeight: Number(fontWeight || TEXT_EDITOR.DEFAULT_FONT_WEIGHT),
    textColor: textColor || TEXT_EDITOR.DEFAULT_COLOR,
    background: background || null,
    textLayout: textLayout || TEXT_EDITOR.LAYOUT_DEFAULT,
    timestamp: Date.now(),
  };
}
