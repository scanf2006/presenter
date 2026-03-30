import React, { useState, useEffect, useRef } from 'react';

/**
 * 投影窗口视图
 * 全屏显示在外部屏幕上，接收来自控制台的内容
 * 支持文字、图片、视频和 PDF 渲染
 */
function ProjectorView() {
  const [content, setContent] = useState(null);
  const [isBlackout, setIsBlackout] = useState(false);
  const [fadeClass, setFadeClass] = useState('');
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  // 检查是否在 Electron 环境
  const isElectron = typeof window.churchDisplay !== 'undefined';

  useEffect(() => {
    if (!isElectron) return;

    // 监听内容更新
    window.churchDisplay.onProjectorContent((data) => {
      // 先淡出
      setFadeClass('projector-view__content--fade-out');

      setTimeout(() => {
        setContent(data);
        setIsBlackout(false);
        setFadeClass('projector-view__content--fade-in');

        // 如果是视频，自动播放
        if (data.type === 'video' && videoRef.current) {
          videoRef.current.play().catch(console.error);
        }

        // 如果是 PDF，渲染指定页面
        if (data.type === 'pdf') {
          renderPdfPage(data.path, data.page || 1);
        }
      }, 300);
    });

    // 监听黑屏命令
    window.churchDisplay.onProjectorBlackout(() => {
      setFadeClass('projector-view__content--fade-out');
      setTimeout(() => {
        setContent(null);
        setIsBlackout(true);
        setFadeClass('');
        // 暂停视频
        if (videoRef.current) {
          videoRef.current.pause();
        }
      }, 300);
    });
  }, [isElectron]);

  // 当视频内容更新后自动播放
  useEffect(() => {
    if (content?.type === 'video' && videoRef.current) {
      videoRef.current.play().catch(console.error);
    }
  }, [content]);

  // 当 PDF 内容更新后渲染
  useEffect(() => {
    if (content?.type === 'pdf') {
      renderPdfPage(content.path, content.page || 1);
    }
  }, [content]);

  /**
   * 使用 PDF.js 渲染 PDF 页面到 canvas
   */
  const renderPdfPage = async (pdfPath, pageNumber) => {
    try {
      const pdfjsLib = await import('pdfjs-dist');
      // 设置 PDF.js worker
      pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
        'pdfjs-dist/build/pdf.worker.mjs',
        import.meta.url
      ).toString();

      const fileUrl = `local-media://${encodeURIComponent(pdfPath)}`;
      const pdf = await pdfjsLib.getDocument(fileUrl).promise;
      const page = await pdf.getPage(Math.min(pageNumber, pdf.numPages));

      const canvas = canvasRef.current;
      if (!canvas) return;

      const context = canvas.getContext('2d');
      // 获取窗口大小来设置缩放
      const viewport = page.getViewport({ scale: 1 });
      const scaleX = window.innerWidth / viewport.width;
      const scaleY = window.innerHeight / viewport.height;
      const scale = Math.min(scaleX, scaleY);
      const scaledViewport = page.getViewport({ scale });

      canvas.width = scaledViewport.width;
      canvas.height = scaledViewport.height;

      await page.render({
        canvasContext: context,
        viewport: scaledViewport,
      }).promise;
    } catch (err) {
      console.error('[投影窗口] PDF 渲染错误:', err);
    }
  };

  // 获取字体大小的样式类
  const getTextSizeClass = () => {
    if (!content) return 'projector-text--large';
    switch (content.fontSize) {
      case 'small': return 'projector-text--small';
      case 'medium': return 'projector-text--medium';
      default: return 'projector-text--large';
    }
  };

  /**
   * 获取本地文件的可用 URL
   * 在 Electron 中使用 local-media 协议
   */
  const getMediaUrl = (filePath) => {
    if (!filePath) return '';
    return `local-media://${encodeURIComponent(filePath)}`;
  };

  return (
    <div className="projector-view">
      {/* 背景层 */}
      <div
        className="projector-view__background"
        style={{
          background: isBlackout
            ? '#000'
            : 'radial-gradient(ellipse at center, #0a0a2e 0%, #000 100%)',
        }}
      />

      {/* 半透明遮罩 - 仅文字模式使用 */}
      {!isBlackout && content && content.type === 'text' && (
        <div className="projector-view__overlay" />
      )}

      {/* 投影内容 */}
      {content && !isBlackout && (
        <>
          {/* 文字内容 */}
          {content.type === 'text' && (
            <div className={`projector-view__content ${fadeClass}`}>
              <div className={`projector-text ${getTextSizeClass()}`} style={{ whiteSpace: 'pre-line' }}>
                {content.text}
              </div>
            </div>
          )}

          {/* 图片内容 */}
          {content.type === 'image' && (
            <div className={`projector-image ${fadeClass}`}>
              <img
                src={getMediaUrl(content.path)}
                alt={content.name}
                style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
              />
            </div>
          )}

          {/* 视频内容 */}
          {content.type === 'video' && (
            <div className={`projector-video ${fadeClass}`}>
              <video
                ref={videoRef}
                src={getMediaUrl(content.path)}
                autoPlay
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              />
            </div>
          )}

          {/* PDF 内容 */}
          {content.type === 'pdf' && (
            <div className={`projector-pdf ${fadeClass}`}>
              <canvas ref={canvasRef} />
            </div>
          )}
        </>
      )}

      {/* 黑屏状态 */}
      {isBlackout && (
        <div style={{
          position: 'absolute',
          inset: 0,
          background: '#000',
          zIndex: 100,
        }} />
      )}
    </div>
  );
}

export default ProjectorView;
