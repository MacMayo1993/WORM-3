import React, { useEffect, useState } from 'react';
import { useGameStore } from '../../hooks/useGameStore.js';
import { callWormTurn } from '../wormTurnBridge.js';
import { combatBridge, COMBAT } from './portalCombat.js';
import { ELEMENTS, WAVES } from './combatDefs.js';
import './combat.css';

function useCombatReadout() {
  const [, update] = useState(0);
  useEffect(() => { const id = setInterval(() => update(n => n+1), 100); return () => clearInterval(id); }, []);
  return combatBridge.current;
}
export function CombatCard({ onRetry, onHome }) {
  const c = useCombatReadout();
  const alive = useGameStore(s => s.wormAlive);
  if (!c) return <section className="worm-combat-card">Preparing Portal Combat…</section>;
  const wave = WAVES[c.wave], element = ELEMENTS[c.element];
  const charging = c.intermission === 0 && c.waveSpawned < wave.enemies.length && c.enemies.length < wave.cap && c.spawnTimer <= COMBAT.warning;
  const message = c.won ? c.endReason === 'waves' ? 'All three waves defeated. Arena cleared!' : 'Portal sealed. You escaped the remaining waves.'
    : !alive ? 'Run ended. Try jumping over dashers or freezing armored crawlers.'
    : !c.started ? 'Survive 3 waves, or seal the portal with your six healing charges. Steer to aim. Hold Fire; colored drops infuse shots.'
    : c.intermission > 0 ? `Wave clear! Next wave in ${Math.ceil(c.intermission)}s — ammo refill and +1 shield.`
    : c.held ? 'Combat held while you clear the tunnel or return to the surface.'
    : charging ? 'Portal charging — watch for the next enemy.'
    : element ? `${element.effect}. Collect colored drops to change your shots.` : 'Steer to line up the reticle. Hold Fire to shoot forward. Jump to dodge.';
  return <section className="worm-combat-card" aria-label="Portal Combat">
    <div className="worm-combat-heading"><strong>{c.won ? c.endReason === 'waves' ? 'ARENA CLEARED' : 'PORTAL SEALED' : `WAVE ${c.wave+1}/${WAVES.length}`}</strong><span>Shield {c.health}/{COMBAT.health} · {c.kills} defeated</span></div>
    {c.started && <div className="worm-combat-readout"><span>{c.score.toLocaleString()} pts {c.combo > 1 ? `· ×${c.combo}` : ''}</span>{alive && !c.won && <span style={{color:element?.color}}>{element ? `${element.label} · ${Math.ceil(c.elementT)}s` : `${Math.max(0,wave.enemies.length-c.waveSpawned)+c.enemies.length} remaining`}</span>}</div>}
    <p role="status">{message}</p>
    {!c.started && alive && <button onClick={() => callWormTurn('combat-start')}>Start combat</button>}
    {(c.won || !alive) && <div className="worm-combat-results"><span>{c.wavesCleared}/3 waves · {c.shotsHit}/{c.shotsFired} shots hit · best ×{c.bestCombo}</span><button onClick={onRetry}>Try again</button><button onClick={onHome}>Main menu</button></div>}
  </section>;
}
export function CombatFireButton() {
  const c = useCombatReadout();
  const active = useGameStore(s => s.wormAlive && !s.wormPaused && s.wormPhase === 'crawling');
  const stop = () => callWormTurn('fire-stop');
  useEffect(() => { window.addEventListener('blur',stop); return () => { stop(); window.removeEventListener('blur',stop); }; }, []);
  const start = e => { e.preventDefault(); e.currentTarget.setPointerCapture?.(e.pointerId); callWormTurn('fire-start'); };
  const element = ELEMENTS[c?.element];
  return <button className="worm-combat-fire worm-hud-key" aria-label={`Fire parity shot, ${c?.ammo ?? 0} of 3 ready`}
    style={{borderColor:element?.color}}
    disabled={!active || !c?.started || c.won || c.held}
    onPointerDown={start} onPointerUp={stop} onPointerCancel={stop} onLostPointerCapture={stop}
    onClick={e => { if (e.detail === 0) callWormTurn('fire'); }}>
    <span>✦ {c?.ammo === 0 ? 'CHARGING' : 'FIRE'} <small>HOLD / F</small></span><span className="worm-combat-ammo" aria-hidden="true">{[0,1,2].map(i => <i key={i} className={i < (c?.ammo ?? 0) ? 'ready' : ''} />)}</span>
  </button>;
}
