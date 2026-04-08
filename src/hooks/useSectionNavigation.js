import { useCallback, useState } from 'react';

export default function useSectionNavigation({
  setActiveQueueIndex,
  setActiveSection,
  resetFreeTextEditor,
}) {
  const [songsListOpenToken, setSongsListOpenToken] = useState(0);
  const [bibleCatalogOpenToken, setBibleCatalogOpenToken] = useState(0);
  const [mediaHomeOpenToken, setMediaHomeOpenToken] = useState(0);

  const openDisplays = useCallback(() => {
    setActiveQueueIndex(-1);
    setActiveSection('displays');
  }, [setActiveQueueIndex, setActiveSection]);

  const openText = useCallback(() => {
    setActiveQueueIndex(-1);
    resetFreeTextEditor();
    setActiveSection('text');
  }, [setActiveQueueIndex, setActiveSection, resetFreeTextEditor]);

  const openSongs = useCallback(() => {
    setActiveQueueIndex(-1);
    setSongsListOpenToken(Date.now());
    setActiveSection('songs');
  }, [setActiveQueueIndex, setActiveSection]);

  const openBible = useCallback(() => {
    setActiveQueueIndex(-1);
    setBibleCatalogOpenToken(Date.now());
    setActiveSection('bible');
  }, [setActiveQueueIndex, setActiveSection]);

  const openMedia = useCallback(() => {
    setActiveQueueIndex(-1);
    setMediaHomeOpenToken(Date.now());
    setActiveSection('media');
  }, [setActiveQueueIndex, setActiveSection]);

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
