import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useGameStore } from '../../hooks/useGameStore.js';
import { useShallow } from 'zustand/react/shallow';
import { FACE_COLORS } from '../../utils/constants.js';

const FACE_NAMES = { 1: 'RED', 2: 'GREEN', 3: 'WHITE', 4: 'ORANGE', 5: 'BLUE', 6: 'YELLOW' };
const FACE_ELIMINATION_LIFETIME = 2500; // ms to show the face elimination banner

const NOTIFICATION_LIFETIME = 8000; // ms before a death entry fades out
const MAX_PAIR_GROUPS = 6;           // max simultaneous pair groups visible
const CLEAN_CARD = {
  bg: 'rgba(255,255,255,0.9)',
  border: 'rgba(15,23,42,0.14)',
  text: '#0f172a',
  subtle: 'rgba(15,23,42,0.62)',
};

// ─── Static style constants ───────────────────────────────────────────────────
const CONTAINER_STYLE = {
  position: 'fixed',
  right: '16px',
  bottom: '80px',
  display: 'flex',
  flexDirection: 'column-reverse',
  gap: '5px',
  zIndex: 200,
  pointerEvents: 'none',
  maxWidth: '260px',
};

const FACE_ELIM_BANNER_STYLE = {
  background: CLEAN_CARD.bg,
  border: `1.5px solid ${CLEAN_CARD.border}`,
  borderRadius: '12px',
  padding: '8px 14px',
  fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif",
  textAlign: 'center',
  backdropFilter: 'blur(18px)',
  marginBottom: '4px',
  animation: 'disparity-face-elim 0.35s cubic-bezier(0.22,1,0.36,1) forwards',
};

const FACE_ELIM_LABEL_STYLE = {
  fontSize: '9px',
  color: CLEAN_CARD.subtle,
  letterSpacing: '0.12em',
  marginBottom: '2px',
};

const ALIVE_COUNT_BASE_STYLE = {
  borderRadius: '12px',
  padding: '8px 14px',
  fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif",
  display: 'flex',
  alignItems: 'baseline',
  gap: '6px',
  backdropFilter: 'blur(18px)',
  marginBottom: '4px',
};

const ALIVE_LABEL_STYLE = { fontSize: '11px', color: CLEAN_CARD.subtle, letterSpacing: '0.06em' };
const ALIVE_TOTAL_STYLE = { fontSize: '10px', color: CLEAN_CARD.subtle, marginLeft: 'auto' };

const PARITY_SCORE_BASE_STYLE = {
  ...ALIVE_COUNT_BASE_STYLE,
  background: CLEAN_CARD.bg,
  border: `1.5px solid rgba(99,102,241,0.35)`,
  marginBottom: '4px',
};
const PARITY_LABEL_STYLE = { fontSize: '11px', color: 'rgba(99,102,241,0.8)', letterSpacing: '0.06em' };
const SCORE_GAIN_STYLE = {
  position: 'absolute',
  right: '10px',
  top: '-14px',
  fontSize: '11px',
  fontWeight: 700,
  color: '#818cf8',
  pointerEvents: 'none',
  animation: 'disparity-gain-float 1.2s ease-out forwards',
};

const WINNER_STYLE = {
  background: CLEAN_CARD.bg,
  border: '1.5px solid rgba(255, 215, 0, 0.5)',
  borderRadius: '12px',
  padding: '12px 18px',
  color: '#FFD700',
  fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif",
  fontSize: '13px',
  fontWeight: 'bold',
  textAlign: 'center',
  backdropFilter: 'blur(10px)',
  textShadow: '0 0 12px rgba(255, 215, 0, 0.7)',
  lineHeight: 1.5,
  marginBottom: '4px',
};

const WINNER_TROPHY_STYLE = { fontSize: '18px', marginBottom: '4px' };
const WINNER_PAIR_STYLE = { fontSize: '15px', letterSpacing: '0.06em', marginTop: '4px' };

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * DisparityHUD
 *
 * Shows a stack of death notifications as tiles burn out at FLIP_CAP.
 * Deaths that occur in the same tick (antipodal pairs dying together) are
 * grouped into one line: "✝✝ M1-003 #1 + M4-003 #2"
 * Solo deaths show as:  "✝ M1-003 — #1"
 *
 * A gold "🏆 Winner by least observation" banner appears when one tile survives.
 * Rendered whenever Disparity Mode (chaos) is active.
 */
const DisparityHUD = () => {
  const { disparityDeaths, disparityWinner, disparityEliminatedFaces, size, disparityParityScore } = useGameStore(
    useShallow(s => ({
      disparityDeaths: s.disparityDeaths,
      disparityWinner: s.disparityWinner,
      disparityEliminatedFaces: s.disparityEliminatedFaces,
      size: s.size,
      disparityParityScore: s.disparityParityScore,
    }))
  );

  const totalTiles = size * size * 6;
  const aliveCount = Math.max(0, totalTiles - disparityDeaths.length);

  // Animate the alive counter when it drops
  const prevAliveRef = useRef(aliveCount);
  const [counterFlash, setCounterFlash] = useState(false);
  useEffect(() => {
    if (aliveCount < prevAliveRef.current) {
      setCounterFlash(true);
      const t = setTimeout(() => setCounterFlash(false), 300);
      prevAliveRef.current = aliveCount;
      return () => clearTimeout(t);
    }
    prevAliveRef.current = aliveCount;
  }, [aliveCount]);

  // Animate the parity score when it increases
  const prevScoreRef = useRef(disparityParityScore);
  const [scoreFlash, setScoreFlash] = useState(false);
  const [scoreGain, setScoreGain] = useState(null);
  useEffect(() => {
    if (disparityParityScore > prevScoreRef.current) {
      const gained = disparityParityScore - prevScoreRef.current;
      setScoreFlash(true);
      setScoreGain(gained);
      const t1 = setTimeout(() => setScoreFlash(false), 400);
      const t2 = setTimeout(() => setScoreGain(null), 1200);
      prevScoreRef.current = disparityParityScore;
      return () => { clearTimeout(t1); clearTimeout(t2); };
    }
    prevScoreRef.current = disparityParityScore;
  }, [disparityParityScore]);

  // Face elimination banner: show the latest eliminated face for a brief period
  const [activeFaceElimination, setActiveFaceElimination] = useState(null);
  const prevEliminatedLengthRef = useRef(0);
  useEffect(() => {
    if (disparityEliminatedFaces.length > prevEliminatedLengthRef.current) {
      const faceNum = disparityEliminatedFaces[disparityEliminatedFaces.length - 1];
      setActiveFaceElimination(faceNum);
      const t = setTimeout(() => setActiveFaceElimination(null), FACE_ELIMINATION_LIFETIME);
      prevEliminatedLengthRef.current = disparityEliminatedFaces.length;
      return () => clearTimeout(t);
    }
  }, [disparityEliminatedFaces]);

  const [visiblePairRanks, setVisiblePairRanks] = useState(new Set());

  // When a new death arrives, mark its pairRank visible and schedule removal
  useEffect(() => {
    if (!disparityDeaths.length) { setVisiblePairRanks(new Set()); return; }
    const latest = disparityDeaths[disparityDeaths.length - 1];
    const pr = latest.pairRank ?? latest.rank;
    setVisiblePairRanks((prev) => new Set([...prev, pr]));
    const timer = setTimeout(() => {
      setVisiblePairRanks((prev) => { const next = new Set(prev); next.delete(pr); return next; });
    }, NOTIFICATION_LIFETIME);
    return () => clearTimeout(timer);
  }, [disparityDeaths]);

  // Group deaths by pairRank, only include visible groups
  const sortedGroups = useMemo(() => {
    const groups = {};
    disparityDeaths.forEach((d) => {
      const pr = d.pairRank ?? d.rank;
      if (!visiblePairRanks.has(pr)) return;
      if (!groups[pr]) groups[pr] = [];
      groups[pr].push(d);
    });
    return Object.entries(groups)
      .sort(([a], [b]) => Number(b) - Number(a))
      .slice(0, MAX_PAIR_GROUPS);
  }, [disparityDeaths, visiblePairRanks]);

  // Dynamic alive count styles memoized on their changing deps
  const aliveCountStyle = useMemo(() => ({
    ...ALIVE_COUNT_BASE_STYLE,
    background: CLEAN_CARD.bg,
    border: `1.5px solid ${aliveCount <= 5 ? 'rgba(239,68,68,0.55)' : CLEAN_CARD.border}`,
    animation: aliveCount <= 5 ? 'disparity-pulse-red 1.2s ease-in-out infinite' : 'none',
  }), [aliveCount]);

  const aliveNumStyle = useMemo(() => ({
    fontSize: counterFlash ? '30px' : '26px',
    fontWeight: 900,
    color: aliveCount <= 5 ? '#ef4444' : aliveCount <= 10 ? '#f97316' : CLEAN_CARD.text,
    transition: 'font-size 0.15s, color 0.3s',
    textShadow: aliveCount <= 5 ? '0 0 12px rgba(239,68,68,0.8)' : 'none',
    lineHeight: 1,
  }), [counterFlash, aliveCount]);

  const parityScoreStyle = useMemo(() => ({
    ...PARITY_SCORE_BASE_STYLE,
    boxShadow: scoreFlash ? '0 0 10px 3px rgba(99,102,241,0.4)' : 'none',
    transition: 'box-shadow 0.3s',
  }), [scoreFlash]);

  const parityNumStyle = useMemo(() => ({
    fontSize: scoreFlash ? '30px' : '26px',
    fontWeight: 900,
    color: '#818cf8',
    transition: 'font-size 0.15s',
    textShadow: scoreFlash ? '0 0 12px rgba(129,140,248,0.9)' : 'none',
    lineHeight: 1,
  }), [scoreFlash]);

  if (!sortedGroups.length && !disparityWinner && aliveCount === totalTiles) return null;

  return (
    <div style={CONTAINER_STYLE}>
      <style>{`
        @keyframes disparity-pulse-red {
          0%, 100% { box-shadow: 0 0 0 0 rgba(239,68,68,0); }
          50% { box-shadow: 0 0 10px 3px rgba(239,68,68,0.35); }
        }
        @keyframes disparity-face-elim {
          0%   { transform: scale(0.8) translateY(8px); opacity: 0; }
          60%  { transform: scale(1.04) translateY(-2px); opacity: 1; }
          100% { transform: scale(1) translateY(0); opacity: 1; }
        }
        @keyframes disparity-gain-float {
          0%   { opacity: 1; transform: translateY(0); }
          70%  { opacity: 1; transform: translateY(-10px); }
          100% { opacity: 0; transform: translateY(-16px); }
        }
      `}</style>
      {/* Face elimination banner */}
      {activeFaceElimination != null && (
        <div key={activeFaceElimination} style={FACE_ELIM_BANNER_STYLE}>
          <div style={FACE_ELIM_LABEL_STYLE}>
            FACE ELIMINATED
          </div>
          <FaceEliminationName faceNum={activeFaceElimination} />
        </div>
      )}

      {/* Parity score — visible once chaos has started */}
      {disparityDeaths.length > 0 && (
        <div style={{ position: 'relative' }}>
          {scoreGain != null && (
            <div style={SCORE_GAIN_STYLE}>+{scoreGain}</div>
          )}
          <div style={parityScoreStyle}>
            <span style={parityNumStyle}>{disparityParityScore}</span>
            <span style={PARITY_LABEL_STYLE}>PARITY</span>
          </div>
        </div>
      )}
      {/* Alive count — always visible once chaos has started (at least 1 death) */}
      {!disparityWinner && disparityDeaths.length > 0 && (
        <div style={aliveCountStyle}>
          <span style={aliveNumStyle}>
            {aliveCount}
          </span>
          <span style={ALIVE_LABEL_STYLE}>
            ALIVE
          </span>
          <span style={ALIVE_TOTAL_STYLE}>
            / {totalTiles}
          </span>
        </div>
      )}
      {disparityWinner && (
        <div style={WINNER_STYLE}>
          <div style={WINNER_TROPHY_STYLE}>Win</div>
          <div>Winning antipodal pair</div>
          <div style={WINNER_PAIR_STYLE}>
            {(disparityWinner.pair ?? [disparityWinner.gridId]).join(' ↔ ')}
          </div>
        </div>
      )}
      {sortedGroups.map(([pr, deaths]) => (
        <DeathEntry key={pr} pairRank={pr} deaths={deaths} />
      ))}
    </div>
  );
};

// ─── Sub-components ───────────────────────────────────────────────────────────

const FACE_NAME_BASE_STYLE = {
  fontSize: '14px',
  fontWeight: 900,
  letterSpacing: '0.08em',
};

const FaceEliminationName = React.memo(({ faceNum }) => {
  const color = FACE_COLORS[faceNum] ?? '#fff';
  const style = useMemo(() => ({
    ...FACE_NAME_BASE_STYLE,
    color,
    textShadow: `0 0 10px ${color}`,
  }), [color]);
  return <div style={style}>{FACE_NAMES[faceNum] ?? `FACE ${faceNum}`}</div>;
});

const DEATH_ENTRY_BASE_STYLE = {
  background: CLEAN_CARD.bg,
  borderRadius: '10px',
  padding: '4px 10px',
  color: '#b91c1c',
  fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif",
  fontSize: '11px',
  backdropFilter: 'blur(18px)',
  whiteSpace: 'nowrap',
  letterSpacing: '0.04em',
};

const DEATH_PAIR_SEPARATOR_STYLE = { color: 'rgba(200,80,80,0.6)', margin: '0 4px' };
const DEATH_RANK_STYLE = { fontWeight: 'bold' };

const DeathEntry = React.memo(({ deaths }) => {
  const isPair = deaths.length > 1;
  const style = useMemo(() => ({
    ...DEATH_ENTRY_BASE_STYLE,
    border: `1px solid rgba(180, 40, 40, ${isPair ? '0.45' : '0.3'})`,
  }), [isPair]);

  return (
    <div style={style}>
      {isPair ? (
        <>
          <span style={{ marginRight: '4px' }}>✝✝</span>
          {deaths.map((d, i) => (
            <span key={d.id}>
              {i > 0 && <span style={DEATH_PAIR_SEPARATOR_STYLE}>+</span>}
              <span>{d.gridId} </span>
              <span style={DEATH_RANK_STYLE}>#{d.rank}</span>
            </span>
          ))}
        </>
      ) : (
        <>✝ {deaths[0].gridId} — <span style={DEATH_RANK_STYLE}>#{deaths[0].rank}</span></>
      )}
    </div>
  );
});

export default DisparityHUD;
