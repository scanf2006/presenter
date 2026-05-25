import React from 'react';
import SongManager from '../../SongManager';
import { useQueueContext } from '../../../contexts/QueueContext';
import { useTextEditorContext } from '../../../contexts/TextEditorContext';

function SongsSection({ songsListOpenToken }) {
  const {
    activePreloadItem,
    addSongQueueItem,
    updateSelectedQueueItem,
    projectorQueue,
    activeQueueIndex,
  } = useQueueContext();
  const { handleProjectMedia, handleOpenBackgroundPicker, songPickedBackground } =
    useTextEditorContext();
  const activeQueueItem =
    activeQueueIndex >= 0 && activeQueueIndex < projectorQueue.length
      ? projectorQueue[activeQueueIndex]
      : null;

  return (
    <SongManager
      onProjectContent={handleProjectMedia}
      onQueueContent={addSongQueueItem}
      onUpdateActiveQueueItem={updateSelectedQueueItem}
      activePreloadItem={activePreloadItem}
      activeQueueItem={activeQueueItem}
      onOpenBackgroundPicker={() => handleOpenBackgroundPicker('songs')}
      externalBackground={songPickedBackground}
      forceShowSongListToken={songsListOpenToken}
    />
  );
}

export default SongsSection;
