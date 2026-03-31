import React, { useState, useEffect, useCallback, useRef } from 'react';

/**
 * 诗歌歌词管理组件
 * 支持歌曲管理、分段标记编辑、段落选择投屏和歌词文件导入
 */
function SongManager({ onProjectContent }) {
  // 歌曲列表
  const [songs, setSongs] = useState([]);
  // 当前编辑的歌曲
  const [editingSong, setEditingSong] = useState(null);
  // 当前选中的歌曲（查看模式）
  const [selectedSong, setSelectedSong] = useState(null);
  // 编辑表单
  const [formTitle, setFormTitle] = useState('');
  const [formAuthor, setFormAuthor] = useState('');
  const [formLyrics, setFormLyrics] = useState('');
  // 投屏字号
  const [fontSize, setFontSize] = useState('large');
  // 搜索
  const [searchQuery, setSearchQuery] = useState('');

  const isElectron = typeof window.churchDisplay !== 'undefined';
  const fileInputRef = useRef(null);

  // 加载歌曲列表
  const loadSongs = useCallback(async () => {
    if (isElectron) {
      const list = await window.churchDisplay.songsList();
      setSongs(list);
    } else {
      // 浏览器模式模拟数据
      setSongs([
        { id: 1, title: '奇异恩典', author: 'John Newton', lyrics: '[V1]\n奇异恩典 何等甘甜\n我罪已得赦免\n前我失丧 今被寻回\n瞎眼今得看见\n\n[V2]\n如此恩典 使我敬畏\n使我心得安慰\n初信之时 即蒙恩惠\n真是何等宝贵\n\n[C]\n赞美主 赞美主\n奇异恩典 何等甘甜' },
        { id: 2, title: '感谢神', author: '', lyrics: '[V1]\n感谢神 赐我救赎主\n感谢神 丰富预备\n感谢神 过去的同在\n感谢神 主在我旁' },
      ]);
    }
  }, [isElectron]);

  useEffect(() => { loadSongs(); }, [loadSongs]);

  // 解析歌词段落
  const parseLyrics = (lyrics) => {
    if (!lyrics) return [];
    const sections = [];
    const lines = lyrics.split('\n');
    let currentSection = { tag: '', title: '前奏', lines: [] };

    for (const line of lines) {
      const tagMatch = line.trim().match(/^\[(V\d*|C|B|P|E)\](.*)$/i);
      if (tagMatch) {
        if (currentSection.lines.length > 0 || sections.length === 0) {
          if (currentSection.lines.length > 0) sections.push(currentSection);
        }
        const tag = tagMatch[1].toUpperCase();
        const extra = tagMatch[2] ? tagMatch[2].trim() : '';
        let title;
        if (tag.startsWith('V')) title = `主歌 ${tag.substring(1) || ''}`;
        else if (tag === 'C') title = '副歌';
        else if (tag === 'B') title = '桥段';
        else if (tag === 'P') title = '前奏';
        else if (tag === 'E') title = '尾声';
        else title = tag;
        if (extra) title += ` ${extra}`;
        currentSection = { tag, title: title.trim(), lines: [] };
      } else if (line.trim()) {
        currentSection.lines.push(line.trim());
      }
    }
    if (currentSection.lines.length > 0) sections.push(currentSection);
    return sections;
  };

  // 保存歌曲
  const handleSave = useCallback(async () => {
    if (!formTitle.trim() || !formLyrics.trim()) {
      alert('请填写歌曲标题和歌词');
      return;
    }
    const song = {
      id: editingSong?.id || null,
      title: formTitle.trim(),
      author: formAuthor.trim(),
      lyrics: formLyrics.trim(),
    };
    if (isElectron) {
      await window.churchDisplay.songsSave(song);
    }
    setEditingSong(null);
    setFormTitle('');
    setFormAuthor('');
    setFormLyrics('');
    await loadSongs();
  }, [editingSong, formTitle, formAuthor, formLyrics, isElectron, loadSongs]);

  // 删除歌曲
  const handleDelete = useCallback(async (songId) => {
    if (!window.confirm('确定要删除这首歌曲吗？')) return;
    if (isElectron) {
      await window.churchDisplay.songsDelete(songId);
    }
    if (selectedSong?.id === songId) setSelectedSong(null);
    await loadSongs();
  }, [isElectron, selectedSong, loadSongs]);

  // 开始编辑
  const handleEdit = (song) => {
    setEditingSong(song);
    setFormTitle(song.title);
    setFormAuthor(song.author || '');
    setFormLyrics(song.lyrics);
    setSelectedSong(null);
  };

  // 新建歌曲
  const handleNew = () => {
    setEditingSong({ id: null });
    setFormTitle('');
    setFormAuthor('');
    setFormLyrics('[V1]\n（在此输入主歌歌词）\n\n[C]\n（在此输入副歌歌词）');
    setSelectedSong(null);
  };

  // 投屏段落
  const handleProjectSection = useCallback((section, songTitle) => {
    onProjectContent({
      type: 'lyrics',
      text: section.lines.join('\n'),
      sectionTitle: section.title,
      songTitle,
      fontSize,
    });
  }, [fontSize, onProjectContent]);

  // 导入歌词文件
  const handleImportFile = useCallback((event) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target.result;
      const title = file.name.replace(/\.(txt|lrc)$/i, '');
      setEditingSong({ id: null });
      setFormTitle(title);
      setFormAuthor('');
      setFormLyrics(content);
    };
    reader.readAsText(file);
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
            🎵 {editingSong.id ? '编辑歌曲' : '新建歌曲'}
          </h2>
          <button className="btn btn--ghost" onClick={() => setEditingSong(null)}>取消</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <input
            type="text" placeholder="歌曲标题" value={formTitle}
            onChange={e => setFormTitle(e.target.value)}
            style={{
              padding: '10px 12px', borderRadius: '6px', border: '1px solid var(--color-border)',
              background: 'var(--color-surface)', color: 'var(--color-text-primary)', fontSize: '14px', outline: 'none',
            }}
          />
          <input
            type="text" placeholder="作者（可选）" value={formAuthor}
            onChange={e => setFormAuthor(e.target.value)}
            style={{
              padding: '10px 12px', borderRadius: '6px', border: '1px solid var(--color-border)',
              background: 'var(--color-surface)', color: 'var(--color-text-primary)', fontSize: '13px', outline: 'none',
            }}
          />
          <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', padding: '8px 12px', background: 'rgba(99,102,241,0.08)', borderRadius: '6px' }}>
            💡 使用标记分段：<code>[V1]</code> 主歌、<code>[C]</code> 副歌、<code>[B]</code> 桥段、<code>[P]</code> 前奏、<code>[E]</code> 尾声
          </div>
          <textarea
            placeholder="在此输入歌词..." value={formLyrics}
            onChange={e => setFormLyrics(e.target.value)}
            rows={15}
            style={{
              padding: '12px', borderRadius: '6px', border: '1px solid var(--color-border)',
              background: 'var(--color-surface)', color: 'var(--color-text-primary)', fontSize: '14px',
              fontFamily: 'monospace', resize: 'vertical', outline: 'none', lineHeight: '1.6',
            }}
          />
          <button className="btn btn--primary" onClick={handleSave} style={{ padding: '12px' }}>
            💾 保存歌曲
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
              ◀ 返回
            </button>
            <h2 style={{ fontSize: '18px', fontWeight: '600' }}>🎵 {selectedSong.title}</h2>
          </div>
          <button className="btn btn--ghost" onClick={() => handleEdit(selectedSong)} style={{ fontSize: '12px' }}>
            ✏️ 编辑
          </button>
        </div>

        {selectedSong.author && (
          <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginBottom: '16px' }}>
            作者：{selectedSong.author}
          </p>
        )}

        {/* 字号选择 */}
        <div style={{ display: 'flex', gap: '6px', marginBottom: '16px' }}>
          {[{ key: 'small', label: '小' }, { key: 'medium', label: '中' }, { key: 'large', label: '大' }].map(s => (
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
          点击任意段落即可投屏该段歌词
        </p>

        {/* 段落列表 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {sections.map((section, idx) => (
            <div
              key={idx}
              onClick={() => handleProjectSection(section, selectedSong.title)}
              style={{
                padding: '16px', cursor: 'pointer', borderRadius: '8px',
                background: 'var(--color-surface)', border: '1px solid var(--color-border)',
                transition: 'all 0.2s',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-primary)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--color-border)'; e.currentTarget.style.boxShadow = 'none'; }}
            >
              <div style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--color-primary)', marginBottom: '8px' }}>
                🎶 {section.title}
              </div>
              <div style={{ fontSize: '14px', lineHeight: '1.8', whiteSpace: 'pre-line' }}>
                {section.lines.join('\n')}
              </div>
              <div style={{ textAlign: 'right', fontSize: '11px', color: 'var(--color-primary)', marginTop: '8px' }}>
                点击投屏 ▶
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
      <h2 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '8px' }}>🎵 诗歌歌词</h2>
      <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginBottom: '16px' }}>
        管理敬拜诗歌，支持分段标记和段落投屏。
      </p>

      {/* 操作栏 */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        <button className="btn btn--primary" onClick={handleNew}>
          ➕ 新建歌曲
        </button>
        <button className="btn btn--ghost" onClick={() => fileInputRef.current?.click()}>
          📥 导入歌词
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".txt,.lrc"
          onChange={handleImportFile}
          style={{ display: 'none' }}
        />
        <input
          type="text" placeholder="搜索歌曲..." value={searchQuery}
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
          <div style={{ fontSize: '14px', marginBottom: '8px' }}>暂无歌曲</div>
          <div style={{ fontSize: '12px' }}>点击"新建歌曲"或"导入歌词"开始添加</div>
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
                  🗑️
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
