import React, { useEffect, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useGameStore } from '../hooks/useGameStore.js';
import { getStoreItem } from '../utils/storeCatalog.js';
import { useDialogBehavior } from '../components/ui/Panel.jsx';
import { pendingGemRewards } from '../hooks/storeSlices/chestSlice.js';
import { CHEST_TIERS, CHEST_MODES, GEM_EXCHANGE, GEM_LEVEL_REWARD, GEM_STORY_REWARD, chestOdds, chestPool } from './chests.js';
import { Z, UI_FONT } from '../utils/uiTheme.js';
import './chests.css';

const orientations = [[0, 0], [0, -90], [0, -180], [0, 90], [-90, 0], [90, 0]];
function CubieDie({ face, rolling, index }) {
  const [rx, ry] = orientations[face];
  return <div className="chest-die-stage" role="img" aria-label={rolling ? `Cubie ${index + 1} rolling` : `${CHEST_TIERS[face].name} ${CHEST_TIERS[face].id} cubie`}>
    <div className={`chest-die${rolling ? ' is-rolling' : ''}`} style={{ '--rx': `${rx}deg`, '--ry': `${ry}deg` }}>
      {CHEST_TIERS.map((tier, i) => <div key={tier.id} className={`chest-face chest-face-${i}`} style={{ '--face-color': tier.color }}><span>{['•', '••', '•••', '✦', '✶', 'W'][i]}</span></div>)}
    </div>
  </div>;
}
function rewardLabel(receipt) {
  const r = receipt.reward;
  return r.kind === 'item' ? getStoreItem(r.itemId)?.label : r.kind === 'currency' ? `${r.points} Parity Points + ${r.xp} XP` : `${r.gems} gems · Tier collection complete`;
}
export default function ChestRoom({ onBack, onClose }) {
  const state = useGameStore(useShallow(s => ({ chestWallet: s.chestWallet, chestRolling: s.chestRolling,
    playerProgress: s.playerProgress, parityPoints: s.parityPoints, ownedItems: s.ownedItems, demoMode: s.demoMode,
    roll: s.rollCubieChest, finish: s.finishChestRoll, exchange: s.exchangeChestGems, claim: s.claimChestGems })));
  const [mode, setMode] = useState('single'), [error, setError] = useState(''), [poolTier, setPoolTier] = useState(5);
  const root = useRef(null), resultRef = useRef(null);
  const onKeyDown = useDialogBehavior(root, onClose);
  const receipt = state.chestWallet.history.at(-1), rolling = state.chestRolling;
  const pending = pendingGemRewards(state), def = CHEST_MODES[mode];
  const faces = receipt?.faces ?? (mode === 'single' ? [0] : [0, 0]);
  const finish = state.finish;
  useEffect(() => {
    if (!rolling || !receipt) return;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    const timer = setTimeout(() => { finish(receipt.id); resultRef.current?.focus(); }, reduced ? 0 : 1500);
    return () => { clearTimeout(timer); finish(receipt.id); };
  }, [rolling, receipt, finish]);
  const perform = action => { const result = action(); setError(result.error ?? ''); };
  const tier = CHEST_TIERS[receipt?.tier ?? 0];
  const percent = n => `${Number((n * 100).toFixed(4))}%`;
  return <div ref={root} onKeyDown={onKeyDown} className="chest-room" style={{ zIndex: Z.TOAST, fontFamily: UI_FONT }} role="dialog" aria-modal="true" aria-labelledby="chest-title">
    <div className="chest-page">
      <header className="chest-header"><button onClick={onBack}>← Collection</button><div className="chest-wallet"><strong>◆ {state.chestWallet.gems.toLocaleString()} gems</strong><span>{state.parityPoints.toLocaleString()} PP</span></div><button onClick={onClose} aria-label="Close chests">✕</button></header>
      <p className="chest-eyebrow">THE PARITY STORE</p><h1 id="chest-title">CUBIE CHESTS</h1><p className="chest-intro">Six colors. One reward. A new piece of your WORM world.</p>
      <div className="chest-layout">
        <section className="chest-roll-panel" aria-label="Roll a chest">
          <div className="chest-dice-row" key={receipt?.id ?? mode}>{faces.map((face, i) => <CubieDie key={i} face={face} index={i} rolling={rolling} />)}</div>
          <div className="chest-result" ref={resultRef} tabIndex={-1} role="status" aria-live="polite" style={{ '--tier': tier.color }}>
            {rolling ? <><strong>Rolling…</strong><p>Your cubies are landing.</p></> : receipt ? <><small>{tier.id.toUpperCase()} · {tier.name}</small><strong>{rewardLabel(receipt)}</strong><p>{receipt.faces.length === 2 ? receipt.faces[0] === receipt.faces[1] ? receipt.tier === 5 && receipt.faces[0] === 5 ? 'Double mythic! Mythic is the highest tier.' : 'Matching pair! Upgraded one tier.' : 'Different faces: the lower tier wins.' : 'Single cubie result.'} Reward added to your collection or wallet.</p></> : <><strong>Your first roll awaits</strong><p>20 welcome gems are included. Pick one cubie or try a matching pair.</p></>}
          </div>
          <div className="chest-options">{Object.entries(CHEST_MODES).map(([id, option]) => <button key={id} aria-pressed={mode === id} disabled={rolling} onClick={() => setMode(id)}><strong>{option.label}</strong><span>◆ {option.cost} gems</span></button>)}</div>
          <p className="chest-rule">{mode === 'single' ? 'One weighted cubie. Keep the tier it lands on.' : 'Stronger face odds. Keep the lower tier; matching colors upgrade one tier.'}</p>
          <button className="chest-roll-button" disabled={rolling || state.demoMode || state.chestWallet.gems < def.cost} onClick={() => perform(() => state.roll(mode))}>{rolling ? 'Rolling…' : `Roll ${def.dice === 1 ? 'one cubie' : 'two cubies'} · ${def.cost} gems`}</button>
          {state.chestWallet.gems < def.cost && <p>Earn or exchange gems below to roll.</p>}
          {error && <p role="alert" className="chest-error">{error}</p>}
        </section>
        <section className="chest-tiers" aria-label="Reward tiers"><h2>THE SIX TIERS</h2>{CHEST_TIERS.map((t, i) => ({ ...t, tier: i })).reverse().map(t => <button key={t.id} onClick={() => setPoolTier(t.tier)} aria-pressed={poolTier === t.tier} style={{ '--tier': t.color }}><i aria-hidden="true" /><span><strong>{t.id.toUpperCase()} · {t.name}</strong><small>{t.label}</small></span></button>)}<details><summary>View {CHEST_TIERS[poolTier].name.toLowerCase()} rewards</summary>{poolTier === 0 ? <p>Every white result grants 25 PP and 25 XP.</p> : <><p>Unowned items have equal chances within this tier. When all are owned: {CHEST_TIERS[poolTier].compensation} gems.</p><ul>{chestPool(poolTier).map(item => <li key={item.id}>{item.label}{state.ownedItems.includes(item.id) ? ' · Owned' : ''}</li>)}</ul></>}</details></section>
      </div>
      <section className="chest-earn"><h2>FUEL YOUR NEXT ROLL</h2><div className="chest-earn-grid"><div><h3>Play & progress</h3><p>+{GEM_LEVEL_REWARD} gems per new XP level. +{GEM_STORY_REWARD} per first Story clear. Past progress counts once, too.</p><button disabled={!pending.amount || rolling || state.demoMode} onClick={() => perform(state.claim)}>Claim {pending.amount} earned gems</button></div><div><h3>Exchange Parity Points</h3><p>Keep PP for direct purchases, or trade {GEM_EXCHANGE.points} PP for {GEM_EXCHANGE.gems} gems.</p><button disabled={state.parityPoints < GEM_EXCHANGE.points || rolling || state.demoMode} onClick={() => perform(state.exchange)}>Exchange {GEM_EXCHANGE.points} PP → {GEM_EXCHANGE.gems} gems</button></div></div></section>
      <details className="chest-odds"><summary>Exact odds & rolling rules</summary><p>Each roll awards one reward. Paired cubies are independent and use stronger weights than single cubies. The final reward takes the lower tier, except matching colors move up one tier. Two red faces stay mythic.</p><div className="chest-table-scroll"><table><caption>Chance per roll, before choosing an item</caption><thead><tr><th>Tier</th><th>One cubie / final</th><th>Each paired cubie</th><th>Two cubies / final</th></tr></thead><tbody>{CHEST_TIERS.map((t, i) => <tr key={t.id}><th>{t.id} · {t.name}</th><td>{percent(chestOdds('single')[i])}</td><td>{percent(CHEST_MODES.double.weights[i] / 10000)}</td><td>{percent(chestOdds('double')[i])}</td></tr>)}</tbody></table></div><p>White gives PP and XP together; an XP level-up can also add its normal PP bonus. Other tiers first choose an unowned item uniformly; completed tiers give gems. Odds stay fixed between rolls. Roll costs are 10 and 15 gems respectively.</p></details>
      <details className="chest-history"><summary>Recent rolls ({state.chestWallet.history.length})</summary><ol>{[...state.chestWallet.history].reverse().map(r => <li key={r.id}>#{r.id} · {r.faces.map(f => CHEST_TIERS[f].id).join(' + ')} → {CHEST_TIERS[r.tier].name} · {rewardLabel(r)} · {r.cost} gems</li>)}</ol></details>
      <p className="chest-currency-note"><strong>Orbs</strong> feed your worm during a run. <strong>Parity Points</strong> buy items directly. <strong>Gems</strong> open cubie chests. <strong>XP</strong> builds your permanent level. Cubies are the dice, not another currency.</p>
    </div>
  </div>;
}
