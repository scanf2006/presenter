import React, { useState, useEffect, useCallback, useRef } from 'react';

/**
 * 媒体管理器组件
 * 支持拖拽上传、文件浏览、媒体投屏
 */
function MediaManager({ onProjectMedia }) {
  const [mediaFiles, setMediaFiles] = useState([]);
  const [activeFilter, setActiveFilter] = useState('all');
  const [isDragging, setIsDragging] = useState(false);
  const [importing, setImporting] = useState(false);
  const [pptConverting, setPptConverting] = useState(false);
  const [pptSlides, setPptSlides] = useState(null);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [selectedPdf, setSelectedPdf] = useState(null);
  const [pdfPageCount, setPdfPageCount] = useState(0);
  const [currentPdfPage, setCurrentPdfPage] = useState(1);
  const dropRef = useRef(null);

  const isElectron = typeof window.churchDisplay !== 'undefined';

  // 加载媒体文件列表
  const loadMediaFiles = useCallback(async () => {
    if (isElectron) {
      const type = activeFilter === 'all' ? undefined : activeFilter;
      const files = await window.churchDisplay.getMediaList(type);
      setMediaFiles(files);
    } else {
      // 浏览器模式模拟数据
      setMediaFiles([
        { id: 'demo1', name: '背景图1.jpg', type: 'image', size: 1024000, createdAt: Date.now() },
        { id: 'demo2', name: '敬拜视频.mp4', type: 'video', size: 52428800, createdAt: Date.now() - 1000 },
        { id: 'demo3', name: '周日程序.pdf', type: 'pdf', size: 2048000, createdAt: Date.now() - 2000 },
        { id: 'demo4', name: '敬拜PPT.pptx', type: 'ppt', size: 8192000, createdAt: Date.now() - 3000 },
      ]);
    }
  }, [isElectron, activeFilter]);

  useEffect(() => {
    loadMediaFiles();
  }, [loadMediaFiles]);

  // 文件选择导入
  const handleSelectFiles = useCallback(async (type) => {
    if (!isElectron) return;
    const filePaths = await window.churchDisplay.selectFiles({ type });
    if (filePaths.length > 0) {
      setImporting(true);
      await window.churchDisplay.importFiles(filePaths);
      await loadMediaFiles();
      setImporting(false);
    }
  }, [isElectron, loadMediaFiles]);

  // 拖拽处理
  const handleDragEnter = (e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); };
  const handleDragLeave = (e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); };
  const handleDragOver = (e) => { e.preventDefault(); e.stopPropagation(); };

  const handleDrop = useCallback(async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (!isElectron) return;

    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;

    const filePaths = files.map(f => f.path);
    setImporting(true);
    await window.churchDisplay.importFiles(filePaths);
    await loadMediaFiles();
    setImporting(false);
  }, [isElectron, loadMediaFiles]);

  // 删除文件
  const handleDelete = useCallback(async (file) => {
    if (!isElectron) return;
    await window.churchDisplay.deleteMedia(file.path);
    await loadMediaFiles();
  }, [isElectron, loadMediaFiles]);

  // 投屏媒体
  const handleProjectMedia = useCallback((file) => {
    if (file.type === 'image') {
      onProjectMedia({
        type: 'image',
        path: file.path,
        name: file.name,
      });
    } else if (file.type === 'video') {
      onProjectMedia({
        type: 'video',
        path: file.path,
        name: file.name,
      });
    } else if (file.type === 'pdf') {
      setSelectedPdf(file);
      setCurrentPdfPage(1);
      onProjectMedia({
        type: 'pdf',
        path: file.path,
        name: file.name,
        page: 1,
      });
    } else if (file.type === 'ppt') {
      handleConvertPpt(file);
    }
  }, [onProjectMedia]);

  // PPT 转换
  const handleConvertPpt = useCallback(async (file) => {
    if (!isElectron) return;
    setPptConverting(true);
    const result = await window.churchDisplay.convertPpt(file.path);
    setPptConverting(false);

    if (result.success && result.slides.length > 0) {
      setPptSlides(result.slides);
      setCurrentSlideIndex(0);
      // 投屏第一张
      onProjectMedia({
        type: 'image',
        path: result.slides[0].path,
        name: `${file.name} - 第 1 页`,
      });
    }
  }, [isElectron, onProjectMedia]);

  // PPT 翻页
  const handleSlideNav = useCallback((direction) => {
    if (!pptSlides) return;
    const newIndex = currentSlideIndex + direction;
    if (newIndex < 0 || newIndex >= pptSlides.length) return;
    setCurrentSlideIndex(newIndex);
    onProjectMedia({
      type: 'image',
      path: pptSlides[newIndex].path,
      name: `PPT - 第 ${newIndex + 1} 页`,
    });
  }, [pptSlides, currentSlideIndex, onProjectMedia]);

  // PDF 翻页
  const handlePdfNav = useCallback((direction) => {
    if (!selectedPdf) return;
    const newPage = currentPdfPage + direction;
    if (newPage < 1) return;
    setCurrentPdfPage(newPage);
    onProjectMedia({
      type: 'pdf',
      path: selectedPdf.path,
      name: `${selectedPdf.name} - 第 ${newPage} 页`,
      page: newPage,
    });
  }, [selectedPdf, currentPdfPage, onProjectMedia]);

  // 格式化文件大小
  const formatSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // 获取类型图标
  const getTypeIcon = (type) => {
    switch (type) {
      case 'image': return '🖼️';
      case 'video': return '🎬';
      case 'pdf': return '📄';
      case 'ppt': return '📊';
      default: return '📁';
    }
  };

  // 获取类型标签
  const getTypeLabel = (type) => {
    switch (type) {
      case 'image': return '图片';
      case 'video': return '视频';
      case 'pdf': return 'PDF';
      case 'ppt': return 'PPT';
      default: return '文件';
    }
  };

  const filterOptions = [
    { key: 'all', label: '全部', icon: '📁' },
    { key: 'image', label: '图片', icon: '🖼️' },
    { key: 'video', label: '视频', icon: '🎬' },
    { key: 'pdf', label: 'PDF', icon: '📄' },
    { key: 'ppt', label: 'PPT', icon: '📊' },
  ];

  return (
    <div className="media-manager animate-slide-in-up">
      <h2 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '8px' }}>🎬 媒体管理</h2>
      <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginBottom: '16px' }}>
        导入图片、视频、PDF 和 PPT 文件，点击即可投屏播放。
      </p>

      {/* 过滤器栏 */}
      <div className="media-filter-bar">
        {filterOptions.map((opt) => (
          <button
            key={opt.key}
            className={`media-filter-btn ${activeFilter === opt.key ? 'media-filter-btn--active' : ''}`}
            onClick={() => setActiveFilter(opt.key)}
          >
            <span>{opt.icon}</span>
            <span>{opt.label}</span>
          </button>
        ))}
      </div>

      {/* 导入按钮组 */}
      <div className="media-import-actions">
        <button className="btn btn--primary" onClick={() => handleSelectFiles()}>
          📥 导入文件
        </button>
        <button className="btn btn--ghost" onClick={() => handleSelectFiles('image')}>🖼️ 图片</button>
        <button className="btn btn--ghost" onClick={() => handleSelectFiles('video')}>🎬 视频</button>
        <button className="btn btn--ghost" onClick={() => handleSelectFiles('pdf')}>📄 PDF</button>
        <button className="btn btn--ghost" onClick={() => handleSelectFiles('ppt')}>📊 PPT</button>
      </div>

      {/* 拖拽上传区 */}
      <div
        ref={dropRef}
        className={`media-drop-zone ${isDragging ? 'media-drop-zone--active' : ''}`}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {importing ? (
          <div className="media-drop-zone__importing">
            <div className="spinner"></div>
            <span>正在导入文件...</span>
          </div>
        ) : (
          <>
            <span className="media-drop-zone__icon">📂</span>
            <span className="media-drop-zone__text">
              拖拽文件到此处导入
            </span>
            <span className="media-drop-zone__hint">
              支持图片、视频、PDF、PPT 文件
            </span>
          </>
        )}
      </div>

      {/* PPT 转换状态 */}
      {pptConverting && (
        <div className="media-converting">
          <div className="spinner"></div>
          <span>正在转换 PPT 文件为图片，请稍候...</span>
        </div>
      )}

      {/* PPT 幻灯片导航 */}
      {pptSlides && (
        <div className="media-slide-nav">
          <div className="media-slide-nav__title">
            📊 PPT 幻灯片 ({currentSlideIndex + 1} / {pptSlides.length})
          </div>
          <div className="media-slide-nav__controls">
            <button
              className="btn btn--ghost"
              onClick={() => handleSlideNav(-1)}
              disabled={currentSlideIndex === 0}
            >
              ◀ 上一页
            </button>
            <span className="media-slide-nav__page">
              第 {currentSlideIndex + 1} 页
            </span>
            <button
              className="btn btn--ghost"
              onClick={() => handleSlideNav(1)}
              disabled={currentSlideIndex === pptSlides.length - 1}
            >
              下一页 ▶
            </button>
          </div>
          <button className="btn btn--ghost" onClick={() => setPptSlides(null)} style={{ marginTop: '8px', width: '100%' }}>
            关闭 PPT 导航
          </button>
        </div>
      )}

      {/* PDF 翻页导航 */}
      {selectedPdf && (
        <div className="media-slide-nav">
          <div className="media-slide-nav__title">
            📄 {selectedPdf.name} - 第 {currentPdfPage} 页
          </div>
          <div className="media-slide-nav__controls">
            <button
              className="btn btn--ghost"
              onClick={() => handlePdfNav(-1)}
              disabled={currentPdfPage === 1}
            >
              ◀ 上一页
            </button>
            <span className="media-slide-nav__page">
              第 {currentPdfPage} 页
            </span>
            <button
              className="btn btn--ghost"
              onClick={() => handlePdfNav(1)}
            >
              下一页 ▶
            </button>
          </div>
          <button className="btn btn--ghost" onClick={() => setSelectedPdf(null)} style={{ marginTop: '8px', width: '100%' }}>
            关闭 PDF 导航
          </button>
        </div>
      )}

      {/* 文件列表 */}
      <div className="media-file-list">
        {mediaFiles.length === 0 ? (
          <div className="empty-state" style={{ padding: '40px 0' }}>
            <div className="empty-state__icon">📭</div>
            <div className="empty-state__title">暂无媒体文件</div>
            <div className="empty-state__desc">
              点击"导入文件"或拖拽文件到上方区域开始使用
            </div>
          </div>
        ) : (
          mediaFiles.map((file) => (
            <div key={file.id} className="media-file-item">
              <div className="media-file-item__icon">{getTypeIcon(file.type)}</div>
              <div className="media-file-item__info">
                <div className="media-file-item__name">{file.name}</div>
                <div className="media-file-item__meta">
                  <span className="media-file-item__type-badge">
                    {getTypeLabel(file.type)}
                  </span>
                  <span>{formatSize(file.size)}</span>
                </div>
              </div>
              <div className="media-file-item__actions">
                <button
                  className="btn btn--success"
                  onClick={() => handleProjectMedia(file)}
                  title="投屏播放"
                >
                  📤 投屏
                </button>
                <button
                  className="btn btn--ghost btn--icon"
                  onClick={() => handleDelete(file)}
                  title="删除"
                >
                  🗑️
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default MediaManager;
