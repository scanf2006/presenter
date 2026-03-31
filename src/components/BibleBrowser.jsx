import React, { useState, useEffect, useCallback, useRef } from 'react';

/**
 * 圣经浏览器组件
 * 支持三级导航（书卷→章→节）、快速索引搜索、全文搜索、中英文切换
 */
function BibleBrowser({ onProjectContent }) {
  // 圣经版本
  const [version, setVersion] = useState('cuvs');
  // 书卷列表
  const [books, setBooks] = useState([]);
  // 当前选中的书卷
  const [selectedBook, setSelectedBook] = useState(null);
  // 当前选中的章
  const [selectedChapter, setSelectedChapter] = useState(null);
  // 经文列表
  const [verses, setVerses] = useState([]);
  // 选中的经文（多选）
  const [selectedVerses, setSelectedVerses] = useState([]);
  // 搜索关键词
  const [searchQuery, setSearchQuery] = useState('');
  // 搜索结果
  const [searchResults, setSearchResults] = useState([]);
  // 搜索中
  const [searching, setSearching] = useState(false);
  // 投屏字号
  const [fontSize, setFontSize] = useState('large');

  const isElectron = typeof window.churchDisplay !== 'undefined';
  const searchTimer = useRef(null);

  // 中文书卷名缩写映射表（用于快速索引搜索）
  const BOOK_ABBR = {
    '创': 1, '出': 2, '利': 3, '民': 4, '申': 5, '书': 6, '士': 7, '得': 8,
    '撒上': 9, '撒下': 10, '王上': 11, '王下': 12, '代上': 13, '代下': 14,
    '拉': 15, '尼': 16, '斯': 17, '伯': 18, '诗': 19, '箴': 20, '传': 21, '歌': 22,
    '赛': 23, '耶': 24, '哀': 25, '结': 26, '但': 27, '何': 28, '珥': 29, '摩': 30,
    '俄': 31, '拿': 32, '弥': 33, '鸿': 34, '哈': 35, '番': 36, '该': 37, '亚': 38, '玛': 39,
    '太': 40, '可': 41, '路': 42, '约': 43, '徒': 44, '罗': 45,
    '林前': 46, '林后': 47, '加': 48, '弗': 49, '腓': 50, '西': 51,
    '帖前': 52, '帖后': 53, '提前': 54, '提后': 55, '多': 56, '门': 57,
    '来': 58, '雅': 59, '彼前': 60, '彼后': 61, '约壹': 62, '约贰': 63, '约叁': 64, '犹': 65, '启': 66,
  };

  // 加载书卷列表
  useEffect(() => {
    if (isElectron) {
      window.churchDisplay.bibleGetBooks(version).then(setBooks);
    } else {
      // 浏览器模式模拟数据
      setBooks([
        { sn: 1, shortName: '创', fullName: '创世记', chapterCount: 50, isNewTestament: false },
        { sn: 2, shortName: '出', fullName: '出埃及记', chapterCount: 40, isNewTestament: false },
        { sn: 40, shortName: '太', fullName: '马太福音', chapterCount: 28, isNewTestament: true },
        { sn: 43, shortName: '约', fullName: '约翰福音', chapterCount: 21, isNewTestament: true },
      ]);
    }
  }, [isElectron, version]);

  // 加载经文
  useEffect(() => {
    if (!selectedBook || !selectedChapter) return;
    if (isElectron) {
      window.churchDisplay.bibleGetVerses(version, selectedBook.sn, selectedChapter).then(setVerses);
    } else {
      setVerses([
        { verse: 1, text: '起初，　神创造天地。' },
        { verse: 2, text: '地是空虚混沌，渊面黑暗；　神的灵运行在水面上。' },
        { verse: 3, text: '　神说："要有光"，就有了光。' },
      ]);
    }
    setSelectedVerses([]);
  }, [selectedBook, selectedChapter, version, isElectron]);

  // 解析快速索引（如"创1:1"、"约3:16"）
  const parseQuickIndex = useCallback((query) => {
    // 匹配中文缩写 + 章:节
    const match = query.match(/^([^\d]+)(\d+)(?::(\d+))?$/);
    if (!match) return null;
    const abbr = match[1].trim();
    const chapter = parseInt(match[2]);
    const verse = match[3] ? parseInt(match[3]) : null;
    const bookSN = BOOK_ABBR[abbr];
    if (!bookSN) return null;
    return { bookSN, chapter, verse };
  }, []);

  // 搜索处理
  const handleSearch = useCallback((query) => {
    setSearchQuery(query);
    if (searchTimer.current) clearTimeout(searchTimer.current);

    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    // 先尝试快速索引
    const indexed = parseQuickIndex(query.trim());
    if (indexed) {
      const book = books.find(b => b.sn === indexed.bookSN);
      if (book) {
        setSelectedBook(book);
        setSelectedChapter(indexed.chapter);
        setSearchResults([]);
        return;
      }
    }

    // 延迟全文搜索
    searchTimer.current = setTimeout(async () => {
      if (!isElectron) return;
      setSearching(true);
      const results = await window.churchDisplay.bibleSearch(version, query.trim());
      setSearchResults(results);
      setSearching(false);
    }, 500);
  }, [books, version, isElectron, parseQuickIndex]);

  // 经文选择切换
  const toggleVerse = useCallback((verse) => {
    setSelectedVerses(prev => {
      const exists = prev.find(v => v.verse === verse.verse);
      if (exists) return prev.filter(v => v.verse !== verse.verse);
      return [...prev, verse].sort((a, b) => a.verse - b.verse);
    });
  }, []);

  // 投屏选中经文
  const handleProject = useCallback(() => {
    if (selectedVerses.length === 0 || !selectedBook) return;
    const text = selectedVerses.map(v => `${v.verse} ${v.text}`).join('\n');
    const reference = `${selectedBook.fullName} ${selectedChapter}:${selectedVerses[0].verse}` +
      (selectedVerses.length > 1 ? `-${selectedVerses[selectedVerses.length - 1].verse}` : '');
    onProjectContent({
      type: 'bible',
      text,
      reference,
      fontSize,
    });
  }, [selectedVerses, selectedBook, selectedChapter, fontSize, onProjectContent]);

  // 投屏搜索结果中的某节经文
  const handleProjectSearchResult = useCallback((result) => {
    onProjectContent({
      type: 'bible',
      text: `${result.verse} ${result.text}`,
      reference: `${result.fullName} ${result.chapter}:${result.verse}`,
      fontSize,
    });
  }, [fontSize, onProjectContent]);

  // 旧约/新约书卷分组
  const oldTestament = books.filter(b => !b.isNewTestament);
  const newTestament = books.filter(b => b.isNewTestament);

  return (
    <div className="bible-browser animate-slide-in-up">
      <h2 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '8px' }}>📖 圣经经文</h2>

      {/* 版本切换 + 搜索框 */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', borderRadius: '6px', overflow: 'hidden', border: '1px solid var(--color-border)' }}>
          <button
            className={`btn ${version === 'cuvs' ? 'btn--primary' : 'btn--ghost'}`}
            style={{ borderRadius: 0, padding: '6px 12px', fontSize: '12px' }}
            onClick={() => setVersion('cuvs')}
          >
            中文和合本
          </button>
          <button
            className={`btn ${version === 'kjv' ? 'btn--primary' : 'btn--ghost'}`}
            style={{ borderRadius: 0, padding: '6px 12px', fontSize: '12px' }}
            onClick={() => setVersion('kjv')}
          >
            English KJV
          </button>
        </div>
        <input
          type="text"
          className="bible-search-input"
          placeholder="搜索经文（如：创1:1、约3:16、或输入关键词）"
          value={searchQuery}
          onChange={(e) => handleSearch(e.target.value)}
          style={{
            flex: 1, padding: '8px 12px', borderRadius: '6px',
            border: '1px solid var(--color-border)', background: 'var(--color-surface)',
            color: 'var(--color-text-primary)', fontSize: '13px', outline: 'none',
          }}
        />
      </div>

      {/* 搜索结果 */}
      {searchResults.length > 0 && (
        <div style={{ marginBottom: '16px', maxHeight: '300px', overflowY: 'auto' }}>
          <h3 style={{ fontSize: '14px', marginBottom: '8px', color: 'var(--color-text-secondary)' }}>
            🔍 搜索结果（{searchResults.length}条）
          </h3>
          {searchResults.map((r, idx) => (
            <div
              key={idx}
              style={{
                padding: '10px 12px', marginBottom: '6px', cursor: 'pointer',
                background: 'var(--color-surface)', border: '1px solid var(--color-border)',
                borderRadius: '6px', fontSize: '13px', transition: 'border-color 0.2s',
              }}
              onClick={() => handleProjectSearchResult(r)}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--color-primary)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--color-border)'}
            >
              <span style={{ color: 'var(--color-primary)', fontWeight: 'bold', marginRight: '8px' }}>
                {r.fullName} {r.chapter}:{r.verse}
              </span>
              <span>{r.text}</span>
            </div>
          ))}
        </div>
      )}

      {searching && (
        <div style={{ textAlign: 'center', padding: '20px', color: 'var(--color-text-secondary)' }}>
          <div className="spinner" style={{ margin: '0 auto 8px' }}></div>
          搜索中...
        </div>
      )}

      {/* 三级导航 */}
      {!searchResults.length && !searching && (
        <>
          {/* 第一级：书卷选择 */}
          {!selectedBook && (
            <div>
              <h3 style={{ fontSize: '14px', marginBottom: '12px', color: 'var(--color-text-secondary)' }}>旧约（{oldTestament.length}卷）</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: '6px', marginBottom: '20px' }}>
                {oldTestament.map(book => (
                  <button
                    key={book.sn}
                    onClick={() => { setSelectedBook(book); setSelectedChapter(null); setVerses([]); }}
                    style={{
                      padding: '8px 4px', fontSize: '12px', borderRadius: '6px',
                      border: '1px solid var(--color-border)', background: 'var(--color-surface)',
                      color: 'var(--color-text-primary)', cursor: 'pointer', transition: 'all 0.2s',
                      textAlign: 'center',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-primary)'; e.currentTarget.style.background = 'rgba(99,102,241,0.1)'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--color-border)'; e.currentTarget.style.background = 'var(--color-surface)'; }}
                  >
                    {version === 'cuvs' ? book.shortName : book.fullName.substring(0, 6)}
                  </button>
                ))}
              </div>

              <h3 style={{ fontSize: '14px', marginBottom: '12px', color: 'var(--color-text-secondary)' }}>新约（{newTestament.length}卷）</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: '6px' }}>
                {newTestament.map(book => (
                  <button
                    key={book.sn}
                    onClick={() => { setSelectedBook(book); setSelectedChapter(null); setVerses([]); }}
                    style={{
                      padding: '8px 4px', fontSize: '12px', borderRadius: '6px',
                      border: '1px solid var(--color-border)', background: 'var(--color-surface)',
                      color: 'var(--color-text-primary)', cursor: 'pointer', transition: 'all 0.2s',
                      textAlign: 'center',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = '#10b981'; e.currentTarget.style.background = 'rgba(16,185,129,0.1)'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--color-border)'; e.currentTarget.style.background = 'var(--color-surface)'; }}
                  >
                    {version === 'cuvs' ? book.shortName : book.fullName.substring(0, 6)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 第二级：章选择 */}
          {selectedBook && !selectedChapter && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                <button className="btn btn--ghost" onClick={() => setSelectedBook(null)} style={{ padding: '4px 8px', fontSize: '12px' }}>
                  ◀ 返回
                </button>
                <h3 style={{ fontSize: '15px', fontWeight: 'bold' }}>
                  📗 {selectedBook.fullName}（{selectedBook.chapterCount}章）
                </h3>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(48px, 1fr))', gap: '6px' }}>
                {Array.from({ length: selectedBook.chapterCount }, (_, i) => i + 1).map(ch => (
                  <button
                    key={ch}
                    onClick={() => setSelectedChapter(ch)}
                    style={{
                      padding: '10px 4px', fontSize: '14px', fontWeight: '600', borderRadius: '6px',
                      border: '1px solid var(--color-border)', background: 'var(--color-surface)',
                      color: 'var(--color-text-primary)', cursor: 'pointer', transition: 'all 0.2s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-primary)'; e.currentTarget.style.background = 'rgba(99,102,241,0.15)'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--color-border)'; e.currentTarget.style.background = 'var(--color-surface)'; }}
                  >
                    {ch}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 第三级：经文列表 */}
          {selectedBook && selectedChapter && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button className="btn btn--ghost" onClick={() => setSelectedChapter(null)} style={{ padding: '4px 8px', fontSize: '12px' }}>
                    ◀ 返回
                  </button>
                  <h3 style={{ fontSize: '15px', fontWeight: 'bold' }}>
                    📗 {selectedBook.fullName} 第{selectedChapter}章
                  </h3>
                </div>
                {selectedVerses.length > 0 && (
                  <button className="btn btn--primary" onClick={handleProject}>
                    📤 投屏选中（{selectedVerses.length}节）
                  </button>
                )}
              </div>

              {/* 字号选择 */}
              <div style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
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

              {/* 经文列表 */}
              <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                {verses.map(v => {
                  const isSelected = selectedVerses.some(sv => sv.verse === v.verse);
                  return (
                    <div
                      key={v.verse}
                      onClick={() => toggleVerse(v)}
                      style={{
                        padding: '10px 12px', marginBottom: '4px', cursor: 'pointer',
                        background: isSelected ? 'rgba(99,102,241,0.15)' : 'transparent',
                        border: isSelected ? '1px solid var(--color-primary)' : '1px solid transparent',
                        borderRadius: '6px', fontSize: '14px', lineHeight: '1.6',
                        transition: 'all 0.15s',
                      }}
                    >
                      <span style={{ color: 'var(--color-primary)', fontWeight: 'bold', marginRight: '6px', fontSize: '12px' }}>
                        {v.verse}
                      </span>
                      <span>{v.text}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default BibleBrowser;
