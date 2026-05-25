import React from 'react';
import BibleBrowser from '../../BibleBrowser';
import { useQueueContext } from '../../../contexts/QueueContext';
import { useTextEditorContext } from '../../../contexts/TextEditorContext';

function BibleSection({ bibleCatalogOpenToken }) {
  const {
    activePreloadItem,
    addBibleQueueItem,
    updateSelectedQueueItem,
    projectorQueue,
    activeQueueIndex,
  } = useQueueContext();
  const { handleProjectMedia, handleOpenBackgroundPicker, biblePickedBackground } =
    useTextEditorContext();
  const activeQueueItem =
    activeQueueIndex >= 0 && activeQueueIndex < projectorQueue.length
      ? projectorQueue[activeQueueIndex]
      : null;

  return (
    <BibleBrowser
      onProjectContent={handleProjectMedia}
      onQueueContent={addBibleQueueItem}
      onUpdateActiveQueueItem={updateSelectedQueueItem}
      activePreloadItem={activePreloadItem}
      activeQueueItem={activeQueueItem}
      forceShowBibleCatalogToken={bibleCatalogOpenToken}
      onOpenBackgroundPicker={() => handleOpenBackgroundPicker('bible')}
      externalBackground={biblePickedBackground}
    />
  );
}

export default BibleSection;
