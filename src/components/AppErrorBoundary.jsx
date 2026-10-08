import React from 'react';
import { isChunkLoadError, recoverFromStaleChunk, resetChunkRecovery } from '../utils/chunkRecovery.js';
import { recordError, formatDiagnostics } from '../utils/diagnostics.js';

// The outermost boundary. Everything else in the app is either inside the 3D
// canvas (which has its own boundaries) or plain DOM with none, so an uncaught
// render error in a menu, a wizard or a lazy screen used to unmount the whole
// tree and leave a blank page with no way back. This turns that into a screen
// that says what happened and offers the two things a player can do about it.
//
// It must not lean on anything that could be what broke: no theme CSS, no store,
// no fonts, no lazy imports. Everything is inline and system-font.

const page = {
  position: 'fixed', inset: 0, zIndex: 100000, display: 'flex', alignItems: 'center', justifyContent: 'center',
  padding: 'max(16px, env(safe-area-inset-top)) 16px max(16px, env(safe-area-inset-bottom))',
  background: '#f5f2e7', color: '#1f3d2b', fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
};
const card = {
  width: 'min(100%, 460px)', boxSizing: 'border-box', padding: '22px 22px 18px', borderRadius: 18,
  background: '#fffdf5', border: '2px solid #1f3d2b', boxShadow: '0 5px 0 #c9c3a8',
};
const heading = { margin: '0 0 8px', fontSize: 22, lineHeight: 1.2, fontWeight: 800 };
const body = { margin: '0 0 16px', fontSize: 15, lineHeight: 1.45 };
const row = { display: 'flex', flexWrap: 'wrap', gap: 10 };
const button = (primary) => ({
  flex: '1 1 150px', minHeight: 48, padding: '8px 16px', borderRadius: 12, cursor: 'pointer', font: 'inherit', fontWeight: 800,
  border: '2px solid #1f3d2b', background: primary ? '#2f9e5b' : '#fffdf5', color: primary ? '#ffffff' : '#1f3d2b',
});
const pre = {
  margin: '10px 0 0', padding: 10, maxHeight: 180, overflow: 'auto', borderRadius: 10, background: '#efe9d3',
  fontSize: 11, lineHeight: 1.4, whiteSpace: 'pre-wrap', wordBreak: 'break-word', userSelect: 'text',
};

export default class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null, updating: false, copied: null };
    this.reload = this.reload.bind(this);
    this.copy = this.copy.bind(this);
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    recordError('render', error);
    console.error('[WORM-3] Uncaught UI error:', error, info?.componentStack);
    // A deploy deleted a chunk this page needs: one fresh load of index.html fixes it.
    if (isChunkLoadError(error)) this.setState({ updating: (this.props.recover ?? recoverFromStaleChunk)() });
  }

  reload() {
    resetChunkRecovery();
    (this.props.reload ?? (() => window.location.reload()))();
  }

  async copy() {
    try {
      await navigator.clipboard.writeText(formatDiagnostics({ error: this.state.error }));
      this.setState({ copied: true });
    } catch {
      // No clipboard (insecure context, denied): the details are on screen to select instead.
      this.setState({ copied: false });
    }
  }

  render() {
    const { error, updating, copied } = this.state;
    if (!error) return this.props.children;

    if (updating) {
      return (
        <div style={page} role="status" data-testid="app-updating">
          <div style={card}>
            <h1 style={heading}>Updating WORM³…</h1>
            <p style={{ ...body, marginBottom: 0 }}>A newer version is available. The game will reload in a moment.</p>
          </div>
        </div>
      );
    }

    const stale = isChunkLoadError(error);
    return (
      <div style={page} role="alert" data-testid="app-error">
        <div style={card}>
          <h1 style={heading}>{stale ? 'The game files are out of date' : 'Something went wrong'}</h1>
          <p style={body}>
            {stale
              ? 'WORM³ was updated while this page was open. Reload to get the new version.'
              : 'WORM³ hit a problem it could not recover from. Reloading usually fixes it.'}
            {' '}Your progress is stored on this device and reloading will not erase it.
          </p>
          <div style={row}>
            <button type="button" style={button(true)} onClick={this.reload}>Reload</button>
            <button type="button" style={button(false)} onClick={this.copy}>
              {copied ? 'Copied ✓' : 'Copy details'}
            </button>
          </div>
          <details style={{ marginTop: 14, fontSize: 13 }} open={copied === false}>
            <summary style={{ cursor: 'pointer', fontWeight: 700 }}>
              {copied === false ? 'Copy failed — select this text instead' : 'Technical details'}
            </summary>
            <pre style={pre}>{formatDiagnostics({ error })}</pre>
          </details>
        </div>
      </div>
    );
  }
}
