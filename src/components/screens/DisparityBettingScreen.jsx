import React, { useState, useMemo, useRef } from 'react';
import { useGameStore } from '../../hooks/useGameStore.js';
import {
  BET_TYPES, FACE_INFO, ANTIPODAL_PAIRS, calcPayout, streakMultiplier,
} from '../../utils/disparityBetting.js';
import { BET_MIN, BET_MAX } from '../../utils/economyConstants.js';

const FONT = "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', system-ui, sans-serif";
const WAGER_PRESETS = [10, 25, 50, 100, 250, 500];

// ── Shared touch-friendly button base styles ──────────────────────────────────
const TOUCH_BTN = { touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' };

// ── Bet type card ─────────────────────────────────────────────────────────────
const BetTypeCard = ({ betType, selected, onSelect }) => (
  <button
    onPointerDown={onSelect}
    style={{
      ...TOUCH_BTN,
      flex: '1 1 130px', minWidth: '120px', maxWidth: '180px',
      padding: '12px 10px 10px',
      background: selected ? 'rgba(168,85,247,0.18)' : 'rgba(255,255,255,0.04)',
      border: selected ? '1.5px solid rgba(168,85,247,0.7)' : '1px solid rgba(120,160,255,0.14)',
      borderRadius: '12px', cursor: 'pointer', textAlign: 'left',
      transition: 'all 0.18s ease',
      boxShadow: selected ? '0 0 16px rgba(168,85,247,0.18)' : 'none',
      position: 'relative',
    }}
  >
    <div style={{
      fontSize: '10px', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase',
      color: selected ? '#e9d5ff' : 'rgba(180,210,255,0.75)',
      fontFamily: FONT, marginBottom: '3px',
    }}>{betType.label}</div>
    <div style={{
      fontSize: '10px', lineHeight: 1.4,
      color: selected ? 'rgba(200,220,255,0.60)' : 'rgba(140,170,220,0.40)',
      fontFamily: FONT,
    }}>{betType.tagline}</div>
    <div style={{
      position: 'absolute', top: '8px', right: '8px',
      background: selected ? 'rgba(168,85,247,0.4)' : 'rgba(255,255,255,0.07)',
      border: selected ? '1px solid rgba(168,85,247,0.5)' : '1px solid rgba(255,255,255,0.1)',
      borderRadius: '6px', padding: '2px 6px',
      fontSize: '10px', fontWeight: 800,
      color: selected ? '#d8b4fe' : 'rgba(160,190,240,0.5)',
      fontFamily: FONT,
    }}>{betType.odds}×</div>
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
          ...TOUCH_BTN,
          display: 'flex', alignItems: 'center', gap: '5px',
          padding: '6px 11px', borderRadius: '100px', cursor: 'pointer',
          border: selected ? `1.5px solid ${info.hex}` : '1px solid rgba(120,160,255,0.2)',
          background: selected ? `${info.hex}22` : 'rgba(255,255,255,0.04)',
          fontFamily: FONT, fontSize: '11px', fontWeight: 700,
          color: selected ? info.hex : 'rgba(180,210,255,0.65)',
          transition: 'all 0.15s ease',
          boxShadow: selected ? `0 0 10px ${info.hex}28` : 'none',
        }}>
          <div style={{ width: '9px', height: '9px', borderRadius: '50%', background: info.hex, flexShrink: 0 }} />
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
          ...TOUCH_BTN,
          display: 'flex', alignItems: 'center', gap: '5px',
          padding: '8px 13px', borderRadius: '100px', cursor: 'pointer',
          border: selected ? `1.5px solid ${pair.color}` : '1px solid rgba(120,160,255,0.2)',
          background: selected ? `${pair.color}18` : 'rgba(255,255,255,0.04)',
          fontFamily: FONT, fontSize: '11px', fontWeight: 700,
          color: selected ? pair.color : 'rgba(180,210,255,0.65)',
          transition: 'all 0.15s ease',
        }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: f1.hex, flexShrink: 0 }} />
          <span style={{ opacity: 0.5 }}>↔</span>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: f2.hex, flexShrink: 0 }} />
          {pair.label}
        </button>
      );
    })}
  </div>
);

// ── Speed picker ──────────────────────────────────────────────────────────────
const SpeedPicker = ({ value, onChange }) => (
  <div style={{ display: 'flex', gap: '8px' }}>
    {[
      { id: 'FAST', label: 'Fast', sub: '< 60 sec', color: '#f59e0b' },
      { id: 'SLOW', label: 'Slow', sub: '> 60 sec', color: '#60a5fa' },
    ].map(opt => {
      const selected = value === opt.id;
      return (
        <button key={opt.id} onPointerDown={() => onChange(opt.id)} style={{
          ...TOUCH_BTN,
          flex: 1, padding: '10px 14px', borderRadius: '12px', cursor: 'pointer',
          border: selected ? `1.5px solid ${opt.color}` : '1px solid rgba(120,160,255,0.2)',
          background: selected ? `${opt.color}18` : 'rgba(255,255,255,0.04)',
          textAlign: 'center', transition: 'all 0.15s ease',
        }}>
          <div style={{ fontSize: '12px', fontWeight: 800, fontFamily: FONT, color: selected ? opt.color : 'rgba(180,210,255,0.75)' }}>{opt.label}</div>
          <div style={{ fontSize: '10px', fontFamily: FONT, color: 'rgba(160,190,240,0.5)', marginTop: '2px' }}>{opt.sub}</div>
        </button>
      );
    })}
  </div>
);

// ── Step label ────────────────────────────────────────────────────────────────
const StepLabel = ({ n, done, active, label }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '8px' }}>
    <div style={{
      width: '18px', height: '18px', borderRadius: '50%', flexShrink: 0,
      background: done ? '#a855f7' : active ? 'rgba(168,85,247,0.3)' : 'rgba(255,255,255,0.07)',
      border: done ? '1.5px solid #a855f7' : active ? '1.5px solid rgba(168,85,247,0.6)' : '1px solid rgba(120,160,255,0.18)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: '9px', fontWeight: 800, fontFamily: FONT,
      color: done ? '#fff' : active ? '#d8b4fe' : 'rgba(120,160,255,0.4)',
      transition: 'all 0.2s ease',
    }}>{done ? '✓' : n}</div>
    <span style={{
      fontSize: '10px', fontWeight: 700, letterSpacing: '0.20em', textTransform: 'uppercase',
      fontFamily: FONT,
      color: done ? 'rgba(168,85,247,0.8)' : active ? 'rgba(200,220,255,0.70)' : 'rgba(120,150,200,0.40)',
      transition: 'color 0.2s ease',
    }}>{label}</span>
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

  // Auto-scroll to pick section when type is selected
  const handleSelectType = (typeId) => {
    setSelectedType(typeId);
    setPick(null);
    setTimeout(() => pickRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50);
  };

  // Auto-scroll to wager when pick is made
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

  // Status hint for button area
  const hint = !selectedType ? 'Pick a bet type above to continue'
    : pick === null ? 'Make your pick above to continue'
    : wager < BET_MIN ? `Minimum wager is ${BET_MIN} PP`
    : wager > maxWager ? `You only have ${parityPoints} PP`
    : null;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9998,
      background: 'rgba(4,6,18,0.92)',
      backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '12px',
    }}>
      <div style={{
        width: '100%', maxWidth: '640px',
        background: 'rgba(8,12,30,0.97)',
        border: '1px solid rgba(120,160,255,0.18)',
        borderRadius: '22px',
        boxShadow: '0 0 60px rgba(168,85,247,0.12), 0 24px 80px rgba(0,0,0,0.7)',
        display: 'flex', flexDirection: 'column',
        maxHeight: 'calc(100vh - 24px)',
        overflow: 'hidden',
      }}>

        {/* ── Scrollable body ─────────────────────────────────────────────── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '22px 22px 8px', scrollbarWidth: 'none' }}>

          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
            <div>
              <div style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.28em', textTransform: 'uppercase', color: 'rgba(168,85,247,0.65)', fontFamily: FONT, marginBottom: '4px' }}>
                Parity Roulette
              </div>
              <h2 style={{ margin: 0, fontSize: 'clamp(18px,4vw,22px)', fontWeight: 900, color: 'rgba(230,240,255,0.95)', fontFamily: FONT, letterSpacing: '-0.02em' }}>
                Place Your Bet
              </h2>
            </div>
            {/* Wallet */}
            <div style={{
              padding: '8px 14px', borderRadius: '12px',
              background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.28)',
              textAlign: 'right', flexShrink: 0,
            }}>
              <div style={{ fontSize: '8px', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'rgba(99,102,241,0.55)', fontFamily: FONT }}>Balance</div>
              <div style={{ fontSize: '16px', fontWeight: 900, color: '#a5b4fc', fontFamily: FONT }}>{parityPoints} <span style={{ fontSize: '10px', opacity: 0.6 }}>PP</span></div>
              {betStreak > 0 && <div style={{ fontSize: '9px', color: '#fbbf24', fontFamily: FONT }}>{betStreak}× streak · {mult.toFixed(1)}× bonus</div>}
            </div>
          </div>

          {/* Step 1 — Bet type */}
          <div style={{ marginBottom: '16px' }}>
            <StepLabel n={1} done={!!selectedType} active={!selectedType} label="Choose a Bet Type" />
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {Object.values(BET_TYPES).map(bt => (
                <BetTypeCard key={bt.id} betType={bt} selected={selectedType === bt.id} onSelect={() => handleSelectType(bt.id)} />
              ))}
            </div>
          </div>

          {/* Step 2 — Pick */}
          {betDef && (
            <div ref={pickRef} style={{ marginBottom: '16px' }}>
              <StepLabel n={2} done={pick !== null} active={pick === null} label="Make Your Pick" />
              <div style={{ fontSize: '11px', color: 'rgba(140,170,220,0.5)', fontFamily: FONT, marginBottom: '8px', lineHeight: 1.5 }}>
                {betDef.desc}
              </div>
              {(selectedType === 'SURVIVOR' || selectedType === 'FIRST_OUT') && <FacePicker value={pick} onChange={handlePick} />}
              {selectedType === 'PAIR' && <PairPicker value={pick} onChange={handlePick} />}
              {selectedType === 'SPEED' && <SpeedPicker value={pick} onChange={handlePick} />}
            </div>
          )}

          {/* Step 3 — Wager */}
          {betDef && pick !== null && (
            <div ref={wagerRef} style={{ marginBottom: '12px' }}>
              <StepLabel n={3} done={wager >= BET_MIN && wager <= maxWager} active={true} label="Set Your Wager" />

              {/* Preset chips */}
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '10px' }}>
                {WAGER_PRESETS.map(preset => {
                  const disabled = preset > maxWager;
                  const active = wager === preset;
                  return (
                    <button key={preset} onPointerDown={() => !disabled && setWager(preset)} style={{
                      ...TOUCH_BTN,
                      padding: '5px 12px', borderRadius: '100px',
                      cursor: disabled ? 'not-allowed' : 'pointer',
                      border: active ? '1.5px solid rgba(168,85,247,0.7)' : '1px solid rgba(120,160,255,0.2)',
                      background: active ? 'rgba(168,85,247,0.2)' : 'rgba(255,255,255,0.04)',
                      fontFamily: FONT, fontSize: '11px', fontWeight: 700,
                      color: active ? '#d8b4fe' : disabled ? 'rgba(100,130,180,0.3)' : 'rgba(180,210,255,0.65)',
                      opacity: disabled ? 0.35 : 1,
                      transition: 'all 0.13s ease',
                    }}>{preset} PP</button>
                  );
                })}
                {maxWager > 0 && !WAGER_PRESETS.includes(maxWager) && (
                  <button onPointerDown={() => setWager(maxWager)} style={{
                    ...TOUCH_BTN,
                    padding: '5px 12px', borderRadius: '100px', cursor: 'pointer',
                    border: wager === maxWager ? '1.5px solid rgba(168,85,247,0.7)' : '1px solid rgba(120,160,255,0.2)',
                    background: wager === maxWager ? 'rgba(168,85,247,0.2)' : 'rgba(255,255,255,0.04)',
                    fontFamily: FONT, fontSize: '11px', fontWeight: 700,
                    color: wager === maxWager ? '#d8b4fe' : 'rgba(180,210,255,0.65)',
                  }}>All-in ({maxWager} PP)</button>
                )}
              </div>

              {/* Payout row */}
              {canPlace && (
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '10px 14px', borderRadius: '10px',
                  background: 'rgba(168,85,247,0.07)', border: '1px solid rgba(168,85,247,0.18)',
                }}>
                  <div>
                    <div style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(168,85,247,0.55)', fontFamily: FONT }}>Win</div>
                    <div style={{ fontSize: '18px', fontWeight: 900, color: '#d8b4fe', fontFamily: FONT }}>+{profit} PP</div>
                    <div style={{ fontSize: '9px', color: 'rgba(168,85,247,0.45)', fontFamily: FONT }}>{effectiveOdds}× odds{mult > 1 ? ` · ${mult.toFixed(1)}× streak` : ''}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(248,113,113,0.5)', fontFamily: FONT }}>Lose</div>
                    <div style={{ fontSize: '18px', fontWeight: 900, color: '#f87171', fontFamily: FONT }}>−{wager} PP</div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Sticky footer — always visible ───────────────────────────────── */}
        <div style={{
          padding: '14px 22px 18px', borderTop: '1px solid rgba(120,160,255,0.1)',
          background: 'rgba(8,12,30,0.98)',
          flexShrink: 0,
        }}>
          {/* Hint */}
          {hint && (
            <div style={{
              fontSize: '11px', color: 'rgba(140,170,220,0.5)', fontFamily: FONT,
              textAlign: 'center', marginBottom: '10px',
            }}>{hint}</div>
          )}

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button onPointerDown={handlePlace} disabled={!canPlace} style={{
              ...TOUCH_BTN,
              flex: 1, padding: '14px 20px', borderRadius: '100px',
              cursor: canPlace ? 'pointer' : 'not-allowed',
              background: canPlace ? 'linear-gradient(90deg,#a855f7,#7c3aed)' : 'rgba(80,60,120,0.25)',
              border: 'none',
              fontFamily: FONT, fontSize: '13px', fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase',
              color: canPlace ? '#ffffff' : 'rgba(160,140,200,0.4)',
              transition: 'all 0.2s ease',
              boxShadow: canPlace ? '0 0 24px rgba(168,85,247,0.35), 0 4px 16px rgba(0,0,0,0.4)' : 'none',
            }}>
              {canPlace ? `Bet ${wager} PP & Start` : 'Place Bet & Start'}
            </button>

            <button onPointerDown={onSkip} style={{
              ...TOUCH_BTN,
              padding: '14px 18px', borderRadius: '100px', cursor: 'pointer',
              background: 'transparent', border: '1px solid rgba(120,160,255,0.2)',
              fontFamily: FONT, fontSize: '12px', fontWeight: 600,
              color: 'rgba(150,180,230,0.55)', whiteSpace: 'nowrap',
              transition: 'all 0.15s ease',
            }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(120,160,255,0.4)'; e.currentTarget.style.color = 'rgba(180,210,255,0.80)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(120,160,255,0.2)'; e.currentTarget.style.color = 'rgba(150,180,230,0.55)'; }}
            >Skip & Start</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DisparityBettingScreen;
