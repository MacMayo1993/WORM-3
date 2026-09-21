import React, { useEffect, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useGameStore } from '../hooks/useGameStore.js';
import { getStoreItem } from '../utils/storeCatalog.js';
import { useDialogBehavior } from '../components/ui/Panel.jsx';
import { pendingGemRewards } from '../hooks/storeSlices/chestSlice.js';
import { CHEST_TIERS, CHEST_MODES, GEM_EXCHANGE, GEM_LEVEL_REWARD, GEM_STORY_REWARD, chestOdds, chestPool } from './chests.js';
import { Z, UI_FONT, DISPLAY_FONT, PAPER_SHEET, PAPER_TEXT, PAPER_TEXT_MUTED, PAPER_BORDER_SOFT, NIGHT_SHEET, NIGHT_TEXT, NIGHT_TEXT_MUTED, UI_MOSS } from '../utils/uiTheme.js';
import ChestRewardChoices from './ChestRewardChoices.jsx';
import './chests.css';

const orientations = [[0, 0], [0, -90], [0, -180], [0, 90], [-90, 0], [90, 0]];
function CubieDie({ face, rolling, index }) {
  const [rx, ry] = orientations[face];
  return <div className={`chest-die-stage${rolling ? ' is-rolling' : ''}`} style={{ '--die-index': index }} role="img" aria-label={rolling ? `Cubie ${index + 1} rolling` : `${CHEST_TIERS[face].name} cubie`}>
    <div className="chest-die-shadow" aria-hidden="true" /><div className="chest-die-flight"><div className={`chest-die${rolling ? ' is-rolling' : ''}`} style={{ '--rx': `${rx}deg`, '--ry': `${ry}deg` }}>
      {CHEST_TIERS.map((tier, i) => <div key={tier.id} className={`chest-face chest-face-${i}`} style={{ '--face-color': tier.color }}><span>{['•', '••', '•••', '✦', '✶', 'W'][i]}</span></div>)}
    </div></div>
  </div>;
}
function rewardLabel(receipt) {
  const r = receipt.reward;
  return r.kind === 'choice' ? "Choose a reward" : r.kind === 'item' ? getStoreItem(r.itemId)?.label : r.kind === 'currency' ? `${r.points} Parity Points + ${r.xp} XP` : `${r.gems} gems · Owned reward`;
}
export default function ChestRoom({ onBack, onClose }) {
  const state = useGameStore(useShallow(s => ({ chestWallet: s.chestWallet, chestRolling: s.chestRolling,
    playerProgress: s.playerProgress, parityPoints: s.parityPoints, ownedItems: s.ownedItems, demoMode: s.demoMode,
    roll: s.rollCubieChest, choose: s.chooseChestReward, finish: s.finishChestRoll, exchange: s.exchangeChestGems, claim: s.claimChestGems })));
  const [mode, setMode] = useState(() => state.chestWallet.history.at(-1)?.mode ?? 'single'), [error, setError] = useState(''), [poolTier, setPoolTier] = useState(5);
  const root = useRef(null), resultRef = useRef(null);
  const onKeyDown = useDialogBehavior(root, onClose);
  const receipt = state.chestWallet.history.at(-1), rolling = state.chestRolling;
  const pending = pendingGemRewards(state), def = CHEST_MODES[mode];
  const choosing = receipt?.reward.kind === 'choice';
  const faces = receipt?.mode === mode ? receipt.faces : (mode === 'single' ? [0] : [0, 0]);
  const finish = state.finish;
  useEffect(() => {
    if (!rolling || !receipt) return;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    const timer = setTimeout(() => { finish(receipt.id); resultRef.current?.focus(); }, reduced ? 0 : 2300);
    return () => { clearTimeout(timer); finish(receipt.id); };
  }, [rolling, receipt, finish]);
  const perform = action => { const result = action(); setError(result.error ?? ''); };
  const tier = CHEST_TIERS[receipt?.tier ?? 0];
  const percent = n => `${Number((n * 100).toFixed(4))}%`;
  return <div ref={root} onKeyDown={onKeyDown} className="chest-room" style={{ zIndex: Z.TOAST, fontFamily: UI_FONT, '--display-font': DISPLAY_FONT, '--paper': PAPER_SHEET, '--ink': PAPER_TEXT, '--muted': PAPER_TEXT_MUTED, '--line': PAPER_BORDER_SOFT, '--night': NIGHT_SHEET, '--night-ink': NIGHT_TEXT, '--night-muted': NIGHT_TEXT_MUTED, '--moss': UI_MOSS }} role="dialog" aria-modal="true" aria-labelledby="chest-title">
    <div className="chest-page">
      <header className="chest-header"><button onClick={onBack}>← Store</button><div className="chest-wallet"><strong>◆ {state.chestWallet.gems.toLocaleString()} gems</strong><span>{state.parityPoints.toLocaleString()} PP</span></div><button onClick={onClose} aria-label="Close chests">✕</button></header>
      <div className="chest-masthead"><div><h1 id="chest-title">Cubie chests</h1></div><div className="chest-spectrum" aria-hidden="true">{[...CHEST_TIERS].reverse().map(t => <i key={t.id} style={{ background: t.color }} />)}</div></div>
      <div className="chest-layout">
        <section className="chest-roll-panel" aria-label="Roll a chest">
          <div className={`chest-arena${rolling ? ' is-rolling' : receipt ? ' is-revealed' : ''}`} key={`${receipt?.id ?? 'ready'}-${mode}`}
            style={{ '--reward-color': rolling ? '#b5d884' : tier.color }}>
            <div className="chest-arena-caption"><span></span><span>{def.dice === 1 ? 'One cubie' : 'Two cubies'}</span></div>
            <div className="chest-orbit" aria-hidden="true" /><div className="chest-orbit chest-orbit-inner" aria-hidden="true" />
            <div className="chest-dice-row">{faces.map((face, i) => <CubieDie key={i} face={face} index={i} rolling={rolling} />)}</div>
            <div className="chest-landing-ring" aria-hidden="true" />
            <span className="chest-arena-note">{rolling ? "Rolling…" : ""}</span>
          </div>
          <div className={`chest-result${!rolling && receipt ? ' is-revealed' : ''}`}  ref={resultRef} tabIndex={-1} role="status" aria-live="polite" style={{ '--tier': tier.color }}>
            {rolling ? <><strong>Rolling…</strong></> : receipt ? <><small><i aria-hidden="true" />Last reward · {tier.name}{receipt.faces.length === 2 && receipt.faces[0] === receipt.faces[1] ? receipt.faces[0] === 5 ? ' · MATCH' : ' · MATCH BONUS' : ''}</small><strong>{rewardLabel(receipt)}</strong><p>{receipt.faces.length === 2 ? receipt.faces[0] === receipt.faces[1] ? receipt.tier === 5 && receipt.faces[0] === 5 ? 'Double mythic.' : 'A match — one tier higher.' : 'The lower tier wins.' : ''} {choosing ? 'Choose one to keep.' : 'Added to your collection.'}</p></> : <><strong>Your next find</strong></>}
          </div>
          {!rolling && choosing && <ChestRewardChoices key={receipt.id} receipt={receipt} ownedItems={state.ownedItems} onChoose={itemId => {
            const result = state.choose(receipt.id, itemId);
            setError(result.error ?? '');
            if (result.receipt) resultRef.current?.focus();
          }} />}
          <div className="chest-options">{Object.entries(CHEST_MODES).map(([id, option]) => <button key={id} aria-pressed={mode === id} disabled={rolling || choosing} onClick={() => setMode(id)}><span className="chest-option-icon" aria-hidden="true">{id === 'single' ? '◇' : '◇ ◇'}</span><strong>{option.label}</strong><span>◆ {option.cost} gems</span></button>)}</div>
          <p className="chest-rule">{mode === 'single' ? 'Keep the rolled tier.' : 'Better odds. Lower tier wins; matches upgrade one tier.'}</p>
          <button className="chest-roll-button" disabled={rolling || choosing || state.demoMode || state.chestWallet.gems < def.cost} onClick={() => perform(() => state.roll(mode))}>{rolling ? 'Rolling…' : choosing ? 'Pick a reward' : `Roll ${def.dice === 1 ? 'one cubie' : 'two cubies'} · ${def.cost} gems`}</button>
          {state.chestWallet.gems < def.cost && <p>Not enough gems.</p>}
          {error && <p role="alert" className="chest-error">{error}</p>}
        </section>
        <section className="chest-tiers" aria-label="Reward tiers"><div className="chest-tier-heading"><h2>Reward tiers</h2></div>{CHEST_TIERS.map((t, i) => ({ ...t, tier: i })).reverse().map(t => <button key={t.id} onClick={() => setPoolTier(t.tier)} aria-pressed={poolTier === t.tier} style={{ '--tier': t.color }}><i aria-hidden="true" /><span><strong>{t.name}</strong><small>{t.label}</small></span><b aria-hidden="true">›</b></button>)}<div className="chest-pool" aria-live="polite"><h3>{CHEST_TIERS[poolTier].name} rewards</h3>{poolTier === 0 ? <p>Common: 25 PP and 25 XP.</p> : <><p>Choose 1 of 3. New items preferred. Owned picks: {CHEST_TIERS[poolTier].compensation} gems.</p><ul>{chestPool(poolTier).map(item => <li key={item.id}>{item.label}{state.ownedItems.includes(item.id) ? ' · Owned' : ''}</li>)}</ul></>}</div></section>
      </div>
      <section className="chest-earn"><h2>Get gems</h2><div className="chest-earn-grid"><div><h3>Play & progress</h3><p>+{GEM_LEVEL_REWARD} per XP level · +{GEM_STORY_REWARD} per first Story clear</p><button disabled={!pending.amount || rolling || state.demoMode} onClick={() => perform(state.claim)}>Claim {pending.amount} earned gems</button></div><div><h3>Exchange Parity Points</h3><button disabled={state.parityPoints < GEM_EXCHANGE.points || rolling || state.demoMode} onClick={() => perform(state.exchange)}>Exchange {GEM_EXCHANGE.points} PP → {GEM_EXCHANGE.gems} gems</button></div></div></section>
      <details className="chest-odds"><summary>Exact odds & rolling rules</summary><p>Each roll awards one reward. Cosmetic tiers let you choose from up to three saved options. Paired cubies are independent and use stronger weights than single cubies. The final reward takes the lower tier, except matching colors move up one tier. Two mythic faces stay mythic.</p><div className="chest-table-scroll"><table><caption>Chance per roll, before choosing an item</caption><thead><tr><th>Tier</th><th>One cubie / final</th><th>Each paired cubie</th><th>Two cubies / final</th></tr></thead><tbody>{CHEST_TIERS.map((t, i) => <tr key={t.id}><th><i className="chest-tier-dot" style={{ background: t.color }} aria-hidden="true" />{t.name}</th><td>{percent(chestOdds('single')[i])}</td><td>{percent(CHEST_MODES.double.weights[i] / 10000)}</td><td>{percent(chestOdds('double')[i])}</td></tr>)}</tbody></table></div><p>Common gives PP and XP together; an XP level-up can also add its normal PP bonus. Cosmetic tiers reveal three distinct choices. Unowned items are preferred; owned items fill any remaining slots and give the displayed gem compensation when chosen. Completed collections still get the reveal. Odds stay fixed between rolls. Roll costs are 10 and 15 gems respectively.</p></details>
      <details className="chest-history"><summary>Recent rolls ({state.chestWallet.history.length})</summary><ol>{[...state.chestWallet.history].reverse().map(r => <li key={r.id}>#{r.id} · {r.faces.map(f => CHEST_TIERS[f].name).join(' + ')} → {CHEST_TIERS[r.tier].name} · {rewardLabel(r)} · {r.cost} gems</li>)}</ol></details>
      <details className="chest-currency-note"><summary>Currencies</summary><p>Orbs: tunnel healing. PP: store purchases. Gems: chests. XP: player levels.</p></details>
    </div>
  </div>;
}
