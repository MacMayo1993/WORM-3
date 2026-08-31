// src/teach/TeachMode.jsx
// Teach Mode UI — Instructor panel with sub-modes: Guided, Demo, Quiz

import React, { useState, useEffect } from 'react';
import { UI_FONT, MONO_FONT, UI_MOSS, UI_MOSS_LIGHT, Z, TEXT_XS } from '../utils/uiTheme.js';
import { fieldGuide } from '../components/ui/FieldGuide.jsx';
import { isMobile } from '../utils/device.js';
import { FACE_TOKENS, MODIFIER_TOKENS, SLICE_TOKENS, EXAMPLE_SEQUENCE, NOTATION_LESSON, describeToken } from './notation.js';

// ─── Module-level style constants (never reallocated) ─────────────────────────
const TABS_CONTAINER_STYLE = {
  display: 'flex',
  gap: '4px',
  padding: '8px 16px',
  borderBottom: '1px solid rgba(111,126,86,0.25)',
  flexShrink: 0,
};

const TAB_ICON_STYLE = { fontSize: '14px' };

const WHYCARD_OUTER_BUTTON_STYLE = {
  width: '100%',
  padding: '7px 10px',
  background: 'none',
  border: 'none',
  fontFamily: UI_FONT,
  fontSize: '11px',
  fontWeight: 'bold',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  textAlign: 'left',
  touchAction: 'manipulation',
};

const WHYCARD_ICON_STYLE = {
  width: '16px',
  height: '16px',
  borderRadius: '50%',
  background: 'rgba(251,191,36,0.2)',
  border: '1px solid rgba(251,191,36,0.4)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '10px',
  flexShrink: 0,
  color: fieldGuide.goldInk,
};

const WHYCARD_CHEVRON_STYLE_BASE = { marginLeft: 'auto', transition: 'transform 0.2s' };

const WHYCARD_CONTENT_STYLE = { padding: '2px 10px 10px' };

const TM_PANEL_STYLE = {
  position: 'fixed',
  // On a phone the game's top bar sits above everything, so start below it —
  // otherwise the panel's own header (and its collapse control) is buried.
  top: isMobile ? 'calc(48px + env(safe-area-inset-top, 0px))' : 0,
  bottom: 0,
  left: 0,
  width: '340px',
  maxWidth: 'calc(100vw - 20px)',
  maxHeight: '100dvh',
  background: 'rgba(250,247,238,0.97)',
  boxShadow: '0 14px 34px rgba(40,48,32,0.22)',
  borderRight: '1px solid rgba(111,126,86,0.25)',
  zIndex: Z.PANEL,
  display: 'flex',
  flexDirection: 'column',
  fontFamily: UI_FONT,
  color: fieldGuide.ink,
  overflowY: 'auto',
  WebkitOverflowScrolling: 'touch',
};

// Compact practice card (mobile). The full sheet covers a phone screen edge to
// edge, which hides the very thing being taught — the cube and its gold layer
// guidance. Once an algorithm or a notation token is in play the panel drops to
// this card, pinned above the nav bar, and the cube is visible again.
const TM_CARD_STYLE = {
  position: 'fixed',
  left: 12,
  right: 12,
  bottom: 'calc(72px + env(safe-area-inset-bottom, 0px))',
  maxHeight: '46dvh',
  background: 'rgba(250,247,238,0.97)',
  boxShadow: '0 14px 34px rgba(40,48,32,0.22)',
  border: '1px solid rgba(111,126,86,0.25)',
  borderRadius: '18px',
  zIndex: Z.PANEL,
  display: 'flex',
  flexDirection: 'column',
  fontFamily: UI_FONT,
  color: fieldGuide.ink,
  overflowY: 'auto',
  WebkitOverflowScrolling: 'touch',
};

const TM_CARD_HEADER_STYLE = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  padding: '10px 12px 6px',
};

const TM_CARD_BODY_STYLE = { padding: '0 12px 12px' };

const TM_CHEVRON_BTN_STYLE = {
  background: 'rgba(38,51,31,0.08)',
  border: '1px solid rgba(111,126,86,0.25)',
  borderRadius: '999px',
  padding: '4px 10px',
  color: fieldGuide.ink,
  fontFamily: UI_FONT,
  fontSize: '11px',
  fontWeight: 'bold',
  cursor: 'pointer',
  touchAction: 'manipulation',
  WebkitTapHighlightColor: 'transparent',
  flexShrink: 0,
};

const TM_HEADER_STYLE = {
  padding: '16px',
  borderBottom: '1px solid rgba(111,126,86,0.25)',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  flexShrink: 0,
};

const TM_TITLE_STYLE = { fontSize: '16px', fontWeight: 'bold', color: UI_MOSS };
const TM_SUBTITLE_STYLE = { fontSize: '10px', color: 'rgba(38,51,31,0.68)', marginTop: '2px' };

const TM_CLOSE_BTN_STYLE = {
  background: 'rgba(38,51,31,0.14)',
  border: '1px solid rgba(255, 255, 255, 0.2)',
  borderRadius: '50%',
  width: '32px',
  height: '32px',
  color: fieldGuide.ink,
  fontSize: '16px',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const TM_SECTION_STYLE = {
  padding: '12px 16px',
  borderBottom: '1px solid rgba(111,126,86,0.25)',
  flexShrink: 0,
};

const TM_SECTION_LABEL_STYLE = { fontSize: '11px', color: 'rgba(38,51,31,0.68)', marginBottom: '8px' };
const TM_STAGES_BAR_ROW_STYLE = { display: 'flex', gap: '3px', marginBottom: '6px' };

const TM_ALL_STAGES_SECTION_STYLE = {
  padding: '12px 16px',
  borderTop: '1px solid rgba(111,126,86,0.25)',
};

const TM_SECTION_SUB_LABEL_STYLE = { fontSize: '10px', color: 'rgba(38,51,31,0.54)', marginBottom: '8px' };

const TM_STAGE_ITEM_STYLE = { marginBottom: '4px' };

const TM_STAGE_EXPANDED_STYLE = {
  padding: '8px 10px 8px 36px',
  fontSize: '11px',
  color: 'rgba(38,51,31,0.68)',
  lineHeight: '1.4',
};

const TM_STAGE_GOAL_STYLE = { marginBottom: '6px' };

const TM_ALGO_CARD_STYLE = {
  padding: '4px 8px',
  margin: '4px 0',
  background: 'rgba(38,51,31,0.05)',
  borderRadius: '4px',
  borderLeft: '2px solid rgba(95,127,74,0.30)',
};

const TM_ALGO_CARD_NAME_STYLE = { fontWeight: 'bold', color: UI_MOSS, fontSize: '10px' };
const TM_ALGO_CARD_NOTATION_STYLE = { fontFamily: MONO_FONT, fontSize: '12px', color: fieldGuide.goldInk, margin: '2px 0' };
const TM_ALGO_CARD_WHEN_STYLE = { fontSize: '10px', color: 'rgba(38,51,31,0.54)' };

const TM_ALGO_LIST_LABEL_STYLE = { fontSize: '10px', color: 'rgba(38,51,31,0.54)', marginBottom: '8px' };

// ---------------------------------------------------------------------------
// Sub-mode tab bar
// ---------------------------------------------------------------------------
const SubModeTabs = ({ subMode, onSwitch }) => {
  const tabs = [
    { id: 'guided',   label: 'Guided',   icon: '▶',  desc: 'Follow along' },
    { id: 'demo',     label: 'Demo',     icon: '⏩', desc: 'Watch & learn' },
    { id: 'notation', label: 'Notation', icon: 'ƒ',  desc: 'Read the letters' },
    { id: 'quiz',     label: 'Quiz',     icon: '?',  desc: 'Test yourself' },
  ];

  return (
    <div style={TABS_CONTAINER_STYLE}>
      {tabs.map((tab) => {
        const active = subMode === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onSwitch(tab.id)}
            title={tab.desc}
            style={{
              flex: 1,
              padding: '6px 4px',
              borderRadius: '6px',
              border: `1px solid ${active ? 'rgba(95,127,74,0.55)' : 'rgba(38,51,31,0.14)'}`,
              background: active ? 'rgba(95,127,74,0.15)' : 'rgba(255,255,255,0.56)',
              color: active ? UI_MOSS : 'rgba(38,51,31,0.54)',
              fontFamily: UI_FONT,
              fontSize: '11px',
              fontWeight: active ? 'bold' : 'normal',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '2px',
              transition: 'all 0.15s',
              touchAction: 'manipulation',
            }}
          >
            <span style={TAB_ICON_STYLE}>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Why / Topology expandable card
// ---------------------------------------------------------------------------
const WhyCard = ({ algo, open, onToggle }) => {
  if (!algo || (!algo.why && !algo.topologyTip)) return null;

  return (
    <div style={{
      margin: '8px 0 0',
      borderRadius: '6px',
      border: `1px solid ${open ? 'rgba(123,111,69,0.40)' : 'rgba(255,255,255,0.62)'}`,
      background: open ? 'rgba(255,233,173,0.34)' : 'rgba(255,255,255,0.48)',
      overflow: 'hidden',
      transition: 'border-color 0.2s',
    }}>
      <button
        onClick={onToggle}
        style={{ ...WHYCARD_OUTER_BUTTON_STYLE, color: open ? fieldGuide.goldInk : 'rgba(38,51,31,0.54)' }}
      >
        <span style={WHYCARD_ICON_STYLE}>?</span>
        WHY DOES THIS WORK?
        <span style={{ ...WHYCARD_CHEVRON_STYLE_BASE, transform: open ? 'rotate(180deg)' : 'none' }}>▼</span>
      </button>

      {open && (
        <div style={WHYCARD_CONTENT_STYLE}>
          {algo.why && (
            <div style={{
              fontSize: '11px',
              color: 'rgba(38,51,31,0.82)',
              lineHeight: '1.55',
              marginBottom: algo.topologyTip ? '10px' : 0,
            }}>
              {algo.why}
            </div>
          )}
          {algo.topologyTip && (
            <div style={{
              padding: '8px',
              borderRadius: '4px',
              background: 'rgba(139,92,246,0.1)',
              border: '1px solid rgba(139,92,246,0.25)',
            }}>
              <div style={{
                fontSize: TEXT_XS,
                color: 'rgba(139,92,246,0.9)',
                fontWeight: 'bold',
                letterSpacing: '0.5px',
                marginBottom: '4px',
              }}>
                RP² TOPOLOGY
              </div>
              <div style={{
                fontSize: '11px',
                color: 'rgba(200,185,255,0.85)',
                lineHeight: '1.5',
              }}>
                {algo.topologyTip}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Quiz panel
// ---------------------------------------------------------------------------
const QuizPanel = ({
  currentStage,
  quizOptions,
  quizAnswered,
  quizHintShown,
  onAnswer,
  onRetry,
}) => {
  if (!currentStage) return null;

  const hintText = currentStage.algorithms[0]?.quizHint;

  return (
    <div style={{ padding: '12px 16px' }}>
      <div style={{ fontSize: '11px', color: 'rgba(38,51,31,0.54)', marginBottom: '4px' }}>
        QUIZ
      </div>
      <div style={{
        fontSize: '13px',
        color: fieldGuide.ink,
        fontWeight: 'bold',
        marginBottom: '12px',
        lineHeight: '1.4',
      }}>
        Which algorithm should you use for<br />
        <span style={{ color: UI_MOSS }}>{currentStage.name}</span>?
      </div>

      {quizOptions.map((opt, i) => {
        let borderColor = 'rgba(111,126,86,0.20)';
        let bgColor = 'rgba(255,255,255,0.56)';
        let labelColor = 'rgba(38,51,31,0.76)';
        let showResult = false;

        if (quizAnswered !== null) {
          showResult = true;
          if (opt.isCorrect) {
            borderColor = 'rgba(0,255,136,0.5)';
            bgColor = 'rgba(0,255,136,0.08)';
            labelColor = UI_MOSS_LIGHT;
          } else {
            borderColor = 'rgba(255,80,80,0.3)';
            bgColor = 'rgba(255,80,80,0.04)';
            labelColor = 'rgba(255,120,120,0.6)';
          }
        }

        return (
          <button
            key={i}
            onClick={() => quizAnswered === null && onAnswer(i)}
            disabled={quizAnswered !== null}
            style={{
              width: '100%',
              marginBottom: '6px',
              padding: '10px 12px',
              borderRadius: '7px',
              border: `1px solid ${borderColor}`,
              background: bgColor,
              color: labelColor,
              fontFamily: UI_FONT,
              fontSize: '12px',
              textAlign: 'left',
              cursor: quizAnswered === null ? 'pointer' : 'default',
              transition: 'all 0.15s',
              touchAction: 'manipulation',
            }}
          >
            <div style={{ fontWeight: 'bold', letterSpacing: '0.5px', marginBottom: '2px' }}>
              {opt.notation}
            </div>
            <div style={{ fontSize: '10px', opacity: 0.7 }}>{opt.name}</div>
            {showResult && opt.isCorrect && (
              <div style={{ fontSize: '10px', color: UI_MOSS_LIGHT, marginTop: '4px' }}>
                ✓ Correct!
              </div>
            )}
          </button>
        );
      })}

      {/* Hint after wrong answer */}
      {quizHintShown && hintText && (
        <div style={{
          marginTop: '10px',
          padding: '8px 10px',
          borderRadius: '6px',
          background: 'rgba(251,191,36,0.08)',
          border: '1px solid rgba(251,191,36,0.25)',
          fontSize: '11px',
          color: 'rgba(251,191,36,0.9)',
          lineHeight: '1.5',
        }}>
          <span style={{ fontWeight: 'bold' }}>Hint: </span>{hintText}
        </div>
      )}

      {/* Actions after answering */}
      {quizAnswered !== null && (
        <div style={{ marginTop: '12px', display: 'flex', gap: '8px' }}>
          <button
            onClick={onRetry}
            style={{
              flex: 1,
              padding: '8px',
              borderRadius: '6px',
              border: '1px solid rgba(0,217,255,0.35)',
              background: 'rgba(95,127,74,0.10)',
              color: UI_MOSS,
              fontFamily: UI_FONT,
              fontSize: '12px',
              fontWeight: 'bold',
              cursor: 'pointer',
              touchAction: 'manipulation',
            }}
          >
            ↺ New Question
          </button>
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Notation lesson
// ---------------------------------------------------------------------------
// Every token is live: tapping one lights the layer it names with the same gold
// guidance the solver uses, and ↻ turns it. The letter, the layer and the
// motion are taught as one thing rather than as a table to memorise.
const NOTATION_PROSE_STYLE = { fontSize: '11px', color: 'rgba(38,51,31,0.72)', lineHeight: '1.55' };
const NOTATION_GROUP_LABEL_STYLE = {
  fontSize: '10px', color: UI_MOSS, fontWeight: 'bold',
  letterSpacing: '0.06em', margin: '14px 0 6px',
};

const TokenRow = ({ token, title, hint, selected, onPreview, onPlay }) => (
  <div
    onClick={() => onPreview(token)}
    style={{
      display: 'flex', alignItems: 'center', gap: '10px',
      padding: '7px 8px', marginBottom: '4px',
      borderRadius: '7px',
      border: `1px solid ${selected ? 'rgba(95,127,74,0.50)' : 'rgba(38,51,31,0.12)'}`,
      background: selected ? 'rgba(95,127,74,0.12)' : 'rgba(255,255,255,0.52)',
      cursor: 'pointer',
      transition: 'all 0.15s',
      touchAction: 'manipulation',
    }}
  >
    <span style={{
      minWidth: '34px', textAlign: 'center',
      padding: '4px 0', borderRadius: '5px',
      fontFamily: MONO_FONT, fontSize: '15px', fontWeight: 'bold',
      color: fieldGuide.goldInk,
      background: 'rgba(38,51,31,0.06)',
      border: '1px solid rgba(123,111,69,0.22)',
    }}>
      {token}
    </span>
    <span style={{ flex: 1, minWidth: 0 }}>
      <span style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: fieldGuide.ink }}>{title}</span>
      <span style={{ display: 'block', fontSize: '10px', color: 'rgba(38,51,31,0.60)', lineHeight: '1.35' }}>{hint}</span>
    </span>
    <button
      onClick={(e) => { e.stopPropagation(); onPlay(token); }}
      title={`Turn ${token}`}
      style={{
        padding: '6px 10px', borderRadius: '999px',
        border: '1px solid rgba(95,127,74,0.40)',
        background: 'rgba(95,127,74,0.15)',
        color: UI_MOSS,
        fontFamily: UI_FONT, fontSize: '11px', fontWeight: 'bold',
        cursor: 'pointer', flexShrink: 0,
        touchAction: 'manipulation',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      ↻ Turn
    </button>
  </div>
);

const NotationPanel = ({ notationToken, onPreview, onPlay }) => {
  const groups = [
    { label: 'THE SIX FACES', items: FACE_TOKENS.map((f) => ({ token: f.token, title: f.face, hint: f.hint })) },
    { label: 'MARKS AFTER THE LETTER', items: MODIFIER_TOKENS.map((m) => ({ token: m.token, title: m.name, hint: m.hint })) },
    { label: 'MIDDLE SLICES', items: SLICE_TOKENS.map((s) => ({ token: s.token, title: s.name, hint: s.hint })) },
  ];

  return (
    <div style={{ padding: '12px 16px' }}>
      <div style={TM_ALGO_LIST_LABEL_STYLE}>NOTATION</div>
      <div style={NOTATION_PROSE_STYLE}>{NOTATION_LESSON.intro}</div>
      <div style={{ ...NOTATION_PROSE_STYLE, marginTop: '6px', color: 'rgba(38,51,31,0.60)' }}>
        Tap a letter to light its layer on the cube; tap <span style={{ color: UI_MOSS, fontWeight: 'bold' }}>↻ Turn</span> to watch it move.
      </div>

      {groups.map((g) => (
        <div key={g.label}>
          <div style={NOTATION_GROUP_LABEL_STYLE}>{g.label}</div>
          {g.items.map((item) => (
            <TokenRow
              key={item.token}
              token={item.token}
              title={item.title}
              hint={item.hint}
              selected={notationToken === item.token}
              onPreview={onPreview}
              onPlay={onPlay}
            />
          ))}
        </div>
      ))}

      <div style={NOTATION_GROUP_LABEL_STYLE}>READING A SEQUENCE</div>
      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '8px' }}>
        {EXAMPLE_SEQUENCE.split(' ').map((tok, i) => (
          <button
            key={i}
            onClick={() => onPlay(tok)}
            style={{
              padding: '4px 8px', borderRadius: '5px',
              fontFamily: MONO_FONT, fontSize: '13px', fontWeight: 'bold',
              border: `1px solid ${notationToken === tok ? 'rgba(95,127,74,0.50)' : 'rgba(255,255,255,0.62)'}`,
              background: notationToken === tok ? 'rgba(95,127,74,0.20)' : 'rgba(38,51,31,0.07)',
              color: notationToken === tok ? UI_MOSS : fieldGuide.goldInk,
              cursor: 'pointer',
              touchAction: 'manipulation',
            }}
          >
            {tok}
          </button>
        ))}
      </div>
      <div style={NOTATION_PROSE_STYLE}>{NOTATION_LESSON.reading}</div>

      <div style={NOTATION_GROUP_LABEL_STYLE}>ON THIS CUBE</div>
      <div style={{
        padding: '9px 10px', borderRadius: '6px',
        background: 'rgba(139,92,246,0.08)',
        border: '1px solid rgba(139,92,246,0.22)',
        fontSize: '11px', color: 'rgba(38,51,31,0.78)', lineHeight: '1.55',
      }}>
        {NOTATION_LESSON.manifold}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Demo mode info banner
// ---------------------------------------------------------------------------
const DemoBanner = () => (
  <div style={{
    margin: '12px 16px 0',
    padding: '10px 12px',
    borderRadius: '7px',
    background: 'rgba(95,127,74,0.06)',
    border: '1px solid rgba(0,217,255,0.2)',
    fontSize: '11px',
    color: 'rgba(38,51,31,0.72)',
    lineHeight: '1.5',
  }}>
    <span style={{ color: UI_MOSS, fontWeight: 'bold' }}>Demo mode: </span>
    Select an algorithm below and press <span style={{ color: fieldGuide.goldInk }}>▶▶</span> to watch it
    execute automatically. Press <span style={{ color: '#ffa500' }}>⏸</span> to pause at any step.
  </div>
);

// ---------------------------------------------------------------------------
// Practice block — the move chips, the "next" callout and the transport
// controls. Shared by the full algorithm card and the compact practice card,
// so stepping through an algorithm works the same in both.
// ---------------------------------------------------------------------------
const PracticeBlock = ({
  algoMoves,
  currentStep,
  isPlaying,
  canExecute,
  isAlgoComplete,
  onExecuteStep,
  onToggleAutoPlay,
  onResetAlgorithm,
  subMode,
}) => (
  <>
    {/* Move sequence visualization */}
    <div style={{
      display: 'flex',
      flexWrap: 'wrap',
      gap: '4px',
      marginBottom: '10px',
    }}>
      {algoMoves.map((move, i) => (
        <span
          key={i}
          style={{
            padding: '3px 6px',
            borderRadius: '4px',
            fontSize: '12px',
            fontFamily: MONO_FONT,
            fontWeight: 'bold',
            background: i < currentStep
              ? 'rgba(95,127,74,0.20)'
              : i === currentStep
                ? 'rgba(95,127,74,0.30)'
                : 'rgba(38,51,31,0.07)',
            color: i < currentStep
              ? UI_MOSS_LIGHT
              : i === currentStep
                ? UI_MOSS
                : 'rgba(38,51,31,0.42)',
            border: `1px solid ${
              i < currentStep
                ? 'rgba(95,127,74,0.30)'
                : i === currentStep
                  ? 'rgba(95,127,74,0.50)'
                  : 'rgba(255,255,255,0.62)'
            }`,
          }}
        >
          {move.notation}
        </span>
      ))}
    </div>

    {/* Current move callout */}
    {!isAlgoComplete && currentStep < algoMoves.length && (
      <div style={{
        padding: '6px 8px',
        borderRadius: '5px',
        background: 'rgba(95,127,74,0.08)',
        border: '1px solid rgba(0,217,255,0.2)',
        marginBottom: '8px',
        fontSize: '12px',
        color: UI_MOSS,
        fontWeight: 'bold',
        letterSpacing: '0.5px',
      }}>
        NEXT: {algoMoves[currentStep].notation}
      </div>
    )}

    {/* Progress indicator */}
    <div style={{
      fontSize: '10px',
      color: 'rgba(38,51,31,0.54)',
      marginBottom: '8px',
    }}>
      {isAlgoComplete
        ? 'Algorithm complete — tap Reset to try again'
        : `Move ${currentStep + 1} of ${algoMoves.length}`
      }
    </div>

    {/* Control buttons */}
    <div style={{ display: 'flex', gap: '6px' }}>
      {/* Step button (guided only) */}
      {subMode === 'guided' && (
        <button
          onClick={onExecuteStep}
          disabled={!canExecute}
          style={{
            flex: 1,
            padding: '8px',
            borderRadius: '6px',
            border: '1px solid rgba(95,127,74,0.40)',
            background: canExecute ? 'rgba(95,127,74,0.20)' : 'rgba(255,255,255,0.56)',
            color: canExecute ? UI_MOSS : 'rgba(38,51,31,0.24)',
            fontSize: '12px',
            fontWeight: 'bold',
            fontFamily: UI_FONT,
            cursor: canExecute ? 'pointer' : 'default',
            touchAction: 'manipulation',
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          STEP ▶
        </button>
      )}

      {/* Auto-play button */}
      <button
        onClick={onToggleAutoPlay}
        disabled={isAlgoComplete && !isPlaying}
        style={{
          flex: subMode === 'demo' ? 2 : 1,
          padding: '8px 12px',
          borderRadius: '6px',
          border: `1px solid ${isPlaying ? 'rgba(255, 165, 0, 0.5)' : 'rgba(95,127,74,0.40)'}`,
          background: isPlaying ? 'rgba(255, 165, 0, 0.2)' : 'rgba(95,127,74,0.15)',
          color: isPlaying ? '#ffa500' : UI_MOSS_LIGHT,
          fontSize: '12px',
          fontWeight: 'bold',
          fontFamily: UI_FONT,
          cursor: 'pointer',
          touchAction: 'manipulation',
          WebkitTapHighlightColor: 'transparent',
        }}
      >
        {isPlaying ? '⏸ Pause' : subMode === 'demo' ? '⏩ Auto-play' : '▶▶'}
      </button>

      {/* Reset button */}
      <button
        onClick={onResetAlgorithm}
        style={{
          padding: '8px 12px',
          borderRadius: '6px',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          background: 'rgba(38,51,31,0.07)',
          color: 'rgba(38,51,31,0.68)',
          fontSize: '12px',
          fontWeight: 'bold',
          fontFamily: UI_FONT,
          cursor: 'pointer',
          touchAction: 'manipulation',
          WebkitTapHighlightColor: 'transparent',
        }}
      >
        ↺
      </button>
    </div>
  </>
);

// ---------------------------------------------------------------------------
// Algorithm Card sub-component
// ---------------------------------------------------------------------------
const AlgorithmCard = ({
  algo,
  isSelected,
  onSelect,
  algoMoves,
  currentStep,
  isPlaying,
  canExecute,
  isAlgoComplete,
  onExecuteStep,
  onToggleAutoPlay,
  onResetAlgorithm,
  whyOpen,
  onToggleWhy,
  subMode,
}) => {
  return (
    <div style={{
      marginBottom: '10px',
      borderRadius: '8px',
      border: `1px solid ${isSelected ? 'rgba(95,127,74,0.40)' : 'rgba(38,51,31,0.14)'}`,
      background: isSelected ? 'rgba(95,127,74,0.08)' : 'rgba(38,51,31,0.05)',
      overflow: 'hidden',
    }}>
      {/* Card header */}
      <div
        onClick={onSelect}
        style={{ padding: '10px 12px', cursor: 'pointer' }}
      >
        <div style={{ fontSize: '12px', fontWeight: 'bold', color: fieldGuide.ink }}>
          {algo.name}
        </div>
        <div style={{
          fontFamily: MONO_FONT,
          fontSize: '14px',
          color: fieldGuide.goldInk,
          margin: '4px 0',
          letterSpacing: '1px',
        }}>
          {algo.notation}
        </div>
        <div style={{ fontSize: '10px', color: 'rgba(38,51,31,0.54)' }}>
          {algo.when}
        </div>
      </div>

      {/* Why card (always available when expanded) */}
      {isSelected && (
        <div style={{ padding: '0 12px' }}>
          <WhyCard algo={algo} open={whyOpen} onToggle={onToggleWhy} />
        </div>
      )}

      {/* Execution controls (only in guided / demo mode when selected) */}
      {isSelected && algoMoves.length > 0 && (subMode === 'guided' || subMode === 'demo') && (
        <div style={{
          padding: '8px 12px 12px',
          borderTop: '1px solid rgba(111,126,86,0.25)',
          marginTop: '8px',
        }}>
          <PracticeBlock
            algoMoves={algoMoves}
            currentStep={currentStep}
            isPlaying={isPlaying}
            canExecute={canExecute}
            isAlgoComplete={isAlgoComplete}
            onExecuteStep={onExecuteStep}
            onToggleAutoPlay={onToggleAutoPlay}
            onResetAlgorithm={onResetAlgorithm}
            subMode={subMode}
          />
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Main TeachMode component
// ---------------------------------------------------------------------------
const TeachMode = ({
  analysis,
  stages,
  methodName,
  subMode,
  onSwitchSubMode,
  selectedAlgo,
  algoMoves,
  currentStep,
  isPlaying,
  canExecute,
  isAlgoComplete,
  whyOpen,
  onToggleWhy,
  quizOptions,
  quizAnswered,
  quizHintShown,
  onSelectAlgorithm,
  onExecuteStep,
  onToggleAutoPlay,
  onResetAlgorithm,
  onAnswerQuiz,
  onRetryQuiz,
  notationToken,
  onPreviewNotation,
  onPlayNotation,
  onClose,
}) => {
  const [expandedStage, setExpandedStage] = useState(null);
  const [collapsed, setCollapsed] = useState(false);

  // Whatever the cube is currently being told to show. When this changes on a
  // phone, drop to the compact card so the guidance is actually watchable.
  const guidanceKey = selectedAlgo
    ? `algo-${selectedAlgo.stageIndex}-${selectedAlgo.algoIndex}`
    : notationToken ? `tok-${notationToken}` : null;

  useEffect(() => {
    if (isMobile && guidanceKey) setCollapsed(true);
  }, [guidanceKey]);

  if (!analysis) return null;

  const currentStage = stages[analysis.stageIndex] || null;
  const isSolved = analysis.stageId === 'solved';
  const compact = isMobile && collapsed;

  if (compact) {
    const tokenInfo = notationToken ? describeToken(notationToken) : null;
    const practicing = algoMoves.length > 0 && (subMode === 'guided' || subMode === 'demo');

    return (
      <div style={TM_CARD_STYLE}>
        <div style={TM_CARD_HEADER_STYLE}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '10px', letterSpacing: '0.12em', color: 'rgba(38,51,31,0.54)', fontWeight: 'bold' }}>
              TEACH MODE
            </div>
            <div style={{
              fontSize: '13px', fontWeight: 'bold', color: UI_MOSS,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {tokenInfo ? tokenInfo.title : currentStage?.name ?? 'Cube is solved!'}
            </div>
          </div>
          <button onClick={() => setCollapsed(false)} style={TM_CHEVRON_BTN_STYLE}>▲ Lesson</button>
          <button onClick={onClose} style={{ ...TM_CHEVRON_BTN_STYLE, padding: '4px 9px' }}>×</button>
        </div>

        <div style={TM_CARD_BODY_STYLE}>
          {notationToken ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{
                minWidth: '46px', textAlign: 'center', padding: '8px 0', borderRadius: '7px',
                fontFamily: MONO_FONT, fontSize: '20px', fontWeight: 'bold',
                color: fieldGuide.goldInk,
                background: 'rgba(38,51,31,0.06)',
                border: '1px solid rgba(123,111,69,0.22)',
              }}>
                {notationToken}
              </span>
              <span style={{ flex: 1, fontSize: '11px', color: 'rgba(38,51,31,0.68)', lineHeight: '1.45' }}>
                {tokenInfo?.hint || 'Watch the gold layer — that is the one this letter turns.'}
              </span>
              <button
                onClick={() => onPlayNotation(notationToken)}
                style={{
                  padding: '8px 12px', borderRadius: '999px',
                  border: '1px solid rgba(95,127,74,0.40)',
                  background: 'rgba(95,127,74,0.18)',
                  color: UI_MOSS, fontFamily: UI_FONT, fontSize: '12px', fontWeight: 'bold',
                  cursor: 'pointer', flexShrink: 0, touchAction: 'manipulation',
                }}
              >
                ↻ Turn
              </button>
            </div>
          ) : practicing ? (
            <PracticeBlock
              algoMoves={algoMoves}
              currentStep={currentStep}
              isPlaying={isPlaying}
              canExecute={canExecute}
              isAlgoComplete={isAlgoComplete}
              onExecuteStep={onExecuteStep}
              onToggleAutoPlay={onToggleAutoPlay}
              onResetAlgorithm={onResetAlgorithm}
              subMode={subMode}
            />
          ) : (
            <div style={{ fontSize: '11px', color: 'rgba(38,51,31,0.60)', lineHeight: '1.5' }}>
              Tap <span style={{ fontWeight: 'bold' }}>▲ Lesson</span> for the full guide.
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={TM_PANEL_STYLE}>
      {/* Header */}
      <div style={TM_HEADER_STYLE}>
        <div>
          <div style={TM_TITLE_STYLE}>TEACH MODE</div>
          <div style={TM_SUBTITLE_STYLE}>
            {methodName}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {isMobile && (
            <button onClick={() => setCollapsed(true)} style={TM_CHEVRON_BTN_STYLE} title="Shrink the panel to watch the cube">
              ▼ Watch cube
            </button>
          )}
          <button onClick={onClose} style={TM_CLOSE_BTN_STYLE}>
            ×
          </button>
        </div>
      </div>

      {/* Sub-mode tabs */}
      <SubModeTabs subMode={subMode} onSwitch={onSwitchSubMode} />

      {/* Progress Overview */}
      <div style={TM_SECTION_STYLE}>
        <div style={TM_SECTION_LABEL_STYLE}>
          SOLVE PROGRESS
        </div>
        <div style={TM_STAGES_BAR_ROW_STYLE}>
          {stages.map((stage, i) => (
            <div
              key={stage.id}
              style={{
                flex: 1,
                height: '6px',
                borderRadius: '3px',
                background: i < analysis.stageIndex
                  ? UI_MOSS_LIGHT
                  : i === analysis.stageIndex
                    ? 'linear-gradient(90deg, #5f7f4a, rgba(95,127,74,0.30))'
                    : 'rgba(38,51,31,0.14)',
                transition: 'background 0.3s',
              }}
            />
          ))}
        </div>
        {isSolved ? (
          <div style={{ color: UI_MOSS_LIGHT, fontWeight: 'bold', fontSize: '14px' }}>
            Cube is solved!
          </div>
        ) : (
          <div style={{ fontSize: '12px' }}>
            <span style={{ color: UI_MOSS }}>{currentStage?.name}</span>
            {analysis.progress.stepProgress && (
              <span style={{ color: 'rgba(38,51,31,0.54)', marginLeft: '8px' }}>
                ({analysis.progress.stepProgress} pieces)
              </span>
            )}
          </div>
        )}
      </div>

      {/* Scrollable content — the mobile nav bar overlaps the panel's foot, so
          leave room for it rather than letting the last row hide behind it. */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 0, paddingBottom: isMobile ? 104 : 0 }}>

        {/* ── QUIZ sub-mode ── */}
        {subMode === 'quiz' && currentStage && !isSolved && (
          <QuizPanel
            currentStage={currentStage}
            quizOptions={quizOptions}
            quizAnswered={quizAnswered}
            quizHintShown={quizHintShown}
            onAnswer={onAnswerQuiz}
            onRetry={onRetryQuiz}
          />
        )}

        {/* ── NOTATION sub-mode ── */}
        {subMode === 'notation' && (
          <NotationPanel
            notationToken={notationToken}
            onPreview={onPreviewNotation}
            onPlay={onPlayNotation}
          />
        )}

        {/* ── DEMO banner ── */}
        {subMode === 'demo' && !isSolved && <DemoBanner />}

        {/* ── Current Stage Guidance (guided + demo) ── */}
        {currentStage && !isSolved && subMode !== 'quiz' && subMode !== 'notation' && (
          <div style={{
            padding: '12px 16px',
            borderBottom: '1px solid rgba(111,126,86,0.25)',
          }}>
            <div style={{ fontSize: '13px', fontWeight: 'bold', color: fieldGuide.ink, marginBottom: '8px' }}>
              {currentStage.goal}
            </div>
            <div style={{ fontSize: '11px', color: 'rgba(38,51,31,0.72)', lineHeight: '1.5' }}>
              {currentStage.explanation}
            </div>

            {/* Tips */}
            <div style={{ marginTop: '10px' }}>
              <div style={{ fontSize: '10px', color: UI_MOSS, fontWeight: 'bold', marginBottom: '4px' }}>
                TIPS:
              </div>
              {currentStage.tips.map((tip, i) => (
                <div key={i} style={{
                  fontSize: '11px',
                  color: 'rgba(38,51,31,0.68)',
                  padding: '2px 0 2px 12px',
                  position: 'relative',
                }}>
                  <span style={{ position: 'absolute', left: 0, color: 'rgba(95,127,74,0.50)' }}>·</span>
                  {tip}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Algorithm Cards for Current Stage ── */}
        {currentStage && !isSolved && subMode !== 'quiz' && subMode !== 'notation' && (
          <div style={{ padding: '12px 16px' }}>
            <div style={TM_ALGO_LIST_LABEL_STYLE}>
              ALGORITHMS FOR THIS STEP
            </div>
            {currentStage.algorithms.map((algo, algoIdx) => {
              const isSelected = selectedAlgo?.stageIndex === analysis.stageIndex && selectedAlgo?.algoIndex === algoIdx;
              return (
                <AlgorithmCard
                  key={algoIdx}
                  algo={algo}
                  isSelected={isSelected}
                  onSelect={() => onSelectAlgorithm(analysis.stageIndex, algoIdx)}
                  algoMoves={isSelected ? algoMoves : []}
                  currentStep={isSelected ? currentStep : 0}
                  isPlaying={isSelected ? isPlaying : false}
                  canExecute={isSelected ? canExecute : false}
                  isAlgoComplete={isSelected ? isAlgoComplete : false}
                  onExecuteStep={onExecuteStep}
                  onToggleAutoPlay={onToggleAutoPlay}
                  onResetAlgorithm={onResetAlgorithm}
                  whyOpen={isSelected ? whyOpen : false}
                  onToggleWhy={onToggleWhy}
                  subMode={subMode}
                />
              );
            })}
          </div>
        )}

        {/* ── All Stages Reference ── */}
        <div style={TM_ALL_STAGES_SECTION_STYLE}>
          <div style={TM_SECTION_SUB_LABEL_STYLE}>
            ALL STAGES
          </div>
          {stages.map((stage, i) => {
            const isDone = i < analysis.stageIndex;
            const isCurrent = i === analysis.stageIndex;
            const isExpanded = expandedStage === i;

            return (
              <div key={stage.id} style={TM_STAGE_ITEM_STYLE}>
                <div
                  onClick={() => setExpandedStage(isExpanded ? null : i)}
                  style={{
                    padding: '8px 10px',
                    borderRadius: '6px',
                    background: isCurrent
                      ? 'rgba(95,127,74,0.10)'
                      : isDone
                        ? 'rgba(95,127,74,0.05)'
                        : 'rgba(38,51,31,0.05)',
                    border: `1px solid ${isCurrent ? 'rgba(95,127,74,0.30)' : isDone ? 'rgba(95,127,74,0.15)' : 'rgba(255,255,255,0.56)'}`,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <span style={{
                    width: '18px',
                    height: '18px',
                    borderRadius: '50%',
                    background: isDone ? UI_MOSS_LIGHT : isCurrent ? UI_MOSS : 'rgba(38,51,31,0.14)',
                    color: isDone || isCurrent ? '#000' : 'rgba(38,51,31,0.42)',
                    fontSize: '10px',
                    fontWeight: 'bold',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    {isDone ? '✓' : i + 1}
                  </span>
                  <span style={{
                    fontSize: '11px',
                    color: isDone ? UI_MOSS_LIGHT : isCurrent ? UI_MOSS : 'rgba(38,51,31,0.54)',
                    flex: 1,
                  }}>
                    {stage.name}
                  </span>
                  <span style={{
                    fontSize: '10px',
                    color: 'rgba(38,51,31,0.42)',
                    transform: isExpanded ? 'rotate(180deg)' : 'none',
                    transition: 'transform 0.2s',
                  }}>
                    ▼
                  </span>
                </div>

                {/* Expanded stage details */}
                {isExpanded && (
                  <div style={TM_STAGE_EXPANDED_STYLE}>
                    <div style={TM_STAGE_GOAL_STYLE}>{stage.goal}</div>
                    {stage.algorithms.map((algo, j) => (
                      <div key={j} style={TM_ALGO_CARD_STYLE}>
                        <div style={TM_ALGO_CARD_NAME_STYLE}>
                          {algo.name}
                        </div>
                        <div style={TM_ALGO_CARD_NOTATION_STYLE}>
                          {algo.notation}
                        </div>
                        <div style={TM_ALGO_CARD_WHEN_STYLE}>
                          {algo.when}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default TeachMode;
