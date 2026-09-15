import React from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useGameStore } from '../hooks/useGameStore.js';
import './wormMissions.css';

function ActiveAchievement({ mission, xp, number }) {
  return <>
    <div className="worm-mission-heading">
      <span className="worm-mission-label">ACHIEVEMENT {number}</span>
      <span className="worm-mission-reward">+{mission.reward} PP · +{xp} XP</span>
    </div>
    <div className="worm-mission-current" key={mission.sequence}>
      <div className="worm-mission-objective"><strong>{mission.title}</strong><span>{mission.progress}/{mission.target}</span></div>
      <div className="worm-mission-track" role="progressbar" aria-label={mission.title} aria-valuemin={0} aria-valuemax={mission.target} aria-valuenow={mission.progress}>
        <div style={{ transform: `scaleX(${mission.progress / mission.target})` }} />
      </div>
    </div>
  </>;
}

export default function WormMissionCard({ summary = false }) {
  const { mission, earned, demo, alive, paused, phase, multiplier, ended } = useGameStore(useShallow(s => ({
    mission: s.wormMission, earned: s.wormRunAchievements, demo: s.demoMode,
    multiplier: s.xpRun?.mode === 'worm' ? s.xpRun.multiplier : 1,
    alive: s.wormAlive, paused: s.wormPauseMenuOpen, phase: s.wormGamePhase,
    ended: s.xpRun?.completed,
  })));
  const finished = !alive || phase === 'solved' || ended;
  if (!mission || demo || (!summary && (finished || paused))) return null;
  const active = <ActiveAchievement mission={mission} xp={Math.round(50 * multiplier)} number={earned.length + 1} />;
  if (!summary) return <section className="worm-mission worm-mission-live" aria-label="Current achievement">
    {active}
    <span className="worm-mission-announcement" role="status" aria-live="polite" aria-atomic="true">
      {earned.length > 0 ? `Achievement earned. Next: ${mission.title}.` : ''}
    </span>
  </section>;
  const points = earned.reduce((sum, achievement) => sum + achievement.reward, 0);
  const xp = earned.reduce((sum, achievement) => sum + achievement.xpEarned, 0);
  return <section className="worm-mission worm-mission-summary" aria-label={finished ? 'Achievements earned this run' : 'Achievements this run'}>
    <div className="worm-mission-heading">
      <h3 className="worm-mission-label">{finished ? 'ACHIEVEMENTS EARNED' : 'ACHIEVEMENTS SO FAR'}</h3>
      <span className="worm-achievement-count" aria-label={`${earned.length} earned`}>{earned.length}</span>
    </div>
    {earned.length > 0 ? <>
      <ol className="worm-achievements-list">
        {earned.map((achievement, index) => <li key={`${achievement.runId}:${achievement.sequence}`}>
          <span className="worm-achievement-check" aria-hidden="true">✓</span>
          <div><strong>{achievement.title}</strong><span>+{achievement.reward} PP · +{achievement.xpEarned} XP</span></div>
          <span className="worm-achievement-order" aria-hidden="true">{index + 1}</span>
        </li>)}
      </ol>
      <div className="worm-achievement-total"><span>Achievement rewards</span><strong>+{points} PP · +{xp} XP</strong></div>
    </> : <p>No achievements earned yet.</p>}
    {finished ? <p className="worm-achievement-next">Next run: {mission.title}.</p> : <div className="worm-achievement-active">{active}</div>}
  </section>;
}

export function WormReplayLabel() {
  return 'Play again';
}
