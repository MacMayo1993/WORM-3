import { wizardPaperBackground } from './WizardChrome.jsx';
import { chaosSetupSettings } from '../../utils/chaosSetup.js';
import { arcadeModeVars } from '../../utils/arcadeTheme.js';
import React, { useState, useMemo, useRef } from 'react';
import { useDialogBehavior } from '../ui/Panel.jsx';
import { useGameStore } from '../../hooks/useGameStore.js';
import { BET_TYPES, bettingPalette, calcPayout, streakMultiplier, formatSpeedThreshold } from '../../utils/disparityBetting.js';
import { BET_MIN, BET_MAX } from '../../utils/economyConstants.js';
import { Z } from '../../utils/uiTheme.js';
import { ChaosGlyph, ChaosEmblem } from '../../chaos/ChaosArt.jsx';
import '../../chaos/chaos.css';
import '../../chaos/chaosSetup.css';

const WAGER_PRESETS = [10, 25, 50, 100, 250, 500];
const StepLabel = ({ n, done, label }) => <div className="chaos-step-label">
  <span data-done={done}>{done ? '✓' : `0${n}`}</span><h3>{label}</h3>
</div>;

const DisparityBettingScreen = ({ onBetPlaced, onSkip, speedThresholdSec = null, settings, onBack }) => {
  const dialogRef = useRef(null);
  const onDialogKeyDown = useDialogBehavior(dialogRef, onBack);
  const parityPoints = useGameStore(s => s.parityPoints);
  const currentSettings = useGameStore(s => s.settings);
  const paletteSettings = useMemo(() => chaosSetupSettings(currentSettings, settings), [currentSettings, settings]);
  const { faces: faceInfo, pairs } = useMemo(() => bettingPalette(paletteSettings), [paletteSettings]);
  const betStreak = useGameStore(s => s.betStreak);
  const record = useGameStore(s => s.chaosRecord);

  const [selectedType, setSelectedType] = useState('PAIR');
  const [pick, setPick] = useState(null);
  const [wager, setWager] = useState(25);

  const betDef = selectedType ? BET_TYPES[selectedType] : null;
  const maxWager = Math.min(parityPoints, BET_MAX);

  const handleSelectType = (typeId) => {
    setSelectedType(typeId);
    setPick(null);
  };

  const effectiveOdds = betDef ? betDef.odds : 0;
  const mult = streakMultiplier(betStreak);
  const potentialWin = useMemo(() => calcPayout(wager, effectiveOdds, betStreak), [wager, effectiveOdds, betStreak]);
  const profit = potentialWin - wager;

  const canPlace = !!(selectedType && pick !== null && wager >= BET_MIN && wager <= maxWager);

  // Guards against a fast double-tap firing clicks twice before the
  // screen unmounts, which would deduct the wager twice.
  const placedRef = useRef(false);
  const handlePlace = () => {
    if (!canPlace || placedRef.current) return;
    if (!useGameStore.getState().spendCoins(wager)) return;
    placedRef.current = true;
    onBetPlaced({ type: selectedType, pick, wager, odds: effectiveOdds, potentialWin, placedAt: Date.now(), streak: betStreak, paletteSettings });
  };

  const hint = !selectedType ? 'Pick a bet type to continue'
    : pick === null ? 'Make your pick below to continue'
    : wager < BET_MIN ? `Minimum wager is ${BET_MIN} PP`
    : wager > maxWager ? `You only have ${parityPoints} PP`
    : null;

  const size = settings?.cubeSize || 3;
  const selectedPair = pairs.find(p => p.id === pick);
  return (
    <div ref={dialogRef} tabIndex={-1} onKeyDown={onDialogKeyDown} className="chaos-ui chaos-overlay chaos-forecast mode-wizard" style={{ zIndex: Z.FULLSCREEN, ...arcadeModeVars('chaos'), '--mode-accent': arcadeModeVars('chaos')['--arcade-accent'], '--mode-ink': 'var(--arcade-ink-strong)', '--chaos-accent': arcadeModeVars('chaos')['--arcade-accent'], '--chaos-accent-shadow': 'var(--arcade-ink-strong)' }} role="dialog" aria-modal="true" aria-label="Choose a Chaos prediction">
      <div className="chaos-forecast-sheet" style={wizardPaperBackground}>
        <div className="chaos-forecast-scroll">
          <header className="chaos-hero">
            <div className="chaos-topline"><span className="chaos-kicker"><i className="chaos-status-dot" /> Chaos</span>
              <div className="chaos-wallet"><span>Balance</span><strong>{parityPoints.toLocaleString()} <small>PP</small></strong></div>
            </div>
            <div className="chaos-hero-content">
              <div><h1>Who survives?</h1>
                </div>
              <ChaosEmblem colors={faceInfo} />
            </div>
            <div className="chaos-setup-strip">
              <span><strong>{size}×{size}</strong> Cube</span>
              <span><strong>{settings?.disparityLevel || 3}<small>/5</small></strong> Intensity</span>
              <span><strong>{settings?.flipCap || 8}</strong> Flip limit</span>
              <span><strong>{6 * size * size}</strong> Tiles</span>
            </div>
          </header>
          <div className="chaos-forecast-body">
            <section className="chaos-step">
              <StepLabel n={1} done={!!selectedType} label="Prediction" />
              <div className="chaos-bet-types">{Object.values(BET_TYPES).map(bt =>
                <button key={bt.id} className="chaos-bet-type" aria-pressed={selectedType === bt.id} onClick={() => handleSelectType(bt.id)}>
                  <span className="chaos-bet-type-top"><ChaosGlyph kind={bt.id} /><span className="chaos-odds">{bt.odds}×</span></span>
                  <strong>{bt.label}</strong><small>{bt.tagline}</small>
                </button>
              )}</div>
            </section>
            <section className="chaos-step">
              <StepLabel n={2} done={pick !== null} label="Your pick" />
              <p className="chaos-step-description">{betDef.desc}</p>
              {selectedType === 'PAIR' && <div className="chaos-pick-pairs">{pairs.map(pair =>
                <button key={pair.id} className="chaos-pick-pair" data-pair-id={pair.id} style={{ '--pair-a': faceInfo[pair.faces[0]].hex, '--pair-b': faceInfo[pair.faces[1]].hex }} aria-pressed={pick === pair.id} onClick={() => setPick(pair.id)}>
                  <span className="chaos-pair-art" aria-hidden="true">{pair.faces.map(id => <i key={id} data-face-id={id} style={{ backgroundColor: faceInfo[id].hex }} />)}</span>
                  <strong>{pair.label}</strong><small>{2 * size * size} tiles · opposite faces</small>
                  <span className="chaos-selection-mark" aria-hidden="true">{pick === pair.id ? '✓' : '+'}</span>
                </button>
              )}</div>}
              {['SURVIVOR', 'FIRST_OUT'].includes(selectedType) && <div className="chaos-face-picker">{Object.entries(faceInfo).map(([id, info]) =>
                <button key={id} className="chaos-face-choice" aria-pressed={pick === Number(id)} onClick={() => setPick(Number(id))}>
                  <i style={{ background: info.hex }} /><strong>{info.name}</strong><span aria-hidden="true">{pick === Number(id) ? '✓' : '+'}</span>
                </button>
              )}</div>}
              {selectedType === 'SPEED' && <div className="chaos-speed-picker">{[
                { id: 'FAST', label: 'Fast', sub: speedThresholdSec ? `< ${formatSpeedThreshold(speedThresholdSec)}` : 'Beats the typical pace' },
                { id: 'SLOW', label: 'Slow', sub: speedThresholdSec ? `≥ ${formatSpeedThreshold(speedThresholdSec)}` : 'Outlasts the typical pace' },
              ].map(opt => <button key={opt.id} aria-pressed={pick === opt.id} onClick={() => setPick(opt.id)}>
                <ChaosGlyph kind="SPEED" /><strong>{opt.label}</strong><small>{opt.sub}</small>
              </button>)}</div>}
              <div className="chaos-field-note"><ChaosGlyph kind="heal" /><p>
                {selectedType === 'PAIR' && selectedPair && <strong>{size ** 2} tiles per color. </strong>}
                Opposite tiles share their fate. Tap damaged tiles to heal; this can change the outcome.
              </p></div>
            </section>
            <section className="chaos-step">
              <StepLabel n={3} done={canPlace} label="Your wager" />
              <div className="chaos-wager-presets">{WAGER_PRESETS.map(preset =>
                <button key={preset} disabled={preset > maxWager} aria-pressed={wager === preset} onClick={() => setWager(preset)}>{preset}<small> PP</small></button>
              )}{maxWager >= BET_MIN && <button aria-pressed={wager === maxWager} onClick={() => setWager(maxWager)}>All-in ({maxWager} PP)</button>}</div>
              <div className="chaos-payoff" data-ready={canPlace}>
                <div><span className="chaos-kicker">Potential profit</span><strong>+{profit}<small> PP</small></strong><small>{effectiveOdds}× odds{mult > 1 ? ` · ${mult.toFixed(1)}× streak bonus` : ' · profit after stake'}</small></div>
                <div><span className="chaos-kicker">If you lose</span><strong>−{wager}<small> PP</small></strong><small>Parity Points wagered</small></div>
              </div>
            </section>
            <div className="chaos-career-line"><ChaosGlyph kind="trophy" /><span>{record.predictions ? `${record.correct} / ${record.predictions} correct calls · Best streak ${record.bestStreak}` : 'Your first forecast starts here. Playing without a wager is always an option.'}</span></div>
          </div>
        </div>
        <footer className="chaos-forecast-footer">
          {hint && <p className="chaos-footer-hint" role="status">{hint}</p>}
          <div className="chaos-forecast-buttons">
            <button className="chaos-button chaos-button-primary" onClick={handlePlace} disabled={!canPlace}>{canPlace ? `Bet ${wager} PP & Start` : 'Place Bet & Start'}<span aria-hidden="true">↗</span></button>
            <button className="chaos-button" onClick={() => { if (!placedRef.current) { placedRef.current = true; onSkip(); } }}>Skip & Start</button>
          </div>
          {onBack && <button className="chaos-back" onClick={onBack}>← Back to setup</button>}
        </footer>
      </div>
    </div>
  );
};

export default DisparityBettingScreen;
