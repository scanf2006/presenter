import React, { useState, useEffect, useRef } from 'react';

/**
 * 投影窗口视图
 * 全屏显示在外部屏幕上，接收来自控制台的内容
 */
function ProjectorView() {
  const [content, setContent] = useState(null);
  const [isBlackout, setIsBlackout] = useState(false);
  const [fadeClass, setFadeClass] = useState('');
  const contentRef = useRef(null);

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
      }, 300);
    });

    // 监听黑屏命令
    window.churchDisplay.onProjectorBlackout(() => {
      setFadeClass('projector-view__content--fade-out');
      setTimeout(() => {
        setContent(null);
        setIsBlackout(true);
        setFadeClass('');
      }, 300);
    });
  }, [isElectron]);

  // 获取字体大小的样式类
  const getTextSizeClass = () => {
    if (!content) return 'projector-text--large';
    switch (content.fontSize) {
      case 'small': return 'projector-text--small';
      case 'medium': return 'projector-text--medium';
      default: return 'projector-text--large';
    }
  };

  return (
    <div className="projector-view">
      {/* 背景层 - 未来可以添加视频/图片背景 */}
      <div
        className="projector-view__background"
        style={{
          background: isBlackout
            ? '#000'
            : 'radial-gradient(ellipse at center, #0a0a2e 0%, #000 100%)',
        }}
      />

      {/* 半透明遮罩 - 增强文字可读性 */}
      {!isBlackout && content && (
        <div className="projector-view__overlay" />
      )}

      {/* 投影内容 */}
      {content && !isBlackout && (
        <div className={`projector-view__content ${fadeClass}`} ref={contentRef}>
          {content.type === 'text' && (
            <div className={`projector-text ${getTextSizeClass()}`} style={{ whiteSpace: 'pre-line' }}>
              {content.text}
            </div>
          )}
        </div>
      )}

      {/* 黑屏状态 - 完全黑色，无任何内容 */}
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
