import { useCallback, useState } from 'react';
import { buildTextPayload } from '../utils/textPayload';
import { TEXT_EDITOR } from '../constants/ui';

export default function useTextEditorState() {
  const [textContent, setTextContent] = useState('');
  const [fontSize, setFontSize] = useState('large');
  const [textFontFamily, setTextFontFamily] = useState(TEXT_EDITOR.DEFAULT_FONT_FAMILY);
  const [textBold, setTextBold] = useState(true);
  const [textColor, setTextColor] = useState(TEXT_EDITOR.DEFAULT_COLOR);
  const [textSizePx, setTextSizePx] = useState(TEXT_EDITOR.DEFAULT_SIZE_PX);
  const [textBackground, setTextBackground] = useState(null);
  const [textLayout, setTextLayout] = useState(TEXT_EDITOR.LAYOUT_DEFAULT);
  const [textSnapGuide, setTextSnapGuide] = useState({ vertical: false, horizontal: false });

  const buildCurrentTextPayload = useCallback((textOverride = null) => buildTextPayload({
    text: textOverride ?? textContent,
    fontSize,
    fontSizePx: textSizePx,
    fontFamily: textFontFamily,
    fontWeight: textBold ? 700 : 400,
    textColor,
    background: textBackground,
    textLayout,
  }), [
    textContent,
    fontSize,
    textSizePx,
    textFontFamily,
    textBold,
    textColor,
    textBackground,
    textLayout,
  ]);

  const resetTextEditorState = useCallback(() => {
    setTextContent('');
    setFontSize('large');
    setTextSizePx(TEXT_EDITOR.DEFAULT_SIZE_PX);
    setTextFontFamily(TEXT_EDITOR.DEFAULT_FONT_FAMILY);
    setTextBold(true);
    setTextColor(TEXT_EDITOR.DEFAULT_COLOR);
    setTextBackground(null);
    setTextLayout(TEXT_EDITOR.LAYOUT_DEFAULT);
    setTextSnapGuide({ vertical: false, horizontal: false });
  }, []);

  const applyTextPayloadToEditor = useCallback((payload) => {
    if (!payload || payload.type !== 'text') return;
    setTextContent(payload.text || '');
    setFontSize(payload.fontSize || 'large');
    setTextSizePx(Math.max(TEXT_EDITOR.SIZE_INPUT_MIN_PX, Math.min(TEXT_EDITOR.SIZE_CLAMP_MAX_PX, Number(payload.fontSizePx || TEXT_EDITOR.DEFAULT_SIZE_PX))));
    setTextFontFamily(payload.fontFamily || TEXT_EDITOR.DEFAULT_FONT_FAMILY);
    setTextBold(Number(payload.fontWeight || TEXT_EDITOR.DEFAULT_FONT_WEIGHT) >= 600);
    setTextColor(payload.textColor || TEXT_EDITOR.DEFAULT_COLOR);
    setTextBackground(payload.background || null);
    setTextLayout({
      xPercent: Math.max(TEXT_EDITOR.LAYOUT_X_MIN, Math.min(TEXT_EDITOR.LAYOUT_X_MAX, Number(payload?.textLayout?.xPercent ?? TEXT_EDITOR.LAYOUT_DEFAULT.xPercent))),
      yPercent: Math.max(TEXT_EDITOR.LAYOUT_Y_MIN, Math.min(TEXT_EDITOR.LAYOUT_Y_MAX, Number(payload?.textLayout?.yPercent ?? TEXT_EDITOR.LAYOUT_DEFAULT.yPercent))),
      scale: Math.max(TEXT_EDITOR.LAYOUT_SCALE_MIN, Math.min(TEXT_EDITOR.LAYOUT_SCALE_MAX, Number(payload?.textLayout?.scale ?? TEXT_EDITOR.LAYOUT_DEFAULT.scale))),
    });
    setTextSnapGuide({ vertical: false, horizontal: false });
  }, []);

  return {
    textContent,
    setTextContent,
    fontSize,
    setFontSize,
    textFontFamily,
    setTextFontFamily,
    textBold,
    setTextBold,
    textColor,
    setTextColor,
    textSizePx,
    setTextSizePx,
    textBackground,
    setTextBackground,
    textLayout,
    setTextLayout,
    textSnapGuide,
    setTextSnapGuide,
    buildCurrentTextPayload,
    resetTextEditorState,
    applyTextPayloadToEditor,
  };
}
