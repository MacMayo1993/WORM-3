import React, { useState, useMemo } from 'react';
import { useGameStore } from '../../hooks/useGameStore.js';
import {
  BET_TYPES, FACE_INFO, ANTIPODAL_PAIRS, calcPayout, streakMultiplier,
} from '../../utils/disparityBetting.js';
import { BET_MIN, BET_MAX } from '../../utils/economyConstants.js';

const FONT = "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', system-ui, sans-serif";

// ── Wager preset chips ────────────────────────────────────────────────────────
const WAGER_PRESETS = [10, 25, 50, 100, 250, 500];

// ── Bet type card ─────────────────────────────────────────────────────────────
const BetTypeCard = ({ betType, selected, onSelect }) => {
  const [hovered, setHovered] = useState(false);
  const active = selected || hovered;
  return (
    <button
      onClick={onSelect}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        flex: '1 1 160px',
        minWidth: '140px',
        maxWidth: '200px',
        padding: '14px 12px 12px',
        background: selected
          ? 'rgba(168,85,247,0.18)'
          : hovered ? 'rgba(120,80,200,0.10)' : 'rgba(255,255,255,0.04)',
        border: selected
          ? '1.5px solid rgba(168,85,247,0.7)'
          : `1px solid rgba(120,160,255,${hovered ? '0.30' : '0.14'})`,
        borderRadius: '14px',
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'all 0.2s ease',
        boxShadow: selected ? '0 0 20px rgba(168,85,247,0.20)' : 'none',
        position: 'relative',
      }}
    >
      {/* Icon badge */}
      <div style={{
        width: '30px', height: '30px', borderRadius: '8px', marginBottom: '10px',
        background: selected ? 'rgba(168,85,247,0.3)' : 'rgba(120,160,255,0.12)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '13px', fontWeight: 900, fontFamily: 'monospace',
        color: selected ? '#d8b4fe' : 'rgba(160,200,255,0.7)',
        transition: 'all 0.2s ease',
      }}>{betType.icon}</div>

      {/* Label */}
      <div style={{
        fontSize: '12px', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase',
        color: selected ? '#e9d5ff' : 'rgba(200,220,255,0.85)',
        fontFamily: FONT, marginBottom: '4px', transition: 'color 0.2s ease',
      }}>{betType.label}</div>

      {/* Tagline */}
      <div style={{
        fontSize: '10px', lineHeight: 1.45,
        color: active ? 'rgba(200,220,255,0.65)' : 'rgba(160,190,240,0.45)',
        fontFamily: FONT, transition: 'color 0.2s ease',
      }}>{betType.tagline}</div>

      {/* Odds badge */}
      <div style={{
        position: 'absolute', top: '10px', right: '10px',
        background: selected ? 'rgba(168,85,247,0.4)' : 'rgba(255,255,255,0.07)',
        border: selected ? '1px solid rgba(168,85,247,0.5)' : '1px solid rgba(255,255,255,0.1)',
        borderRadius: '6px', padding: '2px 7px',
        fontSize: '10px', fontWeight: 800, letterSpacing: '0.04em',
        color: selected ? '#d8b4fe' : 'rgba(180,210,255,0.6)',
        fontFamily: FONT, transition: 'all 0.2s ease',
      }}>{betType.odds}×</div>
    </button>
  );
};

// ── Pick selector for SURVIVOR / FIRST_OUT ────────────────────────────────────
const FacePicker = ({ value, onChange }) => (
  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
    {Object.entries(FACE_INFO).map(([id, info]) => {
      const faceId = parseInt(id, 10);
      const selected = value === faceId;
      return (
        <button
          key={id}
          onClick={() => onChange(faceId)}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '6px 12px', borderRadius: '100px', cursor: 'pointer',
            border: selected ? `1.5px solid ${info.hex}` : '1px solid rgba(120,160,255,0.2)',
            background: selected ? `${info.hex}25` : 'rgba(255,255,255,0.04)',
            fontFamily: FONT, fontSize: '11px', fontWeight: 700,
            color: selected ? info.hex : 'rgba(180,210,255,0.65)',
            transition: 'all 0.18s ease',
            boxShadow: selected ? `0 0 12px ${info.hex}30` : 'none',
          }}
        >
          <div style={{
            width: '10px', height: '10px', borderRadius: '50%',
            background: info.hex, flexShrink: 0,
          }} />
          {info.name}
        </button>
      );
    })}
  </div>
);

// ── Antipodal pair picker ─────────────────────────────────────────────────────
const PairPicker = ({ value, onChange }) => (
  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
    {ANTIPODAL_PAIRS.map(pair => {
      const selected = value === pair.id;
      const f1 = FACE_INFO[pair.faces[0]];
      const f2 = FACE_INFO[pair.faces[1]];
      return (
        <button
          key={pair.id}
          onClick={() => onChange(pair.id)}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '8px 14px', borderRadius: '100px', cursor: 'pointer',
            border: selected ? `1.5px solid ${pair.color}` : '1px solid rgba(120,160,255,0.2)',
            background: selected ? `${pair.color}20` : 'rgba(255,255,255,0.04)',
            fontFamily: FONT, fontSize: '11px', fontWeight: 700,
            color: selected ? pair.color : 'rgba(180,210,255,0.65)',
            transition: 'all 0.18s ease',
            boxShadow: selected ? `0 0 12px ${pair.color}30` : 'none',
          }}
        >
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: f1.hex, flexShrink: 0 }} />
          <span>↔</span>
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
      { id: 'FAST', label: 'Fast', sub: '< 60 seconds', color: '#f59e0b' },
      { id: 'SLOW', label: 'Slow', sub: '> 60 seconds', color: '#60a5fa' },
    ].map(opt => {
      const selected = value === opt.id;
      return (
        <button
          key={opt.id}
          onClick={() => onChange(opt.id)}
          style={{
            flex: 1, padding: '10px 14px', borderRadius: '12px', cursor: 'pointer',
            border: selected ? `1.5px solid ${opt.color}` : '1px solid rgba(120,160,255,0.2)',
            background: selected ? `${opt.color}18` : 'rgba(255,255,255,0.04)',
            textAlign: 'center', transition: 'all 0.18s ease',
            boxShadow: selected ? `0 0 12px ${opt.color}25` : 'none',
          }}
        >
          <div style={{
            fontSize: '12px', fontWeight: 800, fontFamily: FONT,
            color: selected ? opt.color : 'rgba(180,210,255,0.75)',
          }}>{opt.label}</div>
          <div style={{
            fontSize: '10px', fontFamily: FONT,
            color: 'rgba(160,190,240,0.5)', marginTop: '2px',
          }}>{opt.sub}</div>
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

  const betDef = selectedType ? BET_TYPES[selectedType] : null;

  // Reset pick when type changes
  const handleSelectType = (typeId) => {
    setSelectedType(typeId);
    setPick(null);
  };

  const effectiveOdds = betDef ? betDef.odds : 0;
  const mult = streakMultiplier(betStreak);
  const potentialWin = useMemo(() => calcPayout(wager, effectiveOdds, betStreak), [wager, effectiveOdds, betStreak]);
  const profit = potentialWin - wager;

  const canPlace = selectedType && pick !== null && wager >= BET_MIN && wager <= Math.min(parityPoints, BET_MAX);
  const maxWager = Math.min(parityPoints, BET_MAX);

  const handlePlace = () => {
    if (!canPlace) return;
    // Deduct wager immediately from wallet
    useGameStore.getState().spendCoins(wager);
    onBetPlaced({
      type: selectedType,
      pick,
      wager,
      odds: effectiveOdds,
      potentialWin,
      placedAt: Date.now(),
      streak: betStreak,
    });
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9998,
      background: 'rgba(4,6,18,0.88)',
      backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '16px',
    }}>
      <div style={{
        width: '100%', maxWidth: '680px', maxHeight: '90vh', overflowY: 'auto',
        background: 'rgba(8,12,30,0.95)',
        border: '1px solid rgba(120,160,255,0.18)',
        borderRadius: '24px',
        boxShadow: '0 0 60px rgba(168,85,247,0.12), 0 24px 80px rgba(0,0,0,0.7)',
        padding: '28px 28px 24px',
        scrollbarWidth: 'none',
      }}>

        {/* Header */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{
            fontSize: '10px', fontWeight: 700, letterSpacing: '0.28em', textTransform: 'uppercase',
            color: 'rgba(168,85,247,0.7)', fontFamily: FONT, marginBottom: '6px',
          }}>Parity Roulette</div>
          <h2 style={{
            margin: 0, fontSize: 'clamp(20px,4vw,26px)', fontWeight: 900, letterSpacing: '-0.02em',
            color: 'rgba(230,240,255,0.95)', fontFamily: FONT,
          }}>Place Your Bet</h2>
          <p style={{
            margin: '6px 0 0', fontSize: '13px', color: 'rgba(160,190,240,0.55)', fontFamily: FONT,
          }}>The chaos is about to begin. Wager your Parity Points on how it unfolds.</p>
        </div>

        {/* Wallet + streak */}
        <div style={{
          display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap',
        }}>
          <div style={{
            flex: 1, minWidth: '120px', padding: '10px 14px', borderRadius: '12px',
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(120,160,255,0.14)',
          }}>
            <div style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(120,160,255,0.5)', fontFamily: FONT, marginBottom: '3px' }}>Balance</div>
            <div style={{ fontSize: '18px', fontWeight: 900, color: '#a5b4fc', fontFamily: FONT }}>{parityPoints} <span style={{ fontSize: '11px', fontWeight: 600, opacity: 0.6 }}>PP</span></div>
          </div>
          {betStreak > 0 && (
            <div style={{
              flex: 1, minWidth: '120px', padding: '10px 14px', borderRadius: '12px',
              background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.2)',
            }}>
              <div style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(251,191,36,0.5)', fontFamily: FONT, marginBottom: '3px' }}>Win Streak</div>
              <div style={{ fontSize: '18px', fontWeight: 900, color: '#fbbf24', fontFamily: FONT }}>
                {betStreak}× <span style={{ fontSize: '11px', fontWeight: 600, opacity: 0.6 }}>({mult.toFixed(1)}× bonus)</span>
              </div>
            </div>
          )}
        </div>

        {/* Bet type selector */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(160,190,240,0.55)', fontFamily: FONT, marginBottom: '10px' }}>
            1. Choose a Bet Type
          </div>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {Object.values(BET_TYPES).map(bt => (
              <BetTypeCard
                key={bt.id}
                betType={bt}
                selected={selectedType === bt.id}
                onSelect={() => handleSelectType(bt.id)}
              />
            ))}
          </div>
        </div>

        {/* Pick selector — conditional on type */}
        {betDef && (
          <div style={{ marginBottom: '20px' }}>
            <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(160,190,240,0.55)', fontFamily: FONT, marginBottom: '8px' }}>
              2. Make Your Pick
            </div>
            <div style={{
              fontSize: '11px', color: 'rgba(160,190,240,0.5)', fontFamily: FONT, marginBottom: '10px', lineHeight: 1.5,
            }}>{betDef.desc}</div>

            {(selectedType === 'SURVIVOR' || selectedType === 'FIRST_OUT') && (
              <FacePicker value={pick} onChange={setPick} />
            )}
            {selectedType === 'PAIR' && (
              <PairPicker value={pick} onChange={setPick} />
            )}
            {selectedType === 'SPEED' && (
              <SpeedPicker value={pick} onChange={setPick} />
            )}
          </div>
        )}

        {/* Wager */}
        {betDef && pick !== null && (
          <div style={{ marginBottom: '24px' }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px',
            }}>
              <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(160,190,240,0.55)', fontFamily: FONT }}>
                3. Set Your Wager
              </div>
              {maxWager < BET_MIN && (
                <div style={{ fontSize: '10px', color: '#f87171', fontFamily: FONT }}>Not enough PP to bet (need {BET_MIN})</div>
              )}
            </div>

            {/* Preset chips */}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
              {WAGER_PRESETS.filter(p => p <= Math.max(maxWager, BET_MIN)).map(preset => (
                <button
                  key={preset}
                  onClick={() => setWager(Math.min(preset, maxWager))}
                  disabled={preset > maxWager}
                  style={{
                    padding: '6px 14px', borderRadius: '100px', cursor: preset <= maxWager ? 'pointer' : 'not-allowed',
                    border: wager === preset ? '1.5px solid rgba(168,85,247,0.7)' : '1px solid rgba(120,160,255,0.2)',
                    background: wager === preset ? 'rgba(168,85,247,0.2)' : 'rgba(255,255,255,0.04)',
                    fontFamily: FONT, fontSize: '11px', fontWeight: 700,
                    color: wager === preset ? '#d8b4fe' : preset > maxWager ? 'rgba(100,130,180,0.35)' : 'rgba(180,210,255,0.65)',
                    transition: 'all 0.15s ease',
                    opacity: preset > maxWager ? 0.4 : 1,
                  }}
                >{preset} PP</button>
              ))}
              {maxWager > 0 && maxWager !== WAGER_PRESETS[WAGER_PRESETS.length - 1] && (
                <button
                  onClick={() => setWager(maxWager)}
                  style={{
                    padding: '6px 14px', borderRadius: '100px', cursor: 'pointer',
                    border: wager === maxWager ? '1.5px solid rgba(168,85,247,0.7)' : '1px solid rgba(120,160,255,0.2)',
                    background: wager === maxWager ? 'rgba(168,85,247,0.2)' : 'rgba(255,255,255,0.04)',
                    fontFamily: FONT, fontSize: '11px', fontWeight: 700,
                    color: wager === maxWager ? '#d8b4fe' : 'rgba(180,210,255,0.65)',
                    transition: 'all 0.15s ease',
                  }}
                >Max ({maxWager} PP)</button>
              )}
            </div>

            {/* Payout preview */}
            {wager >= BET_MIN && wager <= maxWager && (
              <div style={{
                padding: '12px 16px', borderRadius: '12px',
                background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.2)',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px',
              }}>
                <div>
                  <div style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(168,85,247,0.6)', fontFamily: FONT, marginBottom: '2px' }}>If you win</div>
                  <div style={{ fontSize: '22px', fontWeight: 900, color: '#d8b4fe', fontFamily: FONT }}>+{profit} PP</div>
                  <div style={{ fontSize: '10px', color: 'rgba(168,85,247,0.5)', fontFamily: FONT }}>({potentialWin} PP total · {betDef.odds}× odds{mult > 1 ? ` · ${mult.toFixed(1)}× streak` : ''})</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(248,113,113,0.6)', fontFamily: FONT, marginBottom: '2px' }}>If you lose</div>
                  <div style={{ fontSize: '22px', fontWeight: 900, color: '#f87171', fontFamily: FONT }}>−{wager} PP</div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <button
            onClick={handlePlace}
            disabled={!canPlace}
            style={{
              flex: 1, padding: '15px 24px', borderRadius: '100px', cursor: canPlace ? 'pointer' : 'not-allowed',
              background: canPlace
                ? 'linear-gradient(90deg,#a855f7,#7c3aed)'
                : 'rgba(100,80,150,0.25)',
              border: 'none',
              fontFamily: FONT, fontSize: '13px', fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase',
              color: canPlace ? '#ffffff' : 'rgba(180,160,220,0.4)',
              transition: 'all 0.2s ease',
              boxShadow: canPlace ? '0 0 24px rgba(168,85,247,0.35), 0 4px 16px rgba(0,0,0,0.4)' : 'none',
            }}
          >
            {parityPoints === 0 ? 'No PP — Earn Some First' : !selectedType ? 'Choose a Bet Type' : pick === null ? 'Make Your Pick' : !canPlace ? 'Set Wager' : `Bet ${wager} PP & Start`}
          </button>

          <button
            onClick={onSkip}
            style={{
              padding: '15px 20px', borderRadius: '100px', cursor: 'pointer',
              background: 'transparent', border: '1px solid rgba(120,160,255,0.2)',
              fontFamily: FONT, fontSize: '12px', fontWeight: 600,
              color: 'rgba(160,190,240,0.55)',
              transition: 'all 0.2s ease',
              whiteSpace: 'nowrap',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(120,160,255,0.4)'; e.currentTarget.style.color = 'rgba(180,210,255,0.75)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(120,160,255,0.2)'; e.currentTarget.style.color = 'rgba(160,190,240,0.55)'; }}
          >Skip</button>
        </div>
      </div>
    </div>
  );
};

export default DisparityBettingScreen;
