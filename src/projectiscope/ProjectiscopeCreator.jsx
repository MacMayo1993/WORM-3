import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useGameStore } from '../hooks/useGameStore.js';
import { PROJECTISCOPE_URL, projectiscopeConfig, validProjectiscopeDesign } from './design.js';
import { prefersReducedMotion } from '../utils/device.js';
import { wizardLayout } from '../components/screens/WizardChrome.jsx';
import { useIsMobile } from '../hooks/useIsMobile.js';
import { UI_CSS_VARS, ARCADE_INK_STRONG } from '../utils/uiTheme.js';
import { MODE_THEMES } from '../utils/modeThemes.js';
import { installCreatorTheme } from './creatorTheme.js';
import './projectiscope.css';

export default function ProjectiscopeCreator({ design, onApply, onCancel, accent = MODE_THEMES.worm.accent }) {
  const mobile = useIsMobile(), styles = wizardLayout(accent, undefined, mobile);
  const initialAccent = useRef(accent);
  const dialog = useRef(null), frame = useRef(null), initial = useRef(design);
  const callbacks = useRef({ onApply, onCancel });
  callbacks.current = { onApply, onCancel };
  const [ready, setReady] = useState(false), [saving, setSaving] = useState(false), [error, setError] = useState('');
  const waiting = useRef(false), timeout = useRef(null);
  useEffect(() => {
    const previousFocus = document.activeElement;
    const state = useGameStore.getState();
    const heldWorm = state.wormHealerMode && !state.wormPaused;
    useGameStore.setState({ projectiscopeEditing: true, ...(heldWorm ? { wormPaused: true } : {}) });
    dialog.current.showModal?.();
    if (!dialog.current.open) dialog.current.setAttribute('open', '');
    const send = () => frame.current?.contentWindow?.postMessage(projectiscopeConfig(initial.current, prefersReducedMotion()), location.origin);
    const message = event => {
      if (event.source !== frame.current?.contentWindow || event.origin !== location.origin) return;
      const m = event.data;
      if (m?.type === 'projectiscope:ready') { installCreatorTheme(frame.current.contentDocument, initialAccent.current); send(); }
      if (m?.type === 'projectiscope:configured') { setReady(true); clearTimeout(timeout.current); }
      if (m?.type === 'projectiscope:exit') callbacks.current.onCancel();
      if (!waiting.current) return;
      if (m?.type === 'projectiscope:background' || m?.type === 'projectiscope:error') {
        waiting.current = false; clearTimeout(timeout.current); setSaving(false);
        if (validProjectiscopeDesign(m.design)) callbacks.current.onApply(m.design);
        else setError('This drawing is too large to save. Undo a few strokes and try again.');
      }
    };
    window.addEventListener('message', message);
    timeout.current = setTimeout(() => setError('The creator could not load. Close it and try again.'), 15000);
    return () => {
      clearTimeout(timeout.current); window.removeEventListener('message', message);
      const current = useGameStore.getState();
      useGameStore.setState({ projectiscopeEditing: false,
        ...(heldWorm && current.wormRunId === state.wormRunId && current.wormAlive ? { wormPaused: false } : {}) });
      previousFocus?.focus?.();
    };
  }, []);
  const apply = () => {
    if (!ready || waiting.current) return;
    waiting.current = true; setSaving(true); setError('');
    frame.current.contentWindow.postMessage({ type: 'projectiscope:saveBackground' }, location.origin);
    timeout.current = setTimeout(() => {
      waiting.current = false; setSaving(false); setError('The design did not respond. Try Apply background again.');
    }, 10000);
  };
  return createPortal(
    <dialog ref={dialog} className="projectiscope-creator mode-wizard" aria-labelledby="projectiscope-title"
      style={{ ...styles.overlay, ...UI_CSS_VARS, '--mode-accent': accent, '--mode-ink': ARCADE_INK_STRONG }}
      onCancel={e => { e.preventDefault(); onCancel(); }} onKeyDown={e => e.stopPropagation()}>
      <div className="mode-wizard-sheet" style={styles.sheet}>
        <header style={styles.modeBar}>
          <button type="button" style={styles.backBtn} onClick={onCancel} aria-label="Close background creator">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M10 3L5 8l5 5" /></svg>
          </button>
          <h2 id="projectiscope-title" className="mode-wizard-kicker">Projectiscope</h2>
          <span className="mode-wizard-count" aria-label="360-degree background">360°</span>
        </header>
        <p className="projectiscope-intro">Draw, choose colors, and explore symmetry.</p>
        <iframe ref={frame} src={`${PROJECTISCOPE_URL}#creator=1`} title="Projectiscope background designer" />
        <footer style={styles.footer}>
          <span className="mode-wizard-footer-note" role="status">{error || (ready ? 'Apply to save your design for next time.' : 'Loading your creator…')}</span>
          <button type="button" className="mode-wizard-primary piece piece--bar piece--glint"
            style={{ '--piece-color': accent }} disabled={!ready || saving} onClick={apply}
            aria-label={saving ? 'Saving…' : 'Apply background'}>
            <span className="piece-face"><span className="piece-trailer">{saving ? 'Saving…' : 'Apply background'}</span><b className="piece-trailer" aria-hidden="true">→</b></span>
          </button>
          <button type="button" className="projectiscope-cancel" style={styles.btnSecondary} onClick={onCancel}>Cancel</button>
        </footer>
      </div>
    </dialog>, document.body);
}
