import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './App.css' // Import App.css instead of index.css

class RootErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    console.error('[WORM³] Uncaught render error:', error);
    console.error('[WORM³] Component stack:', info.componentStack);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          position: 'fixed', inset: 0, background: '#05050f',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 20,
          fontFamily: "'Courier New', monospace", color: '#fff',
        }}>
          <div style={{ fontSize: 48 }}>🐛</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#ff4444' }}>Something went wrong</div>
          <div style={{ fontSize: 13, color: '#888', maxWidth: 400, textAlign: 'center' }}>
            {this.state.error?.message || 'Unknown error'}
          </div>
          <button
            onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload(); }}
            style={{
              marginTop: 16, padding: '12px 32px', background: '#0a84ff',
              border: 'none', borderRadius: 10, color: '#fff',
              fontSize: 15, fontWeight: 700, cursor: 'pointer',
            }}
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <RootErrorBoundary>
      <App />
    </RootErrorBoundary>
  </React.StrictMode>,
)
