import React from 'react';
import MediaManager from '../../MediaManager';
import { useQueueContext } from '../../../contexts/QueueContext';
import { useTextEditorContext } from '../../../contexts/TextEditorContext';

function MediaSection({ mediaHomeOpenToken }) {
  const { activePreloadItem } = useQueueContext();
  const {
    handleProjectMedia,
    handleAddPlaylistItem,
    backgroundPickerTarget,
    handlePickBackgroundFromMedia,
    handleCancelBackgroundPicker,
  } = useTextEditorContext();

  return (
    <MediaManager
      onProjectMedia={handleProjectMedia}
      onAddPlaylist={handleAddPlaylistItem}
      activePreloadItem={activePreloadItem}
      forceShowMediaHomeToken={mediaHomeOpenToken}
      backgroundPickerTarget={backgroundPickerTarget}
      onPickBackground={handlePickBackgroundFromMedia}
      onCancelBackgroundPick={handleCancelBackgroundPicker}
    />
  );
}

export default MediaSection;
