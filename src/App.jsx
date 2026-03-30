import React from 'react';
import ControlPanel from './components/ControlPanel';
import ProjectorView from './components/ProjectorView';

/**
 * 根据 URL hash 决定渲染控制台还是投影窗口
 * 控制台: / 或 无 hash
 * 投影: #/projector
 */
function App() {
  const isProjector = window.location.hash === '#/projector';

  if (isProjector) {
    return <ProjectorView />;
  }

  return <ControlPanel />;
}

export default App;
