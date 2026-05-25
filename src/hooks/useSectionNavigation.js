import { useCallback, useState } from 'react';

export default function useSectionNavigation({
  setActiveQueueIndex,
  setActivePreloadItem,
  setActiveSection,
  resetFreeTextEditor,
}) {
  const [songsListOpenToken, setSongsListOpenToken] = useState(0);
  const [bibleCatalogOpenToken, setBibleCatalogOpenToken] = useState(0);
  const [mediaHomeOpenToken, setMediaHomeOpenToken] = useState(0);

  const openDisplays = useCallback(() => {
    setActivePreloadItem(null);
    setActiveQueueIndex(-1);
    setActiveSection('displays');
  }, [setActivePreloadItem, setActiveQueueIndex, setActiveSection]);

  const openText = useCallback(() => {
    setActivePreloadItem(null);
    setActiveQueueIndex(-1);
    resetFreeTextEditor();
    setActiveSection('text');
  }, [setActivePreloadItem, setActiveQueueIndex, setActiveSection, resetFreeTextEditor]);

  const openSongs = useCallback(() => {
    setActivePreloadItem(null);
    setActiveQueueIndex(-1);
    setSongsListOpenToken(Date.now());
    setActiveSection('songs');
  }, [setActivePreloadItem, setActiveQueueIndex, setActiveSection]);

  const openBible = useCallback(() => {
    setActivePreloadItem(null);
    setActiveQueueIndex(-1);
    setBibleCatalogOpenToken(Date.now());
    setActiveSection('bible');
  }, [setActivePreloadItem, setActiveQueueIndex, setActiveSection]);

  const openMedia = useCallback(() => {
    setActivePreloadItem(null);
    setActiveQueueIndex(-1);
    setMediaHomeOpenToken(Date.now());
    setActiveSection('media');
  }, [setActivePreloadItem, setActiveQueueIndex, setActiveSection]);

  return {
    songsListOpenToken,
    bibleCatalogOpenToken,
    mediaHomeOpenToken,
    openDisplays,
    openText,
    openSongs,
    openBible,
    openMedia,
  };
}
