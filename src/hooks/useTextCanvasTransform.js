import { useCallback, useEffect, useRef } from 'react';
import { TEXT_CANVAS, TEXT_EDITOR } from '../constants/ui';

export default function useTextCanvasTransform({
  textCanvasRef,
  textLayerRef,
  textLayout,
  setTextLayout,
  textSizePx,
  setTextSizePx,
  clamp,
  setTextSnapGuide,
}) {
  // R3-M: Use refs for values read inside callbacks to prevent frequent callback recreation.
  const textLayoutRef = useRef(textLayout);
  const textSizePxRef = useRef(textSizePx);
  useEffect(() => {
    textLayoutRef.current = textLayout;
  }, [textLayout]);
  useEffect(() => {
    textSizePxRef.current = textSizePx;
  }, [textSizePx]);

  const textTransformRef = useRef({
    mode: null,
    startX: 0,
    startY: 0,
    startLayout: null,
    startTextSizePx: TEXT_EDITOR.DEFAULT_SIZE_PX,
  });

  const resetTextTransformState = useCallback(() => {
    textTransformRef.current = {
      mode: null,
      startX: 0,
      startY: 0,
      startLayout: null,
      startTextSizePx: TEXT_EDITOR.DEFAULT_SIZE_PX,
    };
    setTextSnapGuide({ vertical: false, horizontal: false });
  }, [setTextSnapGuide]);

  const startTextDrag = useCallback(
    (event) => {
      if (!textCanvasRef.current) return;
      if (event.button !== 0) return;
      if (event.target?.closest?.('[contenteditable="true"]')) return;
      event.preventDefault();
      textTransformRef.current = {
        mode: 'drag',
        startX: event.clientX,
        startY: event.clientY,
        startLayout: { ...textLayoutRef.current },
      };
    },
    [textCanvasRef]
  );

  const startTextResize = useCallback(
    (event) => {
      if (!textCanvasRef.current) return;
      if (event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      textTransformRef.current = {
        mode: 'resize',
        startX: event.clientX,
        startY: event.clientY,
        startLayout: { ...textLayoutRef.current },
        startTextSizePx: textSizePxRef.current,
      };
    },
    [textCanvasRef]
  );

  useEffect(() => {
    const onMouseMove = (event) => {
      const state = textTransformRef.current;
      if (!state?.mode || !textCanvasRef.current || !state.startLayout) return;
      const rect = textCanvasRef.current.getBoundingClientRect();
      if (!rect.width || !rect.height) return;

      if (state.mode === 'drag') {
        const deltaXPct = ((event.clientX - state.startX) / rect.width) * 100;
        const deltaYPct = ((event.clientY - state.startY) / rect.height) * 100;
        const layerRect = textLayerRef.current?.getBoundingClientRect?.();
        const halfWidthPct = layerRect?.width
          ? (layerRect.width / rect.width) * TEXT_CANVAS.DRAG_BOUND_CENTER_PERCENT
          : TEXT_EDITOR.LAYOUT_X_MIN;
        const halfHeightPct = layerRect?.height
          ? (layerRect.height / rect.height) * TEXT_CANVAS.DRAG_BOUND_CENTER_PERCENT
          : TEXT_EDITOR.LAYOUT_Y_MIN;
        const minX = Math.max(
          TEXT_CANVAS.DRAG_BOUND_MIN_PERCENT,
          Math.min(TEXT_CANVAS.DRAG_BOUND_CENTER_PERCENT, halfWidthPct)
        );
        const maxX = Math.min(
          TEXT_CANVAS.DRAG_BOUND_MAX_PERCENT,
          Math.max(TEXT_CANVAS.DRAG_BOUND_CENTER_PERCENT, 100 - halfWidthPct)
        );
        const minY = Math.max(
          TEXT_CANVAS.DRAG_BOUND_MIN_PERCENT,
          Math.min(TEXT_CANVAS.DRAG_BOUND_CENTER_PERCENT, halfHeightPct)
        );
        const maxY = Math.min(
          TEXT_CANVAS.DRAG_BOUND_MAX_PERCENT,
          Math.max(TEXT_CANVAS.DRAG_BOUND_CENTER_PERCENT, 100 - halfHeightPct)
        );
        let nextX = clamp(state.startLayout.xPercent + deltaXPct, minX, maxX);
        let nextY = clamp(state.startLayout.yPercent + deltaYPct, minY, maxY);
        const guide = { vertical: false, horizontal: false };
        const snapThreshold = TEXT_CANVAS.SNAP_THRESHOLD_PERCENT;
        if (
          Math.abs(nextX - TEXT_CANVAS.SNAP_CENTER_PERCENT) <= snapThreshold &&
          TEXT_CANVAS.SNAP_CENTER_PERCENT >= minX &&
          TEXT_CANVAS.SNAP_CENTER_PERCENT <= maxX
        ) {
          nextX = TEXT_CANVAS.SNAP_CENTER_PERCENT;
          guide.vertical = true;
        }
        if (
          Math.abs(nextY - TEXT_CANVAS.SNAP_CENTER_PERCENT) <= snapThreshold &&
          TEXT_CANVAS.SNAP_CENTER_PERCENT >= minY &&
          TEXT_CANVAS.SNAP_CENTER_PERCENT <= maxY
        ) {
          nextY = TEXT_CANVAS.SNAP_CENTER_PERCENT;
          guide.horizontal = true;
        }
        setTextSnapGuide(guide);
        setTextLayout((prev) => ({ ...prev, xPercent: nextX, yPercent: nextY }));
        return;
      }

      if (state.mode === 'resize') {
        const delta = event.clientX - state.startX + (event.clientY - state.startY);
        const baseSize =
          Number(state.startTextSizePx || textSizePxRef.current || TEXT_EDITOR.DEFAULT_SIZE_PX) *
          Number(state.startLayout?.scale || TEXT_EDITOR.LAYOUT_DEFAULT.scale);
        const nextSizePx = Math.round(
          clamp(
            baseSize + delta / TEXT_CANVAS.RESIZE_DIVISOR,
            TEXT_EDITOR.SIZE_INPUT_MIN_PX,
            TEXT_EDITOR.SIZE_CLAMP_MAX_PX
          )
        );
        setTextSizePx(nextSizePx);
        setTextLayout((prev) => ({ ...prev, scale: TEXT_EDITOR.LAYOUT_DEFAULT.scale }));
      }
    };

    const onMouseUp = () => {
      if (textTransformRef.current?.mode) {
        resetTextTransformState();
      }
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [
    clamp,
    textCanvasRef,
    textLayerRef,
    setTextSnapGuide,
    setTextLayout,
    setTextSizePx,
    resetTextTransformState,
  ]);

  return {
    startTextDrag,
    startTextResize,
    resetTextTransformState,
  };
}
