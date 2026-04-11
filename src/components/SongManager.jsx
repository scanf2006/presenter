import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable react-hooks/exhaustive-deps */

import {
  getSelectableThumbCardStyle,
  getSelectableThumbIndexStyle,
  getSelectableThumbSelectedTagStyle,
} from '../utils/thumbnail';

const TEXT_FONT_OPTIONS = ['Noto Sans SC', 'Microsoft YaHei', 'Arial', 'Times New Roman', 'SimHei'];

/**
 * 诗歌歌词管理组件
 * Supports song management, section editing, projection and lyrics import.
 */
function SongManager({
  onProjectContent,
  onQueueContent,
  onUpdateActiveQueueItem,
  activePreloadItem,
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
  const [textColor, setTextColor] = useState('#ffffff');
  const [songBackground, setSongBackground] = useState(null);
  const [selectedSectionIndex, setSelectedSectionIndex] = useState(-1);
  // 搜索
  const [searchQuery, setSearchQuery] = useState('');
  const lastProjectedSectionRef = useRef(null);
  const lastAppliedExternalPickRef = useRef(null);
  const lastHandledPreloadRef = useRef(null);

  const isElectron = typeof window.churchDisplay !== 'undefined';
  const fileInputRef = useRef(null);

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

  // 解析歌词段落
  // R3-M: Memoize parseLyrics to avoid recreating on every render.
  const parseLyrics = useCallback((lyrics) => {
    if (!lyrics) return [];

    // compatibility: historical data may store literal "\n"
    const normalized = lyrics.replace(/\r\n/g, '\n').replace(/\\n/g, '\n').trim();
    if (!normalized) return [];

    const lines = normalized.split('\n');
    const hasMarkers = lines.some((line) => /^\s*\[(V\d*|C|B|P|E)\]/i.test(line.trim()));

    // No marker mode: split sections by blank lines.
    if (!hasMarkers) {
      const blocks = normalized
        .split(/\n\s*\n+/)
        .map((block) =>
          block
            .split('\n')
            .map((line) => line.trim())
            .filter(Boolean)
        )
        .filter((block) => block.length > 0);

      // If only one large paragraph, auto-split every 4 lines for easier projection.
      if (blocks.length === 1 && blocks[0].length > 4) {
        const single = blocks[0];
        const autoBlocks = [];
        for (let i = 0; i < single.length; i += 4) {
          autoBlocks.push(single.slice(i, i + 4));
        }
        return autoBlocks.map((block, index) => ({
          tag: `A${index + 1}`,
          title: `Section ${index + 1}`,
          lines: block,
        }));
      }

      return blocks.map((block, index) => ({
        tag: `A${index + 1}`,
        title: `Section ${index + 1}`,
        lines: block,
      }));
    }

    // Marker mode: supports [V1]/[C]/[B]/[P]/[E]
    const sections = [];
    let currentSection = { tag: '', title: 'Section 1', lines: [] };

    for (const rawLine of lines) {
      const line = rawLine.trim();
      const tagMatch = line.match(/^\[(V\d*|C|B|P|E)\](.*)$/i);

      if (tagMatch) {
        if (currentSection.lines.length > 0) {
          sections.push(currentSection);
        }

        const tag = tagMatch[1].toUpperCase();
        const extra = tagMatch[2] ? tagMatch[2].trim() : '';
        let title;
        if (tag.startsWith('V')) title = `Verse ${tag.substring(1) || ''}`.trim();
        else if (tag === 'C') title = 'Chorus';
        else if (tag === 'B') title = 'Bridge';
        else if (tag === 'P') title = 'Intro';
        else if (tag === 'E') title = 'Outro';
        else title = tag;
        if (extra) title += ` ${extra}`;

        currentSection = { tag, title: title.trim(), lines: [] };
      } else if (line) {
        currentSection.lines.push(line);
      }
    }

    if (currentSection.lines.length > 0) {
      sections.push(currentSection);
    }

    return sections;
  }, []);

  // 保存歌曲
  const handleSave = useCallback(async () => {
    if (!formTitle.trim() || !formLyrics.trim()) {
      alert('Please enter song title and lyrics');
      return;
    }
    const song = {
      id: editingSong?.id || null,
      title: formTitle.trim(),
      author: formAuthor.trim(),
      lyrics: formLyrics.trim(),
      backgroundType: songBackground?.type || '',
      backgroundPath: songBackground?.path || '',
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
  }, [editingSong, formTitle, formAuthor, formLyrics, songBackground, isElectron, loadSongs]);

  // 删除歌曲
  const handleDelete = useCallback(
    async (songId) => {
      if (!window.confirm('Delete this song?')) return;
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
    [isElectron, selectedSong, loadSongs]
  );

  // start editing
  const handleEdit = (song) => {
    setEditingSong(song);
    setFormTitle(song.title);
    setFormAuthor(song.author || '');
    setFormLyrics(song.lyrics);
    setSongBackground(
      song.backgroundType && song.backgroundPath
        ? {
            type: song.backgroundType,
            path: song.backgroundPath,
            name: song.backgroundPath.split(/[\\/]/).pop() || 'Background',
          }
        : null
    );
    setSelectedSong(null);
  };

  // 新建歌曲
  const handleNew = () => {
    setEditingSong({ id: null });
    setFormTitle('');
    setFormAuthor('');
    setFormLyrics(
      '(Enter first section)\n(Continue lines in same section)\n\n(Blank line starts next section)'
    );
    setSongBackground(null);
    setSelectedSong(null);
  };

  const buildSelectedSongQueuePayload = useCallback(
    (song, section = null, sectionIndex = null) => {
      if (!song) return null;
      return {
        type: 'song',
        songId: song.id,
        songTitle: song.title,
        background: songBackground
          ? {
              type: songBackground.type,
              path: songBackground.path,
            }
          : null,
        lastSectionIndex: Number.isFinite(sectionIndex) ? sectionIndex : null,
        lastSectionTitle: section?.title || '',
        lastSectionTag: section?.tag || '',
      };
    },
    [songBackground]
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
        textColor,
        background: songBackground,
      };
      if (isElectron && typeof window.churchDisplay?.sendToProjectorBackground === 'function') {
        window.churchDisplay.sendToProjectorBackground(songBackground || null);
      }
      lastProjectedSectionRef.current = { section };
      onProjectContent(payload);
      if (selectedSong && typeof onUpdateActiveQueueItem === 'function') {
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
      textColor,
      onProjectContent,
      songBackground,
      isElectron,
      selectedSong,
      onUpdateActiveQueueItem,
      buildSelectedSongQueuePayload,
    ]
  );

  const handleQueueSong = useCallback(
    (song) => {
      if (typeof onQueueContent !== 'function' || !song) return;
      const payload = {
        type: 'song',
        songId: song.id,
        songTitle: song.title,
        background:
          song.backgroundType && song.backgroundPath
            ? {
                type: song.backgroundType,
                path: song.backgroundPath,
              }
            : null,
      };
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
    setSongBackground(
      song.backgroundType && song.backgroundPath
        ? {
            type: song.backgroundType,
            path: song.backgroundPath,
            name: song.backgroundPath.split(/[\\/]/).pop() || 'Background',
          }
        : null
    );
  }, []);

  useEffect(() => {
    // Do not interrupt editor mode while user is creating/editing a song.
    if (editingSong) return;
    if (!activePreloadItem || activePreloadItem.type !== 'song') return;
    const targetSongId = activePreloadItem.payload?.songId;
    if (!targetSongId) return;
    // Avoid re-opening the same song after save/delete triggers a songs or editingSong change.
    const preloadKey = `${targetSongId}|${activePreloadItem.payload?.token || ''}`;
    if (lastHandledPreloadRef.current === preloadKey) return;
    lastHandledPreloadRef.current = preloadKey;
    const target = songs.find((s) => s.id === targetSongId);
    if (target) {
      openSongWithoutAutoProject(target);
    }
  }, [activePreloadItem, songs, editingSong, openSongWithoutAutoProject]);

  useEffect(() => {
    if (!selectedSong) return;
    // Switch song should not auto-project last section from previous song.
    lastProjectedSectionRef.current = null;
    setSelectedSectionIndex(-1);
    setSongBackground(
      selectedSong.backgroundType && selectedSong.backgroundPath
        ? {
            type: selectedSong.backgroundType,
            path: selectedSong.backgroundPath,
            name: selectedSong.backgroundPath.split(/[\\/]/).pop() || 'Background',
          }
        : null
    );
  }, [selectedSong?.id]);

  useEffect(() => {
    if (!forceShowSongListToken) return;
    // User explicitly clicked Songs menu: always return to songs list view.
    setSelectedSong(null);
    setEditingSong(null);
    setSelectedSectionIndex(-1);
    lastProjectedSectionRef.current = null;
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

  const persistSelectedSongBackground = useCallback(
    async (bg) => {
      if (!selectedSong) return;
      const nextSong = {
        ...selectedSong,
        backgroundType: bg?.type || '',
        backgroundPath: bg?.path || '',
      };
      setSelectedSong(nextSong);
      setSongs((prev) => prev.map((s) => (s.id === nextSong.id ? nextSong : s)));
      try {
        if (isElectron) {
          await window.churchDisplay.songsSave({
            id: nextSong.id,
            title: nextSong.title || '',
            author: nextSong.author || '',
            lyrics: nextSong.lyrics || '',
            backgroundType: nextSong.backgroundType,
            backgroundPath: nextSong.backgroundPath,
          });
        }
      } catch (err) {
        console.warn('[SongManager] persist background failed:', err?.message || err);
      }
      if (typeof onUpdateActiveQueueItem === 'function') {
        const queuePayload = {
          type: 'song',
          songId: nextSong.id,
          songTitle: nextSong.title,
          background: bg ? { type: bg.type, path: bg.path } : null,
        };
        onUpdateActiveQueueItem(queuePayload, nextSong.title, 'songs');
      }
    },
    [selectedSong, isElectron, onUpdateActiveQueueItem]
  );

  const persistBackgroundForSong = useCallback(
    async (song, bg) => {
      if (!song) return;
      const nextSong = {
        ...song,
        backgroundType: bg?.type || '',
        backgroundPath: bg?.path || '',
      };

      setSelectedSong(nextSong);
      setSongBackground(bg || null);
      setSongs((prev) => prev.map((s) => (s.id === nextSong.id ? nextSong : s)));

      try {
        if (isElectron) {
          await window.churchDisplay.songsSave({
            id: nextSong.id,
            title: nextSong.title || '',
            author: nextSong.author || '',
            lyrics: nextSong.lyrics || '',
            backgroundType: nextSong.backgroundType,
            backgroundPath: nextSong.backgroundPath,
          });
        }
      } catch (err) {
        console.warn('[SongManager] persist background failed:', err?.message || err);
      }

      if (typeof onUpdateActiveQueueItem === 'function') {
        onUpdateActiveQueueItem(
          {
            type: 'song',
            songId: nextSong.id,
            songTitle: nextSong.title,
            background: bg ? { type: bg.type, path: bg.path } : null,
          },
          nextSong.title,
          'songs'
        );
      }
    },
    [isElectron, onUpdateActiveQueueItem]
  );

  useEffect(() => {
    if (!externalBackground) return;
    const externalPickKey = String(
      externalBackground.pickToken ||
        `${externalBackground.type || ''}|${externalBackground.path || ''}`
    );
    if (lastAppliedExternalPickRef.current === externalPickKey) return;
    lastAppliedExternalPickRef.current = externalPickKey;

    setSongBackground(externalBackground);

    const pickerSong =
      externalBackground?.pickerContext?.song || backgroundPickContext?.song || null;

    // In selected-song view, picking a new background should replace and persist immediately.
    if (!editingSong && selectedSong) {
      const unchanged =
        (selectedSong.backgroundType || '') === (externalBackground.type || '') &&
        (selectedSong.backgroundPath || '') === (externalBackground.path || '');
      if (!unchanged) {
        persistSelectedSongBackground(externalBackground);
      }
    } else if (!editingSong && pickerSong?.id) {
      const unchanged =
        (pickerSong.backgroundType || '') === (externalBackground.type || '') &&
        (pickerSong.backgroundPath || '') === (externalBackground.path || '');
      if (!unchanged) {
        persistBackgroundForSong(pickerSong, externalBackground);
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
    persistBackgroundForSong,
    persistSelectedSongBackground,
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
      let content = '';
      try {
        content = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
      } catch (_) {
        content = '';
      }

      // If replacement char appears, retry with GB18030
      if (content.includes('\ufffd')) {
        try {
          content = new TextDecoder('gb18030', { fatal: false }).decode(bytes);
        } catch (_) {
          // ignore fallback failure, keep UTF-8 result
        }
      }

      const title = file.name.replace(/\.(txt|lrc)$/i, '');
      setEditingSong({ id: null });
      setSelectedSong(null);
      setSelectedSectionIndex(-1);
      setFormTitle(title);
      setFormAuthor('');
      setFormLyrics(content);
    };
    reader.readAsArrayBuffer(file);
    event.target.value = '';
  }, []);

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
            {editingSong.id ? 'Edit Song' : 'New Song'}
          </h2>
          <button className="btn btn--ghost" onClick={() => setEditingSong(null)}>
            Cancel
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <input
            type="text"
            placeholder="Song Title"
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
            placeholder="Author (optional)"
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
            Use blank lines to auto-split sections, or optional tags [V1]/[C]/[B]/[P]/[E].
          </div>
          <textarea
            placeholder="Enter lyrics here..."
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
              Pick Background from Media
            </button>
            {songBackground && (
              <button
                className="btn btn--ghost"
                onClick={() => {
                  setSongBackground(null);
                }}
              >
                Clear Background
              </button>
            )}
          </div>
          <button className="btn btn--primary" onClick={handleSave} style={{ padding: '12px' }}>
            Save Song
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
              ← Back
            </button>
            <h2 style={{ fontSize: '18px', fontWeight: '600' }}>{selectedSong.title}</h2>
          </div>
          <button
            className="btn btn--ghost"
            onClick={() => handleEdit(selectedSong)}
            style={{ fontSize: '12px' }}
          >
            Edit
          </button>
        </div>

        {selectedSong.author && (
          <p
            style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginBottom: '16px' }}
          >
            Author: {selectedSong.author}
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
            Pick Background from Media
          </button>
          {songBackground && (
            <button className="btn btn--ghost" onClick={() => persistSelectedSongBackground(null)}>
              Clear Background
            </button>
          )}
          <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
            {songBackground
              ? `Selected: ${songBackground.name || songBackground.path}`
              : 'No background selected'}
          </span>
        </div>

        <div className="text-settings-card" style={{ marginBottom: '16px' }}>
          <div className="text-settings-head">Song Text Controls</div>

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
          </div>

          <div className="text-settings-grid">
            <label className="text-settings-field">
              <span className="text-settings-label">Size (px)</span>
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
              <span className="text-settings-label">Font Family</span>
              <select
                value={fontFamily}
                onChange={(e) => setFontFamily(e.target.value)}
                className="cp-input-md"
              >
                {TEXT_FONT_OPTIONS.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-settings-field">
              <span className="text-settings-label">Text Color</span>
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
          Slide-style section cards (in order). Click a card to project.
        </p>

        {/* 歌词段落卡片（PPT 风格） */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
            gap: '10px',
          }}
        >
          {sections.map((section, idx) => (
            <div
              key={idx}
              onClick={() => {
                setSelectedSectionIndex(idx);
                handleProjectSection(section, idx);
              }}
              style={getSelectableThumbCardStyle(idx === selectedSectionIndex)}
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
                  Slide {idx + 1}
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
      <h2 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '8px' }}>Songs</h2>
      <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginBottom: '16px' }}>
        Manage worship songs with section-based projection.
      </p>

      {/* Actions */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        <button className="btn btn--primary" onClick={handleNew}>
          + New Song
        </button>
        <button className="btn btn--ghost" onClick={() => fileInputRef.current?.click()}>
          Import Lyrics
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
          placeholder="Search songs..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            flex: 1,
            padding: '8px 12px',
            borderRadius: '6px',
            border: '1px solid var(--color-border)',
            background: 'var(--color-surface)',
            color: 'var(--color-text-primary)',
            fontSize: '13px',
            outline: 'none',
          }}
        />
      </div>

      {/* 歌曲列表 */}
      {filteredSongs.length === 0 ? (
        <div
          style={{ textAlign: 'center', padding: '40px 0', color: 'var(--color-text-secondary)' }}
        >
          <div style={{ fontSize: '40px', marginBottom: '12px' }}>Songs</div>
          <div style={{ fontSize: '14px', marginBottom: '8px' }}>No songs yet</div>
          <div style={{ fontSize: '12px' }}>Click "New Song" or "Import Lyrics" to start</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {filteredSongs.map((song) => (
            <div
              key={song.id}
              style={{
                padding: '14px 16px',
                borderRadius: '8px',
                cursor: 'pointer',
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                transition: 'all 0.2s',
              }}
              onClick={() => openSongWithoutAutoProject(song)}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--color-primary)';
                e.currentTarget.style.transform = 'translateX(4px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--color-border)';
                e.currentTarget.style.transform = 'none';
              }}
            >
              <div>
                <div style={{ fontSize: '14px', fontWeight: '600' }}>{song.title}</div>
                {song.author && (
                  <div
                    style={{
                      fontSize: '12px',
                      color: 'var(--color-text-secondary)',
                      marginTop: '4px',
                    }}
                  >
                    {song.author}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  className="btn btn--ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleQueueSong(song);
                  }}
                  style={{ padding: '4px 8px', fontSize: '12px', color: 'var(--color-primary)' }}
                  title="Add whole song to queue"
                >
                  +{' '}
                </button>
                <button
                  className="btn btn--ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleEdit(song);
                  }}
                  style={{ padding: '4px 8px', fontSize: '12px' }}
                >
                  Edit
                </button>
                <button
                  className="btn btn--ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(song.id);
                  }}
                  style={{ padding: '4px 8px', fontSize: '12px', color: '#ff4d4f' }}
                >
                  Delete
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
