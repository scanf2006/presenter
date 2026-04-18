import React, { useEffect, useRef, useState } from 'react';

/**
 * PdfThumbnail - 懒加载的 PDF 缩略图生成器
 * 只有该组件进入视口时，才会调用 PDF.js 渲染当前页，极大节约内存和 CPU
 */
const PdfThumbnail = ({ pdfDocument, pageNumber, onClick, isSelected, thumbRef }) => {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [isVisible, setIsVisible] = useState(false);
  const [hasRendered, setHasRendered] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  // 1. 视口探测 (IntersectionObserver)
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setIsVisible(true);
          // 只要进入过视口，为了避免反复滚动导致重新渲染，这里可以选择停止观察
          observer.disconnect();
        }
      },
      { threshold: 0.1, rootMargin: '100px' } // 提前 100px 加载
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, []);

  // 2. 渲染页面核心逻辑
  useEffect(() => {
    let isMounted = true;
    
    // 如果没有被探测到进入视口、或者没有可用的文档实例、或已经渲染过了，就不做任何操作
    if (!isVisible || !pdfDocument || hasRendered) return;

    const renderPage = async () => {
      try {
        const page = await pdfDocument.getPage(pageNumber);
        
        if (!isMounted || !canvasRef.current) return;

        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');

        // 为了保证缩略图渲染速度，我们使用固定的较小分辨率
        const unscaledViewport = page.getViewport({ scale: 1 });
        // 我们假设缩略图容器大概宽 140px
        const scale = 140 / unscaledViewport.width;
        const viewport = page.getViewport({ scale });

        const dpr = window.devicePixelRatio || 1;
        canvas.width = viewport.width * dpr;
        canvas.height = viewport.height * dpr;
        canvas.style.width = '100%';
        canvas.style.height = '100%';
        
        context.scale(dpr, dpr);

        const renderContext = {
          canvasContext: context,
          viewport: viewport,
        };

        await page.render(renderContext).promise;
        
        if (isMounted) {
          setHasRendered(true);
        }
      } catch (err) {
        if (isMounted) {
            console.error(`[PdfThumbnail] 第 ${pageNumber} 页渲染失败:`, err);
            setErrorMsg(err.message);
        }
      }
    };

    renderPage();

    return () => {
      isMounted = false;
    };
  }, [isVisible, pdfDocument, pageNumber, hasRendered]);

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
        aspectRatio: 'vmax', // 默认让它有个基础高度，防止一开始挤在一起导致 intersection 全部触发
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
      {!hasRendered && !errorMsg && (
        <div style={{ color: 'var(--color-text-muted)', fontSize: '12px' }}>
          {isVisible ? '正在绘制...' : '等待加载'}
        </div>
      )}
      
      {errorMsg && (
        <div style={{ color: 'red', fontSize: '10px', textAlign: 'center', padding: '4px' }}>
          加载失败
        </div>
      )}

      {/* Canvas 一直存在，只是不被看见或者没内容 */}
      <canvas 
        ref={canvasRef} 
        style={{ 
          display: hasRendered ? 'block' : 'none', 
          objectFit: 'contain' 
        }} 
      />
      
      {/* 右下角的页码标识 */}
      <div style={{ 
        position: 'absolute', 
        bottom: 0, right: 0, 
        background: isSelected ? 'var(--color-primary)' : 'rgba(0,0,0,0.7)', 
        color: '#fff', 
        fontSize: '12px', 
        fontWeight: 'bold',
        padding: '2px 8px',
        borderTopLeftRadius: '6px'
      }}>
        {pageNumber}
      </div>
    </div>
  );
};

export default PdfThumbnail;
