import { useEffect, useState } from 'react';
import { useGameStore } from '../hooks/useGameStore.js';
import { wormBuffs } from './wormBuffs.js';
import { callWormTurn } from './wormTurnBridge.js';
import { SIGNATURES } from './healerWorm/signatures.js';
import { GAME_HUD } from '../utils/uiTheme.js';

export default function SignatureButton({ compact = false }) {
  const character = useGameStore(s => s.wormCharacter);
  const paused = useGameStore(s => s.wormPaused || s.wormJumpRescueActive);
  const alive = useGameStore(s => s.wormAlive);
  const phase = useGameStore(s => s.wormGamePhase);
  const [readout, setReadout] = useState(wormBuffs.signature);
  const def = SIGNATURES[character];
  useEffect(() => {
    if (!def || def.passive) return;
    const id = setInterval(() => setReadout(wormBuffs.signature), 100);
    return () => clearInterval(id);
  }, [def]);
  if (!def || def.passive) return null;
  const current = readout?.character === character ? readout : null;
  const disabled = !alive || paused || !['active', 'finalHealing'].includes(phase) || !current || (!current.returnReady && (current.seconds > 0 || current.active));
  const label = current?.returnReady ? `${current.activeSeconds}s` : current?.charges > 0 ? `${current.charges} LEFT` : current?.active ? 'ACTIVE' : current?.seconds > 0 ? `${current.seconds}s` : 'Q';
  const status = current?.notice || (!current?.ready && !current?.active && !current?.seconds ? current?.reason : '') || '';
  const activate = () => {
    const state = useGameStore.getState();
    if (!disabled && state.wormAlive && !state.wormPaused) callWormTurn('signature');
  };
  return <div className={`worm-signature-control${compact ? ' worm-signature-compact' : ''}`} style={{ width: '100%', minWidth: 0, textAlign: 'center' }}>
    <button type="button" disabled={disabled} onPointerDown={activate}
      onClick={e => { if (e.detail === 0) activate(); }}
      aria-label={`${current?.returnReady ? 'Return to bookmark' : def.name}${current?.returnReady ? `, ${current.activeSeconds} seconds to return` : current?.seconds > 0 ? `, ${current.seconds} seconds remaining` : ''}`}
      title={`${def.hint} Keyboard: Q`} className="worm-hud-key"
      style={{ width: '100%', minHeight: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 18,
        color: def.color, background: GAME_HUD.raised, border: `1px solid ${def.color}`, opacity: disabled && !current?.active ? 0.65 : 1,
        boxShadow: current?.ready ? `0 0 12px ${def.color}35` : 'none', fontFamily: 'inherit', cursor: disabled ? 'default' : 'pointer' }}>
      <svg width="30" height="30" viewBox="0 0 32 32" aria-hidden="true">
        <circle cx="16" cy="16" r="14" fill="none" stroke="currentColor" opacity="0.2" />
        <circle cx="16" cy="16" r="14" fill="none" stroke="currentColor" strokeWidth="2" pathLength="100"
          strokeDasharray={`${Math.max(0, Math.min(100, (current?.fraction ?? 1) * 100))} 100`} transform="rotate(-90 16 16)" />
        <g fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          {character === 'inch' ? <path d="M11 23h10l-10-4 10-4-10-4h10M16 10V6m-3 3 3-3 3 3" />
            : character === 'glow' ? <><circle cx="16" cy="16" r="3" /><path d="M10 10a8 8 0 0 0 0 12m12-12a8 8 0 0 1 0 12M7 6a13 13 0 0 0 0 20M25 6a13 13 0 0 1 0 20" /></>
            : character === 'book' ? <path d="M6 7h8l2 2 2-2h8v18h-8l-2 2-2-2H6ZM16 9v18M20 7v9l2-2 2 2V7" />
            : character === 'classic' ? <><path d="M9 24c-8-11 6-23 14-14 4 5-1 12-7 10" /><path d="m13 19 3 4 3-4M11 10l2 2m-3 3 3 1" /></>
            : character === 'prism' ? <><path d="m16 6 11 20H5ZM3 17h8m8 0 10-7m-9 9h9m-8 3 8 5" /></>
            : character === 'wiggle' ? <path d="M6 24c0-10 20-3 20-13M20 11h6v6M6 18c0-10 12-3 12-11" />
            : <><path d="M7 13V7h6m6 0h6v6M7 19v6h6m6 0h6v-6" /><rect x="12" y="12" width="8" height="8" /></>}
        </g>
      </svg>
      <span style={{ fontWeight: 800, fontSize: 12 }}>{current?.returnReady ? 'Return' : def.short}</span>
      <span style={{ fontSize: 10, minWidth: 30 }}>{label}</span>
    </button>
    {status && <div role={current?.notice ? 'status' : undefined} style={{ marginTop: 4, fontSize: 10, lineHeight: 1.25, color: '#fff8e7', textShadow: '0 1px 3px #000', pointerEvents: 'none' }}>{status}</div>}
  </div>;
}
