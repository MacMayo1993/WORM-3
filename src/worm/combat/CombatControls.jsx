import React, { useEffect, useState } from 'react';
import { useGameStore } from '../../hooks/useGameStore.js';
import { callWormTurn } from '../wormTurnBridge.js';
import { combatBridge, COMBAT } from './portalCombat.js';
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
  const message = c.won ? 'Portal sealed. The invasion is over.' : !alive ? 'Run ended. Try another route or jump over a crawler.'
    : !c.started ? 'Shoot crawlers or seal the marked portal. Six matching healing charges are supplied. Drops recharge one shot.'
    : c.held ? 'Combat held while you clear the tunnel or return to the surface.'
    : c.enemies.length < COMBAT.maxEnemies && c.spawnTimer <= COMBAT.warning ? 'Portal charging — a crawler is emerging.'
    : 'Shots aim at nearby crawlers. Jump to dodge. Seal the portal to finish.';
  return <section className="worm-combat-card" aria-label="Portal Combat">
    <div className="worm-combat-heading"><strong>{c.won ? 'PORTAL SEALED' : 'PORTAL COMBAT'}</strong><span>Shield {c.health}/{COMBAT.health} · {c.kills} defeated</span></div>
    <p role="status">{message}</p>
    {!c.started && alive && <button onClick={() => callWormTurn('combat-start')}>Start combat</button>}
    {(c.won || !alive) && <div className="worm-combat-results"><span>{c.shotsHit}/{c.shotsFired} shots hit · {c.dropsCollected} drops</span><button onClick={onRetry}>Try again</button><button onClick={onHome}>Main menu</button></div>}
  </section>;
}
export function CombatFireButton() {
  const c = useCombatReadout();
  const active = useGameStore(s => s.wormAlive && !s.wormPaused && s.wormPhase === 'crawling');
  const fire = () => callWormTurn('fire');
  return <button className="worm-combat-fire worm-hud-key" aria-label={`Fire parity shot, ${c?.ammo ?? 0} of 3 ready`}
    disabled={!active || !c?.started || c.won || c.held || c.ammo === 0}
    onPointerDown={fire} onClick={e => { if (e.detail === 0) fire(); }}>
    <span>✦ FIRE <small>F</small></span><span className="worm-combat-ammo" aria-hidden="true">{[0,1,2].map(i => <i key={i} className={i < (c?.ammo ?? 0) ? 'ready' : ''} />)}</span>
  </button>;
}
