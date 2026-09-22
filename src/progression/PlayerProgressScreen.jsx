import { ACHIEVEMENTS } from './achievements.js';
import './PlayerProgressScreen.css';
import React, { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useGameStore } from '../hooks/useGameStore.js';
import DemoDialog from '../components/screens/DemoDialog.jsx';
import { STORE_ITEMS } from '../utils/storeCatalog.js';
import { levelProgress, playerRank, XP_MODES, XP_SOURCES, MAX_PLAYER_LEVEL, levelDescription } from './model.js';
import { rewardChoices, rewardTitle, availableRewards, REWARD_LEVELS } from './rewards.js';
import { XpMeter } from './ProgressWidgets.jsx';
import RewardPreview from './RewardPreview.jsx';

export default function PlayerProgressScreen() {
  const { progress, owned, close, claim } = useGameStore(useShallow(s => ({ progress: s.playerProgress, owned: s.ownedItems, close: s.setShowPlayerProgress, claim: s.claimLevelReward })));
  const level = levelProgress(progress.xp).level;
  const [achievementMode, setAchievementMode] = useState('worm');
  const modeFeats = ACHIEVEMENTS.filter(a => a.mode === achievementMode);
  const discoveries = Object.keys(progress.achievements || {}).length;
  const pending = availableRewards(progress);
  const [selectedLevel, selectLevel] = useState(() => pending[0] || REWARD_LEVELS.find(n => n > level) || MAX_PLAYER_LEVEL);
  const [choiceId, selectChoice] = useState(null);
  const [unlocked, setUnlocked] = useState(null);
  const options = rewardChoices(selectedLevel, owned);
  const selected = options.find(c => c.id === choiceId) || options[0];
  const isMilestone = REWARD_LEVELS.includes(selectedLevel);
  const claimed = progress.claimedRewards[selectedLevel];
  const canClaim = pending.includes(selectedLevel);
  const nextRewards = [...pending, ...REWARD_LEVELS.filter(n => n > level)].slice(0, 3);
  const chooseLevel = n => { selectLevel(n); selectChoice(null); setUnlocked(null); };
  const claimSelected = () => {
    if (selected && claim(selectedLevel, selected.id)) setUnlocked({ ...selected, level: selectedLevel });
  };
  const equip = () => {
    if (!unlocked) return;
    const s = useGameStore.getState();
    let settings = s.settings;
    let tileEquipped = false;
    for (const id of unlocked.items) {
      if (!s.ownedItems.includes(id)) continue;
      const item = STORE_ITEMS.find(i => i.id === id);
      if (item?.type === 'skin') s.setWormSkin(item.skinId);
      if (item?.type === 'accessory') s.setWormAccessory(item.slot, item.accessoryId);
      if (item?.type === 'hat') s.setWormHat(item.hatId);
      if (item?.type === 'scheme') settings = { ...settings, colorScheme: item.schemeKey };
      if (item?.type === 'tile' && !tileEquipped) {
        settings = { ...settings, manifoldStyles: Object.fromEntries([1,2,3,4,5,6].map(n => [n, item.tileKey])) };
        tileEquipped = true;
      }
    }
    if (settings !== s.settings) s.setSettings(settings);
    setUnlocked({ ...unlocked, equipped: true });
  };
  return <DemoDialog className="xp-screen" onClose={() => close(false)} aria-labelledby="xp-screen-title">
    <header className="xp-screen-header"><button type="button" className="xp-back" onClick={() => close(false)} data-demo-autofocus aria-label="Back to game">←</button><span>Your progress</span><span>{progress.xp.toLocaleString()} XP</span></header>
    <main className="xp-screen-content">
      <section className="xp-player-heading"><span className="xp-level-seal xp-level-seal-large" aria-hidden="true">{level}</span><div><h1 id="xp-screen-title">Level {level}</h1><p>{playerRank(level)}</p></div></section>
      <XpMeter xp={progress.xp} />
      <p className="xp-rule">+25 PP per level · Reward choice every 5 levels</p>
      {nextRewards.length > 0 && <nav className="xp-next-rewards" aria-label="Upcoming rewards">{nextRewards.map(n => <button type="button" key={n} onClick={() => chooseLevel(n)} aria-pressed={selectedLevel === n}><small>Level {n}</small><strong>{rewardTitle(n)}</strong><span>{n <= level ? 'Ready to choose' : 'Preview →'}</span></button>)}</nav>}
      <section className="xp-reward-panel" aria-labelledby="xp-reward-title">
        <div className="xp-reward-heading"><div><small>LEVEL {selectedLevel}</small><h2 id="xp-reward-title">{isMilestone ? rewardTitle(selectedLevel) : 'Keep exploring'}</h2></div><span>{claimed ? '✓ Claimed' : canClaim ? 'Reward ready' : selectedLevel <= level ? '✓ Reached' : 'Ahead'}</span></div>
        {unlocked ? <div className="xp-unlocked" role="status"><span className="xp-flip-cube" aria-hidden="true">✦</span><h3>{unlocked.items.length ? 'Unlocked' : 'Points added'}</h3><p>{unlocked.label}</p>{unlocked.items.length > 0 && <button type="button" className="xp-primary" onClick={equip} disabled={unlocked.equipped}>{unlocked.equipped ? 'Equipped ✓' : 'Equip now'}</button>}</div> : claimed ? <p className="xp-rule">Reward saved. Equip it in the Store.</p> : <>
          <div className="xp-reward-preview"><RewardPreview choice={isMilestone ? selected : { points: selectedLevel === 1 ? 0 : 25, label: 'Parity Points' }} /></div>
          {isMilestone && <><div className="xp-choice-grid" role="group" aria-label="Choose a reward">{options.map(c => <button type="button" key={c.id} onClick={() => selectChoice(c.id)} aria-pressed={selected?.id === c.id}><small>{c.item?.type === 'scheme' ? 'Palette' : c.item?.type === 'tile' ? 'Tile style' : c.item?.type || (c.points ? 'Points' : 'Collection')}</small><strong>{c.label}</strong></button>)}</div>
          {selected?.items.length > 1 && <p className="xp-bundle-items">{selected.items.map(id => STORE_ITEMS.find(i => i.id === id)?.label).join(' · ')}</p>}
          <button type="button" className="xp-primary" disabled={!canClaim} onClick={claimSelected}>{canClaim ? `Claim ${selected?.label}` : `Unlock at level ${selectedLevel}`}</button></>}
          {!isMilestone && <p className="xp-rule">{levelDescription(selectedLevel)}</p>}
        </>}
      </section>
      <section className="xp-collection" aria-labelledby="xp-collection-title">
        <h2 id="xp-collection-title">Achievements</h2>
        <p>{discoveries} / {ACHIEVEMENTS.length} discovered · First discovery in each feat family earns +10 XP.</p>
        <div className="xp-achievement-filters" role="group" aria-label="Achievement mode">
          {Object.entries(XP_MODES).map(([mode, label]) => <button key={mode} type="button" aria-pressed={achievementMode === mode} onClick={() => setAchievementMode(mode)}>{label}</button>)}
        </div>
        <ul className="xp-collection-list">{modeFeats.map(a => {
          const count = progress.achievements?.[a.id]?.count || 0;
          return <li key={a.id} className={count ? 'is-earned' : ''}><span aria-hidden="true">{count ? '✦' : '◇'}</span><div><strong>{a.title}</strong><p>{a.description}</p><small>{count ? `Earned ${count} time${count === 1 ? '' : 's'}` : 'Undiscovered'} · {a.xp} base XP</small></div></li>;
        })}</ul>
        <details><summary>XP rules</summary><p>Related tiers award only the XP increase. Puzzle replays earn reduced XP; learning, exploration and Chaos feat bonuses pay on first discovery.</p></details>
      </section>
      <section className="xp-track-section"><h2>Level track</h2><div className="xp-level-track" aria-label="All 50 levels">{Array.from({ length: MAX_PLAYER_LEVEL }, (_, i) => i + 1).map(n => <button type="button" key={n} onClick={() => chooseLevel(n)} aria-pressed={selectedLevel === n} aria-label={`Level ${n}${n % 5 === 0 ? ', reward choice' : ''}${n <= level ? ', reached' : ''}`} className={`${n <= level ? 'is-reached' : ''} ${n % 5 === 0 ? 'is-milestone' : ''}`}><strong>{n}</strong>{n % 5 === 0 && <span aria-hidden="true">✦</span>}</button>)}</div></section>
      {Object.keys(progress.modeXp).length > 0 && <section className="xp-mode-section"><h2>XP across your modes</h2><dl>{Object.entries(progress.modeXp).map(([mode, xp]) => <div key={mode}><dt>{XP_SOURCES[mode]}</dt><dd>{xp.toLocaleString()} XP</dd></div>)}</dl></section>}
    </main>
  </DemoDialog>;
}
