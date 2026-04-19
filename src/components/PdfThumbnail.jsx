import React, { memo, useEffect, useMemo, useRef, useState } from 'react';

const THUMBNAIL_CACHE_MAX = 300;
const thumbnailDataUrlCache = new Map();

function getCachedThumbnail(key) {
  if (!key || !thumbnailDataUrlCache.has(key)) return '';
  const value = thumbnailDataUrlCache.get(key);
  // LRU touch
  thumbnailDataUrlCache.delete(key);
  thumbnailDataUrlCache.set(key, value);
  return value;
}

function setCachedThumbnail(key, value) {
  if (!key || !value) return;
  if (thumbnailDataUrlCache.has(key)) {
    thumbnailDataUrlCache.delete(key);
  }
  thumbnailDataUrlCache.set(key, value);
  if (thumbnailDataUrlCache.size > THUMBNAIL_CACHE_MAX) {
    const oldestKey = thumbnailDataUrlCache.keys().next().value;
    thumbnailDataUrlCache.delete(oldestKey);
  }
}

function PdfThumbnailImpl({ pdfDocument, pageNumber, onClick, isSelected, thumbRef, cacheKey = '' }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [isVisible, setIsVisible] = useState(false);
  const cacheEntryKey = useMemo(() => `${cacheKey}|${pageNumber}`, [cacheKey, pageNumber]);
  const [thumbDataUrl, setThumbDataUrl] = useState(() => getCachedThumbnail(cacheEntryKey));
  const [errorMsg, setErrorMsg] = useState(null);

  useEffect(() => {
    setThumbDataUrl(getCachedThumbnail(cacheEntryKey));
    setErrorMsg(null);
  }, [cacheEntryKey]);

  useEffect(() => {
    if (thumbDataUrl) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1, rootMargin: '120px' }
    );

    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [thumbDataUrl]);

  useEffect(() => {
    let isMounted = true;
    if (!isVisible || !pdfDocument || thumbDataUrl) return undefined;

    const renderPage = async () => {
      try {
        const page = await pdfDocument.getPage(pageNumber);
        if (!isMounted || !canvasRef.current) return;

        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');
        if (!context) return;

        const unscaledViewport = page.getViewport({ scale: 1 });
        const scale = 140 / unscaledViewport.width;
        const viewport = page.getViewport({ scale });
        const dpr = window.devicePixelRatio || 1;

        canvas.width = Math.max(1, Math.floor(viewport.width * dpr));
        canvas.height = Math.max(1, Math.floor(viewport.height * dpr));
        canvas.style.width = '100%';
        canvas.style.height = '100%';
        context.setTransform(dpr, 0, 0, dpr, 0, 0);

        await page.render({
          canvasContext: context,
          viewport,
        }).promise;

        if (!isMounted) return;
        const dataUrl = canvas.toDataURL('image/png');
        setCachedThumbnail(cacheEntryKey, dataUrl);
        setThumbDataUrl(dataUrl);
      } catch (err) {
        if (isMounted) {
          console.error(`[PdfThumbnail] page ${pageNumber} render failed:`, err);
          setErrorMsg(err?.message || 'Render failed');
        }
      }
    };

    renderPage();
    return () => {
      isMounted = false;
    };
  }, [isVisible, pdfDocument, pageNumber, thumbDataUrl, cacheEntryKey]);

  return (
    <div
      ref={(el) => {
        containerRef.current = el;
        if (typeof thumbRef === 'function') thumbRef(el);
      }}
      onClick={onClick}
      tabIndex={-1}
      style={{
        cursor: 'pointer',
        border: isSelected ? '2px solid var(--color-primary)' : '2px solid var(--glass-border)',
        borderRadius: '6px',
        overflow: 'hidden',
        position: 'relative',
        backgroundColor: '#000',
        boxShadow: isSelected ? '0 0 10px var(--color-primary)' : '0 2px 8px rgba(0,0,0,0.2)',
        aspectRatio: '1 / 1.414',
        minHeight: '100px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.2s',
        transform: isSelected ? 'scale(1.02)' : 'scale(1)',
        outline: isSelected ? '2px solid rgba(99,102,241,0.45)' : 'none',
        outlineOffset: isSelected ? '1px' : 0,
      }}
    >
      {!thumbDataUrl && !errorMsg && (
        <div style={{ color: 'var(--color-text-muted)', fontSize: '12px' }}>
          {isVisible ? 'Rendering...' : 'Waiting...'}
        </div>
      )}

      {errorMsg && (
        <div style={{ color: 'red', fontSize: '10px', textAlign: 'center', padding: '4px' }}>
          Load failed
        </div>
      )}

      {thumbDataUrl && (
        <img
          src={thumbDataUrl}
          alt={`PDF Page ${pageNumber}`}
          style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
        />
      )}

      {!thumbDataUrl && <canvas ref={canvasRef} style={{ display: 'none' }} />}

      <div
        style={{
          position: 'absolute',
          bottom: 0,
          right: 0,
          background: isSelected ? 'var(--color-primary)' : 'rgba(0,0,0,0.7)',
          color: '#fff',
          fontSize: '12px',
          fontWeight: 'bold',
          padding: '2px 8px',
          borderTopLeftRadius: '6px',
        }}
      >
        {pageNumber}
      </div>
    </div>
  );
}

const PdfThumbnail = memo(
  PdfThumbnailImpl,
  (prev, next) =>
    prev.pdfDocument === next.pdfDocument &&
    prev.pageNumber === next.pageNumber &&
    prev.isSelected === next.isSelected &&
    prev.cacheKey === next.cacheKey
);

export default PdfThumbnail;
