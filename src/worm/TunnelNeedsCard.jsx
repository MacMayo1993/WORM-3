import { tunnelDanger } from './healerWorm/tunnelReadout.js';
import { WORMHOLE_MAX_TRAVERSALS } from './healerWorm/constants.js';
import { useEffect, useState } from 'react';
import { wormBuffs } from './wormBuffs.js';
import { useGameStore } from '../hooks/useGameStore.js';
import { GAME_HUD } from '../utils/uiTheme.js';

export default function TunnelNeedsCard({ compact = false, onInspect }) {
  const [need, setNeed] = useState(wormBuffs.tunnelNeeds);
  const alive = useGameStore(s => s.wormAlive);
  const phase = useGameStore(s => s.wormGamePhase);
  useEffect(() => {
    const id = setInterval(() => setNeed(wormBuffs.tunnelNeeds), 100);
    return () => clearInterval(id);
  }, []);
  if (!need || !alive || !['active', 'finalHealing'].includes(phase)) return null;
  const danger = tunnelDanger(need);
  const warning = danger === 'collapsing' ? 'Tunnel collapsing' : danger === 'collapsed' ? 'Collapsed · do not enter' : 'Fatal tunnel · turn away';
  const title = danger ? warning : need.ready ? (need.inTransit ? 'Heals when you exit' : 'Ready to heal') : `Collect ${need.pickupsNeeded} more ${need.pickupsNeeded === 1 ? 'orb' : 'orbs'}`;
  const location = need.inTransit ? 'This tunnel' : need.distance === 0 ? 'Tunnel here' : need.aroundCorner ? 'Around the corner' : 'Tunnel ahead';
  const caption = danger ? (danger === 'collapsing' ? 'Traversal limit exceeded · collapse ahead' : 'Entering this tunnel will kill you · take another route') : need.locked ? `Re-entry in ${need.lockSeconds}s · heal before creating another` : need.uses >= WORMHOLE_MAX_TRAVERSALS ? 'Final safe trip · do not re-enter without healing' : need.ready ? (need.inTransit ? 'Let your tail clear the exit' : 'Enter to spend your carried orbs') : need.isPrism ? 'Any color counts · carried orbs included' : need.saved > 0 ? 'Progress saved · match this color' : 'Match this color · carried orbs included';
  const funded = need.ready && !danger;
  const passes = Math.max(0, WORMHOLE_MAX_TRAVERSALS - (need.uses ?? 0));
  const safety = danger ? warning : need.locked ? `Locked ${need.lockSeconds}s` : need.inTransit
    ? (passes === 0 ? 'Final safe trip' : 'Safe traversal')
    : `${passes} safe ${passes === 1 ? 'pass' : 'passes'} left`;
  const healing = need.traversalTrial ? 'Clears after your tail' : need.ready ? (need.inTransit ? 'Healing after tail clears' : 'Heal ready')
    : `Need ${need.pickupsNeeded} ${need.pickupsNeeded === 1 ? 'orb' : 'orbs'} to heal`;

  if (compact) return <button type="button" onClick={onInspect} className="worm-tunnel-needs worm-tunnel-glance worm-hud-chip"
    data-heal-ready={funded} data-tunnel-danger={!!danger} aria-label={`${safety}. ${danger ? caption : healing}. Pause for details.`} aria-haspopup="dialog">
    <span className="worm-tunnel-safety-symbol" aria-hidden="true">{danger ? '⊘' : need.locked ? '—' : '✓'}</span>
    <span className="worm-tunnel-safety-copy"><strong>{safety}</strong>
      <small>{danger ? (need.inTransit ? 'Collapse ahead' : 'Choose another route') : healing}</small>
    </span>
  </button>;
  return <aside className="worm-tunnel-needs" data-heal-ready={funded} data-tunnel-danger={!!danger} aria-label="Tunnel healing requirements" style={{ color: GAME_HUD.text, background: funded ? 'rgba(22,65,39,0.94)' : 'rgba(76,27,32,0.94)', border: `1px solid ${funded ? '#8ee5a6' : '#f08d91'}`, borderRadius: 16, padding: '8px 10px', width: '100%', boxSizing: 'border-box', pointerEvents: 'none', boxShadow: '0 6px 20px #0005' }}>

    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span aria-hidden="true" style={{ width: 30, height: 30, flexShrink: 0, borderRadius: '50%', background: need.isPrism ? 'conic-gradient(#ff739a,#ffdc72,#93e59c,#7cdaff,#b996ff,#ff739a)' : need.color, border: '2px solid #ffffffc0', boxShadow: `0 0 12px ${need.color}70`, display: 'grid', placeItems: 'center', color: '#16201a', fontWeight: 900 }}>{danger ? '!' : need.ready ? '✓' : need.pickupsNeeded}</span>
      <div>
        <div style={{ fontSize: 9, letterSpacing: 1.1, opacity: 0.72 }}>{location}</div>
        <div style={{ fontSize: 13, fontWeight: 900, lineHeight: 1.5 }}>{danger ? title : safety}</div>
        {!danger && <div style={{ fontSize: 12 }}>{healing}</div>}
      </div>
    </div>
    {!danger && !need.inTransit && !need.traversalTrial && <div role="progressbar" aria-label="Healing energy deposited" aria-valuetext={`${Math.round(need.savedFraction * 100)}% deposited, ${Math.round(need.payableFraction * 100)}% available from carried orbs`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(need.savedFraction * 100)} style={{ display: 'flex', overflow: 'hidden', height: 5, background: '#0005', borderRadius: 4, margin: '7px 0 5px' }}>
      <span style={{ width: `${need.savedFraction * 100}%`, background: need.color }} />
      <span style={{ width: `${need.payableFraction * 100}%`, background: 'repeating-linear-gradient(120deg,#ffffff70 0 3px,#ffffff25 3px 6px)' }} />
    </div>}
    <div style={{ fontSize: 10, opacity: 0.85, marginTop: need.voided ? 5 : 0 }}>{need.traversalTrial && !danger ? 'Cross once to clear this route' : caption}</div>
  </aside>;
}
