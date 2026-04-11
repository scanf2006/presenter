import React, { useState, useEffect, useCallback, useRef } from 'react';
import { normalizeBibleLine, normalizeBibleText } from '../utils/bibleText';
/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable react-hooks/exhaustive-deps */

/**
 * Bible browser component
 * Keeps Chinese Bible content and supports Chinese quick-index search.
 */
function BibleBrowser({
  onProjectContent,
  onQueueContent,
  onUpdateActiveQueueItem,
  onOpenBackgroundPicker,
  externalBackground,
  activePreloadItem,
  forceShowBibleCatalogToken,
}) {
  // 圣经版本
  const [version, setVersion] = useState('cuvs');
  // 书卷列表
  const [books, setBooks] = useState([]);
  // selected book
  const [selectedBook, setSelectedBook] = useState(null);
  // 当前选中的章
  const [selectedChapter, setSelectedChapter] = useState(null);
  // 经文列表
  const [verses, setVerses] = useState([]);
  // selected verses (multi-select)
  const [selectedVerses, setSelectedVerses] = useState([]);
  // search keyword
  const [searchQuery, setSearchQuery] = useState('');
  // 搜索结果
  const [searchResults, setSearchResults] = useState([]);
  // searching state
  const [searching, setSearching] = useState(false);
  // 投屏字号
  const [fontSize, setFontSize] = useState('large'); // 投屏正文是否显示每节节号
  const [showVerseNumbers, setShowVerseNumbers] = useState(false);
  const [bibleBackground, setBibleBackground] = useState(null);
  const [pendingPreloadSelection, setPendingPreloadSelection] = useState(null);
  const [preloadFocusVerse, setPreloadFocusVerse] = useState(null);
  const [versesContext, setVersesContext] = useState(null);
  const [isApplyingQueuePreload, setIsApplyingQueuePreload] = useState(false);
  const verseRowRefs = useRef(new Map());
  const preloadPayloadRef = useRef(null);
  const versesLoadSeqRef = useRef(0);
  const isApplyingQueuePreloadRef = useRef(false);

  const isElectron = typeof window.churchDisplay !== 'undefined';
  const searchTimer = useRef(null);
  const beginQueuePreload = useCallback(() => {
    isApplyingQueuePreloadRef.current = true;
    setIsApplyingQueuePreload(true);
  }, []);
  const endQueuePreload = useCallback(() => {
    isApplyingQueuePreloadRef.current = false;
    setIsApplyingQueuePreload(false);
  }, []);

  // 中文书卷名缩写映射表（用于快速索引搜索）
  const BOOK_ABBR = {
    创: 1,
    出: 2,
    利: 3,
    民: 4,
    申: 5,
    书: 6,
    士: 7,
    得: 8,
    撒上: 9,
    撒下: 10,
    王上: 11,
    王下: 12,
    代上: 13,
    代下: 14,
    拉: 15,
    尼: 16,
    斯: 17,
    伯: 18,
    诗: 19,
    箴: 20,
    传: 21,
    歌: 22,
    赛: 23,
    耶: 24,
    哀: 25,
    结: 26,
    但: 27,
    何: 28,
    珥: 29,
    摩: 30,
    俄: 31,
    拿: 32,
    弥: 33,
    鸿: 34,
    哈: 35,
    番: 36,
    该: 37,
    亚: 38,
    玛: 39,
    太: 40,
    可: 41,
    路: 42,
    约: 43,
    徒: 44,
    罗: 45,
    林前: 46,
    林后: 47,
    加: 48,
    弗: 49,
    腓: 50,
    西: 51,
    帖前: 52,
    帖后: 53,
    提前: 54,
    提后: 55,
    多: 56,
    门: 57,
    来: 58,
    雅: 59,
    彼前: 60,
    彼后: 61,
    约壹: 62,
    约贰: 63,
    约叁: 64,
    犹: 65,
    启: 66,
  };

  // 加载书卷列表
  useEffect(() => {
    if (isElectron) {
      window.churchDisplay.bibleGetBooks(version).then(setBooks);
    } else {
      // Browser fallback demo data
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
    const loadSeq = ++versesLoadSeqRef.current;
    // Clear stale chapter verses immediately to avoid preload selecting old text.
    setVerses([]);
    setSelectedVerses([]);
    setVersesContext(null);
    if (isElectron) {
      window.churchDisplay
        .bibleGetVerses(version, selectedBook.sn, selectedChapter)
        .then((rows) => {
          if (loadSeq !== versesLoadSeqRef.current) return;
          setVerses(Array.isArray(rows) ? rows : []);
          setVersesContext({
            bookSn: selectedBook.sn,
            chapter: selectedChapter,
            loadSeq,
          });
        });
    } else {
      if (loadSeq !== versesLoadSeqRef.current) return;
      setVerses([
        { verse: 1, text: '起初，神创造天地。' },
        { verse: 2, text: '地是空虚混沌，渊面黑暗；神的灵运行在水面上。' },
        { verse: 3, text: '神说：要有光，就有了光。' },
      ]);
      setVersesContext({
        bookSn: selectedBook.sn,
        chapter: selectedChapter,
        loadSeq,
      });
    }
  }, [selectedBook, selectedChapter, version, isElectron]);

  // Parse quick index such as 创1:1 or 约3:16
  const parseQuickIndex = useCallback((query) => {
    // match Chinese abbreviation + chapter:verse
    const match = query.match(/^([^\d]+)(\d+)(?::(\d+))?$/);
    if (!match) return null;
    const abbr = match[1].trim();
    const chapter = parseInt(match[2]);
    const verse = match[3] ? parseInt(match[3]) : null;
    const bookSN = BOOK_ABBR[abbr];
    if (!bookSN) return null;
    return { bookSN, chapter, verse };
  }, []);

  const normalizeBookName = useCallback(
    (s) =>
      String(s || '')
        .replace(/\s+/g, '')
        .toLowerCase(),
    []
  );

  const parseReference = useCallback((ref) => {
    if (typeof ref !== 'string') return null;
    const m = ref.trim().match(/^(.*)\s+(\d+):(\d+)(?:-(\d+))?$/);
    if (!m) return null;
    const bookName = (m[1] || '').trim();
    const chapter = Number(m[2]);
    const fromVerse = Number(m[3]);
    const toVerse = Number(m[4] || m[3]);
    if (
      !bookName ||
      !Number.isFinite(chapter) ||
      !Number.isFinite(fromVerse) ||
      !Number.isFinite(toVerse)
    )
      return null;
    return { bookName, chapter, fromVerse, toVerse };
  }, []);

  // 搜索处理
  const handleSearch = useCallback(
    (query) => {
      setSearchQuery(query);
      if (searchTimer.current) clearTimeout(searchTimer.current);

      if (!query.trim()) {
        setSearchResults([]);
        return;
      }

      // Try quick index parsing first.
      const indexed = parseQuickIndex(query.trim());
      if (indexed) {
        const book = books.find((b) => b.sn === indexed.bookSN);
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
    },
    [books, version, isElectron, parseQuickIndex]
  );

  // 经文选择切换
  const toggleVerse = useCallback((verse) => {
    setSelectedVerses((prev) => {
      const exists = prev.find((v) => v.verse === verse.verse);
      if (exists) return prev.filter((v) => v.verse !== verse.verse);
      return [...prev, verse].sort((a, b) => a.verse - b.verse);
    });
  }, []);

  const buildSelectedPayload = useCallback(() => {
    if (selectedVerses.length === 0 || !selectedBook) return;
    const text = showVerseNumbers
      ? normalizeBibleText(
          selectedVerses.map((v) => `${v.verse} ${normalizeBibleLine(v.text)}`).join('\n')
        )
      : normalizeBibleText(selectedVerses.map((v) => normalizeBibleLine(v.text)).join('\n'));
    const reference =
      `${selectedBook.fullName} ${selectedChapter}:${selectedVerses[0].verse}` +
      (selectedVerses.length > 1 ? `-${selectedVerses[selectedVerses.length - 1].verse}` : '');
    return {
      type: 'bible',
      text,
      reference,
      fontSize,
      background: bibleBackground,
    };
  }, [selectedVerses, selectedBook, selectedChapter, fontSize, bibleBackground, showVerseNumbers]);

  // 投屏选中经文
  const handleProject = useCallback(() => {
    const payload = buildSelectedPayload();
    if (!payload) return;
    onProjectContent(payload);
    if (isElectron && typeof window.churchDisplay?.sendToProjectorBackground === 'function') {
      window.churchDisplay.sendToProjectorBackground(bibleBackground || null);
    }
    if (typeof onUpdateActiveQueueItem === 'function') {
      onUpdateActiveQueueItem(payload, payload.reference, 'bible');
    }
  }, [
    buildSelectedPayload,
    onProjectContent,
    bibleBackground,
    isElectron,
    onUpdateActiveQueueItem,
  ]);

  const handleQueueSelected = useCallback(() => {
    if (typeof onQueueContent !== 'function') return;
    const payload = buildSelectedPayload();
    if (!payload) return;
    onQueueContent(payload, payload.reference);
  }, [onQueueContent, buildSelectedPayload]);

  // 投屏搜索结果中的某节经文
  const handleProjectSearchResult = useCallback(
    (result) => {
      const payload = {
        type: 'bible',
        text: showVerseNumbers
          ? normalizeBibleText(`${result.verse} ${normalizeBibleLine(result.text)}`)
          : normalizeBibleText(`${normalizeBibleLine(result.text)}`),
        reference: `${result.fullName} ${result.chapter}:${result.verse}`,
        fontSize,
        background: bibleBackground,
      };
      onProjectContent(payload);
      if (isElectron && typeof window.churchDisplay?.sendToProjectorBackground === 'function') {
        window.churchDisplay.sendToProjectorBackground(bibleBackground || null);
      }
      if (typeof onUpdateActiveQueueItem === 'function') {
        onUpdateActiveQueueItem(payload, payload.reference, 'bible');
      }
    },
    [
      fontSize,
      onProjectContent,
      bibleBackground,
      isElectron,
      showVerseNumbers,
      onUpdateActiveQueueItem,
    ]
  );

  const handleQueueSearchResult = useCallback(
    (result) => {
      if (typeof onQueueContent !== 'function') return;
      const payload = {
        type: 'bible',
        text: showVerseNumbers
          ? normalizeBibleText(`${result.verse} ${normalizeBibleLine(result.text)}`)
          : normalizeBibleText(`${normalizeBibleLine(result.text)}`),
        reference: `${result.fullName} ${result.chapter}:${result.verse}`,
        fontSize,
        background: bibleBackground,
      };
      onQueueContent(payload, payload.reference);
    },
    [onQueueContent, fontSize, bibleBackground, showVerseNumbers]
  );

  // Keep refs in sync via effects to avoid stale-closure: the background-change
  // effect fires only when bibleBackground changes, but needs the latest values.
  const handleProjectRef = useRef(handleProject);
  const selectedVersesRef = useRef(selectedVerses);
  useEffect(() => {
    handleProjectRef.current = handleProject;
  }, [handleProject]);
  useEffect(() => {
    selectedVersesRef.current = selectedVerses;
  }, [selectedVerses]);

  useEffect(() => {
    if (isApplyingQueuePreloadRef.current || isApplyingQueuePreload) return;
    if (selectedVersesRef.current.length > 0) {
      handleProjectRef.current();
    }
  }, [bibleBackground, isApplyingQueuePreload]);

  useEffect(() => {
    if (isApplyingQueuePreloadRef.current || isApplyingQueuePreload) return;
    if (selectedVerses.length === 0 || typeof onUpdateActiveQueueItem !== 'function') return;
    const payload = buildSelectedPayload();
    if (!payload) return;
    onUpdateActiveQueueItem(payload, payload.reference, 'bible');
  }, [isApplyingQueuePreload, selectedVerses, buildSelectedPayload, onUpdateActiveQueueItem]);

  useEffect(() => {
    if (externalBackground) {
      setBibleBackground(externalBackground);
    }
  }, [externalBackground?.path, externalBackground?.type]);

  useEffect(() => {
    if (!forceShowBibleCatalogToken) return;
    setSearchQuery('');
    setSearchResults([]);
    setSelectedBook(null);
    setSelectedChapter(null);
    setVerses([]);
    setSelectedVerses([]);
    setPendingPreloadSelection(null);
    setPreloadFocusVerse(null);
    endQueuePreload();
  }, [forceShowBibleCatalogToken, endQueuePreload]);

  useEffect(() => {
    if (!activePreloadItem || activePreloadItem.type !== 'bible' || !activePreloadItem.payload)
      return;
    beginQueuePreload();
    const payload = activePreloadItem.payload;
    preloadPayloadRef.current = payload;
    setSelectedVerses([]);
    if (payload.fontSize) setFontSize(payload.fontSize);
    if (payload.background) setBibleBackground(payload.background);

    const parsed = parseReference(payload.reference);
    if (!parsed || books.length === 0) {
      endQueuePreload();
      return;
    }

    const targetNorm = normalizeBookName(parsed.bookName);
    const targetBook = books.find(
      (b) =>
        normalizeBookName(b.fullName) === targetNorm ||
        normalizeBookName(b.shortName) === targetNorm
    );
    if (!targetBook) {
      endQueuePreload();
      return;
    }

    setSearchResults([]);
    setSearchQuery('');
    setSelectedBook(targetBook);
    setSelectedChapter(parsed.chapter);
    setPendingPreloadSelection({
      bookSn: targetBook.sn,
      chapter: parsed.chapter,
      fromVerse: parsed.fromVerse,
      toVerse: parsed.toVerse,
      token: activePreloadItem.token || Date.now(),
    });
  }, [activePreloadItem?.token, books, normalizeBookName, parseReference, beginQueuePreload, endQueuePreload]);

  useEffect(() => {
    if (!pendingPreloadSelection) return;
    if (!selectedBook || !selectedChapter || !verses.length) return;
    if (!versesContext) return;
    if (versesContext.bookSn !== selectedBook.sn) return;
    if (versesContext.chapter !== selectedChapter) return;
    if (pendingPreloadSelection.bookSn && pendingPreloadSelection.bookSn !== selectedBook.sn)
      return;
    if (selectedChapter !== pendingPreloadSelection.chapter) return;

    const selected = verses.filter(
      (v) =>
        v.verse >= pendingPreloadSelection.fromVerse && v.verse <= pendingPreloadSelection.toVerse
    );
    if (selected.length > 0) {
      setSelectedVerses(selected);
      setPreloadFocusVerse(selected[0].verse);

      // Queue Bible click: project the resolved selected range immediately so first click is correct.
      const sourcePayload = preloadPayloadRef.current || {};
      const nextText = showVerseNumbers
        ? normalizeBibleText(
            selected.map((v) => `${v.verse} ${normalizeBibleLine(v.text)}`).join('\n')
          )
        : normalizeBibleText(selected.map((v) => normalizeBibleLine(v.text)).join('\n'));
      const nextReference =
        sourcePayload.reference ||
        `${selectedBook.fullName} ${selectedChapter}:${selected[0].verse}` +
          (selected.length > 1 ? `-${selected[selected.length - 1].verse}` : '');
      const projectedPayload = {
        type: 'bible',
        text: nextText,
        reference: nextReference,
        fontSize: sourcePayload.fontSize || fontSize,
        background:
          sourcePayload.background !== undefined ? sourcePayload.background : bibleBackground,
      };

      onProjectContent(projectedPayload);
      if (isElectron && typeof window.churchDisplay?.sendToProjectorBackground === 'function') {
        window.churchDisplay.sendToProjectorBackground(projectedPayload.background || null);
      }
      if (typeof onUpdateActiveQueueItem === 'function') {
        onUpdateActiveQueueItem(projectedPayload, projectedPayload.reference, 'bible');
      }
    }
    preloadPayloadRef.current = null;
    setPendingPreloadSelection(null);
    endQueuePreload();
  }, [
    pendingPreloadSelection,
    selectedBook,
    selectedChapter,
    verses,
    versesContext,
    showVerseNumbers,
    fontSize,
    bibleBackground,
    onProjectContent,
    isElectron,
    onUpdateActiveQueueItem,
    endQueuePreload,
  ]);

  useEffect(() => {
    if (!preloadFocusVerse) return;
    const el = verseRowRefs.current.get(preloadFocusVerse);
    if (el && typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    const t = setTimeout(() => setPreloadFocusVerse(null), 1200);
    return () => clearTimeout(t);
  }, [preloadFocusVerse, verses]);

  // 旧约/新约书卷分组
  const oldTestament = books.filter((b) => !b.isNewTestament);
  const newTestament = books.filter((b) => b.isNewTestament);

  return (
    <div className="bible-browser animate-slide-in-up">
      <h2 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '8px' }}>
        Bible
      </h2>

      {/* Version switch + search */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        <div
          style={{
            display: 'flex',
            borderRadius: '6px',
            overflow: 'hidden',
            border: '1px solid var(--color-border)',
          }}
        >
          <button
            className={`btn ${version === 'cuvs' ? 'btn--primary' : 'btn--ghost'}`}
            style={{ borderRadius: 0, padding: '6px 12px', fontSize: '12px' }}
            onClick={() => setVersion('cuvs')}
          >
            Chinese CUV
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
          placeholder="Search Bible (e.g. 创1:1, 约3:16, or keywords)"
          value={searchQuery}
          onChange={(e) => handleSearch(e.target.value)}
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

      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '12px' }}>
        <button className="btn btn--ghost" onClick={() => onOpenBackgroundPicker?.()}>
          🎬 Pick Background from Media
        </button>
        {bibleBackground && (
          <button className="btn btn--ghost" onClick={() => setBibleBackground(null)}>
            Clear Background
          </button>
        )}
        <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
          {bibleBackground
            ? `Selected: ${bibleBackground.name || bibleBackground.path}`
            : 'No background selected'}
        </span>
      </div>
      {/* 搜索结果 */}
      {searchResults.length > 0 && (
        <div style={{ marginBottom: '16px', maxHeight: '300px', overflowY: 'auto' }}>
          <h3
            style={{ fontSize: '14px', marginBottom: '8px', color: 'var(--color-text-secondary)' }}
          >
            🔍 Search Results ({searchResults.length})
          </h3>
          {searchResults.map((r, idx) => (
            <div
              key={idx}
              style={{
                padding: '10px 12px',
                marginBottom: '6px',
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: '6px',
                fontSize: '13px',
                transition: 'border-color 0.2s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--color-primary)')}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--color-border)')}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <div
                  style={{ cursor: 'pointer', flex: 1 }}
                  onClick={() => handleProjectSearchResult(r)}
                >
                  <span
                    style={{
                      color: 'var(--color-primary)',
                      fontWeight: 'bold',
                      marginRight: '8px',
                    }}
                  >
                    {r.fullName} {r.chapter}:{r.verse}
                  </span>
                  <span>{r.text}</span>
                </div>
                <button
                  className="btn btn--ghost"
                  style={{ padding: '4px 8px', fontSize: '11px' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleQueueSearchResult(r);
                  }}
                >
                  + Queue
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {searching && (
        <div style={{ textAlign: 'center', padding: '20px', color: 'var(--color-text-secondary)' }}>
          <div className="spinner" style={{ margin: '0 auto 8px' }}></div>
          Searching...
        </div>
      )}

      {/* 三级导航 */}
      {!searchResults.length && !searching && (
        <>
          {/* 第一级：书卷选择 */}
          {!selectedBook && (
            <div>
              <h3
                style={{
                  fontSize: '14px',
                  marginBottom: '12px',
                  color: 'var(--color-text-secondary)',
                }}
              >
                Old Testament ({oldTestament.length})
              </h3>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))',
                  gap: '6px',
                  marginBottom: '20px',
                }}
              >
                {oldTestament.map((book) => (
                  <button
                    key={book.sn}
                    onClick={() => {
                      setSelectedBook(book);
                      setSelectedChapter(null);
                      setVerses([]);
                    }}
                    style={{
                      padding: '8px 4px',
                      fontSize: '12px',
                      borderRadius: '6px',
                      border: '1px solid var(--color-border)',
                      background: 'var(--color-surface)',
                      color: 'var(--color-text-primary)',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      textAlign: 'center',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'var(--color-primary)';
                      e.currentTarget.style.background = 'rgba(99,102,241,0.1)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'var(--color-border)';
                      e.currentTarget.style.background = 'var(--color-surface)';
                    }}
                  >
                    {version === 'cuvs' ? book.shortName : book.fullName.substring(0, 6)}
                  </button>
                ))}
              </div>

              <h3
                style={{
                  fontSize: '14px',
                  marginBottom: '12px',
                  color: 'var(--color-text-secondary)',
                }}
              >
                New Testament ({newTestament.length})
              </h3>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))',
                  gap: '6px',
                }}
              >
                {newTestament.map((book) => (
                  <button
                    key={book.sn}
                    onClick={() => {
                      setSelectedBook(book);
                      setSelectedChapter(null);
                      setVerses([]);
                    }}
                    style={{
                      padding: '8px 4px',
                      fontSize: '12px',
                      borderRadius: '6px',
                      border: '1px solid var(--color-border)',
                      background: 'var(--color-surface)',
                      color: 'var(--color-text-primary)',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      textAlign: 'center',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = '#10b981';
                      e.currentTarget.style.background = 'rgba(16,185,129,0.1)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'var(--color-border)';
                      e.currentTarget.style.background = 'var(--color-surface)';
                    }}
                  >
                    {version === 'cuvs' ? book.shortName : book.fullName.substring(0, 6)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Level 2: chapter selection */}
          {selectedBook && !selectedChapter && (
            <div>
              <div
                style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}
              >
                <button
                  className="btn btn--ghost"
                  onClick={() => setSelectedBook(null)}
                  style={{ padding: '4px 8px', fontSize: '12px' }}
                >
                  ← Back
                </button>
                <h3 style={{ fontSize: '15px', fontWeight: 'bold' }}>
                  📗 {selectedBook.fullName} ({selectedBook.chapterCount} chapters)
                </h3>
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(48px, 1fr))',
                  gap: '6px',
                }}
              >
                {Array.from({ length: selectedBook.chapterCount }, (_, i) => i + 1).map((ch) => (
                  <button
                    key={ch}
                    onClick={() => setSelectedChapter(ch)}
                    style={{
                      padding: '10px 4px',
                      fontSize: '14px',
                      fontWeight: '600',
                      borderRadius: '6px',
                      border: '1px solid var(--color-border)',
                      background: 'var(--color-surface)',
                      color: 'var(--color-text-primary)',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'var(--color-primary)';
                      e.currentTarget.style.background = 'rgba(99,102,241,0.15)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'var(--color-border)';
                      e.currentTarget.style.background = 'var(--color-surface)';
                    }}
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
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '12px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    className="btn btn--ghost"
                    onClick={() => setSelectedChapter(null)}
                    style={{ padding: '4px 8px', fontSize: '12px' }}
                  >
                    ← Back
                  </button>
                  <h3 style={{ fontSize: '15px', fontWeight: 'bold' }}>
                    📗 {selectedBook.fullName} Chapter {selectedChapter}
                  </h3>
                </div>
                {selectedVerses.length > 0 && (
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button className="btn btn--ghost" onClick={handleQueueSelected}>
                      + Queue ({selectedVerses.length} verses)
                    </button>
                    <button className="btn btn--primary" onClick={handleProject}>
                      📤 Project Selection ({selectedVerses.length} verses)
                    </button>
                  </div>
                )}
              </div>

              {/* 字号选择 */}
              <div
                style={{
                  display: 'flex',
                  gap: '6px',
                  marginBottom: '12px',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                }}
              >
                {[
                  { key: 'small', label: 'Small' },
                  { key: 'medium', label: 'Medium' },
                  { key: 'large', label: 'Large' },
                ].map((s) => (
                  <button
                    key={s.key}
                    className={`btn ${fontSize === s.key ? 'btn--primary' : 'btn--ghost'}`}
                    style={{ padding: '4px 10px', fontSize: '12px' }}
                    onClick={() => setFontSize(s.key)}
                  >
                    {s.label}
                  </button>
                ))}
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '12px',
                    color: 'var(--color-text-secondary)',
                    marginLeft: '4px',
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={showVerseNumbers}
                    onChange={(e) => setShowVerseNumbers(e.target.checked)}
                  />
                  Show Verse Numbers
                </label>
              </div>

              {/* 经文列表 */}
              <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                {verses.map((v) => {
                  const isSelected = selectedVerses.some((sv) => sv.verse === v.verse);
                  const isFocusedFromQueue = preloadFocusVerse === v.verse;
                  return (
                    <div
                      key={v.verse}
                      ref={(el) => {
                        if (el) verseRowRefs.current.set(v.verse, el);
                        else verseRowRefs.current.delete(v.verse);
                      }}
                      onClick={() => toggleVerse(v)}
                      style={{
                        padding: '10px 12px',
                        marginBottom: '4px',
                        cursor: 'pointer',
                        background: isSelected ? 'rgba(99,102,241,0.15)' : 'transparent',
                        border: isSelected
                          ? isFocusedFromQueue
                            ? '2px solid #ff4d4f'
                            : '1px solid var(--color-primary)'
                          : '1px solid transparent',
                        borderRadius: '6px',
                        fontSize: '14px',
                        lineHeight: '1.6',
                        transition: 'all 0.18s',
                      }}
                    >
                      <span
                        style={{
                          color: 'var(--color-primary)',
                          fontWeight: 'bold',
                          marginRight: '6px',
                          fontSize: '12px',
                        }}
                      >
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

