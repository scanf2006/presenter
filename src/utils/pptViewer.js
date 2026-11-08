// The PowerPoint conversion and slide view, as one state machine.
//
// This was five independent `useState` values in MediaManager: whether a
// conversion is running, the error from the last one, the converted slides, the
// source path, and which slide is showing. Set separately, they could disagree:
//
//   * starting a conversion set the new source path and the converting flag but
//     left the PREVIOUS document's slides and slide index in place, so while
//     document B converted, the view showed A's slides labelled as B;
//   * opening a PDF cleared the slides but not the slide index, the error or
//     the source path, so a failed conversion's error could sit on screen
//     while a PDF was being viewed;
//   * nothing bounded the slide index, so it could point past the end of a
//     shorter deck after switching documents.
//
// Only one document is open at a time, so every entry point here clears what
// belonged to the last one.

export const initialPptViewer = {
  /** 'idle' | 'converting' | 'ready' | 'failed' */
  status: 'idle',
  sourcePath: '',
  error: '',
  slides: null,
  /** -1 means "the deck is open but no slide is projected yet". */
  slideIndex: -1,
};

export function pptViewerReducer(state, action) {
  switch (action?.type) {
    /** A conversion begins: nothing from the previous document survives. */
    case 'convertStarted': {
      return {
        ...initialPptViewer,
        status: 'converting',
        sourcePath: action.sourcePath || '',
      };
    }

    case 'convertSucceeded': {
      const slides = Array.isArray(action.slides) ? action.slides : [];
      if (slides.length === 0) {
        // A deck that converts to nothing is a failure, not an empty success.
        return { ...state, status: 'failed', slides: null, slideIndex: -1 };
      }
      return { ...state, status: 'ready', error: '', slides, slideIndex: -1 };
    }

    /**
     * A failure drops the source path, because there is no document to show
     * any more. `error` is empty for a timeout, which is reported by a toast
     * instead of inline.
     */
    case 'convertFailed': {
      return {
        ...initialPptViewer,
        status: 'failed',
        error: action.error || '',
      };
    }

    case 'selectSlide': {
      const total = Array.isArray(state.slides) ? state.slides.length : 0;
      // `Number(null)` is 0, so a null index would otherwise read as "project
      // the first slide" rather than as the nonsense it is.
      if (typeof action.index !== 'number' && typeof action.index !== 'string') return state;
      const requested = Number(action.index);
      if (!Number.isFinite(requested)) return state;
      // Clamped rather than trusted: an index from a previous, longer deck
      // would otherwise point past the end of this one.
      const index = total === 0 ? -1 : Math.min(Math.max(Math.trunc(requested), -1), total - 1);
      if (index === state.slideIndex) return state;
      return { ...state, slideIndex: index };
    }

    /** The deck is put away, by closing it or by opening something else. */
    case 'close': {
      if (
        state.status === initialPptViewer.status &&
        state.slides === null &&
        state.slideIndex === -1 &&
        state.error === '' &&
        state.sourcePath === ''
      ) {
        return state;
      }
      return { ...initialPptViewer };
    }

    default:
      return state;
  }
}

/** True while a conversion is running, for the spinner. */
export function isPptConverting(state) {
  return state?.status === 'converting';
}

/** True when there is a deck to show. */
export function hasPptSlides(state) {
  return Array.isArray(state?.slides) && state.slides.length > 0;
}

export default pptViewerReducer;
