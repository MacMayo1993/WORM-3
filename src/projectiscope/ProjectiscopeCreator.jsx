import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useGameStore } from '../hooks/useGameStore.js';
import { PROJECTISCOPE_URL, projectiscopeConfig, validProjectiscopeDesign } from './design.js';
import { prefersReducedMotion } from '../utils/device.js';
import './projectiscope.css';

export default function ProjectiscopeCreator({ design, onApply, onCancel }) {
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
      if (m?.type === 'projectiscope:ready') send();
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
    <dialog ref={dialog} className="projectiscope-creator" aria-labelledby="projectiscope-title"
      onCancel={e => { e.preventDefault(); onCancel(); }} onKeyDown={e => e.stopPropagation()}>
      <header><div><h2 id="projectiscope-title">Create your background</h2>
        <p>Draw, choose colors, and explore symmetry. Your last design is the starting point.</p></div>
        <button type="button" onClick={onCancel} aria-label="Close background creator">×</button></header>
      <iframe ref={frame} src={`${PROJECTISCOPE_URL}#creator=1`} title="Projectiscope background designer" />
      <footer><span role="status">{error || (ready ? 'Apply wraps this design around you as a moving 360° dome.' : 'Loading your creator…')}</span>
        <div><button type="button" onClick={onCancel}>Cancel</button>
          <button type="button" className="projectiscope-apply" disabled={!ready || saving} onClick={apply}>
            {saving ? 'Saving…' : 'Apply background'}</button></div></footer>
    </dialog>, document.body);
}
