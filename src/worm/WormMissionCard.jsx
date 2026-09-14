import React from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useGameStore } from '../hooks/useGameStore.js';
import { missionDefinition } from './missions.js';
import './wormMissions.css';

export default function WormMissionCard({ summary = false }) {
  const { mission, demo, completed, alive, paused, phase } = useGameStore(useShallow(s => ({
    mission: s.wormMission, demo: s.demoMode, completed: s.wormMissionsCompleted,
    alive: s.wormAlive, paused: s.wormPauseMenuOpen, phase: s.wormGamePhase,
  })));
  if (!mission || demo || (!summary && (!alive || paused || phase === 'solved'))) return null;
  return <section className={`worm-mission ${summary ? 'worm-mission-summary' : 'worm-mission-live'}${mission.completed ? ' worm-mission-complete' : ''}`} aria-label="Run mission">
    <div className="worm-mission-heading">
      <span className="worm-mission-label">{mission.completed ? 'MISSION COMPLETE' : 'RUN MISSION'}</span>
      <span className="worm-mission-reward" role={mission.completed ? 'status' : undefined}>
        {mission.completed ? `+${mission.reward} PP earned` : `+${mission.reward} PP`}
      </span>
    </div>
    <div className="worm-mission-objective"><strong>{mission.title}</strong><span>{mission.progress}/{mission.target}</span></div>
    <div className="worm-mission-track" role="progressbar" aria-label={mission.title} aria-valuemin={0} aria-valuemax={mission.target} aria-valuenow={mission.progress}>
      <div style={{ transform: `scaleX(${mission.progress / mission.target})` }} />
    </div>
    {summary && <p>{mission.completed ? `Next run: ${missionDefinition(completed).title}.` : 'Try this mission again next run. Progress starts fresh.'}</p>}
  </section>;
}

export function WormReplayLabel() {
  const mission = useGameStore(s => s.demoMode ? null : s.wormMission);
  return mission ? (mission.completed ? 'Next mission' : 'Retry mission') : 'Play again';
}
