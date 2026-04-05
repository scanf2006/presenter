import React, { useEffect, useRef, useState } from 'react';

/**
 * PdfRenderer - render one PDF page into a canvas with contain-fit behavior.
 */
const PdfRenderer = ({ path, pageNumber = 1, className = '', onLoadSuccess }) => {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [containerVersion, setContainerVersion] = useState(0);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver(() => {
      setContainerVersion((v) => v + 1);
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let isMounted = true;

    const renderPdf = async () => {
      if (!path) return;

      try {
        setErrorMsg(null);

        const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.min.mjs');
        const workerUrl = new URL('pdfjs-dist/legacy/build/pdf.worker.min.mjs', import.meta.url).toString();
        pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

        const fileUrl = `local-media://${encodeURIComponent(path)}`;
        const response = await fetch(fileUrl);
        if (!response.ok) {
          throw new Error(`Failed to load PDF: ${response.status} ${response.statusText}`);
        }

        const dataBuffer = await response.arrayBuffer();
        const loadingTask = pdfjsLib.getDocument({ data: dataBuffer });
        const pdf = await loadingTask.promise;

        if (!isMounted) return;
        if (onLoadSuccess) onLoadSuccess({ numPages: pdf.numPages });

        const page = await pdf.getPage(Math.min(pageNumber, pdf.numPages));

        if (!isMounted || !canvasRef.current || !containerRef.current) return;

        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');
        const container = containerRef.current;
        if (!context) return;

        const containerWidth = container.clientWidth;
        const containerHeight = container.clientHeight;

        // Layout not ready: try once on next frame instead of forcing 4:3 fallback.
        if (!containerWidth || !containerHeight) {
          requestAnimationFrame(() => {
            if (isMounted) setContainerVersion((v) => v + 1);
          });
          return;
        }

        const unscaledViewport = page.getViewport({ scale: 1 });
        const scaleX = containerWidth / unscaledViewport.width;
        const scaleY = containerHeight / unscaledViewport.height;
        const scale = Math.min(scaleX, scaleY);

        const viewport = page.getViewport({ scale });
        const dpr = window.devicePixelRatio || 1;

        canvas.width = Math.max(1, Math.floor(viewport.width * dpr));
        canvas.height = Math.max(1, Math.floor(viewport.height * dpr));
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;

        context.setTransform(dpr, 0, 0, dpr, 0, 0);
        context.clearRect(0, 0, viewport.width, viewport.height);

        await page.render({
          canvasContext: context,
          viewport,
        }).promise;
      } catch (error) {
        setErrorMsg(error?.message || String(error));
      }
    };

    renderPdf();

    return () => {
      isMounted = false;
    };
  }, [path, pageNumber, containerVersion, onLoadSuccess]);

  return (
    <div
      ref={containerRef}
      className={`pdf-renderer ${className}`}
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      {errorMsg ? (
        <div
          style={{
            color: 'red',
            textAlign: 'center',
            padding: '10px',
            fontSize: '13px',
            background: 'rgba(255,0,0,0.1)',
            border: '1px solid red',
          }}
        >
          PDF render failed:
          <br />
          {errorMsg}
        </div>
      ) : (
        <canvas ref={canvasRef} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
      )}
    </div>
  );
};

export default PdfRenderer;
