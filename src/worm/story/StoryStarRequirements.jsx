import React from 'react';
import { storyStarRules } from './starGoals.js';

export default function StoryStarRequirements({ level, progress, result, earnedStars = result?.stars }) {
  const rules = storyStarRules(level);
  // Three stars at a glance; the rules behind them are one tap away, so the card
  // reads as a goal, not a paragraph.
  return <details className="worm-star-requirements" aria-label="Star requirements" open={result ? true : undefined}>
    <summary><span className="worm-star-glance" aria-hidden="true">{[1, 2, 3].map(n =>
      <i key={n} data-earned={earnedStars != null ? earnedStars >= n : undefined}>★</i>)}</span><strong>Star goals</strong></summary>
    <ol>{rules.map((rule, index) => <li key={index} data-earned={earnedStars != null ? earnedStars > index : undefined}>
      <b aria-label={`${index + 1} stars`}>{'★'.repeat(index + 1)}</b><span>{rule}</span>
    </li>)}</ol>
    <small>Peak length counts, even after spending body energy to heal.</small>
    {progress && <p>Best length: <b>{progress.peakLength}/{progress.target}</b> segments
      {' · '}{progress.grown ? 'Growth ✓' : 'Keep growing'}{' · '}{progress.fast ? 'Time ✓' : 'Over par'}
      {' · '}{progress.clean ? 'No cuts ✓' : 'Tail cut'}</p>}
    {result && <p>Best length: <b>{result.peakLength ?? 0}</b> segments
      {result.starGoals && <> · {result.starGoals.fast ? 'Time ✓' : 'Over par'} · {result.starGoals.clean ? 'No cuts ✓' : 'Tail cut'} · {result.starGoals.grown ? 'Growth ✓' : 'Growth target missed'}</>}</p>}
  </details>;
}
