import { useCallback, useState } from 'react';

export default function useBackgroundPickerFlow({
  setActiveSection,
  setTextBackground,
}) {
  const [backgroundPickerTarget, setBackgroundPickerTarget] = useState(null);
  const [songPickedBackground, setSongPickedBackground] = useState(null);
  const [biblePickedBackground, setBiblePickedBackground] = useState(null);

  const openBackgroundPicker = useCallback((target) => {
    setBackgroundPickerTarget(target);
    setActiveSection('media');
  }, [setActiveSection]);

  const pickBackgroundFromMedia = useCallback((bg) => {
    if (!bg || !backgroundPickerTarget) return;
    if (backgroundPickerTarget === 'songs') {
      setSongPickedBackground({
        ...bg,
        pickToken: Date.now(),
      });
      setActiveSection('songs');
    } else if (backgroundPickerTarget === 'bible') {
      setBiblePickedBackground(bg);
      setActiveSection('bible');
    } else if (backgroundPickerTarget === 'text') {
      setTextBackground(bg);
      setActiveSection('text');
    }
    setBackgroundPickerTarget(null);
  }, [backgroundPickerTarget, setActiveSection, setTextBackground]);

  const cancelBackgroundPicker = useCallback(() => {
    if (backgroundPickerTarget === 'songs') setActiveSection('songs');
    if (backgroundPickerTarget === 'bible') setActiveSection('bible');
    if (backgroundPickerTarget === 'text') setActiveSection('text');
    setBackgroundPickerTarget(null);
  }, [backgroundPickerTarget, setActiveSection]);

  return {
    backgroundPickerTarget,
    songPickedBackground,
    biblePickedBackground,
    openBackgroundPicker,
    pickBackgroundFromMedia,
    cancelBackgroundPicker,
  };
}
