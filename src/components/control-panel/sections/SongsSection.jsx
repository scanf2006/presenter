import React from 'react';
import SongManager from '../../SongManager';
import { useQueueContext } from '../../../contexts/QueueContext';
import { useTextEditorContext } from '../../../contexts/TextEditorContext';

function SongsSection({ songsListOpenToken }) {
  const { activePreloadItem, addSongQueueItem, updateSelectedQueueItem } = useQueueContext();
  const { handleProjectMedia, handleOpenBackgroundPicker, songPickedBackground } =
    useTextEditorContext();

  return (
    <SongManager
      onProjectContent={handleProjectMedia}
      onQueueContent={addSongQueueItem}
      onUpdateActiveQueueItem={updateSelectedQueueItem}
      activePreloadItem={activePreloadItem}
      onOpenBackgroundPicker={() => handleOpenBackgroundPicker('songs')}
      externalBackground={songPickedBackground}
      forceShowSongListToken={songsListOpenToken}
    />
  );
}

export default SongsSection;
