import { useCallback, useRef, useState } from 'react';

export default function usePreviewVideoControls({ onMediaCommand } = {}) {
  const [previewVideoCurrent, setPreviewVideoCurrent] = useState(0);
  const [previewVideoDuration, setPreviewVideoDuration] = useState(0);
  const [previewVideoPaused, setPreviewVideoPaused] = useState(false);
  const [previewVideoMuted, setPreviewVideoMuted] = useState(false);
  const previewVideoRef = useRef(null);

  const handleLoadedMetadata = useCallback((event) => {
    const target = event.currentTarget;
    target.muted = false;
    target.defaultMuted = false;
    target.volume = 1;
    setPreviewVideoDuration(target.duration || 0);
    target.play().catch(() => {});
  }, []);

  const handleTimeUpdate = useCallback((event) => {
    setPreviewVideoCurrent(event.currentTarget.currentTime || 0);
  }, []);

  const handlePlay = useCallback(() => {
    setPreviewVideoPaused(false);
  }, []);

  const handlePause = useCallback(() => {
    setPreviewVideoPaused(true);
  }, []);

  const handleVolumeChange = useCallback((event) => {
    setPreviewVideoMuted(!!event.currentTarget.muted);
  }, []);

  const togglePauseResume = useCallback(() => {
    const v = previewVideoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play().catch(() => {});
      onMediaCommand?.({ type: 'play' });
    } else {
      v.pause();
      onMediaCommand?.({ type: 'pause' });
    }
  }, [onMediaCommand]);

  const stopPlayback = useCallback(() => {
    const v = previewVideoRef.current;
    if (!v) return;
    v.pause();
    v.currentTime = 0;
    setPreviewVideoCurrent(0);
    onMediaCommand?.({ type: 'pause' });
    onMediaCommand?.({ type: 'seek', value: 0 });
  }, [onMediaCommand]);

  const toggleMute = useCallback(() => {
    const v = previewVideoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setPreviewVideoMuted(v.muted);
    onMediaCommand?.({ type: 'mute', value: v.muted });
  }, [onMediaCommand]);

  return {
    previewVideoRef,
    previewVideoCurrent,
    previewVideoDuration,
    previewVideoPaused,
    previewVideoMuted,
    handleLoadedMetadata,
    handleTimeUpdate,
    handlePlay,
    handlePause,
    handleVolumeChange,
    togglePauseResume,
    stopPlayback,
    toggleMute,
  };
}
