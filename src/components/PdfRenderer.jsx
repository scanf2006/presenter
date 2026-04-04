import React, { useEffect, useRef } from 'react';

/**
 * PdfRenderer - 通用的 PDF 页面渲染组件
 * 使用 pdfjs-dist 在 Canvas 上绘制指定页面
 */
const PdfRenderer = ({ path, pageNumber = 1, className = "", onLoadSuccess }) => {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [errorMsg, setErrorMsg] = React.useState(null);

  useEffect(() => {
    let isMounted = true;
    
    const renderPdf = async () => {
      if (!path) return;
      
      try {
        setErrorMsg(null);
        console.log(`[PdfRenderer] 开始加载 PDF: ${path}`, { pageNumber });
        
        const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.min.mjs');
        
        // 更好的兼容 Vite 的 worker 动态加载方式
        const workerUrl = new URL('pdfjs-dist/legacy/build/pdf.worker.min.mjs', import.meta.url).toString();
        pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

        // 使用 fetch 获取为 ArrayBuffer（绕过 PDF.js 自身的 HTTP 加载器，防止它对自定义协议的支持不佳）
        const fileUrl = `local-media://${encodeURIComponent(path)}`;
        console.log(`[PdfRenderer] Fetching ${fileUrl}`);
        
        const response = await fetch(fileUrl);
        if (!response.ok) {
           throw new Error(`网络加载失败: Status ${response.status} - ${response.statusText}`);
        }
        const dataBuffer = await response.arrayBuffer();

        const loadingTask = pdfjsLib.getDocument({ data: dataBuffer });
        const pdf = await loadingTask.promise;
        
        if (!isMounted) return;
        console.log(`[PdfRenderer] PDF 加载成功，总页数: ${pdf.numPages}`);
        if (onLoadSuccess) {
          onLoadSuccess({ numPages: pdf.numPages });
        }

        const page = await pdf.getPage(Math.min(pageNumber, pdf.numPages));
        
        if (!isMounted || !canvasRef.current || !containerRef.current) {
          console.warn('[PdfRenderer] 组件已卸载或 Canvas 引用失效');
          return;
        }

        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');
        const container = containerRef.current;

        // 如果容器尺寸为 0，尝试延迟渲染或使用默认尺寸
        let containerWidth = container.clientWidth;
        let containerHeight = container.clientHeight;
        
        if (containerWidth === 0 || containerHeight === 0) {
          console.warn('[PdfRenderer] 容器尺寸为 0，尝试重新获取...');
          // 强制给一个基础尺寸以防万一
          containerWidth = containerWidth || 400;
          containerHeight = containerHeight || 300;
        }

        const unscaledViewport = page.getViewport({ scale: 1 });
        const scaleX = containerWidth / unscaledViewport.width;
        const scaleY = containerHeight / unscaledViewport.height;
        const scale = Math.min(scaleX, scaleY) * 0.95;

        console.log(`[PdfRenderer] 渲染参数: 比例=${scale.toFixed(2)}, 容器=${containerWidth}x${containerHeight}`);

        const viewport = page.getViewport({ scale });
        const dpr = window.devicePixelRatio || 1;
        canvas.width = viewport.width * dpr;
        canvas.height = viewport.height * dpr;
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;
        
        context.scale(dpr, dpr);

        const renderContext = {
          canvasContext: context,
          viewport: viewport,
        };

        await page.render(renderContext).promise;
        console.log('[PdfRenderer] 页面渲染完成');
      } catch (error) {
        console.error('[PdfRenderer] 渲染全流程出错:', error);
        setErrorMsg(error.message || String(error));
      }
    };

    renderPdf();

    return () => {
      isMounted = false;
    };
  }, [path, pageNumber]);

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
        overflow: 'hidden'
      }}
    >
      {errorMsg ? (
        <div style={{ color: 'red', textAlign: 'center', padding: '10px', fontSize: '13px', background: 'rgba(255,0,0,0.1)', border: '1px solid red' }}>
          PDF渲染失败: <br />{errorMsg}
        </div>
      ) : (
        <canvas ref={canvasRef} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
      )}
    </div>
  );
};

export default PdfRenderer;
