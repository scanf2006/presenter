import React from 'react';
import BibleBrowser from '../../BibleBrowser';
import { useQueueContext } from '../../../contexts/QueueContext';
import { useTextEditorContext } from '../../../contexts/TextEditorContext';

function BibleSection({ bibleCatalogOpenToken }) {
  const { activePreloadItem, addBibleQueueItem, updateSelectedQueueItem } = useQueueContext();
  const { handleProjectMedia, handleOpenBackgroundPicker, biblePickedBackground } =
    useTextEditorContext();

  return (
    <BibleBrowser
      onProjectContent={handleProjectMedia}
      onQueueContent={addBibleQueueItem}
      onUpdateActiveQueueItem={updateSelectedQueueItem}
      activePreloadItem={activePreloadItem}
      forceShowBibleCatalogToken={bibleCatalogOpenToken}
      onOpenBackgroundPicker={() => handleOpenBackgroundPicker('bible')}
      externalBackground={biblePickedBackground}
    />
  );
}

export default BibleSection;
