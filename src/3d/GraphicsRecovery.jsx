import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useThree } from '@react-three/fiber';

const handledContextLoss = new WeakSet();

// Canvas.fallback is DOM *inside* <canvas>: React mounts it even when WebGL
// works. Never put an effect there that reports graphics failure.
export function GraphicsContextMonitor({ onFailure }) {
  const gl = useThree(s => s.gl);
  useEffect(() => {
    const lost = event => {
      if (event && handledContextLoss.has(event)) return;
      if (event) handledContextLoss.add(event);
      event?.preventDefault();
      onFailure(new Error('The graphics context was lost.'));
    };
    const canvas = gl.domElement;
    canvas.addEventListener('webglcontextlost', lost);
    if (gl.getContext().isContextLost()) lost();
    return () => canvas.removeEventListener('webglcontextlost', lost);
  }, [gl, onFailure]);
  return null;
}

function RecoveryDialog({ canRetry, onRetry, onMenu }) {
  const dialog = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    const app = document.querySelector('.full-screen');
    const wasInert = app?.hasAttribute('inert');
    app?.setAttribute('inert', '');
    dialog.current?.querySelector('button')?.focus();
    const key = event => {
      event.stopImmediatePropagation();
      if (event.type === 'keyup') return;
      if (event.key === 'Tab') {
        event.preventDefault();
        const buttons = [...dialog.current.querySelectorAll('button')];
        const index = buttons.indexOf(document.activeElement);
        buttons[(index + (event.shiftKey ? -1 : 1) + buttons.length) % buttons.length]?.focus();
      } else if (!['Enter', ' '].includes(event.key)) event.preventDefault();
    };
    const isolate = event => {
      // Allow events aimed at the dialog to reach its buttons. Background
      // touches cannot turn the worm, even on browsers without inert support.
      if (!dialog.current?.contains(event.target)) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    };
    window.addEventListener('keydown', key, true);
    window.addEventListener('keyup', key, true);
    const events = ['pointerdown', 'pointerup', 'touchstart', 'touchmove', 'touchend', 'touchcancel'];
    events.forEach(type => window.addEventListener(type, isolate, { capture: true, passive: false }));
    return () => {
      window.removeEventListener('keydown', key, true);
      window.removeEventListener('keyup', key, true);
      events.forEach(type => window.removeEventListener(type, isolate, true));
      if (!wasInert) app?.removeAttribute('inert');
      if (previous?.isConnected) previous.focus?.();
    };
  }, []);
  const stop = event => event.stopPropagation();
  return createPortal(
    <div data-graphics-recovery="modal" style={{ position: 'fixed', inset: 0, zIndex: 2147483647, display: 'grid', placeItems: 'center', padding: 20, background: '#11251ee8', color: '#18382a', fontFamily: 'system-ui, sans-serif' }}>
      <section ref={dialog} role="alertdialog" aria-modal="true" aria-labelledby="graphics-title" aria-describedby="graphics-description" data-game-input="ui"
        onPointerDown={stop} onPointerUp={stop} onTouchStart={stop} onTouchMove={stop} onTouchEnd={stop} onTouchCancel={stop}
        style={{ width: 'min(100%, 440px)', padding: 24, borderRadius: 18, background: '#fffdf5', boxSizing: 'border-box' }}>
        <h1 id="graphics-title" style={{ fontSize: 24 }}>Graphics could not start</h1>
        <p id="graphics-description">The 3D view stopped or could not open. Your saved progress is safe. {canRetry ? 'Try again, or return to the menu.' : 'Close other graphics-heavy tabs, then reload to try again.'}</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          {canRetry ? <button type="button" style={{ minHeight: 48 }} onClick={onRetry}>Retry graphics</button>
            : <button type="button" style={{ minHeight: 48 }} onClick={() => window.location.reload()}>Reload game</button>}
          <button type="button" style={{ minHeight: 48 }} onClick={onMenu}>Return to menu</button>
        </div>
      </section>
    </div>, document.body);
}

// Zero automatic retries: a deterministic renderer failure must never spin in
// a remount loop. Two player-requested attempts are enough before a full reload.
export default class GraphicsRecovery extends React.Component {
  state = { error: null, attempt: 0, dismissed: false };
  surface = null;
  lost = event => {
    if (handledContextLoss.has(event)) return;
    handledContextLoss.add(event);
    event.preventDefault();
    this.fail(new Error('The graphics context was lost.'));
  };
  bindSurface = node => {
    this.surface?.removeEventListener('webglcontextlost', this.lost, true);
    this.surface = node;
    // Native capture observes non-bubbling context loss even before suspended
    // scene children commit. The ref cleanup also covers retry and unmount.
    node?.addEventListener('webglcontextlost', this.lost, true);
  };
  static getDerivedStateFromError(error) { return { error, dismissed: false }; }
  componentDidCatch(error) { this.props.onFailure?.(error); }
  fail = error => {
    this.setState({ error, dismissed: false });
    this.props.onFailure?.(error);
  };
  retry = () => {
    if (this.state.attempt >= 2) return;
    this.props.onRetry?.();
    this.setState(s => ({ error: null, dismissed: false, attempt: s.attempt + 1 }));
  };
  menu = () => {
    this.props.onMenu();
    this.setState({ dismissed: true });
  };
  render() {
    if (!this.state.error) return <div key={this.state.attempt} ref={this.bindSurface} style={{ display: 'contents' }}>{this.props.children(this.fail)}</div>;
    if (this.state.dismissed && this.props.isMenu) {
      return createPortal(<div data-graphics-recovery="banner" role="status" style={{ position: 'fixed', bottom: 12, left: 12, zIndex: 2147483647, padding: 12, background: '#fffdf5', color: '#18382a' }}>
        3D graphics unavailable. <button type="button" onClick={() => this.setState({ dismissed: false })}>Graphics options</button>
      </div>, document.body);
    }
    return <RecoveryDialog canRetry={this.state.attempt < 2} onRetry={this.retry} onMenu={this.menu} />;
  }
}
