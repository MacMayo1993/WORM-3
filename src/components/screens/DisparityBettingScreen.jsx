import React, { useState, useMemo, useRef } from 'react';
import { useGameStore } from '../../hooks/useGameStore.js';
import {
  BET_TYPES, FACE_INFO, ANTIPODAL_PAIRS, calcPayout, streakMultiplier,
} from '../../utils/disparityBetting.js';
import { BET_MIN, BET_MAX } from '../../utils/economyConstants.js';

const ACCENT = '#C44B00';
const ACCENT_SHADOW = '#7a2e00';
const WAGER_PRESETS = [10, 25, 50, 100, 250, 500];

const S = {
  overlay: {
    position: 'fixed', inset: 0, zIndex: 9998,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'rgba(8,10,22,0.72)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
    padding: '12px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", sans-serif',
    animation: 'modalBackdropIn 0.22s ease',
  },
  sheet: {
    background: 'rgba(14,17,38,0.96)', borderRadius: '20px', width: 'min(600px, 100%)',
    maxHeight: '92vh', display: 'flex', flexDirection: 'column', overflow: 'hidden',
    boxShadow: '0 32px 80px rgba(0,0,0,0.60), 0 0 0 1px rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.08)', animation: 'modalSheetIn 0.30s cubic-bezier(0.22, 1, 0.36, 1)',
  },
  header: { padding: '24px 28px 20px', flexShrink: 0 },
  body: {
    padding: '0 28px', overflowY: 'auto', flex: 1,
    scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.15) transparent',
  },
  footer: {
    padding: '16px 28px 22px', display: 'flex', gap: '10px', alignItems: 'center',
    flexShrink: 0, borderTop: '1px solid rgba(255,255,255,0.08)', background: 'rgba(10,12,28,0.96)',
  },
  badge: {
    display: 'inline-flex', alignItems: 'center', gap: '6px',
    background: ACCENT, borderRadius: '6px', padding: '4px 12px',
    marginBottom: '16px', boxShadow: `0 2px 0 ${ACCENT_SHADOW}`,
  },
  wallet: {
    padding: '10px 14px', borderRadius: '12px',
    background: 'rgba(255,255,255,0.05)', border: '1.5px solid rgba(255,255,255,0.10)',
    boxShadow: 'none',
    textAlign: 'right', flexShrink: 0,
  },
  betCard: (selected) => ({
    flex: '1 1 130px', minWidth: '120px', maxWidth: '200px',
    padding: '14px 12px 12px',
    background: selected ? `${ACCENT}18` : 'rgba(255,255,255,0.04)',
    border: selected ? `2px solid ${ACCENT}` : '2px solid rgba(255,255,255,0.10)',
    borderRadius: '12px', cursor: 'pointer', textAlign: 'left',
    boxShadow: selected ? 'none' : '0 1px 4px rgba(0,0,0,0.4)',
    transform: selected ? 'translateY(1px)' : 'none',
    transition: 'all 0.15s ease', position: 'relative',
    fontFamily: 'inherit',
    touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent',
  }),
  stepDot: (done, active) => ({
    width: '22px', height: '22px', borderRadius: '6px', flexShrink: 0,
    background: done ? ACCENT : active ? `${ACCENT}22` : 'rgba(255,255,255,0.08)',
    border: done ? 'none' : active ? `2px solid ${ACCENT}` : '2px solid rgba(255,255,255,0.14)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '10px', fontWeight: 800,
    color: done ? '#fff' : active ? ACCENT : 'rgba(200,220,255,0.40)',
    transition: 'all 0.2s ease',
    boxShadow: done ? `0 2px 0 ${ACCENT_SHADOW}` : 'none',
  }),
  sectionLabel: {
    fontSize: '10px', fontWeight: 800, letterSpacing: '0.20em',
    textTransform: 'uppercase', color: 'rgba(200,220,255,0.50)',
  },
  hint: {
    fontSize: '11px', color: 'rgba(200,220,255,0.40)',
    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", sans-serif',
    textAlign: 'center', marginBottom: '10px',
  },
  primaryBtn: (enabled) => ({
    flex: 1, padding: '14px 20px', borderRadius: '10px',
    cursor: enabled ? 'pointer' : 'not-allowed',
    background: enabled ? ACCENT : 'rgba(255,255,255,0.08)',
    border: 'none', fontFamily: 'inherit', fontSize: '14px', fontWeight: 800,
    color: enabled ? '#fff' : 'rgba(200,220,255,0.30)',
    transition: 'all 0.12s ease',
    boxShadow: enabled ? `0 4px 0 ${ACCENT_SHADOW}, 0 6px 16px ${ACCENT}44` : 'none',
    touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent',
  }),
  skipBtn: {
    padding: '14px 18px', borderRadius: '10px', cursor: 'pointer',
    background: 'rgba(255,255,255,0.06)', border: '1.5px solid rgba(255,255,255,0.12)',
    fontFamily: 'inherit', fontSize: '14px', fontWeight: 600,
    color: 'rgba(200,220,255,0.65)', whiteSpace: 'nowrap',
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
    <span style={{ ...S.sectionLabel, color: done ? ACCENT : active ? '#e8edf8' : 'rgba(200,220,255,0.40)', transition: 'color 0.2s ease' }}>{label}</span>
  </div>
);

// ── Bet type card ─────────────────────────────────────────────────────────────
const BetTypeCard = ({ betType, selected, onSelect }) => (
  <button onPointerDown={onSelect} style={S.betCard(selected)}>
    <div style={{
      position: 'absolute', top: '8px', right: '8px',
      background: selected ? ACCENT : 'rgba(255,255,255,0.08)',
      border: selected ? 'none' : '1.5px solid rgba(255,255,255,0.14)',
      borderRadius: '6px', padding: '2px 7px',
      fontSize: '11px', fontWeight: 900,
      color: selected ? '#fff' : 'rgba(200,220,255,0.55)',
      boxShadow: selected ? `0 2px 0 ${ACCENT_SHADOW}` : 'none',
      fontFamily: 'inherit',
    }}>{betType.odds}×</div>
    <div style={{ fontSize: '12px', fontWeight: 800, letterSpacing: '-0.02em', color: selected ? ACCENT : '#e8edf8', fontFamily: 'inherit', marginBottom: '4px', paddingRight: '36px' }}>
      {betType.label}
    </div>
    <div style={{ fontSize: '11px', lineHeight: 1.45, color: 'rgba(200,220,255,0.55)', fontFamily: 'inherit' }}>
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
          border: selected ? `2px solid ${info.hex}` : '2px solid rgba(255,255,255,0.14)',
          background: selected ? `${info.hex}22` : 'rgba(255,255,255,0.05)',
          fontFamily: 'inherit', fontSize: '12px', fontWeight: 700,
          color: selected ? info.hex : 'rgba(200,220,255,0.65)',
          boxShadow: 'none',
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
          border: selected ? `2px solid ${pair.color}` : '2px solid rgba(255,255,255,0.14)',
          background: selected ? `${pair.color}22` : 'rgba(255,255,255,0.05)',
          fontFamily: 'inherit', fontSize: '12px', fontWeight: 700,
          color: selected ? pair.color : 'rgba(200,220,255,0.65)',
          boxShadow: 'none',
          transform: selected ? 'translateY(1px)' : 'none',
          transition: 'all 0.15s ease',
          touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent',
        }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '3px', background: f1.hex, flexShrink: 0 }} />
          <span style={{ opacity: 0.5 }}>↔</span>
          <div style={{ width: '8px', height: '8px', borderRadius: '3px', background: f2.hex, flexShrink: 0 }} />
          {pair.label}
        </button>
      );
    })}
  </div>
);

// ── Speed picker ──────────────────────────────────────────────────────────────
const SpeedPicker = ({ value, onChange }) => (
  <div style={{ display: 'flex', gap: '10px' }}>
    {[
      { id: 'FAST', label: 'Fast', sub: '< 60 sec', color: '#f59e0b' },
      { id: 'SLOW', label: 'Slow', sub: '> 60 sec', color: '#60a5fa' },
    ].map(opt => {
      const selected = value === opt.id;
      return (
        <button key={opt.id} onPointerDown={() => onChange(opt.id)} style={{
          flex: 1, padding: '14px', borderRadius: '12px', cursor: 'pointer',
          border: selected ? `2px solid ${opt.color}` : '2px solid rgba(255,255,255,0.14)',
          background: selected ? `${opt.color}18` : 'rgba(255,255,255,0.04)',
          textAlign: 'center',
          boxShadow: 'none',
          transform: selected ? 'translateY(1px)' : 'none',
          transition: 'all 0.15s ease',
          fontFamily: 'inherit',
          touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent',
        }}>
          <div style={{ fontSize: '14px', fontWeight: 800, color: selected ? opt.color : '#e8edf8' }}>{opt.label}</div>
          <div style={{ fontSize: '11px', color: 'rgba(200,220,255,0.45)', marginTop: '2px' }}>{opt.sub}</div>
        </button>
      );
    })}
  </div>
);

// ── Main component ────────────────────────────────────────────────────────────
const DisparityBettingScreen = ({ onBetPlaced, onSkip }) => {
  const parityPoints = useGameStore(s => s.parityPoints);
  const betStreak = useGameStore(s => s.betStreak);

  const [selectedType, setSelectedType] = useState(null);
  const [pick, setPick] = useState(null);
  const [wager, setWager] = useState(25);

  const pickRef = useRef(null);
  const wagerRef = useRef(null);

  const betDef = selectedType ? BET_TYPES[selectedType] : null;
  const maxWager = Math.min(parityPoints, BET_MAX);

  const handleSelectType = (typeId) => {
    setSelectedType(typeId);
    setPick(null);
    setTimeout(() => pickRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50);
  };

  const handlePick = (val) => {
    setPick(val);
    setTimeout(() => wagerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50);
  };

  const effectiveOdds = betDef ? betDef.odds : 0;
  const mult = streakMultiplier(betStreak);
  const potentialWin = useMemo(() => calcPayout(wager, effectiveOdds, betStreak), [wager, effectiveOdds, betStreak]);
  const profit = potentialWin - wager;

  const canPlace = !!(selectedType && pick !== null && wager >= BET_MIN && wager <= maxWager);

  const handlePlace = () => {
    if (!canPlace) return;
    useGameStore.getState().spendCoins(wager);
    onBetPlaced({ type: selectedType, pick, wager, odds: effectiveOdds, potentialWin, placedAt: Date.now(), streak: betStreak });
  };

  const hint = !selectedType ? 'Pick a bet type above to continue'
    : pick === null ? 'Make your pick above to continue'
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
                  <h2 style={{ margin: 0, fontSize: 'clamp(20px,5vw,26px)', fontWeight: 900, color: '#e8edf8', letterSpacing: '-0.04em', lineHeight: 1.1 }}>
                    Place Your Bet
                  </h2>
                  <p style={{ margin: '6px 0 0', fontSize: '13px', color: 'rgba(200,220,255,0.55)', lineHeight: 1.5 }}>
                    Pick a wager before the round starts — wins are paid in PP.
                  </p>
                </div>

                {/* Wallet */}
                <div style={S.wallet}>
                  <div style={{ fontSize: '9px', fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'rgba(200,220,255,0.40)' }}>Balance</div>
                  <div style={{ fontSize: '18px', fontWeight: 900, color: '#e8edf8' }}>{parityPoints} <span style={{ fontSize: '11px', color: 'rgba(200,220,255,0.45)', fontWeight: 600 }}>PP</span></div>
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

            {/* Step 2 — Pick */}
            {betDef && (
              <div ref={pickRef} style={{ marginBottom: '20px' }}>
                <StepLabel n={2} done={pick !== null} active={pick === null} label="Make Your Pick" />
                <p style={{ margin: '0 0 10px', fontSize: '12px', color: 'rgba(200,220,255,0.55)', lineHeight: 1.5 }}>{betDef.desc}</p>
                {(selectedType === 'SURVIVOR' || selectedType === 'FIRST_OUT') && <FacePicker value={pick} onChange={handlePick} />}
                {selectedType === 'PAIR' && <PairPicker value={pick} onChange={handlePick} />}
                {selectedType === 'SPEED' && <SpeedPicker value={pick} onChange={handlePick} />}
              </div>
            )}

            {/* Step 3 — Wager */}
            {betDef && pick !== null && (
              <div ref={wagerRef} style={{ marginBottom: '8px' }}>
                <StepLabel n={3} done={wager >= BET_MIN && wager <= maxWager} active={true} label="Set Your Wager" />

                {/* Preset chips */}
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '12px' }}>
                  {WAGER_PRESETS.map(preset => {
                    const disabled = preset > maxWager;
                    const active = wager === preset;
                    return (
                      <button key={preset} onPointerDown={() => !disabled && setWager(preset)} style={{
                        padding: '6px 14px', borderRadius: '100px',
                        cursor: disabled ? 'not-allowed' : 'pointer',
                        border: active ? `2px solid ${ACCENT}` : '2px solid rgba(255,255,255,0.14)',
                        background: active ? `${ACCENT}18` : 'rgba(255,255,255,0.05)',
                        fontFamily: 'inherit', fontSize: '12px', fontWeight: 700,
                        color: active ? ACCENT : disabled ? 'rgba(200,220,255,0.20)' : 'rgba(200,220,255,0.65)',
                        boxShadow: 'none',
                        transform: active ? 'translateY(1px)' : 'none',
                        opacity: disabled ? 0.4 : 1,
                        transition: 'all 0.13s ease',
                        touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent',
                      }}>{preset} PP</button>
                    );
                  })}
                  {maxWager > 0 && !WAGER_PRESETS.includes(maxWager) && (
                    <button onPointerDown={() => setWager(maxWager)} style={{
                      padding: '6px 14px', borderRadius: '100px', cursor: 'pointer',
                      border: wager === maxWager ? `2px solid ${ACCENT}` : '2px solid rgba(255,255,255,0.14)',
                      background: wager === maxWager ? `${ACCENT}18` : 'rgba(255,255,255,0.05)',
                      fontFamily: 'inherit', fontSize: '12px', fontWeight: 700,
                      color: wager === maxWager ? ACCENT : 'rgba(200,220,255,0.65)',
                      boxShadow: 'none',
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
                    background: `${ACCENT}10`, border: `2px solid ${ACCENT}55`,
                  }}>
                    <div>
                      <div style={{ fontSize: '9px', fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(200,220,255,0.45)' }}>Potential win</div>
                      <div style={{ fontSize: '22px', fontWeight: 900, color: ACCENT, letterSpacing: '-0.03em' }}>+{profit} PP</div>
                      <div style={{ fontSize: '10px', color: 'rgba(200,220,255,0.40)', marginTop: '1px' }}>{effectiveOdds}× odds{mult > 1 ? ` · ${mult.toFixed(1)}× streak` : ''}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '9px', fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(200,220,255,0.40)' }}>If you lose</div>
                      <div style={{ fontSize: '22px', fontWeight: 900, color: '#f87171', letterSpacing: '-0.03em' }}>−{wager} PP</div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Sticky footer ─────────────────────────────────────────────── */}
        <div style={S.footer}>
          {hint && <div style={{ ...S.hint, width: '100%', marginBottom: '10px' }}>{hint}</div>}
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', width: '100%' }}>
            <button
              onPointerDown={handlePlace}
              disabled={!canPlace}
              style={S.primaryBtn(canPlace)}
              onMouseEnter={e => { if (canPlace) { e.currentTarget.style.opacity = '0.88'; e.currentTarget.style.transform = 'translateY(-1px)'; } }}
              onMouseLeave={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'none'; }}
              onMouseDown={e => { if (canPlace) { e.currentTarget.style.transform = 'translateY(3px)'; e.currentTarget.style.boxShadow = `0 1px 0 ${ACCENT_SHADOW}`; } }}
              onMouseUp={e => { if (canPlace) { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = `0 4px 0 ${ACCENT_SHADOW}, 0 6px 16px ${ACCENT}44`; } }}
            >
              {canPlace ? `Bet ${wager} PP & Start` : 'Place Bet & Start'}
            </button>
            <button
              onPointerDown={onSkip}
              style={S.skipBtn}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.10)'; e.currentTarget.style.color = '#e8edf8'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = 'rgba(200,220,255,0.65)'; }}
            >Skip & Start</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DisparityBettingScreen;
