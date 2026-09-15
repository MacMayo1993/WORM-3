import React, { useEffect, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useGameStore } from '../hooks/useGameStore.js';
import { levelProgress, playerRank } from './model.js';
import './progression.css';

export function XpMeter({ xp, animate = false }) {
  const p = levelProgress(xp);
  return <div className="xp-meter-wrap">
    <div className="xp-meter" role="progressbar" aria-label="Player level progress" aria-valuemin={0} aria-valuemax={p.max ? 1 : p.needed} aria-valuenow={p.max ? 1 : p.current} aria-valuetext={p.max ? 'Level 50 reached' : `${p.current} of ${p.needed} XP toward level ${p.level + 1}`}>
      <span className={animate ? 'xp-meter-animate' : ''} style={{ '--xp-fill': p.fraction, transform: `scaleX(${p.fraction})` }} />
    </div>
    <span className="xp-meter-copy">{p.max ? 'Level 50 reached · XP keeps counting' : `${p.current.toLocaleString()} / ${p.needed.toLocaleString()} XP`}</span>
  </div>;
}
export function PlayerLevelBadge() {
  const { progress, open } = useGameStore(useShallow(s => ({ progress: s.playerProgress, open: s.setShowPlayerProgress })));
  const p = levelProgress(progress.xp);
  const pending = Array.from({ length: 10 }, (_, i) => (i + 1) * 5).filter(n => n <= p.level && !progress.claimedRewards[n]).length;
  return <button className="xp-menu-badge" type="button" onClick={() => open(true)} aria-label={`Player level ${p.level}. ${pending ? `${pending} rewards ready.` : 'View XP and rewards.'}`}>
    <span className="xp-level-seal" aria-hidden="true">{p.level}</span>
    <span className="xp-badge-body"><strong>{playerRank(p.level)}</strong><XpMeter xp={progress.xp} /></span>
    <span className="xp-badge-action">{pending ? `${pending} ready` : 'Rewards'} <span aria-hidden="true">→</span></span>
  </button>;
}
export function XpRunSummary({ mode }) {
  const { run, progress, demo, open } = useGameStore(useShallow(s => ({ run: s.xpRun, progress: s.playerProgress, demo: s.demoMode, open: s.setShowPlayerProgress })));
  if (demo || !run || (mode === 'puzzle' ? !run.puzzle : run.mode !== mode)) return null;
  const level = levelProgress(progress.xp).level;
  const gainedLevels = level - levelProgress(run.startXp).level;
  return <section className="xp-run-summary" aria-label="XP earned">
    <div className="xp-summary-heading"><strong>+{run.xp} XP</strong><span>{gainedLevels > 0 ? `LEVEL UP · ${level}` : `LEVEL ${level}`}</span></div>
    <XpMeter xp={progress.xp} animate />
    {Object.keys(run.breakdown).length > 0 && <details><summary>XP breakdown</summary><dl>{Object.entries(run.breakdown).map(([label, amount]) => <div key={label}><dt>{label}</dt><dd>+{amount}</dd></div>)}</dl></details>}
    <button type="button" className="xp-text-button" onClick={() => open(true)}>View rewards →</button>
  </section>;
}
export function XpReceipt({ mode }) {
  const notice = useGameStore(s => s.xpNotice);
  if (!notice || notice.mode !== mode) return null;
  return <p className="xp-receipt" role="status" key={notice.id}>+{notice.amount} XP · {notice.label}</p>;
}
export function LevelUpCue() {
  const level = useGameStore(s => levelProgress(s.playerProgress.xp).level);
  const previous = useRef(level);
  const [show, setShow] = useState(null);
  useEffect(() => {
    const gained = level - previous.current;
    previous.current = level;
    const s = useGameStore.getState();
    setShow(null);
    if (gained <= 0 || s.demoMode || s.showMainMenu || s.showPlayerProgress || s.victory || s.showDisparityWinner) return;
    setShow({ level, points: gained * 25 });
    const timer = setTimeout(() => setShow(null), 1600);
    return () => clearTimeout(timer);
  }, [level]);
  return show ? <div className="xp-level-toast" role="status"><span className="xp-flip-cube" aria-hidden="true">✦</span><div><small>LEVEL UP</small><strong>Level {show.level}</strong><small>+{show.points} Parity Points</small></div></div> : null;
}
