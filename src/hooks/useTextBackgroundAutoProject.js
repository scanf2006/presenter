import { useEffect, useRef } from 'react';

export default function useTextBackgroundAutoProject({
  activeSection,
  textContent,
  currentSlide,
  textBackground,
  handleSendToProjector,
}) {
  const sendToProjectorRef = useRef(handleSendToProjector);
  const activeSectionRef = useRef(activeSection);
  const textContentRef = useRef(textContent);
  const currentSlideRef = useRef(currentSlide);

  useEffect(() => {
    sendToProjectorRef.current = handleSendToProjector;
  }, [handleSendToProjector]);

  useEffect(() => {
    activeSectionRef.current = activeSection;
  }, [activeSection]);

  useEffect(() => {
    textContentRef.current = textContent;
  }, [textContent]);

  useEffect(() => {
    currentSlideRef.current = currentSlide;
  }, [currentSlide]);

  useEffect(() => {
    if (
      activeSectionRef.current === 'text' &&
      textContentRef.current.trim() &&
      currentSlideRef.current?.type === 'text'
    ) {
      sendToProjectorRef.current();
    }
  }, [textBackground]);
}
