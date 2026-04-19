import { useEffect } from 'react';

function useSongSectionNavigation({
  isSongsSectionActive,
  selectedSong,
  selectedSectionIndex,
  setSelectedSectionIndex,
  parseLyrics,
  handleProjectSection,
  handleProjectBlankSection,
  sectionCardRefs,
  blankSectionCardRef,
  blankSectionIndex,
}) {
  useEffect(() => {
    if (!isSongsSectionActive) return;
    if (!selectedSong) return;
    const sections = parseLyrics(selectedSong.lyrics);
    if (selectedSectionIndex === blankSectionIndex) {
      const blankNode = blankSectionCardRef.current;
      if (!blankNode) return;
      blankNode.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      if (typeof blankNode.focus === 'function') blankNode.focus();
      return;
    }
    if (sections.length === 0) return;
    if (selectedSectionIndex < 0 || selectedSectionIndex >= sections.length) return;

    const node = sectionCardRefs.current.get(selectedSectionIndex);
    if (!node) return;
    node.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    if (typeof node.focus === 'function') node.focus();
  }, [
    isSongsSectionActive,
    selectedSong,
    selectedSectionIndex,
    parseLyrics,
    blankSectionIndex,
    blankSectionCardRef,
    sectionCardRefs,
  ]);

  useEffect(() => {
    if (!isSongsSectionActive) return;
    if (!selectedSong) return;
    const sections = parseLyrics(selectedSong.lyrics);

    const isTypingTarget = (target) => {
      if (!target || !(target instanceof HTMLElement)) return false;
      const tag = String(target.tagName || '').toLowerCase();
      return target.isContentEditable || tag === 'input' || tag === 'textarea' || tag === 'select';
    };

    const onKeyDown = (event) => {
      if (isTypingTarget(event.target)) return;
      const consumeEvent = () => {
        event.preventDefault();
        event.stopPropagation();
        if (typeof event.stopImmediatePropagation === 'function') {
          event.stopImmediatePropagation();
        }
      };
      const key = event.key;
      const goPrev = key === 'ArrowLeft' || key === 'ArrowUp' || key === 'PageUp';
      const goNext = key === 'ArrowRight' || key === 'ArrowDown' || key === 'PageDown';
      const goFirst = key === 'Home';
      const goLast = key === 'End';
      if (!goPrev && !goNext && !goFirst && !goLast) return;

      consumeEvent();
      const totalCards = sections.length + 1; // Blank + lyric sections
      if (totalCards <= 0) return;
      const toCardPos = (sectionIndex) => {
        if (sectionIndex === blankSectionIndex) return 0;
        if (sectionIndex >= 0 && sectionIndex < sections.length) return sectionIndex + 1;
        return -1;
      };
      const fromCardPos = (cardPos) => {
        if (cardPos === 0) return blankSectionIndex;
        return cardPos - 1;
      };

      const currentPos = toCardPos(selectedSectionIndex);
      let nextPos = currentPos;
      if (goFirst) {
        nextPos = 0;
      } else if (goLast) {
        nextPos = totalCards - 1;
      } else if (goPrev) {
        nextPos = currentPos <= 0 ? 0 : currentPos - 1;
      } else if (goNext) {
        nextPos = currentPos < 0 ? 0 : Math.min(totalCards - 1, currentPos + 1);
      }
      if (nextPos === currentPos) return;

      const nextIndex = fromCardPos(nextPos);
      if (nextIndex === blankSectionIndex) {
        setSelectedSectionIndex(blankSectionIndex);
        handleProjectBlankSection();
        return;
      }
      const nextSection = sections[nextIndex];
      if (!nextSection) return;
      setSelectedSectionIndex(nextIndex);
      handleProjectSection(nextSection, nextIndex);
    };

    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [
    isSongsSectionActive,
    selectedSong,
    selectedSectionIndex,
    parseLyrics,
    handleProjectSection,
    handleProjectBlankSection,
    setSelectedSectionIndex,
    blankSectionIndex,
  ]);
}

export default useSongSectionNavigation;
