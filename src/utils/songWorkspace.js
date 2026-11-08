// The song screen's two pieces of state, each as a small state machine.
//
// Unlike the bible and PPT consolidations, the live bugs here are mild: every
// path that OPENS the editor or SELECTS a song already set all of its fields.
// What was incomplete was the closing: `setEditingSong(null)` on its own left
// the three form fields populated, and `setSelectedSong(null)` on its own left
// the section index pointing at a section of a song that is no longer open.
//
// Nothing visibly broke, because the editor and the section list are only
// rendered when their subject exists. But the invariant held only as long as
// every one of the eight call sites remembered to do the full set, which is the
// kind of thing that holds until someone adds a ninth. It now holds by
// construction.

// ── The editor ──────────────────────────────────────────────────────────────

export const initialSongEditor = {
  /** null when closed; `{ id: null }` while composing a new song. */
  song: null,
  title: '',
  author: '',
  lyrics: '',
};

export function songEditorReducer(state, action) {
  switch (action?.type) {
    /** A blank song, with whatever starter text the caller supplies. */
    case 'openNew': {
      return { song: { id: null }, title: '', author: '', lyrics: action.lyrics || '' };
    }

    case 'openExisting': {
      if (!action.song) return state;
      return {
        song: action.song,
        title: action.song.title || '',
        author: action.song.author || '',
        lyrics: action.song.lyrics || '',
      };
    }

    /** A song fetched from the web: new, but with its text already filled in. */
    case 'openImported': {
      return {
        song: { id: null },
        title: action.title || '',
        author: action.author || '',
        lyrics: action.lyrics || '',
      };
    }

    case 'setField': {
      const { field, value } = action;
      if (field !== 'title' && field !== 'author' && field !== 'lyrics') return state;
      if (state[field] === value) return state;
      return { ...state, [field]: String(value ?? '') };
    }

    /**
     * Closing drops the text as well as the subject. Leaving it behind meant
     * the next entry point had to overwrite all three fields to avoid showing
     * the last edit's content.
     */
    case 'close': {
      if (state.song === null && state.title === '' && state.author === '' && state.lyrics === '') {
        return state;
      }
      return { ...initialSongEditor };
    }

    default:
      return state;
  }
}

export function isEditorOpen(state) {
  return Boolean(state?.song);
}

/** True while composing a song that has never been saved. */
export function isEditingNewSong(state) {
  return Boolean(state?.song) && state.song.id === null;
}

// ── The selection shown on screen ───────────────────────────────────────────

/** No section chosen yet. */
export const NO_SECTION = -1;
/** The "blank" card, which projects an empty slide on the song's background. */
export const BLANK_SECTION = -2;

export const initialSongSelection = {
  song: null,
  sectionIndex: NO_SECTION,
};

export function songSelectionReducer(state, action) {
  switch (action?.type) {
    /**
     * Opening a different song starts with no section chosen: a section number
     * only means something within the song it came from, and the next song may
     * be shorter.
     */
    case 'selectSong': {
      if (!action.song) return state;
      return { song: action.song, sectionIndex: NO_SECTION };
    }

    /**
     * The same song with changed data - a saved style or background. The
     * section stays, since the reader is still looking at it.
     */
    case 'updateSong': {
      if (!action.song) return state;
      if (!state.song || state.song.id !== action.song.id) {
        // A different song arriving through this action would silently keep a
        // section index from the previous one, so treat it as a selection.
        return { song: action.song, sectionIndex: NO_SECTION };
      }
      return { ...state, song: action.song };
    }

    case 'clearSong': {
      if (state.song === null && state.sectionIndex === NO_SECTION) return state;
      return { ...initialSongSelection };
    }

    /** Clears the selection if the song that went away was the one shown. */
    case 'songRemoved': {
      if (!state.song || state.song.id !== action.songId) return state;
      return { ...initialSongSelection };
    }

    case 'selectSection': {
      const index = action.index;
      if (typeof index !== 'number' || !Number.isInteger(index)) return state;
      if (index < BLANK_SECTION) return state;
      if (index === state.sectionIndex) return state;
      return { ...state, sectionIndex: index };
    }

    default:
      return state;
  }
}

export default songEditorReducer;
