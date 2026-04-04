import React, { useState, useEffect, useCallback, useRef } from 'react';

/**
 * 诗歌歌词管理组件
 * 支持歌曲管理、分段编辑��段落��择投屏和歌词文件导�? */
function SongManager({ onProjectContent, onQueueContent, activePreloadItem, onOpenBackgroundPicker, externalBackground }) {
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
  const [songBackground, setSongBackground] = useState(null);
  // 搜索
  const [searchQuery, setSearchQuery] = useState('');
  const lastProjectedSectionRef = useRef(null);

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
        { id: 1, title: '奇异恩典', author: 'John Newton', lyrics: '[V1]\n奇异恩典 何等甘甜\n我罪已得赦免\n前我失丧 今被寻回\n瞎眼今得看见\n\n[V2]\n如此恩典 使我敬畏\n使我心得安慰\n初信之时 即蒙恩惠\n真是何等宝贵\n\n[C]\n赞美主，赞美主\n奇异恩典 何等甘甜', backgroundType: '', backgroundPath: '' },
        { id: 2, title: '感谢神', author: '', lyrics: '[V1]\n感谢神 赐我救赎主\n感谢神 丰富预备\n感谢神 过去的同在\n感谢神 主在我旁', backgroundType: '', backgroundPath: '' },
      ]);
    }
  }, [isElectron]);

  useEffect(() => { loadSongs(); }, [loadSongs]);

  // 解析歌词段落
  const parseLyrics = (lyrics) => {
    if (!lyrics) return [];

    // compatibility: historical data may store literal "\n"
    const normalized = lyrics.replace(/\r\n/g, '\n').replace(/\\n/g, '\n').trim();
    if (!normalized) return [];

    const lines = normalized.split('\n');
    const hasMarkers = lines.some((line) => /^\s*\[(V\d*|C|B|P|E)\]/i.test(line.trim()));

    // 无标记模式：按空行自动分�?
    if (!hasMarkers) {
      const blocks = normalized
        .split(/\n\s*\n+/)
        .map((block) => block.split('\n').map((line) => line.trim()).filter(Boolean))
        .filter((block) => block.length > 0);

      // 若没有空行导致只有一个大段，则按�?4 行自动分段，便于点击投屏
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

    // 标记模式：兼�?[V1]/[C]/[B]/[P]/[E]
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
  };

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
    if (isElectron) {
      await window.churchDisplay.songsSave(song);
    }
    setEditingSong(null);
    setFormTitle('');
    setFormAuthor('');
    setFormLyrics('');
    setSongBackground(null);
    await loadSongs();
  }, [editingSong, formTitle, formAuthor, formLyrics, songBackground, isElectron, loadSongs]);

  // 删除歌曲
  const handleDelete = useCallback(async (songId) => {
    if (!window.confirm('Delete this song?')) return;
    if (isElectron) {
      await window.churchDisplay.songsDelete(songId);
    }
    if (selectedSong?.id === songId) setSelectedSong(null);
    await loadSongs();
  }, [isElectron, selectedSong, loadSongs]);

  // start editing
  const handleEdit = (song) => {
    setEditingSong(song);
    setFormTitle(song.title);
    setFormAuthor(song.author || '');
    setFormLyrics(song.lyrics);
    setSongBackground(song.backgroundType && song.backgroundPath ? {
      type: song.backgroundType,
      path: song.backgroundPath,
      name: song.backgroundPath.split(/[\\/]/).pop() || 'Background',
    } : null);
    setSelectedSong(null);
  };

  // 新建歌曲
  const handleNew = () => {
    setEditingSong({ id: null });
    setFormTitle('');
    setFormAuthor('');
    setFormLyrics('(Enter first section)\n(Continue lines in same section)\n\n(Blank line starts next section)');
    setSongBackground(null);
    setSelectedSong(null);
  };

  // Project one section (lyrics text only)
  const handleProjectSection = useCallback((section) => {
    const payload = {
      type: 'lyrics',
      text: section.lines.join('\n'),
      fontSize,
      background: songBackground,
    };
    if (isElectron && typeof window.churchDisplay?.sendToProjectorBackground === 'function') {
      window.churchDisplay.sendToProjectorBackground(songBackground || null);
    }
    lastProjectedSectionRef.current = { section };
    onProjectContent(payload);
  }, [fontSize, onProjectContent, songBackground, isElectron]);

  const handleQueueSong = useCallback((song) => {
    if (typeof onQueueContent !== 'function' || !song) return;
    const payload = {
      type: 'song',
      songId: song.id,
      songTitle: song.title,
      background: song.backgroundType && song.backgroundPath ? {
        type: song.backgroundType,
        path: song.backgroundPath,
      } : null,
    };
    onQueueContent(payload, `🎵 ${song.title}`);
  }, [onQueueContent]);

  useEffect(() => {
    if (!activePreloadItem || activePreloadItem.type !== 'song') return;
    const targetSongId = activePreloadItem.payload?.songId;
    if (!targetSongId) return;
    const target = songs.find((s) => s.id === targetSongId);
    if (target) {
      setEditingSong(null);
      setSelectedSong(target);
      setSongBackground(target.backgroundType && target.backgroundPath ? {
        type: target.backgroundType,
        path: target.backgroundPath,
        name: target.backgroundPath.split(/[\\/]/).pop() || 'Background',
      } : null);
    }
  }, [activePreloadItem, songs]);

  useEffect(() => {
    if (!selectedSong) return;
    setSongBackground(selectedSong.backgroundType && selectedSong.backgroundPath ? {
      type: selectedSong.backgroundType,
      path: selectedSong.backgroundPath,
      name: selectedSong.backgroundPath.split(/[\\/]/).pop() || 'Background',
    } : null);
  }, [selectedSong?.id]);

  useEffect(() => {
    if (selectedSong && lastProjectedSectionRef.current) {
      handleProjectSection(lastProjectedSectionRef.current.section);
    }
  }, [songBackground]);

  useEffect(() => {
    if (externalBackground) {
      setSongBackground(externalBackground);
    }
  }, [externalBackground?.path, externalBackground?.type]);

  // 导入歌词文件（优�?UTF-8，异常时回��� GB18030，避免乱码）
  const handleImportFile = useCallback((event) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
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
      setFormTitle(title);
      setFormAuthor('');
      setFormLyrics(content);
    };
    reader.readAsArrayBuffer(file);
    event.target.value = '';
  }, []);

  // 过滤歌曲
  const filteredSongs = songs.filter(s =>
    !searchQuery || s.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // 编辑模式
  if (editingSong) {
    return (
      <div className="song-manager animate-slide-in-up">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: '600' }}>
            🎵 {editingSong.id ? 'Edit Song' : 'New Song'}
          </h2>
          <button className="btn btn--ghost" onClick={() => setEditingSong(null)}>Cancel</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <input
            type="text" placeholder="Song Title" value={formTitle}
            onChange={e => setFormTitle(e.target.value)}
            style={{
              padding: '10px 12px', borderRadius: '6px', border: '1px solid var(--color-border)',
              background: 'var(--color-surface)', color: 'var(--color-text-primary)', fontSize: '14px', outline: 'none',
            }}
          />
          <input
            type="text" placeholder="Author (optional)" value={formAuthor}
            onChange={e => setFormAuthor(e.target.value)}
            style={{
              padding: '10px 12px', borderRadius: '6px', border: '1px solid var(--color-border)',
              background: 'var(--color-surface)', color: 'var(--color-text-primary)', fontSize: '13px', outline: 'none',
            }}
          />
          <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', padding: '8px 12px', background: 'rgba(99,102,241,0.08)', borderRadius: '6px' }}>
            Use blank lines to auto-split sections, or optional tags [V1]/[C]/[B]/[P]/[E].
          </div>
          <textarea
            placeholder="Enter lyrics here..." value={formLyrics}
            onChange={e => setFormLyrics(e.target.value)}
            rows={15}
            style={{
              padding: '12px', borderRadius: '6px', border: '1px solid var(--color-border)',
              background: 'var(--color-surface)', color: 'var(--color-text-primary)', fontSize: '14px',
              fontFamily: 'monospace', resize: 'vertical', outline: 'none', lineHeight: '1.6',
            }}
          />
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button className="btn btn--ghost" onClick={() => onOpenBackgroundPicker?.()}>
              🎬 Pick Background from Media
            </button>
            {songBackground && (
              <button className="btn btn--ghost" onClick={() => setSongBackground(null)}>Clear Background</button>
            )}
          </div>
          <button className="btn btn--primary" onClick={handleSave} style={{ padding: '12px' }}>
            💾 Save Song
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button className="btn btn--ghost" onClick={() => setSelectedSong(null)} style={{ padding: '4px 8px', fontSize: '12px' }}>
              ← Back
            </button>
            <h2 style={{ fontSize: '18px', fontWeight: '600' }}>🎵 {selectedSong.title}</h2>
          </div>
          <button className="btn btn--ghost" onClick={() => handleEdit(selectedSong)} style={{ fontSize: '12px' }}>
            ✏️ Edit
          </button>
        </div>

        {selectedSong.author && (
          <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginBottom: '16px' }}>
            Author: {selectedSong.author}
          </p>
        )}

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '12px' }}>
          <button className="btn btn--ghost" onClick={() => onOpenBackgroundPicker?.()}>
            🎬 Pick Background from Media
          </button>
          {songBackground && (
            <button className="btn btn--ghost" onClick={() => setSongBackground(null)}>Clear Background</button>
          )}
          <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
            {songBackground ? `Selected: ${songBackground.name || songBackground.path}` : 'No background selected'}
          </span>
        </div>

        {/* 字号选择 */}
        <div style={{ display: 'flex', gap: '6px', marginBottom: '16px' }}>
          {[{ key: 'small', label: 'Small' }, { key: 'medium', label: 'Medium' }, { key: 'large', label: 'Large' }].map(s => (
            <button
              key={s.key}
              className={`btn ${fontSize === s.key ? 'btn--primary' : 'btn--ghost'}`}
              style={{ padding: '4px 10px', fontSize: '12px' }}
              onClick={() => setFontSize(s.key)}
            >
              {s.label}
            </button>
          ))}
        </div>

        <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginBottom: '12px' }}>
          Click any section to project it
        </p>

        {/* 段落列表 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {sections.map((section, idx) => (
            <React.Fragment key={idx}>
              <div
                onClick={() => handleProjectSection(section)}
                style={{
                  padding: '16px', cursor: 'pointer', borderRadius: '8px',
                  background: 'var(--color-surface)', border: '1px solid var(--color-border)',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-primary)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--color-border)'; e.currentTarget.style.boxShadow = 'none'; }}
              >
                <div style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--color-primary)', marginBottom: '8px' }}>
                  🎼 {section.title}
                </div>
                <div style={{ fontSize: '14px', lineHeight: '1.8', whiteSpace: 'pre-line' }}>
                  {section.lines.join('\n')}
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px', marginTop: '10px' }}>
                  <button
                    className="btn btn--primary"
                    style={{ padding: '3px 8px', fontSize: '11px' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleProjectSection(section);
                    }}
                  >
                    ▶ Project Now
                  </button>
                </div>
              </div>
              {idx < sections.length - 1 && (
                <div
                  style={{
                    height: '1px',
                    background: 'linear-gradient(to right, transparent, rgba(255,255,255,0.22), transparent)',
                    margin: '2px 6px 6px',
                  }}
                />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>
    );
  }

  // 歌曲列表视图
  return (
    <div className="song-manager animate-slide-in-up">
      <h2 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '8px' }}>🎵 Songs</h2>
      <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginBottom: '16px' }}>
        Manage worship songs with section-based projection.</p>

      {/* Actions */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        <button className="btn btn--primary" onClick={handleNew}>
          + New Song
        </button>
        <button className="btn btn--ghost" onClick={() => fileInputRef.current?.click()}>
          📥 Import Lyrics
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".txt,.lrc"
          onChange={handleImportFile}
          style={{ display: 'none' }}
        />
        <input
          type="text" placeholder="Search songs..." value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          style={{
            flex: 1, padding: '8px 12px', borderRadius: '6px',
            border: '1px solid var(--color-border)', background: 'var(--color-surface)',
            color: 'var(--color-text-primary)', fontSize: '13px', outline: 'none',
          }}
        />
      </div>

      {/* 歌曲列表 */}
      {filteredSongs.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--color-text-secondary)' }}>
          <div style={{ fontSize: '40px', marginBottom: '12px' }}>🎵</div>
          <div style={{ fontSize: '14px', marginBottom: '8px' }}>No songs yet</div>
          <div style={{ fontSize: '12px' }}>Click "New Song" or "Import Lyrics" to start</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {filteredSongs.map(song => (
            <div
              key={song.id}
              style={{
                padding: '14px 16px', borderRadius: '8px', cursor: 'pointer',
                background: 'var(--color-surface)', border: '1px solid var(--color-border)',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                transition: 'all 0.2s',
              }}
              onClick={() => setSelectedSong(song)}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-primary)'; e.currentTarget.style.transform = 'translateX(4px)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--color-border)'; e.currentTarget.style.transform = 'none'; }}
            >
              <div>
                <div style={{ fontSize: '14px', fontWeight: '600' }}>🎵 {song.title}</div>
                {song.author && (
                  <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
                    {song.author}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  className="btn btn--ghost"
                  onClick={(e) => { e.stopPropagation(); handleQueueSong(song); }}
                  style={{ padding: '4px 8px', fontSize: '12px', color: 'var(--color-primary)' }}
                  title="Add whole song to queue"
                >
                  +                </button>
                <button
                  className="btn btn--ghost"
                  onClick={(e) => { e.stopPropagation(); handleEdit(song); }}
                  style={{ padding: '4px 8px', fontSize: '12px' }}
                >
                  ✏️
                </button>
                <button
                  className="btn btn--ghost"
                  onClick={(e) => { e.stopPropagation(); handleDelete(song.id); }}
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
