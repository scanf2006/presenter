import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable react-hooks/exhaustive-deps */

import {
  getSelectableThumbCardStyle,
  getSelectableThumbIndexStyle,
  getSelectableThumbSelectedTagStyle,
} from '../utils/thumbnail';
import {
  buildSongBackgroundFromSong,
  buildSongSaveInput,
  buildSongStyleFromSong,
  buildSongQueuePayload,
  decodeLyricsImportBytes,
  deriveSongTitleFromImportFile,
  mergeSongWithBackground,
  normalizeImportedLyrics,
  parseSongLyricsSections,
} from '../utils/songMeta';
import useSongSectionNavigation from '../hooks/useSongSectionNavigation';
import { useAppContext } from '../contexts/AppContext';
import { useI18n } from '../contexts/I18nContext';
import { PROJECTION_FONT_OPTIONS } from '../constants/fontOptions';
const BLANK_SECTION_INDEX = -2;
const SONG_STYLE_DEFAULTS = {
  fontSize: 'large',
  fontSizePx: 72,
  fontFamily: 'Noto Sans SC',
  fontWeight: 700,
  textColor: '#ffffff',
};

/**
 * 诗歌歌词管理组件
 * Supports song management, section editing, projection and lyrics import.
 */
function SongManager({
  onProjectContent,
  onQueueContent,
  onUpdateActiveQueueItem,
  activePreloadItem,
  activeQueueItem,
  onOpenBackgroundPicker,
  externalBackground,
  backgroundPickContext,
  forceShowSongListToken,
}) {
  // 歌曲列表
  const [songs, setSongs] = useState([]);
  // current editing song
  const [editingSong, setEditingSong] = useState(null);
  // current selected song (view mode)
  const [selectedSong, setSelectedSong] = useState(null);
  // 编辑表单
  const [formTitle, setFormTitle] = useState('');
  const [formAuthor, setFormAuthor] = useState('');
  const [formLyrics, setFormLyrics] = useState('');
  // 投屏字号
  const [fontSize, setFontSize] = useState('large');
  const [fontSizePx, setFontSizePx] = useState(72);
  const [fontFamily, setFontFamily] = useState('Noto Sans SC');
  const [isBold, setIsBold] = useState(true);
  const [textColor, setTextColor] = useState('#ffffff');
  const [songBackground, setSongBackground] = useState(null);
  const [selectedSectionIndex, setSelectedSectionIndex] = useState(-1);
  // 搜索
  const [searchQuery, setSearchQuery] = useState('');
  const [webSearchResults, setWebSearchResults] = useState([]);
  const [webSearching, setWebSearching] = useState(false);
  const [webImportUrl, setWebImportUrl] = useState('');
  // Keep projection-selection continuity:
  // when background changes, we can re-project the last section with new background.
  const lastProjectedSectionRef = useRef(null);
  const lastAppliedExternalPickRef = useRef(null);
  const lastHandledPreloadRef = useRef(null);
  const backgroundPersistSeqBySongRef = useRef(new Map());
  const sectionCardRefs = useRef(new Map());
  const blankSectionCardRef = useRef(null);

  const isElectron = typeof window.churchDisplay !== 'undefined';
  const fileInputRef = useRef(null);
  const { showToast, showConfirm, activeSection } = useAppContext();
  const { t } = useI18n();
  const isSongsSectionActive = activeSection === 'songs';

  const canSyncActiveQueueSong = useCallback(
    (song) => {
      if (!song?.id || !activeQueueItem) return false;
      const payload = activeQueueItem.payload || {};
      if (String(payload.type || activeQueueItem.type || '') !== 'song') return false;
      return Number(payload.songId) === Number(song.id);
    },
    [activeQueueItem]
  );

  const applySongStyle = useCallback((style) => {
    if (!style) return;
    const nextFontSize =
      style.fontSize === 'small' || style.fontSize === 'medium' || style.fontSize === 'large'
        ? style.fontSize
        : SONG_STYLE_DEFAULTS.fontSize;
    setFontSize(nextFontSize);
    setFontSizePx(Math.max(24, Math.min(180, Number(style.fontSizePx || SONG_STYLE_DEFAULTS.fontSizePx))));
    setFontFamily(style.fontFamily || SONG_STYLE_DEFAULTS.fontFamily);
    setIsBold(Number(style.fontWeight || SONG_STYLE_DEFAULTS.fontWeight) >= 600);
    setTextColor(style.textColor || SONG_STYLE_DEFAULTS.textColor);
  }, []);

  // 加载歌曲列表
  const loadSongs = useCallback(async () => {
    if (isElectron) {
      const list = await window.churchDisplay.songsList();
      setSongs(list);
    } else {
      // Browser fallback demo data
      setSongs([
        {
          id: 1,
          title: '奇异恩典',
          author: 'John Newton',
          lyrics:
            '[V1]\n奇异恩典 何等甘甜\n我罪已得赦免\n前我失丧 今被寻回\n瞎眼今得看见\n\n[V2]\n如此恩典 使我敬畏\n使我心得安慰\n初信之时 即蒙恩惠\n真是何等宝贵\n\n[C]\n赞美主，赞美主\n奇异恩典 何等甘甜',
          backgroundType: '',
          backgroundPath: '',
        },
        {
          id: 2,
          title: '感谢神',
          author: '',
          lyrics: '[V1]\n感谢神 赐我救赎主\n感谢神 丰富预备\n感谢神 过去的同在\n感谢神 主在我旁',
          backgroundType: '',
          backgroundPath: '',
        },
      ]);
    }
  }, [isElectron]);

  useEffect(() => {
    loadSongs();
  }, [loadSongs]);

  const parseLyrics = parseSongLyricsSections;

  // 保存歌曲
  const handleSave = useCallback(async () => {
    if (!formTitle.trim() || !formLyrics.trim()) {
      showToast(t('songs.enterTitleLyrics', 'Please enter song title and lyrics'), 'warning');
      return;
    }
    const song = {
      id: editingSong?.id || null,
      title: formTitle.trim(),
      author: formAuthor.trim(),
      lyrics: formLyrics.trim(),
      backgroundType: songBackground?.type || '',
      backgroundPath: songBackground?.path || '',
      songStyle: {
        fontSize,
        fontSizePx,
        fontFamily,
        fontWeight: isBold ? 700 : 400,
        textColor,
      },
    };
    try {
      if (isElectron) {
        await window.churchDisplay.songsSave(song);
      }
    } catch (err) {
      console.warn('[SongManager] save failed:', err?.message || err);
    }
    setEditingSong(null);
    setSelectedSong(null);
    setSelectedSectionIndex(-1);
    setFormTitle('');
    setFormAuthor('');
    setFormLyrics('');
    setSongBackground(null);
    await loadSongs();
  }, [
    editingSong,
    formTitle,
    formAuthor,
    formLyrics,
    songBackground,
    fontSize,
    fontSizePx,
    fontFamily,
    isBold,
    textColor,
    isElectron,
    loadSongs,
    showToast,
  ]);

  // 删除歌曲
  const handleDelete = useCallback(
    async (songId) => {
      if (!(await showConfirm(t('songs.deleteConfirm', 'Delete this song?')))) return;
      try {
        if (isElectron) {
          await window.churchDisplay.songsDelete(songId);
        }
      } catch (err) {
        console.warn('[SongManager] delete failed:', err?.message || err);
      }
      if (selectedSong?.id === songId) setSelectedSong(null);
      await loadSongs();
    },
    [isElectron, selectedSong, loadSongs, showConfirm]
  );

  // start editing
  const handleEdit = (song) => {
    setEditingSong(song);
    setFormTitle(song.title);
    setFormAuthor(song.author || '');
    setFormLyrics(song.lyrics);
    setSongBackground(buildSongBackgroundFromSong(song));
    applySongStyle(buildSongStyleFromSong(song));
    setSelectedSong(null);
  };

  // 新建歌曲
  const handleNew = () => {
    setEditingSong({ id: null });
    setFormTitle('');
    setFormAuthor('');
    setFormLyrics(
      t(
        'songs.defaultTemplate',
        '(Enter first section)\n(Continue lines in same section)\n\n(Blank line starts next section)'
      )
    );
    setSongBackground(null);
    setSelectedSong(null);
  };

  const buildSelectedSongQueuePayload = useCallback(
    (song, section = null, sectionIndex = null) => {
      return buildSongQueuePayload({
        song,
        background: songBackground,
        section,
        sectionIndex,
        style: {
          fontSize,
          fontSizePx,
          fontFamily,
          fontWeight: isBold ? 700 : 400,
          textColor,
        },
      });
    },
    [songBackground, fontSize, fontSizePx, fontFamily, isBold, textColor]
  );

  // Project one section (lyrics text only)
  const handleProjectSection = useCallback(
    (section, sectionIndex = null) => {
      const payload = {
        type: 'lyrics',
        text: section.lines.join('\n'),
        fontSize,
        fontSizePx,
        fontFamily,
        fontWeight: isBold ? 700 : 400,
        textColor,
        background: songBackground,
      };
      lastProjectedSectionRef.current = { section };
      onProjectContent(payload);
      if (
        selectedSong &&
        typeof onUpdateActiveQueueItem === 'function' &&
        canSyncActiveQueueSong(selectedSong)
      ) {
        const queuePayload = buildSelectedSongQueuePayload(selectedSong, section, sectionIndex);
        if (queuePayload) {
          onUpdateActiveQueueItem(queuePayload, selectedSong.title, 'songs');
        }
      }
    },
    [
      fontSize,
        fontSizePx,
        fontFamily,
        isBold,
        textColor,
        onProjectContent,
      songBackground,
      selectedSong,
      onUpdateActiveQueueItem,
      buildSelectedSongQueuePayload,
      canSyncActiveQueueSong,
    ]
  );

  // Project a blank lyrics page (background only, no text).
  const handleProjectBlankSection = useCallback(() => {
      const payload = {
        type: 'lyrics',
        text: '',
        fontSize,
        fontSizePx,
        fontFamily,
        fontWeight: isBold ? 700 : 400,
        textColor,
        background: songBackground,
      };
    lastProjectedSectionRef.current = {
      section: {
        tag: 'BLANK',
        title: 'Blank',
        lines: [],
      },
    };
    onProjectContent(payload);
    if (
      selectedSong &&
      typeof onUpdateActiveQueueItem === 'function' &&
      canSyncActiveQueueSong(selectedSong)
    ) {
      const queuePayload = buildSelectedSongQueuePayload(selectedSong, {
        tag: 'BLANK',
        title: 'Blank',
        lines: [],
      });
      if (queuePayload) {
        onUpdateActiveQueueItem(queuePayload, selectedSong.title, 'songs');
      }
    }
  }, [
    fontSize,
    fontSizePx,
    fontFamily,
    isBold,
    textColor,
    onProjectContent,
    songBackground,
    selectedSong,
    onUpdateActiveQueueItem,
    buildSelectedSongQueuePayload,
    canSyncActiveQueueSong,
  ]);

  useSongSectionNavigation({
    isSongsSectionActive,
    selectedSong,
    selectedSectionIndex,
    setSelectedSectionIndex,
    parseLyrics,
    handleProjectSection,
    handleProjectBlankSection,
    sectionCardRefs,
    blankSectionCardRef,
    blankSectionIndex: BLANK_SECTION_INDEX,
  });

  const handleQueueSong = useCallback(
    (song) => {
      if (typeof onQueueContent !== 'function' || !song) return;
      const savedStyle = buildSongStyleFromSong(song);
      const payload = buildSongQueuePayload({
        song,
        background: buildSongBackgroundFromSong(song),
        style: savedStyle || SONG_STYLE_DEFAULTS,
      });
      onQueueContent(payload, song.title);
    },
    [onQueueContent]
  );

  const openSongWithoutAutoProject = useCallback((song) => {
    if (!song) return;
    lastProjectedSectionRef.current = null;
    setSelectedSectionIndex(-1);
    setEditingSong(null);
    setSelectedSong(song);
    setSongBackground(buildSongBackgroundFromSong(song));
    applySongStyle(buildSongStyleFromSong(song));
  }, [applySongStyle]);

  useEffect(() => {
    // Do not interrupt editor mode while user is creating/editing a song.
    if (editingSong) return;
    if (!activePreloadItem || activePreloadItem.type !== 'song') return;
    const preloadPayload = activePreloadItem.payload || {};
    const targetSongId = preloadPayload.songId;
    if (!targetSongId) return;
    // Avoid re-opening the same song after save/delete triggers a songs or editingSong change.
    const preloadKey = `${targetSongId}|${activePreloadItem.token || ''}`;
    if (lastHandledPreloadRef.current === preloadKey) return;
    lastHandledPreloadRef.current = preloadKey;
    const target = songs.find((s) => s.id === targetSongId);
    if (target) {
      const preloadStyle = preloadPayload.songStyle || null;
      openSongWithoutAutoProject(target);
      if (preloadStyle) applySongStyle(preloadStyle);
    }
  }, [activePreloadItem, songs, editingSong, openSongWithoutAutoProject, applySongStyle]);

  useEffect(() => {
    if (!selectedSong) return;
    // Switch song should not auto-project last section from previous song.
    lastProjectedSectionRef.current = null;
    setSelectedSectionIndex(-1);
    setSongBackground(buildSongBackgroundFromSong(selectedSong));
  }, [selectedSong?.id]);

  useEffect(() => {
    if (!forceShowSongListToken) return;
    // User explicitly clicked Songs menu: always return to songs list view.
    setSelectedSong(null);
    setEditingSong(null);
    setSelectedSectionIndex(-1);
    lastProjectedSectionRef.current = null;
    lastHandledPreloadRef.current = null;
  }, [forceShowSongListToken]);

  // Keep refs in sync via effects to avoid stale-closure: the background-change
  // effect fires only when songBackground changes, but needs the latest values.
  const handleProjectSectionRef = useRef(handleProjectSection);
  const selectedSongRef = useRef(selectedSong);
  useEffect(() => {
    handleProjectSectionRef.current = handleProjectSection;
  }, [handleProjectSection]);
  useEffect(() => {
    selectedSongRef.current = selectedSong;
  }, [selectedSong]);

  useEffect(() => {
    if (selectedSongRef.current && lastProjectedSectionRef.current) {
      handleProjectSectionRef.current(lastProjectedSectionRef.current.section);
    }
  }, [songBackground]);

  useEffect(() => {
    if (!selectedSong || editingSong) return;
    const style = {
      fontSize,
      fontSizePx,
      fontFamily,
      fontWeight: isBold ? 700 : 400,
      textColor,
    };
    const saved = buildSongStyleFromSong(selectedSong);
    if (JSON.stringify(saved || null) === JSON.stringify(style)) return;
    const nextSong = { ...selectedSong, songStyle: style };
    setSelectedSong(nextSong);
    setSongs((prev) => prev.map((s) => (s.id === nextSong.id ? { ...s, songStyle: style } : s)));

    if (!isElectron) return;
    const saveInput = buildSongSaveInput(nextSong);
    if (!saveInput) return;
    window.churchDisplay.songsSave(saveInput).catch((err) => {
      console.warn('[SongManager] persist song style failed:', err?.message || err);
    });
  }, [selectedSong?.id, editingSong, fontSize, fontSizePx, fontFamily, isBold, textColor, isElectron]);

  // Keep active song queue card style in sync with current controls.
  // This lets different queue cards preserve their own font family/size/color settings.
  useEffect(() => {
    if (!selectedSong) return;
    if (typeof onUpdateActiveQueueItem !== 'function') return;
    if (!canSyncActiveQueueSong(selectedSong)) return;
    const queuePayload = buildSongQueuePayload({
      song: selectedSong,
      background: songBackground,
      section: null,
      sectionIndex: null,
      style: {
        fontSize,
        fontSizePx,
        fontFamily,
        fontWeight: isBold ? 700 : 400,
        textColor,
      },
    });
    onUpdateActiveQueueItem(queuePayload, selectedSong.title, 'songs', { silent: true });
  }, [
    selectedSong?.id,
    selectedSong?.title,
    songBackground?.type,
    songBackground?.path,
    fontSize,
    fontSizePx,
    fontFamily,
    isBold,
    textColor,
    onUpdateActiveQueueItem,
    canSyncActiveQueueSong,
  ]);

  const persistSongBackground = useCallback(
    async (song, bg, options = {}) => {
      if (!song) return null;
      const nextSong = mergeSongWithBackground(song, bg);
      const persistKey = String(nextSong.id || '__new__');
      const nextSeq = (backgroundPersistSeqBySongRef.current.get(persistKey) || 0) + 1;
      backgroundPersistSeqBySongRef.current.set(persistKey, nextSeq);
      // Options allow reuse in both selected-song and picker-song paths
      // without forking logic into separate near-duplicate functions.
      const syncSelectedSong = options.syncSelectedSong !== false;
      const syncSongBackground = options.syncSongBackground !== false;
      const nextSongWithStyle = {
        ...nextSong,
        songStyle: {
          fontSize,
          fontSizePx,
          fontFamily,
          fontWeight: isBold ? 700 : 400,
          textColor,
        },
      };
      if (syncSelectedSong) setSelectedSong(nextSongWithStyle);
      if (syncSongBackground) setSongBackground(bg || null);
      setSongs((prev) => prev.map((s) => (s.id === nextSongWithStyle.id ? nextSongWithStyle : s)));

      try {
        if (isElectron) {
          const saveInput = buildSongSaveInput(nextSongWithStyle);
          if (saveInput) {
            await window.churchDisplay.songsSave(saveInput);
          }
        }
      } catch (err) {
        console.warn('[SongManager] persist background failed:', err?.message || err);
      }

      const latestSeq = backgroundPersistSeqBySongRef.current.get(persistKey) || 0;
      if (nextSeq !== latestSeq) {
        if (import.meta.env.DEV) {
          console.debug(
            `[SongManager] stale background persist dropped song=${persistKey} seq=${nextSeq} latest=${latestSeq}`
          );
        }
        return nextSong;
      }

      if (typeof onUpdateActiveQueueItem === 'function' && canSyncActiveQueueSong(nextSongWithStyle)) {
        const queuePayload = buildSongQueuePayload({
          song: nextSongWithStyle,
          background: bg,
          style: {
            fontSize,
            fontSizePx,
            fontFamily,
            fontWeight: isBold ? 700 : 400,
            textColor,
          },
        });
        onUpdateActiveQueueItem(queuePayload, nextSongWithStyle.title, 'songs');
      }
      return nextSongWithStyle;
    },
    [
      isElectron,
      onUpdateActiveQueueItem,
      fontSize,
      fontSizePx,
      fontFamily,
      isBold,
      textColor,
      canSyncActiveQueueSong,
    ]
  );

  useEffect(() => {
    if (!externalBackground) return;
    const externalPickKey = String(
      externalBackground.pickToken ||
        `${externalBackground.type || ''}|${externalBackground.path || ''}`
    );
    if (lastAppliedExternalPickRef.current === externalPickKey) return;
    lastAppliedExternalPickRef.current = externalPickKey;

    // Optimistically reflect picker choice in UI immediately; persistence follows.
    setSongBackground(externalBackground);

    const pickerSong =
      externalBackground?.pickerContext?.song || backgroundPickContext?.song || null;

    // In selected-song view, picking a new background should replace and persist immediately.
    if (!editingSong && selectedSong) {
      const unchanged =
        (selectedSong.backgroundType || '') === (externalBackground.type || '') &&
        (selectedSong.backgroundPath || '') === (externalBackground.path || '');
      if (!unchanged) {
        persistSongBackground(selectedSong, externalBackground);
      }
    } else if (!editingSong && pickerSong?.id) {
      const unchanged =
        (pickerSong.backgroundType || '') === (externalBackground.type || '') &&
        (pickerSong.backgroundPath || '') === (externalBackground.path || '');
      if (!unchanged) {
        persistSongBackground(pickerSong, externalBackground);
      } else {
        setSelectedSong(pickerSong);
      }
    }
  }, [
    externalBackground?.pickToken,
    externalBackground?.pickerContext?.song,
    externalBackground?.path,
    externalBackground?.type,
    backgroundPickContext?.song,
    editingSong,
    selectedSong?.id,
    persistSongBackground,
  ]);

  // Import lyrics file (try UTF-8 first; fallback to GB18030 to avoid mojibake).
  const handleImportFile = useCallback((event) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    // R3-L: Handle FileReader errors.
    reader.onerror = () => {
      console.warn('[SongManager] Failed to read file:', reader.error);
    };
    reader.onload = () => {
      const buffer = reader.result;
      const bytes = new Uint8Array(buffer);
      const content = decodeLyricsImportBytes(bytes);
      const normalizedLyrics = normalizeImportedLyrics(content);
      const title = deriveSongTitleFromImportFile(file.name);
      setEditingSong({ id: null });
      setSelectedSong(null);
      setSelectedSectionIndex(-1);
      setFormTitle(title);
      setFormAuthor('');
      setFormLyrics(normalizedLyrics);
    };
    reader.readAsArrayBuffer(file);
    event.target.value = '';
  }, []);

  const handleSiteSearch = useCallback(async () => {
    if (!isElectron) {
      showToast(t('songs.siteSearchElectronOnly', 'Site search is available in Electron build only.'), 'warning');
      return;
    }
    const keyword = String(searchQuery || '').trim();
    if (!keyword) {
      showToast(t('songs.enterKeywordFirst', 'Please enter keyword first.'), 'warning');
      return;
    }
    setWebSearchResults([]);
    setWebSearching(true);
    try {
      const results = await window.churchDisplay.songsWebSiteSearch(keyword);
      const safeResults = (Array.isArray(results) ? results : []).filter((item) =>
        /^https?:\/\/(www\.)?christianstudy\.com\//i.test(String(item?.url || ''))
      );
      setWebSearchResults(safeResults);
      if (!safeResults.length) {
        showToast(t('songs.noSiteSearchResult', 'No matched pages from site search.'), 'info');
      }
    } catch (err) {
      console.warn('[SongManager] site search failed:', err?.message || err);
      showToast(t('songs.siteSearchFailed', 'Site search failed'), 'error');
    } finally {
      setWebSearching(false);
    }
  }, [isElectron, searchQuery, showToast]);

  const handleImportWebResult = useCallback(
    async (item, options = {}) => {
      if (!isElectron || !item?.url) return;
      const allowForce = options?.allowBlogMirror === true;
      if (
        !allowForce &&
        !/^https?:\/\/www\.christianstudy\.com\/data\/hymns\/text\//i.test(String(item.url))
      ) {
        showToast(t('songs.blockedNonHymn', 'Blocked non-hymn source'), 'warning');
        return;
      }
      try {
        const data = await window.churchDisplay.songsWebFetchLyrics(item.url, options);
        const fallbackTitle = String(item.title || '').replace(/[【】]/g, '').trim();
        const importTitle = String(data?.title || fallbackTitle).trim();
        const importLyrics = String(data?.lyrics || '').trim();
        if (!importTitle || !importLyrics) {
          showToast(t('songs.parseLyricsFailed', 'Failed to parse lyrics from selected page'), 'warning');
          return;
        }
        setEditingSong({ id: null });
        setSelectedSong(null);
        setSelectedSectionIndex(-1);
        setFormTitle(importTitle);
        setFormAuthor('');
        setFormLyrics(importLyrics);
        showToast(t('songs.webImportSuccess', 'Web lyrics imported. Please review then save.'), 'success');
      } catch (err) {
        console.warn('[SongManager] import web song failed:', err?.message || err);
        showToast(t('songs.importFailed', 'Import failed'), 'error');
      }
    },
    [isElectron, showToast]
  );

  const handleImportByUrl = useCallback(async () => {
    if (!isElectron) return;
    const url = String(webImportUrl || '').trim();
    if (!url) {
      showToast(t('songs.pasteUrlFirst', 'Please paste christianstudy song URL first.'), 'warning');
      return;
    }
    if (!/^https?:\/\/(www\.)?christianstudy\.com\//i.test(url)) {
      showToast(t('songs.onlyChristianstudy', 'Only christianstudy.com URL is supported.'), 'warning');
      return;
    }
    const data = await window.churchDisplay.songsWebFetchLyrics(url, { allowBlogMirror: false });
    if (data?.title && data?.lyrics) {
      await handleImportWebResult({ url, title: '' }, { allowBlogMirror: false });
      return;
    }
    await handleImportWebResult({ url, title: '' }, { allowBlogMirror: true });
  }, [isElectron, webImportUrl, showToast, handleImportWebResult]);

  // 过滤歌曲
  // R3-M: Memoize filtered songs to avoid re-filtering on every render.
  const filteredSongs = useMemo(
    () =>
      songs.filter(
        (s) => !searchQuery || s.title.toLowerCase().includes(searchQuery.toLowerCase())
      ),
    [songs, searchQuery]
  );

  // 编辑模式
  if (editingSong) {
    return (
      <div className="song-manager animate-slide-in-up">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '16px',
          }}
        >
          <h2 style={{ fontSize: '18px', fontWeight: '600' }}>
            {editingSong.id ? t('songs.edit', 'Edit') : t('songs.newSong', '+ New Song')}
          </h2>
          <button className="btn btn--ghost" onClick={() => setEditingSong(null)}>
            {t('media.cancel', 'Cancel')}
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <input
            type="text"
            placeholder={t('songs.songTitle', 'Song Title')}
            value={formTitle}
            onChange={(e) => setFormTitle(e.target.value)}
            style={{
              padding: '10px 12px',
              borderRadius: '6px',
              border: '1px solid var(--color-border)',
              background: 'var(--color-surface)',
              color: 'var(--color-text-primary)',
              fontSize: '14px',
              outline: 'none',
            }}
          />
          <input
            type="text"
            placeholder={t('songs.authorOptional', 'Author (optional)')}
            value={formAuthor}
            onChange={(e) => setFormAuthor(e.target.value)}
            style={{
              padding: '10px 12px',
              borderRadius: '6px',
              border: '1px solid var(--color-border)',
              background: 'var(--color-surface)',
              color: 'var(--color-text-primary)',
              fontSize: '13px',
              outline: 'none',
            }}
          />
          <div
            style={{
              fontSize: '12px',
              color: 'var(--color-text-secondary)',
              padding: '8px 12px',
              background: 'rgba(99,102,241,0.08)',
              borderRadius: '6px',
            }}
          >
            {t(
              'songs.splitHint',
              'Use blank lines to auto-split sections, or optional tags [V1]/[C]/[B]/[P]/[E].'
            )}
          </div>
          <textarea
            placeholder={t('songs.enterLyrics', 'Enter lyrics here...')}
            value={formLyrics}
            onChange={(e) => setFormLyrics(e.target.value)}
            rows={15}
            style={{
              padding: '12px',
              borderRadius: '6px',
              border: '1px solid var(--color-border)',
              background: 'var(--color-surface)',
              color: 'var(--color-text-primary)',
              fontSize: '14px',
              fontFamily: 'inherit',
              resize: 'vertical',
              outline: 'none',
              lineHeight: '1.6',
            }}
          />
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button className="btn btn--ghost" onClick={() => onOpenBackgroundPicker?.()}>
              {t('songs.pickBackground', 'Pick Background from Media')}
            </button>
            {songBackground && (
              <button
                className="btn btn--ghost"
                onClick={() => {
                  setSongBackground(null);
                }}
              >
                {t('songs.clearBackground', 'Clear Background')}
              </button>
            )}
          </div>
          <button className="btn btn--primary" onClick={handleSave} style={{ padding: '12px' }}>
            {t('songs.saveSong', 'Save Song')}
          </button>
        </div>
      </div>
    );
  }

  // 查看歌曲段落（投屏模式）
  if (selectedSong) {
    const sections = parseLyrics(selectedSong.lyrics);
    return (
      <div className="song-manager animate-slide-in-up">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '16px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              className="btn btn--ghost"
              onClick={() => setSelectedSong(null)}
              style={{ padding: '4px 8px', fontSize: '12px' }}
            >
              ← {t('songs.back', 'Back')}
            </button>
            <h2 style={{ fontSize: '18px', fontWeight: '600' }}>{selectedSong.title}</h2>
          </div>
          <button
            className="btn btn--ghost"
            onClick={() => handleEdit(selectedSong)}
            style={{ fontSize: '12px' }}
          >
            {t('songs.edit', 'Edit')}
          </button>
        </div>

        {selectedSong.author && (
          <p
            style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginBottom: '16px' }}
          >
            {t('songs.authorPrefix', 'Author')}: {selectedSong.author}
          </p>
        )}

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '12px' }}>
          <button
            className="btn btn--ghost"
            onClick={() =>
              onOpenBackgroundPicker?.({
                mode: 'selected-song',
                song: selectedSong,
              })
            }
          >
            {t('songs.pickBackground', 'Pick Background from Media')}
          </button>
          {songBackground && (
            <button
              className="btn btn--ghost"
              onClick={() => persistSongBackground(selectedSong, null)}
            >
              {t('songs.clearBackground', 'Clear Background')}
            </button>
          )}
          <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
            {songBackground
              ? `${t('common.selected', 'Selected')}: ${songBackground.name || songBackground.path}`
              : t('common.noBackgroundSelected', 'No background selected')}
          </span>
        </div>

        <div className="text-settings-card" style={{ marginBottom: '16px' }}>
          <div className="text-settings-head">{t('songs.songTextControls', 'Song Text Controls')}</div>

        <div className="text-settings-row">
          <div className="text-settings-presets">
              {[
                { key: 'small', label: 'Small', px: 48 },
                { key: 'medium', label: 'Medium', px: 60 },
                { key: 'large', label: 'Large', px: 72 },
              ].map((s) => (
                <button
                  key={s.key}
                  className={`text-size-chip ${fontSize === s.key ? 'text-size-chip--active' : ''}`}
                  onClick={() => {
                    setFontSize(s.key);
                    setFontSizePx(s.px);
                  }}
                >
                  {s.label}
                </button>
            ))}
          </div>
          <label className="cp-label-row" style={{ marginBottom: 0 }}>
            <input
              type="checkbox"
              checked={isBold}
              onChange={(e) => setIsBold(e.target.checked)}
            />
            {t('textEditor.bold', 'Bold')}
          </label>
        </div>

          <div className="text-settings-grid">
            <label className="text-settings-field">
              <span className="text-settings-label">{t('songs.sizePx', 'Size (px)')}</span>
              <input
                type="number"
                min={24}
                max={180}
                value={fontSizePx}
                onChange={(e) =>
                  setFontSizePx(Math.max(24, Math.min(180, Number(e.target.value || 72))))
                }
                className="cp-input-md"
                title="Text Size (px)"
              />
            </label>

            <label className="text-settings-field">
              <span className="text-settings-label">{t('songs.fontFamily', 'Font Family')}</span>
              <select
                value={fontFamily}
                onChange={(e) => setFontFamily(e.target.value)}
                className="cp-input-md"
              >
                {PROJECTION_FONT_OPTIONS.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-settings-field">
              <span className="text-settings-label">{t('songs.textColor', 'Text Color')}</span>
              <div className="text-color-control">
                <input
                  type="color"
                  value={textColor}
                  onChange={(e) => setTextColor(e.target.value)}
                  className="text-color-input"
                  title="Text Color"
                />
                <span className="text-color-value">
                  {String(textColor || '#ffffff').toUpperCase()}
                </span>
              </div>
            </label>
          </div>
        </div>

        <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginBottom: '12px' }}>
          {t('songs.slideStyleHint', 'Slide-style section cards (in order). Click a card to project.')}
        </p>

        {/* 歌词段落卡片（PPT 风格） */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
            gap: '10px',
          }}
        >
          <div
            ref={blankSectionCardRef}
            onClick={() => {
              setSelectedSectionIndex(BLANK_SECTION_INDEX);
              handleProjectBlankSection();
            }}
            style={getSelectableThumbCardStyle(selectedSectionIndex === BLANK_SECTION_INDEX)}
            tabIndex={-1}
          >
            {selectedSectionIndex === BLANK_SECTION_INDEX && (
              <div style={getSelectableThumbSelectedTagStyle()}>SEL</div>
            )}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 10px',
                borderBottom: '1px solid var(--color-border)',
                background: 'rgba(99,102,241,0.12)',
              }}
            >
              <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--color-primary)' }}>
                {t('songs.slideBlank', 'Slide Blank')}
              </span>
              <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>{t('songs.noText', 'No text')}</span>
            </div>
            <div
              style={{
                position: 'relative',
                width: '100%',
                aspectRatio: '16 / 9',
                background: '#000',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'rgba(255,255,255,0.55)',
                  fontSize: '12px',
                  letterSpacing: '0.4px',
                }}
              >
                BLANK
              </div>
            </div>
            <div style={getSelectableThumbIndexStyle(selectedSectionIndex === BLANK_SECTION_INDEX)}>
              B
            </div>
          </div>

          {sections.map((section, idx) => (
            <div
              key={idx}
              ref={(el) => {
                if (el) sectionCardRefs.current.set(idx, el);
                else sectionCardRefs.current.delete(idx);
              }}
              onClick={() => {
                setSelectedSectionIndex(idx);
                handleProjectSection(section, idx);
              }}
              style={getSelectableThumbCardStyle(idx === selectedSectionIndex)}
              tabIndex={-1}
            >
              {idx === selectedSectionIndex && (
                <div style={getSelectableThumbSelectedTagStyle()}>SEL</div>
              )}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 10px',
                  borderBottom: '1px solid var(--color-border)',
                  background: 'rgba(99,102,241,0.12)',
                }}
              >
                <span
                  style={{ fontSize: '11px', fontWeight: '700', color: 'var(--color-primary)' }}
                >
                  {t('songs.slide', 'Slide')} {idx + 1}
                </span>
                <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                  {section.title}
                </span>
              </div>

              <div
                style={{
                  position: 'relative',
                  width: '100%',
                  aspectRatio: '16 / 9',
                  background: '#000',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    padding: '8px 10px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    whiteSpace: 'pre-line',
                      textAlign: 'center',
                      lineHeight: '1.6',
                      color: textColor,
                      fontFamily: fontFamily,
                      fontWeight: isBold ? 700 : 400,
                      // 320px is the baseline preview width mapped from 1920px projector width.
                      fontSize: `${Math.max(9, Math.min(28, Math.round((Number(fontSizePx || 72) * 320) / 1920)))}px`,
                    textShadow: '2px 2px 8px rgba(0, 0, 0, 0.85)',
                    overflow: 'hidden',
                  }}
                >
                  {section.lines.join('\n')}
                </div>
              </div>
              <div style={getSelectableThumbIndexStyle(idx === selectedSectionIndex)}>
                {idx + 1}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // 歌曲列表视图
  return (
    <div className="song-manager animate-slide-in-up">
      <h2 className="cp-page-title cp-page-title--tight">{t('songs.title', 'Songs')}</h2>
      <p className="cp-page-intro">
        {t('songs.intro', 'Manage worship songs with section-based projection.')}
      </p>

      {/* Actions */}
      <div className="cp-toolbar-row cp-gap-bottom-md">
        <button className="btn btn--primary" onClick={handleNew}>
          {t('songs.newSong', '+ New Song')}
        </button>
        <button className="btn btn--ghost" onClick={() => fileInputRef.current?.click()}>
          {t('songs.importLyrics', 'Import Lyrics')}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".txt,.lrc"
          onChange={handleImportFile}
          style={{ display: 'none' }}
        />
        <input
          type="text"
          placeholder={t('songs.searchSongs', 'Search songs...')}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="cp-input-inline"
        />
        <button className="btn btn--ghost" onClick={handleSiteSearch} disabled={webSearching}>
          {webSearching ? t('songs.searching', 'Searching...') : t('songs.search', 'Search')}
        </button>
      </div>

      {!!webSearchResults.length && (
        <div
          style={{
            marginBottom: '12px',
            padding: '10px',
            borderRadius: '8px',
            border: '1px solid var(--color-border)',
            background: 'rgba(59,130,246,0.08)',
          }}
        >
          <div
            style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginBottom: '8px' }}
          >
            christianstudy.com {t('songs.results', 'results')} ({webSearchResults.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '180px', overflow: 'auto' }}>
            {webSearchResults.map((item) => (
              <div
                key={item.url}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '8px',
                  padding: '6px 8px',
                  borderRadius: '6px',
                  background: 'var(--color-surface)',
                }}
                >
                  <span style={{ fontSize: '13px' }}>{item.title}</span>
                  <span style={{ fontSize: '10px', color: 'var(--color-text-secondary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.url}
                  </span>
                  <button className="btn btn--ghost" onClick={() => handleImportWebResult(item)}>
                    {t('songs.importAction', 'Import')}
                  </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div
        style={{
          marginBottom: '12px',
          padding: '10px',
          borderRadius: '8px',
          border: '1px solid var(--color-border)',
          background: 'rgba(16,185,129,0.08)',
          display: 'flex',
          gap: '8px',
          alignItems: 'center',
        }}
      >
        <input
          type="text"
          placeholder={t('songs.directImportByUrl', 'Paste christianstudy song URL and import directly...')}
          value={webImportUrl}
          onChange={(e) => setWebImportUrl(e.target.value)}
          style={{
            flex: 1,
            padding: '8px 10px',
            borderRadius: '6px',
            border: '1px solid var(--color-border)',
            background: 'var(--color-surface)',
            color: 'var(--color-text-primary)',
            fontSize: '12px',
            outline: 'none',
          }}
        />
        <button className="btn btn--ghost" onClick={handleImportByUrl}>
          {t('songs.importUrl', 'Import URL')}
        </button>
      </div>

      {/* 歌曲列表 */}
      {filteredSongs.length === 0 ? (
        <div className="empty-state empty-state--roomy">
          <div className="empty-state__icon">{t('songs.title', 'Songs')}</div>
          <div className="empty-state__title">{t('songs.noSongsYet', 'No songs yet')}</div>
          <div className="empty-state__desc">{t('songs.startHint', 'Click "New Song" or "Import Lyrics" to start')}</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {filteredSongs.map((song) => (
            <div
              key={song.id}
              className="cp-list-card"
              onClick={() => openSongWithoutAutoProject(song)}
            >
              <div>
                <div className="cp-list-card__title">{song.title}</div>
                {song.author && (
                  <div className="cp-list-card__meta">
                    {song.author}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  className="btn btn--ghost cp-btn-xs cp-btn-accent"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleQueueSong(song);
                  }}
                  title={t('songs.addWholeSongToQueue', 'Add whole song to queue')}
                >
                  +{' '}
                </button>
                <button
                  className="btn btn--ghost cp-btn-xs"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleEdit(song);
                  }}
                >
                  {t('songs.edit', 'Edit')}
                </button>
                <button
                  className="btn btn--ghost cp-btn-xs cp-btn-danger-soft"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(song.id);
                  }}
                >
                  {t('songs.deleteSong', 'Delete')}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default SongManager;
