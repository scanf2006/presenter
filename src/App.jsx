import React from 'react';
import ControlPanel from './components/ControlPanel';
import ProjectorView from './components/ProjectorView';

/**
 * C3: Global error boundary — prevents white screen on React errors.
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary] Caught error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100vh',
            background: '#0a0a0f',
            color: '#e0e0e0',
            fontFamily: 'system-ui, sans-serif',
            padding: '2rem',
          }}
        >
          <h1 style={{ color: '#ff6b6b', marginBottom: '1rem' }}>Something went wrong</h1>
          <p
            style={{ color: '#aaa', marginBottom: '1rem', maxWidth: '600px', textAlign: 'center' }}
          >
            {this.state.error?.message || 'An unexpected error occurred.'}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{
              padding: '0.5rem 1.5rem',
              background: '#333',
              color: '#fff',
              border: '1px solid #555',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '1rem',
            }}
          >
            Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

/**
 * 根据 URL hash 决定渲染控制台还是投影窗口
 * 控制台: / 或 无 hash
 * 投影: #/projector
 */
function App() {
  const hash = window.location.hash || '';
  const pathname = window.location.pathname || '';
  const isProjector = hash.includes('projector') || pathname.includes('/projector');

  if (isProjector) {
    return (
      <ErrorBoundary>
        <ProjectorView />
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <ControlPanel />
    </ErrorBoundary>
  );
}

export default App;
