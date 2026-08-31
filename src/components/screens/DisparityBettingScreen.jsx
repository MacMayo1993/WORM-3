import React, { useState, useMemo, useRef } from 'react';
import { useGameStore } from '../../hooks/useGameStore.js';
import {
  BET_TYPES, FACE_INFO, ANTIPODAL_PAIRS, calcPayout, streakMultiplier, formatSpeedThreshold,
} from '../../utils/disparityBetting.js';
import { BET_MIN, BET_MAX } from '../../utils/economyConstants.js';
import {
  UI_FONT, PAPER_BACKDROP, PAPER_BACKDROP_BLUR, PAPER_SHEET, PAPER_SHEET_RAISED,
  PAPER_BORDER, PAPER_BORDER_SOFT, PAPER_TEXT, PAPER_TEXT_MUTED, PAPER_TEXT_FAINT,
  PAPER_FOOTER_BG, PAPER_BG_MUTED, PAPER_CARD_SHADOW, PAPER_SHADOW,
 Z, TEXT_MICRO } from '../../utils/uiTheme.js';

const ACCENT = '#C44B00';
const ACCENT_SHADOW = '#7a2e00';
const WAGER_PRESETS = [10, 25, 50, 100, 250, 500];

const S = {
  overlay: {
    position: 'fixed', inset: 0, zIndex: Z.FULLSCREEN,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: PAPER_BACKDROP, backdropFilter: PAPER_BACKDROP_BLUR, WebkitBackdropFilter: PAPER_BACKDROP_BLUR,
    padding: '12px',
    fontFamily: UI_FONT,
    animation: 'modalBackdropIn 0.22s ease',
    pointerEvents: 'auto',
  },
  sheet: {
    background: PAPER_SHEET, borderRadius: '20px', width: 'min(600px, 100%)',
    maxHeight: '92vh', display: 'flex', flexDirection: 'column', overflow: 'hidden',
    boxShadow: PAPER_SHADOW,
    border: `1px solid ${PAPER_BORDER}`, animation: 'modalSheetIn 0.30s cubic-bezier(0.22, 1, 0.36, 1)',
  },
  header: { padding: '24px 28px 16px', flexShrink: 0 },
  body: {
    padding: '0 28px', overflowY: 'auto', flex: 1,
    scrollbarWidth: 'thin', scrollbarColor: `${PAPER_CARD_SHADOW} transparent`,
  },
  footer: {
    padding: '16px 28px 22px', display: 'flex', flexDirection: 'column', gap: '10px',
    flexShrink: 0, borderTop: `1px solid ${PAPER_BORDER_SOFT}`, background: PAPER_FOOTER_BG,
  },
  badge: {
    display: 'inline-flex', alignItems: 'center', gap: '6px',
    background: ACCENT, borderRadius: '6px', padding: '4px 12px',
    marginBottom: '14px', boxShadow: `0 2px 0 ${ACCENT_SHADOW}`,
  },
  wallet: {
    padding: '10px 14px', borderRadius: '12px',
    background: PAPER_SHEET_RAISED, border: `1.5px solid ${PAPER_BORDER_SOFT}`,
    boxShadow: '0 2px 4px rgba(0,0,0,0.06)',
    textAlign: 'right', flexShrink: 0,
  },
  betCard: (selected) => ({
    flex: '1 1 130px', minWidth: '120px', maxWidth: '200px',
    padding: '14px 12px 12px',
    background: selected ? `${ACCENT}14` : PAPER_SHEET_RAISED,
    border: selected ? `2px solid ${ACCENT}` : `2px solid ${PAPER_BORDER_SOFT}`,
    borderRadius: '12px', cursor: 'pointer', textAlign: 'left',
    boxShadow: selected ? `inset 0 2px 4px rgba(0,0,0,0.06)` : `0 3px 0 ${PAPER_CARD_SHADOW}, 0 4px 10px rgba(0,0,0,0.06)`,
    transform: selected ? 'translateY(1px)' : 'none',
    transition: 'all 0.15s ease', position: 'relative',
    fontFamily: 'inherit',
    touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent',
  }),
  stepDot: (done, active) => ({
    width: '22px', height: '22px', borderRadius: '6px', flexShrink: 0,
    background: done ? ACCENT : active ? `${ACCENT}20` : '#e8e2da',
    border: done ? 'none' : active ? `2px solid ${ACCENT}` : `2px solid ${PAPER_BORDER_SOFT}`,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '10px', fontWeight: 800,
    color: done ? '#fff' : active ? ACCENT : '#a09890',
    transition: 'all 0.2s ease',
    boxShadow: done ? `0 2px 0 ${ACCENT_SHADOW}` : 'none',
  }),
  sectionLabel: {
    fontSize: '10px', fontWeight: 800, letterSpacing: '0.20em',
    textTransform: 'uppercase', color: '#a09890',
  },
  hint: {
    fontSize: '12px', color: PAPER_TEXT_FAINT,
    fontFamily: UI_FONT,
    textAlign: 'center',
  },
  primaryBtn: (enabled) => ({
    flex: 1, padding: '14px 20px', borderRadius: '10px',
    cursor: enabled ? 'pointer' : 'not-allowed',
    background: enabled ? ACCENT : PAPER_BORDER_SOFT,
    border: 'none', fontFamily: 'inherit', fontSize: '14px', fontWeight: 800,
    color: enabled ? '#fff' : '#a09890',
    transition: 'all 0.12s ease',
    boxShadow: enabled ? `0 4px 0 ${ACCENT_SHADOW}, 0 6px 16px ${ACCENT}44` : `0 3px 0 ${PAPER_CARD_SHADOW}`,
    touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent',
  }),
  skipBtn: {
    padding: '14px 18px', borderRadius: '10px', cursor: 'pointer',
    background: 'none', border: `1.5px solid ${PAPER_BORDER_SOFT}`,
    fontFamily: 'inherit', fontSize: '14px', fontWeight: 600,
    color: PAPER_TEXT_MUTED, whiteSpace: 'nowrap',
    boxShadow: 'none',
    touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent',
  },
};

// ── Step label ────────────────────────────────────────────────────────────────
const StepLabel = ({ n, done, active, label }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
    <div style={S.stepDot(done, active)}>
      {done ? (
        <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
          <path d="M1 4L3.5 6.5L9 1" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : n}
    </div>
    <span style={{ ...S.sectionLabel, color: done ? ACCENT : active ? '#3d2b1a' : '#a09890', transition: 'color 0.2s ease' }}>{label}</span>
  </div>
);

// ── Bet type card ─────────────────────────────────────────────────────────────
const BetTypeCard = ({ betType, selected, onSelect }) => (
  <button onPointerDown={onSelect} style={S.betCard(selected)}>
    <div style={{
      position: 'absolute', top: '8px', right: '8px',
      background: selected ? ACCENT : '#e8e2da',
      border: selected ? 'none' : `1.5px solid ${PAPER_BORDER_SOFT}`,
      borderRadius: '6px', padding: '2px 7px',
      fontSize: '11px', fontWeight: 900,
      color: selected ? '#fff' : PAPER_TEXT_FAINT,
      boxShadow: selected ? `0 2px 0 ${ACCENT_SHADOW}` : 'none',
      fontFamily: 'inherit',
    }}>{betType.odds}×</div>
    <div style={{ fontSize: '12px', fontWeight: 800, letterSpacing: '-0.02em', color: selected ? ACCENT : PAPER_TEXT, fontFamily: 'inherit', marginBottom: '4px', paddingRight: '36px' }}>
      {betType.label}
    </div>
    <div style={{ fontSize: '11px', lineHeight: 1.45, color: PAPER_TEXT_MUTED, fontFamily: 'inherit' }}>
      {betType.tagline}
    </div>
  </button>
);

// ── Face picker ───────────────────────────────────────────────────────────────
const FacePicker = ({ value, onChange }) => (
  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
    {Object.entries(FACE_INFO).map(([id, info]) => {
      const faceId = parseInt(id, 10);
      const selected = value === faceId;
      return (
        <button key={id} onPointerDown={() => onChange(faceId)} style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          padding: '7px 13px', borderRadius: '100px', cursor: 'pointer',
          border: selected ? `2px solid ${info.hex}` : `2px solid ${PAPER_BORDER_SOFT}`,
          background: selected ? `${info.hex}20` : PAPER_SHEET_RAISED,
          fontFamily: 'inherit', fontSize: '12px', fontWeight: 700,
          color: selected ? info.hex : PAPER_TEXT_MUTED,
          boxShadow: selected ? 'none' : `0 2px 0 ${PAPER_CARD_SHADOW}`,
          transform: selected ? 'translateY(1px)' : 'none',
          transition: 'all 0.15s ease',
          touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent',
        }}>
          <div style={{ width: '9px', height: '9px', borderRadius: '3px', background: info.hex, flexShrink: 0 }} />
          {info.name}
        </button>
      );
    })}
  </div>
);

// ── Pair picker ───────────────────────────────────────────────────────────────
const PairPicker = ({ value, onChange }) => (
  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
    {ANTIPODAL_PAIRS.map(pair => {
      const selected = value === pair.id;
      const f1 = FACE_INFO[pair.faces[0]];
      const f2 = FACE_INFO[pair.faces[1]];
      return (
        <button key={pair.id} onPointerDown={() => onChange(pair.id)} style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          padding: '8px 14px', borderRadius: '100px', cursor: 'pointer',
          border: selected ? `2px solid ${pair.color}` : `2px solid ${PAPER_BORDER_SOFT}`,
          background: selected ? `${pair.color}20` : PAPER_SHEET_RAISED,
          fontFamily: 'inherit', fontSize: '12px', fontWeight: 700,
          color: selected ? pair.color : PAPER_TEXT_MUTED,
          boxShadow: selected ? 'none' : `0 2px 0 ${PAPER_CARD_SHADOW}`,
          transform: selected ? 'translateY(1px)' : 'none',
          transition: 'all 0.15s ease',
          touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent',
        }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '3px', background: f1.hex, flexShrink: 0 }} />
          <span style={{ opacity: 0.45 }}>↔</span>
          <div style={{ width: '8px', height: '8px', borderRadius: '3px', background: f2.hex, flexShrink: 0 }} />
          {pair.label}
        </button>
      );
    })}
  </div>
);

// ── Speed picker ──────────────────────────────────────────────────────────────
// thresholdSec is the measured median collapse time for the chosen settings —
// FAST/SLOW is judged against it, so the sub-labels must show the real number.
const SpeedPicker = ({ value, onChange, thresholdSec }) => (
  <div style={{ display: 'flex', gap: '10px' }}>
    {[
      { id: 'FAST', label: 'Fast', sub: thresholdSec ? `< ${formatSpeedThreshold(thresholdSec)}` : 'beats the typical pace', color: '#c45000' },
      { id: 'SLOW', label: 'Slow', sub: thresholdSec ? `> ${formatSpeedThreshold(thresholdSec)}` : 'outlasts the typical pace', color: '#1565C0' },
    ].map(opt => {
      const selected = value === opt.id;
      return (
        <button key={opt.id} onPointerDown={() => onChange(opt.id)} style={{
          flex: 1, padding: '14px', borderRadius: '12px', cursor: 'pointer',
          border: selected ? `2px solid ${opt.color}` : `2px solid ${PAPER_BORDER_SOFT}`,
          background: selected ? `${opt.color}14` : PAPER_SHEET_RAISED,
          textAlign: 'center',
          boxShadow: selected ? 'none' : `0 3px 0 ${PAPER_CARD_SHADOW}`,
          transform: selected ? 'translateY(1px)' : 'none',
          transition: 'all 0.15s ease',
          fontFamily: 'inherit',
          touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent',
        }}>
          <div style={{ fontSize: '14px', fontWeight: 800, color: selected ? opt.color : PAPER_TEXT }}>{opt.label}</div>
          <div style={{ fontSize: '11px', color: PAPER_TEXT_FAINT, marginTop: '2px' }}>{opt.sub}</div>
        </button>
      );
    })}
  </div>
);

// ── Main component ────────────────────────────────────────────────────────────
const DisparityBettingScreen = ({ onBetPlaced, onSkip, speedThresholdSec = null }) => {
  const parityPoints = useGameStore(s => s.parityPoints);
  const betStreak = useGameStore(s => s.betStreak);

  const [selectedType, setSelectedType] = useState(null);
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

  // Guards against a fast double-tap firing pointerdown twice before the
  // screen unmounts, which would deduct the wager twice.
  const placedRef = useRef(false);
  const handlePlace = () => {
    if (!canPlace || placedRef.current) return;
    if (!useGameStore.getState().spendCoins(wager)) return;
    placedRef.current = true;
    onBetPlaced({ type: selectedType, pick, wager, odds: effectiveOdds, potentialWin, placedAt: Date.now(), streak: betStreak });
  };

  const hint = !selectedType ? 'Pick a bet type to continue'
    : pick === null ? 'Make your pick below to continue'
    : wager < BET_MIN ? `Minimum wager is ${BET_MIN} PP`
    : wager > maxWager ? `You only have ${parityPoints} PP`
    : null;

  return (
    <div style={S.overlay}>
      <div style={S.sheet}>

        {/* ── Scrollable body ─────────────────────────────────────────────── */}
        <div style={S.body}>
          <div style={{ paddingBottom: '24px' }}>

            {/* Header */}
            <div style={S.header}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={S.badge}>
                    <span style={{ fontSize: '13px' }}>🎲</span>
                    <span style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#fff' }}>Parity Roulette</span>
                  </div>
                  <h2 style={{ margin: 0, fontSize: 'clamp(20px,5vw,26px)', fontWeight: 900, color: PAPER_TEXT, letterSpacing: '-0.04em', lineHeight: 1.1 }}>
                    Place Your Bet
                  </h2>
                  <p style={{ margin: '6px 0 0', fontSize: '13px', color: PAPER_TEXT_MUTED, lineHeight: 1.5 }}>
                    Pick a wager before the round starts — wins are paid in PP.
                  </p>
                </div>

                {/* Wallet */}
                <div style={S.wallet}>
                  <div style={{ fontSize: TEXT_MICRO, fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#a09890' }}>Balance</div>
                  <div style={{ fontSize: '18px', fontWeight: 900, color: PAPER_TEXT }}>{parityPoints} <span style={{ fontSize: '11px', color: PAPER_TEXT_FAINT, fontWeight: 600 }}>PP</span></div>
                  {betStreak > 0 && (
                    <div style={{ fontSize: '10px', color: ACCENT, fontWeight: 700, marginTop: '2px' }}>
                      {betStreak}× streak · {mult.toFixed(1)}× bonus
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Step 1 — Bet type */}
            <div style={{ marginBottom: '20px' }}>
              <StepLabel n={1} done={!!selectedType} active={!selectedType} label="Choose a Bet Type" />
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {Object.values(BET_TYPES).map(bt => (
                  <BetTypeCard key={bt.id} betType={bt} selected={selectedType === bt.id} onSelect={() => handleSelectType(bt.id)} />
                ))}
              </div>
            </div>

            {/* Step 2 — Pick (always shown, dimmed until type is selected) */}
            <div style={{ marginBottom: '20px', opacity: betDef ? 1 : 0.38, transition: 'opacity 0.2s ease', pointerEvents: betDef ? 'auto' : 'none' }}>
              <StepLabel n={2} done={pick !== null} active={!!betDef && pick === null} label="Make Your Pick" />
              {betDef ? (
                <>
                  <p style={{ margin: '0 0 10px', fontSize: '12px', color: PAPER_TEXT_MUTED, lineHeight: 1.5 }}>{betDef.desc}</p>
                  {(selectedType === 'SURVIVOR' || selectedType === 'FIRST_OUT') && <FacePicker value={pick} onChange={setPick} />}
                  {selectedType === 'PAIR' && <PairPicker value={pick} onChange={setPick} />}
                  {selectedType === 'SPEED' && <SpeedPicker value={pick} onChange={setPick} thresholdSec={speedThresholdSec} />}
                </>
              ) : (
                <p style={{ margin: '0 0 10px', fontSize: '12px', color: '#a09890', lineHeight: 1.5 }}>Select a bet type above first.</p>
              )}
            </div>

            {/* Step 3 — Wager (always shown, dimmed until pick done) */}
            <div style={{ marginBottom: '8px', opacity: pick !== null ? 1 : 0.38, transition: 'opacity 0.2s ease', pointerEvents: pick !== null ? 'auto' : 'none' }}>
              <StepLabel n={3} done={wager >= BET_MIN && wager <= maxWager && pick !== null} active={pick !== null} label="Set Your Wager" />

              {/* Preset chips */}
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '12px' }}>
                {WAGER_PRESETS.map(preset => {
                  const disabled = preset > maxWager;
                  const active = wager === preset;
                  return (
                    <button key={preset} onPointerDown={() => !disabled && setWager(preset)} style={{
                      padding: '6px 14px', borderRadius: '100px',
                      cursor: disabled ? 'not-allowed' : 'pointer',
                      border: active ? `2px solid ${ACCENT}` : `2px solid ${PAPER_BORDER_SOFT}`,
                      background: active ? `${ACCENT}14` : PAPER_SHEET_RAISED,
                      fontFamily: 'inherit', fontSize: '12px', fontWeight: 700,
                      color: active ? ACCENT : disabled ? PAPER_CARD_SHADOW : PAPER_TEXT_MUTED,
                      boxShadow: active ? 'none' : `0 2px 0 ${PAPER_CARD_SHADOW}`,
                      transform: active ? 'translateY(1px)' : 'none',
                      opacity: disabled ? 0.4 : 1,
                      transition: 'all 0.13s ease',
                      touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent',
                    }}>{preset} PP</button>
                  );
                })}
                {maxWager >= BET_MIN && !WAGER_PRESETS.includes(maxWager) && (
                  <button onPointerDown={() => setWager(maxWager)} style={{
                    padding: '6px 14px', borderRadius: '100px', cursor: 'pointer',
                    border: wager === maxWager ? `2px solid ${ACCENT}` : `2px solid ${PAPER_BORDER_SOFT}`,
                    background: wager === maxWager ? `${ACCENT}14` : PAPER_SHEET_RAISED,
                    fontFamily: 'inherit', fontSize: '12px', fontWeight: 700,
                    color: wager === maxWager ? ACCENT : PAPER_TEXT_MUTED,
                    boxShadow: wager === maxWager ? 'none' : `0 2px 0 ${PAPER_CARD_SHADOW}`,
                    transform: wager === maxWager ? 'translateY(1px)' : 'none',
                    touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent',
                  }}>All-in ({maxWager} PP)</button>
                )}
              </div>

              {/* Payout row */}
              {canPlace && (
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '14px 16px', borderRadius: '12px',
                  background: `${ACCENT}0e`, border: `2px solid ${ACCENT}40`,
                }}>
                  <div>
                    <div style={{ fontSize: TEXT_MICRO, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#a09890' }}>Potential win</div>
                    <div style={{ fontSize: '22px', fontWeight: 900, color: ACCENT, letterSpacing: '-0.03em' }}>+{profit} PP</div>
                    <div style={{ fontSize: '10px', color: PAPER_TEXT_FAINT, marginTop: '1px' }}>{effectiveOdds}× odds{mult > 1 ? ` · ${mult.toFixed(1)}× streak` : ''}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: TEXT_MICRO, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#a09890' }}>If you lose</div>
                    <div style={{ fontSize: '22px', fontWeight: 900, color: '#b91c1c', letterSpacing: '-0.03em' }}>−{wager} PP</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Sticky footer ─────────────────────────────────────────────── */}
        <div style={S.footer}>
          {hint && <div style={S.hint}>{hint}</div>}
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button
              onPointerDown={handlePlace}
              disabled={!canPlace}
              style={S.primaryBtn(canPlace)}
            >
              {canPlace ? `Bet ${wager} PP & Start` : 'Place Bet & Start'}
            </button>
            <button onPointerDown={onSkip} style={S.skipBtn}>
              Skip & Start
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DisparityBettingScreen;
