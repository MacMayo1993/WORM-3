import React from 'react';
import { useGameStore } from '../../hooks/useGameStore.js';

// Keep HUD effects and progress bookkeeping mounted while removing all of its
// paint, hit targets and tab stops. Never wrap a game Canvas in this boundary.
export default function CaptureChrome({ children }) {
  const active = useGameStore(s => s.captureMode);
  return <div className="capture-chrome" hidden={active} inert={active ? '' : undefined}
    aria-hidden={active || undefined} style={{ display: active ? 'none' : 'contents' }}>
    {children}
  </div>;
}
