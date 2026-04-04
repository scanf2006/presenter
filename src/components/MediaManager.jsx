import React, { useState, useEffect, useCallback, useRef } from 'react';
import PdfThumbnail from './PdfThumbnail';

/**
 * 媒体管理器组�?
 * 支持拖拽上传、文件浏览��媒体投�?
 */
function MediaManager({ onProjectMedia, onAddPlaylist, activePreloadItem, backgroundPickerTarget, onPickBackground, onCancelBackgroundPick }) {
  const [mediaFiles, setMediaFiles] = useState([]);
  const [activeFilter, setActiveFilter] = useState('all');
  const [isDragging, setIsDragging] = useState(false);
  const [importing, setImporting] = useState(false);
  const [pptConverting, setPptConverting] = useState(false);
  const [pptSlides, setPptSlides] = useState(null);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  
  // PDF 网格预览状��?
  const [pdfLoading, setPdfLoading] = useState(false);
  const [activePdf, setActivePdf] = useState(null);
  const [currentPdfPage, setCurrentPdfPage] = useState(1);
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const dropRef = useRef(null);

  const isElectron = typeof window.churchDisplay !== 'undefined';

  // 加载媒体文件列表
  const loadMediaFiles = useCallback(async () => {
    if (isElectron) {
      const type = activeFilter === 'all' ? undefined : activeFilter;
      const files = await window.churchDisplay.getMediaList(type);
      setMediaFiles(files);
    } else {
      // 浏览器模式模拟数�?
      setMediaFiles([
        { id: 'demo1', name: 'background.jpg', type: 'image', size: 1024000, createdAt: Date.now() },
        { id: 'demo2', name: 'worship-video.mp4', type: 'video', size: 52428800, createdAt: Date.now() - 1000 },
        { id: 'demo3', name: 'service-program.pdf', type: 'pdf', size: 2048000, createdAt: Date.now() - 2000 },
        { id: 'demo4', name: 'worship.pptx', type: 'ppt', size: 8192000, createdAt: Date.now() - 3000 },
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

    const filePaths = files.map(f => f.path).filter(Boolean);
    if (filePaths.length === 0) return;
    
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

  // 加载 PDF 生成网格
  const handleLoadPdfGrid = useCallback(async (file) => {
    setPdfLoading(true);
    setActivePdf(null);
    setPptSlides(null); // 关闭 PPT 网格
    setCurrentPdfPage(1);

    try {
      const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.min.mjs');
      const workerUrl = new URL('pdfjs-dist/legacy/build/pdf.worker.min.mjs', import.meta.url).toString();
      pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

      const fileUrl = `local-media://${encodeURIComponent(file.path)}`;
      const response = await fetch(fileUrl);
      if (!response.ok) throw new Error(`Network load failed: ${response.status}`);
      const dataBuffer = await response.arrayBuffer();

      const loadingTask = pdfjsLib.getDocument({ data: dataBuffer });
      const pdfDocument = await loadingTask.promise;

      setActivePdf({
        path: file.path,
        name: file.name,
        pdfDocument,
        numPages: pdfDocument.numPages
      });

      // 立即触发大屏幕第丢�页投�?
      onProjectMedia({
        type: 'pdf',
        path: file.path,
        name: file.name,
        page: 1,
      });
    } catch (err) {
      console.error('[MediaManager] PDF load failed:', err);
      alert('Failed to load PDF thumbnails: ' + err.message);
    } finally {
      setPdfLoading(false);
    }
  }, [onProjectMedia]);

  // 投屏媒体
  const handleProjectMedia = useCallback((file) => {
    if (backgroundPickerTarget) {
      if (file.type === 'image' || file.type === 'video') {
        onPickBackground?.({ type: file.type, path: file.path, name: file.name });
      } else {
        alert('Background only supports image or video');
      }
      return;
    }
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
      handleLoadPdfGrid(file);
    } else if (file.type === 'ppt') {
      handleConvertPpt(file);
    }
  }, [onProjectMedia, handleLoadPdfGrid, backgroundPickerTarget, onPickBackground]);

  const parseYouTubeId = useCallback((url) => {
    if (!url) return null;
    const input = url.trim();
    try {
      const u = new URL(input);
      if (u.hostname.includes('youtu.be')) {
        const id = u.pathname.replace('/', '').trim();
        return id || null;
      }
      if (u.hostname.includes('youtube.com')) {
        if (u.pathname.startsWith('/watch')) {
          return u.searchParams.get('v');
        }
        if (u.pathname.startsWith('/shorts/')) {
          return u.pathname.split('/')[2] || null;
        }
        if (u.pathname.startsWith('/embed/')) {
          return u.pathname.split('/')[2] || null;
        }
      }
    } catch (_) {
      const match = input.match(/(?:v=|youtu\.be\/|shorts\/|embed\/)([A-Za-z0-9_-]{11})/);
      return match ? match[1] : null;
    }
    return null;
  }, []);

  const handleProjectYouTube = useCallback(() => {
    const id = parseYouTubeId(youtubeUrl);
    if (!id) {
      alert('Please enter a valid YouTube URL');
      return;
    }
    onProjectMedia({
      type: 'youtube',
      videoId: id,
      url: youtubeUrl.trim(),
      name: `YouTube - ${id}`,
    });
  }, [youtubeUrl, parseYouTubeId, onProjectMedia]);

  const handleQueueYouTube = useCallback(() => {
    const id = parseYouTubeId(youtubeUrl);
    if (!id) {
      alert('Please enter a valid YouTube URL');
      return;
    }
    if (onAddPlaylist) {
      onAddPlaylist({
        type: 'youtube',
        name: `YouTube - ${id}`,
        payload: {
          type: 'youtube',
          videoId: id,
          url: youtubeUrl.trim(),
          name: `YouTube - ${id}`,
        },
      });
    }
  }, [youtubeUrl, parseYouTubeId, onAddPlaylist]);

  // PPT 转换
  const handleConvertPpt = useCallback(async (file) => {
    if (!isElectron) return;
    setPptConverting(true);
    const result = await window.churchDisplay.convertPpt(file.path);
    setPptConverting(false);

    if (result.success && result.slides.length > 0) {
      setPptSlides(result.slides);
      setCurrentSlideIndex(0);
      // 投屏第一�?
      onProjectMedia({
        type: 'image',
        path: result.slides[0].path,
        name: `${file.name} - Page 1`,
      });
    } else {
      if (result.error === 'TIMEOUT') {
        alert('PPT conversion timed out (over 2 minutes). Please close any PowerPoint popups and retry.');
      } else {
        alert(`PPT conversion failed:\n${result.error || 'Unknown error'}\n\nPlease verify PPT format and Office availability.`);
      }
    }
  }, [isElectron, onProjectMedia]);

  // === 新增：接管播放列表传来的濢�活载入任�?===
  useEffect(() => {
    if (activePreloadItem) {
      const type = activePreloadItem.type;
      if (type === 'ppt' || type === 'pdf') {
        const file = { 
          type: type, 
          path: activePreloadItem.payload.path, 
          name: activePreloadItem.payload.name 
        };
        if (type === 'ppt') handleConvertPpt(file);
        if (type === 'pdf') handleLoadPdfGrid(file);
      }
    }
  }, [activePreloadItem, handleConvertPpt, handleLoadPdfGrid]);

  // PPT 翻页
  const handleSlideNav = useCallback((direction) => {
    if (!pptSlides) return;
    const newIndex = currentSlideIndex + direction;
    if (newIndex < 0 || newIndex >= pptSlides.length) return;
    setCurrentSlideIndex(newIndex);
    onProjectMedia({
      type: 'image',
      path: pptSlides[newIndex].path,
      name: `PPT - Page ${newIndex + 1}`,
    });
  }, [pptSlides, currentSlideIndex, onProjectMedia]);

  // 格式化文件大�?
  const formatSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // 获取类型图标
  const getTypeIcon = (type) => {
    switch (type) {
      case 'image': return '🖼';
      case 'video': return '🎬';
      case 'pdf': return '📄';
      case 'ppt': return '📊';
      default: return '📁';
    }
  };

  // 获取类型标签
  const getTypeLabel = (type) => {
    switch (type) {
      case 'image': return 'Image';
      case 'video': return 'Video';
      case 'pdf': return 'PDF';
      case 'ppt': return 'PPT';
      default: return 'File';
    }
  };

  const filterOptions = [
    { key: 'all', label: 'All', icon: '📁' },
    { key: 'image', label: 'Image', icon: '🖼' },
    { key: 'video', label: 'Video', icon: '🎬' },
    { key: 'pdf', label: 'PDF', icon: '📄' },
    { key: 'ppt', label: 'PPT', icon: '📊' },
  ];

  const isViewingDetail = activePdf || pptSlides || pptConverting || pdfLoading;

  return (
    <div className="media-manager animate-slide-in-up">
      <h2 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '8px' }}>🎬 Media</h2>
      <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginBottom: '16px' }}>
        Import image, video, PDF and PPT files. Click to project.
      </p>

      {!isViewingDetail && (
        <>
          {backgroundPickerTarget && (
            <div style={{
              marginBottom: '12px',
              padding: '10px 12px',
              borderRadius: '8px',
              border: '1px solid rgba(99,102,241,0.35)',
              background: 'rgba(99,102,241,0.12)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '12px',
              fontSize: '12px',
            }}>
              <span>Background picker mode: click an image/video to apply and return.</span>
              <button className="btn btn--ghost" onClick={() => onCancelBackgroundPick?.()}>Cancel</button>
            </div>
          )}

          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
            <input
              type="text"
              placeholder="Paste YouTube URL (e.g. https://youtu.be/...)"
              value={youtubeUrl}
              onChange={(e) => setYoutubeUrl(e.target.value)}
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
            <button className="btn btn--primary" onClick={handleProjectYouTube}>Play</button>
            <button className="btn btn--ghost" onClick={handleQueueYouTube}>Queue</button>
          </div>

          {/* Filter bar */}
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

      {/* Import buttons */}
      <div className="media-import-actions">
        <button className="btn btn--primary" onClick={() => handleSelectFiles()}>
          📥 Import Files
        </button>
        <button className="btn btn--ghost" onClick={() => handleSelectFiles('image')}>🖼 Image</button>
        <button className="btn btn--ghost" onClick={() => handleSelectFiles('video')}>🎬 Video</button>
        <button className="btn btn--ghost" onClick={() => handleSelectFiles('pdf')}>📄 PDF</button>
        <button className="btn btn--ghost" onClick={() => handleSelectFiles('ppt')}>📊 PPT</button>
      </div>

          {/* Drag and drop upload */}
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
                <span>Importing files...</span>
              </div>
            ) : (
              <>
                <span className="media-drop-zone__icon">📂</span>
                <span className="media-drop-zone__text">
                  Drag files here to import
                </span>
                <span className="media-drop-zone__hint">
                  Supports image, video, PDF and PPT
                </span>
              </>
            )}
          </div>
        </>
      )}

      {/* PPT converting */}
      {pptConverting && (
        <div className="media-converting">
          <div className="spinner"></div>
          <span>Converting PPT to images, please wait...</span>
        </div>
      )}

      {/* PDF parsing */}
      {pdfLoading && (
        <div className="media-converting">
          <div className="spinner"></div>
          <span>Parsing PDF and building thumbnails...</span>
        </div>
      )}

      {/* PDF page grid */}
      {activePdf && (
        <div className="media-slide-selector" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '16px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 'bold' }}>
              📄 {activePdf.name} - Thumbnails <span style={{ color: 'var(--color-text-secondary)', fontSize: '13px', fontWeight: 'normal' }}>({currentPdfPage} / {activePdf.numPages})</span>
            </h3>
            <button className="btn btn--ghost" style={{ padding: '4px 8px', fontSize: '12px' }} onClick={() => setActivePdf(null)}>Close</button>
          </div>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', 
            gap: '12px',
            maxHeight: '400px',
            overflowY: 'auto',
            paddingRight: '6px'
          }}>
            {Array.from({ length: activePdf.numPages }).map((_, i) => {
              const pageNumber = i + 1;
              return (
                <PdfThumbnail
                  key={pageNumber}
                  pdfDocument={activePdf.pdfDocument}
                  pageNumber={pageNumber}
                  isSelected={currentPdfPage === pageNumber}
                  onClick={() => {
                    setCurrentPdfPage(pageNumber);
                    onProjectMedia({
                      type: 'pdf',
                      path: activePdf.path,
                      name: activePdf.name,
                      page: pageNumber,
                    });
                  }}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* PPT slide grid */}
      {pptSlides && (
        <div className="media-slide-selector" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '16px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 'bold' }}>
              📊 PPT Slides <span style={{ color: 'var(--color-text-secondary)', fontSize: '13px', fontWeight: 'normal' }}>({currentSlideIndex + 1} / {pptSlides.length})</span>
            </h3>
            <button className="btn btn--ghost" style={{ padding: '4px 8px', fontSize: '12px' }} onClick={() => setPptSlides(null)}>Close</button>
          </div>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', 
            gap: '12px',
            maxHeight: '400px',
            overflowY: 'auto',
            paddingRight: '6px'
          }}>
            {pptSlides.map((slide, index) => (
              <div 
                key={slide.path}
                onClick={() => {
                  setCurrentSlideIndex(index);
                  onProjectMedia({
                    type: 'image',
                    path: slide.path,
                    name: `PPT - Page ${index + 1}`,
                  });
                }}
                style={{
                  cursor: 'pointer',
                  border: currentSlideIndex === index ? '2px solid var(--color-primary)' : '2px solid transparent',
                  borderRadius: '6px',
                  overflow: 'hidden',
                  position: 'relative',
                  backgroundColor: '#000',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
                }}
              >
                <img 
                  src={`local-media://${encodeURIComponent(slide.path)}`} 
                  alt={`Slide ${index + 1}`}
                  style={{ width: '100%', display: 'block', aspectRatio: '16/9', objectFit: 'contain' }}
                />
                <div style={{ 
                  position: 'absolute', 
                  bottom: 0, right: 0, 
                  background: currentSlideIndex === index ? 'var(--color-primary)' : 'rgba(0,0,0,0.7)', 
                  color: '#fff', 
                  fontSize: '12px', 
                  fontWeight: 'bold',
                  padding: '2px 8px',
                  borderTopLeftRadius: '6px'
                }}>
                  {index + 1}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!isViewingDetail && (
        <>
          {/* Media library */}
          <h3 style={{ fontSize: '15px', fontWeight: 'bold', marginTop: '24px', marginBottom: '16px' }}>
            📁 Media Library
          </h3>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', 
            gap: '16px'
          }}>
            {mediaFiles.length === 0 ? (
          <div className="empty-state" style={{ padding: '40px 0', gridColumn: '1 / -1' }}>
            <div className="empty-state__icon">📭</div>
            <div className="empty-state__title">No media files</div>
            <div className="empty-state__desc">
              Click "Import Files" or drag files into the drop zone above.
            </div>
          </div>
        ) : (
          mediaFiles.map((file) => (
            <div 
              key={file.id} 
              style={{
                position: 'relative',
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: '8px',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.borderColor = 'var(--color-primary)';
                e.currentTarget.style.boxShadow = '0 6px 16px rgba(0,0,0,0.4)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'none';
                e.currentTarget.style.borderColor = 'var(--color-border)';
                e.currentTarget.style.boxShadow = 'none';
              }}
              onClick={() => handleProjectMedia(file)}
              title={`Project now: ${file.name}`}
            >
              {/* Thumbnail area */}
              <div style={{ 
                height: '110px', 
                backgroundColor: '#0a0a0a', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                position: 'relative' 
              }}>
                {file.type === 'image' ? (
                  <img src={`local-media://${encodeURIComponent(file.path)}`} alt={file.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : file.type === 'video' ? (
                  <video src={`local-media://${encodeURIComponent(file.path)}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ fontSize: '48px' }}>{getTypeIcon(file.type)}</div>
                )}
                
                {/* Hover action: delete */}
                <button
                  onClick={(e) => { 
                    e.stopPropagation(); 
                    if(window.confirm(`Delete ${file.name}?`)) handleDelete(file); 
                  }}
                  style={{ 
                    position: 'absolute', top: '6px', right: '6px', 
                    background: 'rgba(0,0,0,0.7)', border: 'none', borderRadius: '4px', 
                    color: '#ff4d4f', padding: '4px', cursor: 'pointer', zIndex: 10,
                    fontSize: '12px'
                  }}
                  title="Delete file"
                  onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(0,0,0,0.9)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(0,0,0,0.7)'}
                >
                  🗑
                </button>

                {/* Type badge */}
                <div style={{ 
                  position: 'absolute', bottom: '6px', left: '6px', 
                  background: 'rgba(0,0,0,0.7)', borderRadius: '4px', 
                  padding: '2px 6px', fontSize: '11px', color: '#fff', fontWeight: 'bold' 
                }}>
                  {getTypeIcon(file.type)} {getTypeLabel(file.type)}
                </div>
              </div>

              {/* File info */}
              <div style={{ padding: '10px' }}>
                <div style={{ 
                  fontSize: '13px', 
                  fontWeight: '500', 
                  whiteSpace: 'nowrap', 
                  overflow: 'hidden', 
                  textOverflow: 'ellipsis',
                  color: 'var(--color-text-primary)'
                }}>
                  {file.name}
                </div>
                <div style={{ 
                  fontSize: '11px', 
                  color: 'var(--color-text-secondary)',
                  marginTop: '4px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <span>{formatSize(file.size)}</span>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <span 
                      style={{ color: 'var(--color-primary)', cursor: 'pointer', padding: '2px 6px', background: 'rgba(99,102,241,0.1)', borderRadius: '4px' }}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onAddPlaylist) {
                          onAddPlaylist({
                            type: file.type,
                            name: file.name,
                            payload: {
                              type: file.type,
                              path: file.path,
                              name: file.name
                            }
                          });
                        }
                      }}
                      title="Add to queue"
                    >+</span>
                    <span style={{ color: 'var(--color-primary)' }} title="Project now" onClick={(e) => { e.stopPropagation(); handleProjectMedia(file); }}>▶</span>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
      </>
      )}
    </div>
  );
}

export default MediaManager;
