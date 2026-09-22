import React from 'react';

export default function AchievementList({ achievements = [] }) {
  if (!achievements.length) return null;
  const standout = achievements.reduce((best, a) => a.baseXp > best.baseXp ? a : best);
  return <section className="xp-feats" aria-label="Run feats earned">
    <div className="xp-feat-standout"><small>Highlight</small><strong>{standout.title}</strong></div>
    <ol>{achievements.map(a => <li key={a.id}>
      <span aria-hidden="true">✦</span><div><strong>{a.title}</strong><span>{a.description}</span>
        {a.first && <small>New</small>}</div><b>{a.xpEarned > 0 ? `+${a.xpEarned} XP` : 'Earned'}</b>
    </li>)}</ol>
  </section>;
}
