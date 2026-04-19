import React, { useEffect, useRef, useState } from 'react';

/**
 * PdfRenderer - render one PDF page into a canvas with configurable fit behavior.
 */
const PdfRenderer = ({
  path,
  pageNumber = 1,
  fitMode = 'cover',
  className = '',
  onLoadSuccess,
}) => {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [containerVersion, setContainerVersion] = useState(0);
  // H6-R2: Store onLoadSuccess in a ref so the PDF-loading effect
  // doesn't re-run when the parent passes a new callback reference.
  const onLoadSuccessRef = useRef(onLoadSuccess);
  useEffect(() => {
    onLoadSuccessRef.current = onLoadSuccess;
  }, [onLoadSuccess]);

  // M12-R2: Store the loaded PDF document in a ref so page rendering
  // can happen independently without reloading the entire document.
  const pdfDocRef = useRef(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver(() => {
      setContainerVersion((v) => v + 1);
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Effect 1: Load PDF document only when path changes.
  useEffect(() => {
    let isMounted = true;

    const loadPdf = async () => {
      if (!path) return;

      try {
        setErrorMsg(null);

        const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.min.mjs');
        const workerUrl = new URL(
          'pdfjs-dist/legacy/build/pdf.worker.min.mjs',
          import.meta.url
        ).toString();
        pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

        const fileUrl = `local-media://${encodeURIComponent(path)}`;
        const response = await fetch(fileUrl);
        if (!response.ok) {
          throw new Error(`Failed to load PDF: ${response.status} ${response.statusText}`);
        }

        const dataBuffer = await response.arrayBuffer();
        const loadingTask = pdfjsLib.getDocument({ data: dataBuffer });
        const pdf = await loadingTask.promise;

        if (!isMounted) {
          pdf.destroy().catch(() => {});
          return;
        }

        // Destroy previous document before storing new one.
        if (pdfDocRef.current) {
          pdfDocRef.current.destroy().catch(() => {});
        }
        pdfDocRef.current = pdf;

        if (onLoadSuccessRef.current) onLoadSuccessRef.current({ numPages: pdf.numPages });

        // Trigger a page render after loading.
        setContainerVersion((v) => v + 1);
      } catch (error) {
        if (isMounted) setErrorMsg(error?.message || String(error));
      }
    };

    loadPdf();

    return () => {
      isMounted = false;
      if (pdfDocRef.current) {
        pdfDocRef.current.destroy().catch(() => {});
        pdfDocRef.current = null;
      }
    };
  }, [path]);

  // Effect 2: Render the current page when pageNumber or container size changes.
  useEffect(() => {
    let cancelled = false;

    const renderPage = async () => {
      const pdf = pdfDocRef.current;
      if (!pdf || !canvasRef.current || !containerRef.current) return;

      try {
        const page = await pdf.getPage(Math.min(pageNumber, pdf.numPages));

        if (cancelled || !canvasRef.current || !containerRef.current) return;

        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');
        const container = containerRef.current;
        if (!context) return;

        const containerWidth = container.clientWidth;
        const containerHeight = container.clientHeight;

        if (!containerWidth || !containerHeight) {
          requestAnimationFrame(() => {
            if (!cancelled) setContainerVersion((v) => v + 1);
          });
          return;
        }

        const unscaledViewport = page.getViewport({ scale: 1 });
        const scaleX = containerWidth / unscaledViewport.width;
        const scaleY = containerHeight / unscaledViewport.height;
        const scale = fitMode === 'contain' ? Math.min(scaleX, scaleY) : Math.max(scaleX, scaleY);

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
        if (!cancelled) setErrorMsg(error?.message || String(error));
      }
    };

    renderPage();

    return () => {
      cancelled = true;
    };
  }, [pageNumber, containerVersion, fitMode]);

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
        <canvas
          ref={canvasRef}
          style={{ display: 'block' }}
        />
      )}
    </div>
  );
};

export default PdfRenderer;
