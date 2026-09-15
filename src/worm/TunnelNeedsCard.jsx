import { useEffect, useState } from 'react';
import { wormBuffs } from './wormBuffs.js';
import { useGameStore } from '../hooks/useGameStore.js';
import { GAME_HUD } from '../utils/uiTheme.js';

export default function TunnelNeedsCard() {
  const [need, setNeed] = useState(wormBuffs.tunnelNeeds);
  const alive = useGameStore(s => s.wormAlive);
  const phase = useGameStore(s => s.wormGamePhase);
  useEffect(() => {
    const id = setInterval(() => setNeed(wormBuffs.tunnelNeeds), 100);
    return () => clearInterval(id);
  }, []);
  if (!need || !alive || !['active', 'finalHealing'].includes(phase)) return null;
  const title = need.voided ? 'TUNNEL COLLAPSED' : need.ready ? (need.inTransit ? 'HEALING ON EXIT' : 'READY TO HEAL') : `COLLECT ${need.pickupsNeeded} MORE ${need.pickupsNeeded === 1 ? 'ORB' : 'ORBS'}`;
  const location = need.inTransit ? 'THIS TUNNEL' : need.distance === 0 ? 'TUNNEL HERE' : need.aroundCorner ? 'AROUND THE CORNER' : 'TUNNEL AHEAD';
  const caption = need.voided ? 'Choose another route' : need.locked ? `Sealed for ${need.lockSeconds}s · prepare your orbs` : need.uses >= 3 ? 'Danger · tunnel at traversal limit' : need.ready ? (need.inTransit ? 'Let your tail clear the exit' : 'Enter to spend your carried orbs') : need.isPrism ? 'Any color counts · carried orbs included' : need.saved > 0 ? 'Progress saved · match this color' : 'Match this color · carried orbs included';
  return <aside className="worm-tunnel-needs" aria-label="Tunnel healing requirements" style={{ color: GAME_HUD.text, background: GAME_HUD.raised, border: `1px solid ${need.ready ? '#a6eb9b' : '#ffffff35'}`, borderRadius: 16, padding: '8px 10px', width: '100%', boxSizing: 'border-box', pointerEvents: 'none', boxShadow: '0 6px 20px #0005' }}>

    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span aria-hidden="true" style={{ width: 30, height: 30, flexShrink: 0, borderRadius: '50%', background: need.isPrism ? 'conic-gradient(#ff739a,#ffdc72,#93e59c,#7cdaff,#b996ff,#ff739a)' : need.color, border: '2px solid #ffffffc0', boxShadow: `0 0 12px ${need.color}70`, display: 'grid', placeItems: 'center', color: '#16201a', fontWeight: 900 }}>{need.voided ? '×' : need.ready ? '✓' : need.pickupsNeeded}</span>
      <div>
        <div style={{ fontSize: 9, letterSpacing: 1.1, opacity: 0.72 }}>{location}</div>
        <div style={{ fontSize: 13, fontWeight: 900, lineHeight: 1.5 }}>{title}</div>
      </div>
    </div>
    {!need.voided && !need.inTransit && <div role="progressbar" aria-label="Healing energy deposited" aria-valuetext={`${Math.round(need.savedFraction * 100)}% deposited, ${Math.round(need.payableFraction * 100)}% available from carried orbs`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(need.savedFraction * 100)} style={{ display: 'flex', overflow: 'hidden', height: 5, background: '#0005', borderRadius: 4, margin: '7px 0 5px' }}>
      <span style={{ width: `${need.savedFraction * 100}%`, background: need.color }} />
      <span style={{ width: `${need.payableFraction * 100}%`, background: 'repeating-linear-gradient(120deg,#ffffff70 0 3px,#ffffff25 3px 6px)' }} />
    </div>}
    <div style={{ fontSize: 10, opacity: 0.85, marginTop: need.voided ? 5 : 0 }}>{caption}</div>
  </aside>;
}
