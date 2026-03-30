import React, { useState, useEffect, useCallback } from 'react';
import MediaManager from './MediaManager';

/**
 * 控制台主面板
 * 负责显示器管理、内容编辑和投影控制
 */
function ControlPanel() {
  // 显示器列表
  const [displays, setDisplays] = useState([]);
  // 投影状态
  const [projectorActive, setProjectorActive] = useState(false);
  const [projectorDisplayId, setProjectorDisplayId] = useState(null);
  // 当前活动的侧边栏项
  const [activeSection, setActiveSection] = useState('text');
  // 文字内容编辑
  const [textContent, setTextContent] = useState('');
  const [fontSize, setFontSize] = useState('large');
  // 当前投影的内容
  const [currentSlide, setCurrentSlide] = useState(null);

  // 检查是否在 Electron 环境
  const isElectron = typeof window.churchDisplay !== 'undefined';

  // 获取显示器列表
  useEffect(() => {
    if (isElectron) {
      window.churchDisplay.getDisplays().then(setDisplays);
      window.churchDisplay.onDisplaysChanged(setDisplays);
      window.churchDisplay.onProjectorStatus((status) => {
        setProjectorActive(status.active);
        setProjectorDisplayId(status.displayId || null);
      });
      // 检查初始状态
      window.churchDisplay.getProjectorStatus().then((status) => {
        setProjectorActive(status.active);
      });
    } else {
      // 非 Electron 环境模拟数据
      setDisplays([
        { id: 1, label: '主显示器', bounds: { x: 0, y: 0, width: 1920, height: 1080 }, isPrimary: true, size: { width: 1920, height: 1080 } },
        { id: 2, label: '副显示器', bounds: { x: 1920, y: 0, width: 1920, height: 1080 }, isPrimary: false, size: { width: 1920, height: 1080 } },
      ]);
    }
  }, [isElectron]);

  // 启动投影
  const handleStartProjector = useCallback((displayId) => {
    if (isElectron) {
      window.churchDisplay.startProjector(displayId);
    } else {
      setProjectorActive(true);
      setProjectorDisplayId(displayId);
    }
  }, [isElectron]);

  // 停止投影
  const handleStopProjector = useCallback(() => {
    if (isElectron) {
      window.churchDisplay.stopProjector();
    } else {
      setProjectorActive(false);
      setProjectorDisplayId(null);
    }
  }, [isElectron]);

  // 发送内容到投影
  const handleSendToProjector = useCallback((content) => {
    const data = {
      type: 'text',
      text: content || textContent,
      fontSize: fontSize,
      timestamp: Date.now(),
    };
    setCurrentSlide(data);
    if (isElectron) {
      window.churchDisplay.sendToProjector(data);
    }
  }, [textContent, fontSize, isElectron]);

  // 黑屏
  const handleBlackout = useCallback(() => {
    setCurrentSlide(null);
    if (isElectron) {
      window.churchDisplay.blackout();
    }
  }, [isElectron]);

  // 媒体投屏回调
  const handleProjectMedia = useCallback((mediaData) => {
    setCurrentSlide(mediaData);
    if (isElectron) {
      window.churchDisplay.sendToProjector(mediaData);
    }
  }, [isElectron]);

  // 示例内容
  const sampleContent = [
    {
      id: 1,
      title: '奇异恩典',
      text: '奇异恩典 何等甘甜\n我罪已得赦免\n前我失丧 今被寻回\n瞎眼今得看见',
    },
    {
      id: 2,
      title: '约翰福音 3:16',
      text: '神爱世人，甚至将他的独生子赐给他们，\n叫一切信他的，不至灭亡，反得永生。',
    },
    {
      id: 3,
      title: '诗篇 23:1-3',
      text: '耶和华是我的牧者，我必不至缺乏。\n他使我躺卧在青草地上，\n领我在可安歇的水边。\n他使我的灵魂苏醒，\n为自己的名引导我走义路。',
    },
    {
      id: 4,
      title: '感谢神',
      text: '感谢神 赐我救赎主\n感谢神 丰富预备\n感谢神 过去的同在\n感谢神 主在我旁',
    },
  ];

  return (
    <div className="app-container">
      {/* === 顶部导航栏 === */}
      <div className="top-bar">
        <div className="top-bar__brand">
          <div className="top-bar__logo">✝</div>
          <span className="top-bar__title">ChurchDisplay Pro</span>
        </div>
        <div className="top-bar__controls">
          {/* 投影状态指示 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--color-text-secondary)' }}>
            <span className={`status-dot ${projectorActive ? 'status-dot--active' : 'status-dot--inactive'}`}></span>
            {projectorActive ? '投影中' : '未投影'}
          </div>
          {/* 黑屏按钮 */}
          <button className="btn btn--ghost btn--icon" onClick={handleBlackout} title="黑屏">
            ⬛
          </button>
        </div>
      </div>

      {/* === 侧边栏 === */}
      <div className="sidebar">
        <div className="sidebar__section-title">投影控制</div>
        <div
          className={`sidebar__item ${activeSection === 'displays' ? 'sidebar__item--active' : ''}`}
          onClick={() => setActiveSection('displays')}
        >
          <span className="sidebar__item-icon">🖥️</span>
          显示器管理
        </div>

        <div className="sidebar__section-title">内容</div>
        <div
          className={`sidebar__item ${activeSection === 'text' ? 'sidebar__item--active' : ''}`}
          onClick={() => setActiveSection('text')}
        >
          <span className="sidebar__item-icon">✏️</span>
          自由文字
        </div>
        <div
          className={`sidebar__item ${activeSection === 'songs' ? 'sidebar__item--active' : ''}`}
          onClick={() => setActiveSection('songs')}
        >
          <span className="sidebar__item-icon">🎵</span>
          诗歌歌词
        </div>
        <div
          className={`sidebar__item ${activeSection === 'bible' ? 'sidebar__item--active' : ''}`}
          onClick={() => setActiveSection('bible')}
        >
          <span className="sidebar__item-icon">📖</span>
          圣经经文
        </div>
        <div
          className={`sidebar__item ${activeSection === 'media' ? 'sidebar__item--active' : ''}`}
          onClick={() => setActiveSection('media')}
        >
          <span className="sidebar__item-icon">🎬</span>
          媒体文件
        </div>

        <div className="sidebar__section-title">快速操作</div>
        <div className="quick-actions">
          <button className="quick-action-btn" onClick={handleBlackout}>
            <span className="quick-action-btn__icon">⬛</span>
            <span className="quick-action-btn__label">黑屏</span>
          </button>
          <button className="quick-action-btn" onClick={() => handleSendToProjector(' ')}>
            <span className="quick-action-btn__icon">⬜</span>
            <span className="quick-action-btn__label">清屏</span>
          </button>
        </div>
      </div>

      {/* === 主内容区 === */}
      <div className="main-content">
        {activeSection === 'displays' && (
          <div className="animate-slide-in-up">
            <h2 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px' }}>显示器管理</h2>
            <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginBottom: '24px' }}>
              选择一个外部显示器开始投影。投影内容将全屏显示在选中的屏幕上。
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {displays.map((display) => (
                <div
                  key={display.id}
                  className={`display-card ${projectorDisplayId === display.id ? 'display-card--active' : ''}`}
                  onClick={() => !display.isPrimary && handleStartProjector(display.id)}
                >
                  <span className="display-card__icon">
                    {display.isPrimary ? '💻' : '📺'}
                  </span>
                  <div className="display-card__info">
                    <div className="display-card__name">{display.label || `显示器 ${display.id}`}</div>
                    <div className="display-card__resolution">
                      {display.size.width} × {display.size.height}
                      {display.bounds && ` · 位置 (${display.bounds.x}, ${display.bounds.y})`}
                    </div>
                  </div>
                  {display.isPrimary && (
                    <span className="display-card__badge display-card__badge--primary">主屏</span>
                  )}
                  {projectorDisplayId === display.id && (
                    <span className="display-card__badge display-card__badge--projecting">投影中</span>
                  )}
                </div>
              ))}
            </div>

            {projectorActive && (
              <button
                className="btn btn--danger btn--lg"
                style={{ marginTop: '24px', width: '100%' }}
                onClick={handleStopProjector}
              >
                ⏹ 停止投影
              </button>
            )}

            {displays.filter(d => !d.isPrimary).length === 0 && (
              <div style={{
                marginTop: '24px',
                padding: '20px',
                background: 'rgba(245, 158, 11, 0.08)',
                border: '1px solid rgba(245, 158, 11, 0.2)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--color-warning)',
                fontSize: '13px',
              }}>
                ⚠️ 未检测到外部显示器。请连接投影仪或外部屏幕后重试。
              </div>
            )}
          </div>
        )}

        {activeSection === 'text' && (
          <div className="text-editor animate-slide-in-up">
            <h2 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '8px' }}>自由文字投屏</h2>
            <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginBottom: '16px' }}>
              输入任意文字内容，点击"投屏发送"即可投影到外部屏幕。
            </p>

            <textarea
              className="text-editor__textarea"
              placeholder="在此输入要投屏的文字..."
              value={textContent}
              onChange={(e) => setTextContent(e.target.value)}
            />

            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>字号：</span>
              {['small', 'medium', 'large'].map((size) => (
                <button
                  key={size}
                  className={`btn ${fontSize === size ? 'btn--primary' : 'btn--ghost'}`}
                  onClick={() => setFontSize(size)}
                >
                  {size === 'small' ? '小' : size === 'medium' ? '中' : '大'}
                </button>
              ))}
            </div>

            <button
              className="btn btn--success btn--lg"
              style={{ width: '100%' }}
              onClick={() => handleSendToProjector()}
              disabled={!textContent.trim()}
            >
              📤 投屏发送
            </button>
          </div>
        )}

        {(activeSection === 'songs' || activeSection === 'bible') && (
          <div className="animate-slide-in-up">
            <h2 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px' }}>
              {activeSection === 'songs' ? '🎵 诗歌歌词' : '📖 圣经经文'}
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginBottom: '24px' }}>
              点击下方卡片即可将内容发送到投影画面。
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {sampleContent
                .filter((item) => {
                  if (activeSection === 'songs') return item.id <= 2 || item.id === 4;
                  return item.id === 2 || item.id === 3;
                })
                .map((item) => (
                  <div
                    key={item.id}
                    className="content-card"
                    onClick={() => handleSendToProjector(item.text)}
                  >
                    <div className="content-card__title">{item.title}</div>
                    <div className="content-card__text" style={{ whiteSpace: 'pre-line' }}>
                      {item.text}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {activeSection === 'media' && (
          <MediaManager onProjectMedia={handleProjectMedia} />
        )}
      </div>

      {/* === 预览面板 === */}
      <div className="preview-panel">
        <div className="preview-panel__title">实时预览</div>

        {/* 投影预览 */}
        <div className="preview-screen">
          <span className="preview-screen__label">投影输出</span>
          <div className="preview-screen__content">
            {currentSlide ? (
              <div style={{
                padding: '12px',
                textAlign: 'center',
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                {currentSlide.type === 'text' && (
                  <div style={{
                    fontSize: currentSlide.fontSize === 'large' ? '16px' : currentSlide.fontSize === 'medium' ? '12px' : '10px',
                    fontWeight: '700',
                    color: '#fff',
                    whiteSpace: 'pre-line',
                    lineHeight: '1.6',
                  }}>
                    {currentSlide.text}
                  </div>
                )}
                {currentSlide.type === 'image' && (
                  <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                    🖼️ {currentSlide.name}
                  </div>
                )}
                {currentSlide.type === 'video' && (
                  <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                    🎬 {currentSlide.name}
                  </div>
                )}
                {currentSlide.type === 'pdf' && (
                  <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                    📄 {currentSlide.name}
                  </div>
                )}
              </div>
            ) : (
              <span style={{ fontSize: '11px' }}>无内容</span>
            )}
          </div>
        </div>

        {/* 下一张预览 */}
        <div className="preview-screen">
          <span className="preview-screen__label">下一张</span>
          <div className="preview-screen__content">
            <span style={{ fontSize: '11px' }}>无内容</span>
          </div>
        </div>

        {/* 显示器信息 */}
        <div style={{ marginTop: 'auto' }}>
          <div className="preview-panel__title" style={{ marginBottom: '12px' }}>系统信息</div>
          <div style={{
            fontSize: '12px',
            color: 'var(--color-text-muted)',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>检测到的显示器</span>
              <span style={{ color: 'var(--color-text-secondary)' }}>{displays.length}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>投影状态</span>
              <span style={{ color: projectorActive ? 'var(--color-success)' : 'var(--color-text-muted)' }}>
                {projectorActive ? '运行中' : '未启动'}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>运行环境</span>
              <span style={{ color: 'var(--color-text-secondary)' }}>
                {isElectron ? 'Electron' : '浏览器'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ControlPanel;
