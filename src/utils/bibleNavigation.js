// Where you are in the Bible, as one state machine.
//
// This was six independent `useState` values in BibleBrowser: version, book,
// chapter, the loaded verses, the verse selection, and the context stamp that
// says which chapter the loaded verses belong to. Each was set on its own, and
// the combinations did not always agree:
//
//   * picking a new book cleared the verses but left the verse SELECTION from
//     the previous chapter;
//   * picking a new chapter left the selection too;
//   * going back to the catalogue left the chapter and verses behind;
//   * switching translation reset nothing at all.
//
// None of that was reliably visible, because the effects that follow usually
// reload and overwrite the stale parts. That is the fragility: correctness
// depended on effect ordering rather than on the transition itself.
//
// The rule this encodes: a verse selection, the loaded verses and the context
// stamp only mean something inside one chapter of one translation. Anything
// that changes the translation, the book or the chapter drops all three.

export const DEFAULT_BIBLE_VERSION = 'cuvs';

export const initialBibleNavigation = {
  version: DEFAULT_BIBLE_VERSION,
  selectedBook: null,
  selectedChapter: null,
  verses: [],
  selectedVerses: [],
  versesContext: null,
};

/** Everything that is only meaningful within the current chapter. */
const CHAPTER_SCOPED = {
  verses: [],
  selectedVerses: [],
  versesContext: null,
};

export function bibleNavigationReducer(state, action) {
  switch (action?.type) {
    case 'setVersion': {
      if (!action.version || action.version === state.version) return state;
      // A different translation means different text for the same reference, so
      // nothing loaded for the old one survives.
      return { ...state, ...CHAPTER_SCOPED, version: action.version };
    }

    case 'selectBook': {
      if (!action.book) return state;
      const same = state.selectedBook?.sn === action.book.sn;
      if (same && state.selectedChapter === null) return state;
      return {
        ...state,
        ...CHAPTER_SCOPED,
        selectedBook: action.book,
        selectedChapter: null,
      };
    }

    case 'clearBook': {
      if (state.selectedBook === null && state.selectedChapter === null) return state;
      return { ...state, ...CHAPTER_SCOPED, selectedBook: null, selectedChapter: null };
    }

    case 'selectChapter': {
      const chapter = action.chapter;
      if (chapter === null || chapter === undefined) return state;
      if (state.selectedChapter === chapter) return state;
      return { ...state, ...CHAPTER_SCOPED, selectedChapter: chapter };
    }

    case 'clearChapter': {
      if (state.selectedChapter === null) return state;
      return { ...state, ...CHAPTER_SCOPED, selectedChapter: null };
    }

    /** Book and chapter at once, for a search hit or a queued item. */
    case 'jumpTo': {
      if (!action.book) return state;
      return {
        ...state,
        ...CHAPTER_SCOPED,
        selectedBook: action.book,
        selectedChapter: action.chapter ?? null,
      };
    }

    case 'versesLoading': {
      return { ...state, ...CHAPTER_SCOPED };
    }

    case 'versesLoaded': {
      return {
        ...state,
        verses: Array.isArray(action.verses) ? action.verses : [],
        versesContext: action.context ?? null,
      };
    }

    /** Keeps the placeholder rows the caller supplies, so the UI can explain. */
    case 'versesFailed': {
      return {
        ...state,
        verses: Array.isArray(action.verses) ? action.verses : [],
        selectedVerses: [],
        versesContext: action.context ?? null,
      };
    }

    case 'setSelectedVerses': {
      return {
        ...state,
        selectedVerses: Array.isArray(action.verses) ? action.verses : [],
      };
    }

    /**
     * Adds or removes one verse, keeping the selection in verse order.
     *
     * Order matters beyond looks: the projected reference is built from the
     * first and last entries, so an out-of-order selection would read as the
     * wrong range.
     */
    case 'toggleVerse': {
      const verse = action.verse;
      if (!verse || typeof verse.verse !== 'number') return state;
      const existing = state.selectedVerses.some((item) => item.verse === verse.verse);
      const selectedVerses = existing
        ? state.selectedVerses.filter((item) => item.verse !== verse.verse)
        : [...state.selectedVerses, verse].sort((left, right) => left.verse - right.verse);
      return { ...state, selectedVerses };
    }

    case 'clearSelectedVerses': {
      if (state.selectedVerses.length === 0) return state;
      return { ...state, selectedVerses: [] };
    }

    case 'reset': {
      return { ...initialBibleNavigation, version: state.version };
    }

    default:
      return state;
  }
}

/**
 * True when the loaded verses belong to where the user currently is. Reading
 * `verses` without checking this is how the previous chapter's text can be
 * shown for a frame after a jump.
 */
export function versesMatchSelection(state) {
  const context = state?.versesContext;
  if (!context) return false;
  return context.bookSn === state.selectedBook?.sn && context.chapter === state.selectedChapter;
}

export default bibleNavigationReducer;
