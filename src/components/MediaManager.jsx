import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import PdfThumbnail from './PdfThumbnail';
import { getYouTubeVideoIdFromUrl, normalizeYouTubeWatchUrl } from '../utils/youtube';
import {
  getSelectableThumbCardStyle,
  getSelectableThumbIndexStyle,
  getSelectableThumbSelectedTagStyle,
} from '../utils/thumbnail';
import { useAppContext } from '../contexts/AppContext';
import { useI18n } from '../contexts/I18nContext';

const MEDIA_TYPE_ORDER = ['image', 'video', 'pdf', 'ppt'];

function MediaManager({
  onProjectMedia,
  onAddPlaylist,
  activePreloadItem,
  forceShowMediaHomeToken,
  backgroundPickerTarget,
  onPickBackground,
  onCancelBackgroundPick,
}) {
  const { t } = useI18n();
  const [mediaFiles, setMediaFiles] = useState([]);
  const [activeFilter, setActiveFilter] = useState('all');
  const [isDragging, setIsDragging] = useState(false);
  const [importing, setImporting] = useState(false);
  const [pptConverting, setPptConverting] = useState(false);
  const [pptSlides, setPptSlides] = useState(null);
  const [pptSourcePath, setPptSourcePath] = useState('');
  const [currentSlideIndex, setCurrentSlideIndex] = useState(-1);

  const [pdfLoading, setPdfLoading] = useState(false);
  const [activePdf, setActivePdf] = useState(null);
  const [currentPdfPage, setCurrentPdfPage] = useState(1);
  const [selectedMediaKey, setSelectedMediaKey] = useState('');
  const [detailOpenedFromQueue, setDetailOpenedFromQueue] = useState(false);
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [youtubeDownload, setYoutubeDownload] = useState({ status: 'idle', percent: null });
  const dropRef = useRef(null);
  const pdfThumbRefs = useRef(new Map());
  const pptThumbRefs = useRef(new Map());
  const pdfLoadRequestSeqRef = useRef(0);
  const pptConvertRequestSeqRef = useRef(0);
  const staleDropStatsRef = useRef({ pdf: 0, ppt: 0 });

  const isElectron = typeof window.churchDisplay !== 'undefined';
  const { showToast, showConfirm, activeSection } = useAppContext();
  const isMediaSectionActive = activeSection === 'media';

  useEffect(() => {
    if (typeof window.churchDisplay?.onYouTubeCacheProgress !== 'function') return undefined;
    return window.churchDisplay.onYouTubeCacheProgress((next) => {
      setYoutubeDownload({
        status: next?.status || 'idle',
        percent: Number.isFinite(next?.percent) ? next.percent : null,
      });
    });
  }, []);

  const logStaleDrop = useCallback((type) => {
    if (!import.meta.env.DEV) return;
    if (type !== 'pdf' && type !== 'ppt') return;
    staleDropStatsRef.current[type] += 1;
    // Dev-only signal: track dropped stale async results to verify race-condition mitigation.
    console.debug(
      `[MediaManager] stale ${type.toUpperCase()} result dropped (pdf=${staleDropStatsRef.current.pdf}, ppt=${staleDropStatsRef.current.ppt})`
    );
  }, []);

  const loadMediaFiles = useCallback(async () => {
    if (isElectron) {
      const type = activeFilter === 'all' ? undefined : activeFilter;
      const files = await window.churchDisplay.getMediaList(type);
      setMediaFiles(files);
      return;
    }

    setMediaFiles([
      { id: 'demo1', name: 'background.jpg', type: 'image', size: 1024000, createdAt: Date.now() },
      {
        id: 'demo2',
        name: 'worship-video.mp4',
        type: 'video',
        size: 52428800,
        createdAt: Date.now() - 1000,
      },
      {
        id: 'demo3',
        name: 'service-program.pdf',
        type: 'pdf',
        size: 2048000,
        createdAt: Date.now() - 2000,
      },
      {
        id: 'demo4',
        name: 'worship.pptx',
        type: 'ppt',
        size: 8192000,
        createdAt: Date.now() - 3000,
      },
    ]);
  }, [isElectron, activeFilter]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadMediaFiles();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadMediaFiles]);

  const handleSelectFiles = useCallback(
    async (type) => {
      if (!isElectron) return;
      const filePaths = await window.churchDisplay.selectFiles({ type });
      if (!Array.isArray(filePaths) || filePaths.length === 0) return;

      setImporting(true);
      await window.churchDisplay.importFiles(filePaths);
      await loadMediaFiles();
      setImporting(false);
    },
    [isElectron, loadMediaFiles]
  );

  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };
  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };
  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = useCallback(
    async (e) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      if (!isElectron) return;

      const files = Array.from(e.dataTransfer.files || []);
      if (files.length === 0) return;

      const filePaths = files.map((f) => f.path).filter(Boolean);
      if (filePaths.length === 0) return;

      setImporting(true);
      await window.churchDisplay.importFiles(filePaths);
      await loadMediaFiles();
      setImporting(false);
    },
    [isElectron, loadMediaFiles]
  );

  const handleDelete = useCallback(
    async (file) => {
      if (!isElectron) return;
      await window.churchDisplay.deleteMedia(file.path);
      await loadMediaFiles();
    },
    [isElectron, loadMediaFiles]
  );

  const handleLoadPdfGrid = useCallback(
    async (file) => {
      const requestSeq = ++pdfLoadRequestSeqRef.current;
      // Switching to PDF invalidates any previous PPT conversion result.
      pptConvertRequestSeqRef.current += 1;
      setDetailOpenedFromQueue(Boolean(file?.deferProject));
      setPdfLoading(true);
      // M7: Destroy previous PDF document before loading new one.
      setActivePdf((prev) => {
        if (prev?.pdfDocument) prev.pdfDocument.destroy().catch(() => {});
        return null;
      });
      setPptSlides(null);
      setCurrentPdfPage(1);

      try {
        const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.min.mjs');
        const workerUrl = new URL(
          'pdfjs-dist/legacy/build/pdf.worker.min.mjs',
          import.meta.url
        ).toString();
        pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

        const fileUrl = `local-media://${encodeURIComponent(file.path)}`;
        const response = await fetch(fileUrl);
        if (!response.ok) throw new Error(`Network load failed: ${response.status}`);
        const dataBuffer = await response.arrayBuffer();

        const loadingTask = pdfjsLib.getDocument({ data: dataBuffer });
        const pdfDocument = await loadingTask.promise;
        if (requestSeq !== pdfLoadRequestSeqRef.current) {
          logStaleDrop('pdf');
          pdfDocument.destroy().catch(() => {});
          return;
        }

        setActivePdf({
          path: file.path,
          name: file.name,
          pdfDocument,
          numPages: pdfDocument.numPages,
        });

        if (!file.deferProject) {
          onProjectMedia({
            type: 'pdf',
            path: file.path,
            name: file.name,
            page: 1,
            disableTransitionOnce: true,
          });
        }
      } catch (err) {
        if (requestSeq !== pdfLoadRequestSeqRef.current) return;
        console.error('[MediaManager] PDF load failed:', err);
      showToast(`${t('media.pdfLoadFailed', 'Failed to load PDF thumbnails')}: ${err.message}`, 'error');
      } finally {
        if (requestSeq === pdfLoadRequestSeqRef.current) {
          setPdfLoading(false);
        }
      }
    },
    [onProjectMedia, showToast, t, logStaleDrop]
  );

  const handleConvertPpt = useCallback(
    async (file) => {
      if (!isElectron) return;
      const requestSeq = ++pptConvertRequestSeqRef.current;
      // Switching to PPT invalidates any previous PDF load result.
      pdfLoadRequestSeqRef.current += 1;
      setDetailOpenedFromQueue(Boolean(file?.deferProject));
      setActivePdf((prev) => {
        if (prev?.pdfDocument) prev.pdfDocument.destroy().catch(() => {});
        return null;
      });
      setCurrentPdfPage(1);
      setPptSourcePath(file?.path || '');
      setPptConverting(true);
      const result = await window.churchDisplay.convertPpt(file.path);
      if (requestSeq !== pptConvertRequestSeqRef.current) {
        logStaleDrop('ppt');
        return;
      }
      setPptConverting(false);

      if (result.success && result.slides.length > 0) {
        setPptSlides(result.slides);
        setCurrentSlideIndex(-1);
        return;
      }

      if (result.error === 'TIMEOUT') {
        setPptSourcePath('');
        showToast(
          t(
            'media.pptTimeout',
            'PPT conversion timed out (over 2 minutes). Please close PowerPoint popups and retry.'
          ),
          'error'
        );
      } else {
        setPptSourcePath('');
        showToast(`${t('media.pptFailed', 'PPT conversion failed')}: ${result.error || t('media.unknownError', 'Unknown error')}`, 'error');
      }
    },
    [isElectron, showToast, t, logStaleDrop]
  );

  const handleProjectMedia = useCallback(
    (file) => {
      if (backgroundPickerTarget) {
        if (file.type === 'image' || file.type === 'video') {
          onPickBackground?.({ type: file.type, path: file.path, name: file.name });
        } else {
          showToast(t('media.bgOnlyImageVideo', 'Background only supports image or video'), 'warning');
        }
        return;
      }

      if (file.type === 'image') {
        onProjectMedia({ type: 'image', path: file.path, name: file.name });
      } else if (file.type === 'video') {
        onProjectMedia({ type: 'video', path: file.path, name: file.name });
      } else if (file.type === 'pdf') {
        handleLoadPdfGrid(file);
      } else if (file.type === 'ppt') {
        handleConvertPpt(file);
      }
    },
    [
      backgroundPickerTarget,
      onPickBackground,
      onProjectMedia,
      handleLoadPdfGrid,
      handleConvertPpt,
      showToast,
      t,
    ]
  );

  const parseYouTubeId = useCallback((url) => {
    const id = getYouTubeVideoIdFromUrl(url);
    return id || null;
  }, []);

  const handleProjectYouTube = useCallback(() => {
    const id = parseYouTubeId(youtubeUrl);
    if (!id) {
      showToast(t('media.invalidYoutubeUrl', 'Please enter a valid YouTube URL'), 'warning');
      return;
    }
    onProjectMedia({
      type: 'youtube',
      videoId: id,
      url: normalizeYouTubeWatchUrl(youtubeUrl) || youtubeUrl.trim(),
      name: `YouTube - ${id}`,
    });
  }, [youtubeUrl, parseYouTubeId, onProjectMedia, showToast, t]);

  const handleQueueYouTube = useCallback(() => {
    const id = parseYouTubeId(youtubeUrl);
    if (!id) {
      showToast(t('media.invalidYoutubeUrl', 'Please enter a valid YouTube URL'), 'warning');
      return;
    }
    const normalizedUrl = normalizeYouTubeWatchUrl(youtubeUrl) || youtubeUrl.trim();
    if (!onAddPlaylist) return;

    onAddPlaylist({
      type: 'youtube',
      name: `YouTube - ${id}`,
      payload: {
        type: 'youtube',
        videoId: id,
        url: normalizedUrl,
        name: `YouTube - ${id}`,
      },
    });
    showToast(t('media.youtubeQueued', 'YouTube added to queue. Caching in background.'), 'info');

    if (typeof window.churchDisplay?.youtubeCacheDownload === 'function') {
      setYoutubeDownload({ status: 'resolving', percent: null });
      void (async () => {
        try {
          const resolved = await window.churchDisplay.youtubeCacheDownload(normalizedUrl);
          if (resolved?.success && resolved?.localPath) {
            showToast(t('media.youtubeCached', 'YouTube cached and added to queue'));
            return;
          }
          showToast(
            t('media.youtubeCacheFailed', 'YouTube was added to queue, but offline caching failed.'),
            'warning'
          );
        } catch (_) {
          setYoutubeDownload({ status: 'failed', percent: null });
          showToast(
            t('media.youtubeCacheFailed', 'YouTube was added to queue, but offline caching failed.'),
            'warning'
          );
        }
      })();
    }
  }, [youtubeUrl, parseYouTubeId, onAddPlaylist, showToast, t]);

  useEffect(() => {
    if (!activePreloadItem) return;
    const type = activePreloadItem.type;
    if (type !== 'ppt' && type !== 'pdf') return;

    const file = {
      type,
      path: activePreloadItem.payload.path,
      name: activePreloadItem.payload.name,
      deferProject: !!activePreloadItem.payload.deferProject,
    };

    const timer = setTimeout(() => {
      if (type === 'ppt') void handleConvertPpt(file);
      if (type === 'pdf') void handleLoadPdfGrid(file);
    }, 0);
    return () => clearTimeout(timer);
  }, [activePreloadItem, handleConvertPpt, handleLoadPdfGrid]);

  useEffect(() => {
    const type = activePreloadItem?.type;
    if (type === 'ppt' || type === 'pdf') return;
    // Leaving media preload mode should invalidate stale async completions.
    pdfLoadRequestSeqRef.current += 1;
    pptConvertRequestSeqRef.current += 1;
  }, [activePreloadItem]);

  // M10-R2: Use a ref for activePdf to avoid the forceShowMediaHomeToken effect
  // depending on activePdf?.pdfDocument (which it modifies, causing double-fire).
  const activePdfRef = useRef(activePdf);
  useEffect(() => {
    activePdfRef.current = activePdf;
  }, [activePdf]);

  useEffect(() => {
    if (!forceShowMediaHomeToken) return;
    const timer = setTimeout(() => {
      // Force-home action should invalidate stale async completions.
      pdfLoadRequestSeqRef.current += 1;
      pptConvertRequestSeqRef.current += 1;
      setPptConverting(false);
      setPdfLoading(false);
      setPptSlides(null);
      setPptSourcePath('');
      // M7/M10-R2: Destroy PDF document before clearing reference, using ref.
      if (activePdfRef.current?.pdfDocument) {
        activePdfRef.current.pdfDocument.destroy().catch(() => {});
      }
      setActivePdf(null);
      setCurrentSlideIndex(-1);
      setCurrentPdfPage(1);
      setActiveFilter('all');
    }, 0);
    return () => clearTimeout(timer);
  }, [forceShowMediaHomeToken]);

  useEffect(() => {
    if (!activePdf) return;
    const node = pdfThumbRefs.current.get(currentPdfPage);
    if (!node) return;
    node.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    if (typeof node.focus === 'function') node.focus();
  }, [activePdf, currentPdfPage]);

  useEffect(() => {
    if (!Array.isArray(pptSlides) || pptSlides.length === 0) return;
    if (currentSlideIndex < 0) return;
    const node = pptThumbRefs.current.get(currentSlideIndex);
    if (!node) return;
    node.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    if (typeof node.focus === 'function') node.focus();
  }, [pptSlides, currentSlideIndex]);

  useEffect(() => {
    const isTypingTarget = (target) => {
      if (!target || !(target instanceof HTMLElement)) return false;
      const tag = String(target.tagName || '').toLowerCase();
      return (
        target.isContentEditable ||
        tag === 'input' ||
        tag === 'textarea' ||
        tag === 'select'
      );
    };

    const onKeyDown = (event) => {
      if (!isMediaSectionActive) return;
      if (isTypingTarget(event.target)) return;
      const consumeEvent = () => {
        event.preventDefault();
        event.stopPropagation();
        if (typeof event.stopImmediatePropagation === 'function') {
          event.stopImmediatePropagation();
        }
      };

      const key = event.key;
      const goPrev = key === 'ArrowLeft' || key === 'PageUp';
      const goNext = key === 'ArrowRight' || key === 'PageDown';
      if (!goPrev && !goNext) return;

      if (activePdf) {
        consumeEvent();
        const maxPage = Number(activePdf.numPages || 1);
        const nextPage = goPrev
          ? Math.max(1, currentPdfPage - 1)
          : Math.min(maxPage, currentPdfPage + 1);
        if (nextPage === currentPdfPage) return;
        setCurrentPdfPage(nextPage);
        onProjectMedia({
          type: 'pdf',
          path: activePdf.path,
          name: activePdf.name,
          page: nextPage,
          disableTransitionOnce: true,
        });
        return;
      }

      if (Array.isArray(pptSlides) && pptSlides.length > 0) {
        consumeEvent();
        const currentIndex = currentSlideIndex >= 0 ? currentSlideIndex : -1;
        const nextIndex = goPrev
          ? currentIndex <= 0
            ? 0
            : currentIndex - 1
          : currentIndex < 0
            ? 0
            : Math.min(pptSlides.length - 1, currentIndex + 1);
        if (nextIndex === currentSlideIndex) return;
        const slide = pptSlides[nextIndex];
        if (!slide) return;
        setCurrentSlideIndex(nextIndex);
        onProjectMedia({
          type: 'image',
          path: slide.path,
          name: `PPT - Page ${nextIndex + 1}`,
          fitMode: 'contain',
          originType: 'ppt',
          disableTransitionOnce: true,
        });
      }
    };

    if (!isMediaSectionActive) return;
    if (!activePdf && !(Array.isArray(pptSlides) && pptSlides.length > 0)) return;
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [isMediaSectionActive, activePdf, pptSlides, currentPdfPage, currentSlideIndex, onProjectMedia]);

  const formatSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'image':
        return 'IMG';
      case 'video':
        return 'VID';
      case 'pdf':
        return 'PDF';
      case 'ppt':
        return 'PPT';
      default:
        return 'FILE';
    }
  };

  const getTypeLabel = (type) => {
    switch (type) {
      case 'image':
        return t('media.images', 'Images');
      case 'video':
        return t('media.videos', 'Videos');
      case 'pdf':
        return 'PDF';
      case 'ppt':
        return 'PPT';
      default:
        return t('media.files', 'Files');
    }
  };

  const filterOptions = [
    { key: 'all', label: t('media.all', 'All'), icon: 'ALL' },
    { key: 'image', label: t('media.image', 'Image'), icon: 'IMG' },
    { key: 'video', label: t('media.video', 'Video'), icon: 'VID' },
    { key: 'pdf', label: 'PDF', icon: 'PDF' },
    { key: 'ppt', label: 'PPT', icon: 'PPT' },
  ];

  const displayFiles = useMemo(() => {
    if (!Array.isArray(mediaFiles)) return [];
    return [...mediaFiles].sort((a, b) => {
      const ia = MEDIA_TYPE_ORDER.indexOf(a?.type);
      const ib = MEDIA_TYPE_ORDER.indexOf(b?.type);
      if (ia !== ib) return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
      return String(a?.name || '').localeCompare(String(b?.name || ''));
    });
  }, [mediaFiles]);

  const groupedFiles = useMemo(() => {
    const groups = new Map();
    for (const file of displayFiles) {
      const t = file?.type || 'other';
      if (!groups.has(t)) groups.set(t, []);
      groups.get(t).push(file);
    }
    return MEDIA_TYPE_ORDER.filter((t) => groups.has(t)).map((t) => ({
      type: t,
      files: groups.get(t),
    }));
  }, [displayFiles]);

  const isViewingDetail = activePdf || pptSlides || pptConverting || pdfLoading;
  const isQueuePdfDetail =
    !!activePdf &&
    activePreloadItem?.type === 'pdf' &&
    activePreloadItem?.payload?.deferProject === true &&
    activePreloadItem?.payload?.path === activePdf.path;
  const isQueuePptDetail =
    (!!pptSlides || pptConverting) &&
    !!pptSourcePath &&
    activePreloadItem?.type === 'ppt' &&
    activePreloadItem?.payload?.deferProject === true &&
    activePreloadItem?.payload?.path === pptSourcePath;

  return (
    <div className="media-manager animate-slide-in-up">
      <h2 className="cp-page-title cp-page-title--tight">{t('media.title', 'Media')}</h2>
      <p className="cp-page-intro">
        {t('media.intro', 'Import image, video, PDF and PPT files. Click to project.')}
      </p>

      {!isViewingDetail && (
        <>
          {backgroundPickerTarget && (
            <div
              style={{
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
              }}
            >
              <span>{t('media.backgroundPickerMode', 'Background picker mode: click an image/video to apply and return.')}</span>
              <button className="btn btn--ghost" onClick={() => onCancelBackgroundPick?.()}>
                {t('media.cancel', 'Cancel')}
              </button>
            </div>
          )}

          <div className="cp-toolbar-row cp-gap-bottom-sm">
            <input
              type="text"
              placeholder={t('media.youtubePlaceholder', 'Paste YouTube URL (e.g. https://youtu.be/...)')}
              value={youtubeUrl}
              onChange={(e) => {
                setYoutubeUrl(e.target.value);
                setYoutubeDownload({ status: 'idle', percent: null });
              }}
              className="cp-input-inline cp-input-inline--sm"
            />
            <button className="btn btn--primary" onClick={handleProjectYouTube}>
              {t('media.play', 'Play')}
            </button>
            <button className="btn btn--ghost" onClick={handleQueueYouTube}>
              {t('media.queue', 'Queue')}
            </button>
          </div>
          {youtubeDownload.status !== 'idle' && (
            <div style={{ marginTop: '-6px', marginBottom: '12px', fontSize: '12px' }}>
              {(youtubeDownload.status === 'resolving' || youtubeDownload.status === 'downloading') && (
                <progress
                  max="100"
                  value={Number.isFinite(youtubeDownload.percent) ? youtubeDownload.percent : undefined}
                  style={{ width: '100%', display: 'block', marginBottom: '4px' }}
                />
              )}
              <span>
                {youtubeDownload.status === 'resolving'
                  ? t('media.youtubeDownloadResolving', 'Preparing YouTube download...')
                  : youtubeDownload.status === 'downloading'
                    ? Number.isFinite(youtubeDownload.percent)
                      ? `${t('media.youtubeDownloading', 'Downloading YouTube...')} ${youtubeDownload.percent}%`
                      : t('media.youtubeDownloading', 'Downloading YouTube...')
                    : youtubeDownload.status === 'success'
                      ? t('media.youtubeDownloadSuccess', 'YouTube download complete.')
                      : t('media.youtubeDownloadFailed', 'YouTube download failed.')}
              </span>
            </div>
          )}

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

          <div className="media-import-actions">
            <button className="btn btn--primary" onClick={() => handleSelectFiles()}>
              {t('media.importFiles', 'Import Files')}
            </button>
            <button className="btn btn--ghost" onClick={() => handleSelectFiles('image')}>
              {t('media.image', 'Image')}
            </button>
            <button className="btn btn--ghost" onClick={() => handleSelectFiles('video')}>
              {t('media.video', 'Video')}
            </button>
            <button className="btn btn--ghost" onClick={() => handleSelectFiles('pdf')}>
              PDF
            </button>
            <button className="btn btn--ghost" onClick={() => handleSelectFiles('ppt')}>
              PPT
            </button>
          </div>

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
                <span>{t('media.importingFiles', 'Importing files...')}</span>
              </div>
            ) : (
              <>
                <span className="media-drop-zone__icon">FILE</span>
                <span className="media-drop-zone__text">{t('media.dragToImport', 'Drag files here to import')}</span>
                <span className="media-drop-zone__hint">{t('media.supportsHint', 'Supports image, video, PDF and PPT')}</span>
              </>
            )}
          </div>
        </>
      )}

      {pptConverting && (
        <div className="media-converting">
          <div className="spinner"></div>
          <span>{t('media.convertingPpt', 'Converting PPT to images, please wait...')}</span>
        </div>
      )}

      {pdfLoading && (
        <div className="media-converting">
          <div className="spinner"></div>
          <span>{t('media.parsingPdf', 'Parsing PDF and building thumbnails...')}</span>
        </div>
      )}

      {activePdf && (
        <div
          className="media-slide-selector"
          style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: '8px',
            padding: '16px',
            marginBottom: '16px',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '16px',
            }}
          >
            <h3 style={{ fontSize: '15px', fontWeight: 'bold' }}>
              PDF {activePdf.name} - {t('media.thumbnails', 'Thumbnails')}{' '}
              <span
                style={{
                  color: 'var(--color-text-secondary)',
                  fontSize: '13px',
                  fontWeight: 'normal',
                }}
              >
                ({currentPdfPage} / {activePdf.numPages})
              </span>
            </h3>
            {!detailOpenedFromQueue && !isQueuePdfDetail && (
              <button
                className="btn btn--ghost"
                style={{ padding: '4px 8px', fontSize: '12px' }}
                onClick={() => {
                  setDetailOpenedFromQueue(false);
                  setActivePdf((prev) => {
                    if (prev?.pdfDocument) prev.pdfDocument.destroy().catch(() => {});
                    return null;
                  });
                }}
              >
                {t('media.close', 'Close')}
              </button>
            )}
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
              gap: '12px',
              maxHeight: '400px',
              overflowY: 'auto',
              paddingRight: '6px',
            }}
          >
            {Array.from({ length: activePdf.numPages }).map((_, i) => {
              const pageNumber = i + 1;
              return (
                <PdfThumbnail
                  key={pageNumber}
                  pdfDocument={activePdf.pdfDocument}
                  pageNumber={pageNumber}
                  isSelected={currentPdfPage === pageNumber}
                  cacheKey={activePdf.path}
                  thumbRef={(el) => {
                    if (el) pdfThumbRefs.current.set(pageNumber, el);
                    else pdfThumbRefs.current.delete(pageNumber);
                  }}
                  onClick={() => {
                    setCurrentPdfPage(pageNumber);
                    onProjectMedia({
                      type: 'pdf',
                      path: activePdf.path,
                      name: activePdf.name,
                      page: pageNumber,
                      disableTransitionOnce: true,
                    });
                  }}
                />
              );
            })}
          </div>
        </div>
      )}

      {pptSlides && (
        <div
          className="media-slide-selector"
          style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: '8px',
            padding: '16px',
            marginBottom: '16px',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '16px',
            }}
          >
            <h3 style={{ fontSize: '15px', fontWeight: 'bold' }}>
              PPT {t('media.slides', 'Slides')}{' '}
              <span
                style={{
                  color: 'var(--color-text-secondary)',
                  fontSize: '13px',
                  fontWeight: 'normal',
                }}
              >
                ({currentSlideIndex >= 0 ? currentSlideIndex + 1 : '-'} / {pptSlides.length})
              </span>
            </h3>
            {!detailOpenedFromQueue && !isQueuePptDetail && (
              <button
                className="btn btn--ghost"
                style={{ padding: '4px 8px', fontSize: '12px' }}
                onClick={() => {
                  setDetailOpenedFromQueue(false);
                  setPptSlides(null);
                  setPptSourcePath('');
                }}
              >
                {t('media.close', 'Close')}
              </button>
            )}
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
              gap: '12px',
              maxHeight: '400px',
              overflowY: 'auto',
              paddingRight: '6px',
            }}
          >
            {pptSlides.map((slide, index) => (
              <div
                key={slide.path}
                ref={(el) => {
                  if (el) pptThumbRefs.current.set(index, el);
                  else pptThumbRefs.current.delete(index);
                }}
                onClick={() => {
                  setCurrentSlideIndex(index);
                  onProjectMedia({
                    type: 'image',
                    path: slide.path,
                    name: `PPT - Page ${index + 1}`,
                    fitMode: 'contain',
                    originType: 'ppt',
                    disableTransitionOnce: true,
                  });
                }}
                style={getSelectableThumbCardStyle(currentSlideIndex === index)}
                tabIndex={-1}
              >
                {currentSlideIndex === index && (
                  <div style={getSelectableThumbSelectedTagStyle()}>SEL</div>
                )}
                <img
                  src={`local-media://${encodeURIComponent(slide.path)}`}
                  alt={`Slide ${index + 1}`}
                  style={{
                    width: '100%',
                    display: 'block',
                    aspectRatio: '16/9',
                    objectFit: 'contain',
                  }}
                />
                <div style={getSelectableThumbIndexStyle(currentSlideIndex === index)}>
                  {index + 1}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!isViewingDetail && (
        <>
          <h3
            style={{
              fontSize: '15px',
              fontWeight: 'bold',
              marginTop: '24px',
              marginBottom: '16px',
            }}
          >
            {t('media.mediaLibrary', 'Media Library')}
          </h3>

          {displayFiles.length === 0 ? (
            <div className="empty-state empty-state--roomy">
              <div className="empty-state__icon">FILE</div>
              <div className="empty-state__title">{t('media.noMediaFiles', 'No media files')}</div>
              <div className="empty-state__desc">
                {t('media.noMediaHint', 'Click "Import Files" or drag files into the drop zone above.')}
              </div>
            </div>
          ) : (
            groupedFiles.map((group) => (
              <div key={group.type} style={{ marginBottom: '16px' }}>
                <div
                  className="cp-group-head"
                >
                  <span>
                    {getTypeIcon(group.type)} {getTypeLabel(group.type)}
                  </span>
                  <span className="cp-group-head__count">{group.files.length}</span>
                </div>

                <div className="cp-media-grid">
                  {group.files.map((file) => {
                    const mediaKey = String(file.path || file.id || file.name || '');
                    const isSelected = mediaKey !== '' && selectedMediaKey === mediaKey;
                    return (
                      <div
                        key={file.id}
                        style={{
                          ...getSelectableThumbCardStyle(isSelected),
                          position: 'relative',
                          overflow: 'hidden',
                          display: 'flex',
                          flexDirection: 'column',
                        }}
                        className="cp-media-card"
                        onClick={() => {
                          setSelectedMediaKey(mediaKey);
                          handleProjectMedia(file);
                        }}
                        title={`Project now: ${file.name}`}
                      >
                        <div
                          style={{
                            height: '110px',
                            backgroundColor: '#0a0a0a',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            position: 'relative',
                          }}
                        >
                          {isSelected && (
                            <div style={getSelectableThumbSelectedTagStyle()}>SEL</div>
                          )}
                          {file.type === 'image' ? (
                            <img
                              src={`local-media://${encodeURIComponent(file.path)}`}
                              alt={file.name}
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                          ) : file.type === 'video' ? (
                            <video
                              src={`local-media://${encodeURIComponent(file.path)}`}
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                          ) : (
                            <div style={{ fontSize: '22px', fontWeight: 700, color: '#fff' }}>
                              {getTypeIcon(file.type)}
                            </div>
                          )}

                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              if (await showConfirm(`Delete ${file.name}?`)) handleDelete(file);
                            }}
                            style={{
                              position: 'absolute',
                              top: '6px',
                              right: '6px',
                              background: 'rgba(0,0,0,0.7)',
                              border: 'none',
                              borderRadius: '4px',
                              color: '#ff4d4f',
                              padding: '4px 6px',
                              cursor: 'pointer',
                              zIndex: 10,
                              fontSize: '11px',
                            }}
                            title="Delete file"
                          >
                            Del
                          </button>

                          <div
                            style={{
                              position: 'absolute',
                              bottom: '6px',
                              left: '6px',
                              background: 'rgba(0,0,0,0.7)',
                              borderRadius: '4px',
                              padding: '2px 6px',
                              fontSize: '11px',
                              color: '#fff',
                              fontWeight: 'bold',
                            }}
                          >
                            {getTypeIcon(file.type)}
                          </div>
                        </div>

                        <div className="cp-media-card__body">
                          <div className="cp-media-card__title">
                            {file.name}
                          </div>
                          <div className="cp-media-card__meta">
                            <span>{formatSize(file.size)}</span>
                            <div className="cp-media-card__actions">
                              <span
                                className="cp-media-card__action-btn"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (onAddPlaylist) {
                                    onAddPlaylist({
                                      type: file.type,
                                      name: file.name,
                                      payload: {
                                        type: file.type,
                                        path: file.path,
                                        name: file.name,
                                      },
                                    });
                                  }
                                }}
                                title={t('media.addToQueue', 'Add to queue')}
                              >
                                +
                              </span>
                              <span
                                className="cp-media-card__action-link"
                                title={t('media.projectNow', 'Project now')}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleProjectMedia(file);
                                }}
                              >
                                {t('media.play', 'Play')}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </>
      )}
    </div>
  );
}

export default MediaManager;
