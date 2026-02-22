// src/components/SolveMode.jsx
// Guided solve mode with CFOP step tracking and algorithm hints

import React, { useState, useMemo, useCallback } from 'react';
import {
  checkSolveProgress,
  getHintForState,
  getPiecesToHighlight,
  WHITE_CROSS_HINTS,
  F2L_HINTS,
  OLL_HINTS,
  PLL_HINTS
} from '../game/solveDetection.js';

const STEPS = [
  { id: 'whiteCross', name: 'White Cross', shortName: 'Cross', description: 'Form a cross on the white face with edges matching center colors' },
  { id: 'f2l', name: 'F2L', shortName: 'F2L', description: 'First Two Layers - pair corners and edges' },
  { id: 'oll', name: 'OLL', shortName: 'OLL', description: 'Orient Last Layer - make yellow face all yellow' },
  { id: 'pll', name: 'PLL', shortName: 'PLL', description: 'Permute Last Layer - final solve' },
];

// Progress bar component
const ProgressBar = ({ value, max, color = '#00ff88' }) => (
  <div style={{
    width: '100%',
    height: '4px',
    background: 'rgba(255,255,255,0.1)',
    borderRadius: '2px',
    overflow: 'hidden'
  }}>
    <div style={{
      width: `${(value / max) * 100}%`,
      height: '100%',
      background: color,
      transition: 'width 0.3s ease'
    }} />
  </div>
);

// Algorithm card component
const AlgorithmCard = ({ hint, expanded, onToggle }) => (
  <div
    style={{
      background: 'rgba(255,255,255,0.05)',
      borderRadius: '8px',
      padding: '10px 12px',
      cursor: 'pointer',
      border: '1px solid rgba(255,255,255,0.1)',
      transition: 'all 0.2s ease'
    }}
    onClick={onToggle}
  >
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontWeight: 600, color: '#fefae0' }}>{hint.name}</span>
      <span style={{ opacity: 0.5, fontSize: '12px' }}>{expanded ? '[-]' : '[+]'}</span>
    </div>
    {expanded && (
      <div style={{ marginTop: '8px', fontSize: '12px' }}>
        <p style={{ color: '#aaa', margin: '4px 0' }}>{hint.description}</p>
        <p style={{ color: '#9c6644', margin: '4px 0' }}>Situation: {hint.situation}</p>
        <div style={{
          background: 'rgba(0,0,0,0.3)',
          padding: '8px 10px',
          borderRadius: '4px',
          marginTop: '8px',
          fontFamily: "'Courier New', monospace",
          color: '#00ff88',
          fontSize: '13px'
        }}>
          {hint.algorithm}
        </div>
      </div>
    )}
  </div>
);

export default function SolveMode({
  cubies,
  size,
  onClose,
  onHighlightChange,
  focusedStep,
  onFocusStep
}) {
  const [expandedHint, setExpandedHint] = useState(null);
  const [showAllHints, setShowAllHints] = useState(false);

  // Calculate solve progress
  const progress = useMemo(() => {
    return checkSolveProgress(cubies, size);
  }, [cubies, size]);

  // Get hints for current/focused step
  const currentHint = useMemo(() => {
    const step = focusedStep || progress.currentStep;
    return getHintForState(cubies, size, step);
  }, [cubies, size, focusedStep, progress.currentStep]);

  // Get highlights for visualization
  const highlights = useMemo(() => {
    const step = focusedStep || progress.currentStep;
    return getPiecesToHighlight(cubies, size, step);
  }, [cubies, size, focusedStep, progress.currentStep]);

  // Notify parent of highlight changes
  React.useEffect(() => {
    if (onHighlightChange) {
      onHighlightChange(highlights);
    }
  }, [highlights, onHighlightChange]);

  const handleStepClick = useCallback((stepId) => {
    onFocusStep?.(stepId === focusedStep ? null : stepId);
    setExpandedHint(null);
  }, [focusedStep, onFocusStep]);

  const getStepStatus = (stepId) => {
    switch (stepId) {
      case 'whiteCross': return progress.whiteCross;
      case 'f2l': return progress.f2l;
      case 'oll': return progress.oll;
      case 'pll': return progress.pll;
      default: return { complete: false, solvedCount: 0, total: 1 };
    }
  };

  const getStepColor = (stepId) => {
    const status = getStepStatus(stepId);
    if (status.complete) return '#00ff88';
    if (progress.currentStep === stepId) return '#fefae0';
    return 'rgba(255,255,255,0.4)';
  };

  const activeStep = focusedStep || progress.currentStep;
  const allHints = {
    whiteCross: WHITE_CROSS_HINTS,
    f2l: F2L_HINTS,
    oll: OLL_HINTS,
    pll: PLL_HINTS
  };

  return (
    <div style={{
      position: 'fixed',
      right: '20px',
      top: '80px',
      width: '320px',
      maxHeight: 'calc(100vh - 160px)',
      background: 'rgba(0,0,0,0.85)',
      backdropFilter: 'blur(10px)',
      borderRadius: '12px',
      border: '1px solid rgba(255,255,255,0.1)',
      color: 'white',
      fontFamily: "'Courier New', monospace",
      zIndex: 1000,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    }}>
      {/* Header */}
      <div style={{
        padding: '16px',
        borderBottom: '1px solid rgba(255,255,255,0.1)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '14px', letterSpacing: '0.1em', color: '#fefae0' }}>
            SOLVE MODE
          </h3>
          <p style={{ margin: '4px 0 0', fontSize: '10px', opacity: 0.6 }}>
            CFOP Method Tutorial
          </p>
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: '1px solid rgba(255,255,255,0.2)',
            color: 'white',
            padding: '4px 10px',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '12px'
          }}
        >
          CLOSE
        </button>
      </div>

      {/* Steps Overview */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
          {STEPS.map((step, _idx) => {
            const status = getStepStatus(step.id);
            const isActive = activeStep === step.id;
            const isFocused = focusedStep === step.id;

            return (
              <button
                key={step.id}
                onClick={() => handleStepClick(step.id)}
                style={{
                  flex: 1,
                  padding: '8px 4px',
                  background: isActive ? 'rgba(255,255,255,0.1)' : 'transparent',
                  border: isFocused ? '2px solid #fefae0' : '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '6px',
                  color: getStepColor(step.id),
                  cursor: 'pointer',
                  fontSize: '10px',
                  fontFamily: "'Courier New', monospace",
                  transition: 'all 0.2s ease'
                }}
              >
                <div style={{ fontWeight: 600 }}>{step.shortName}</div>
                <div style={{ fontSize: '9px', opacity: 0.7, marginTop: '2px' }}>
                  {status.solvedCount}/{status.total}
                </div>
                <ProgressBar
                  value={status.solvedCount}
                  max={status.total}
                  color={status.complete ? '#00ff88' : '#fefae0'}
                />
              </button>
            );
          })}
        </div>

        {/* Current Step Info */}
        <div style={{
          background: 'rgba(255,255,255,0.05)',
          borderRadius: '6px',
          padding: '10px 12px',
          fontSize: '11px'
        }}>
          <div style={{ color: '#fefae0', fontWeight: 600, marginBottom: '4px' }}>
            {STEPS.find(s => s.id === activeStep)?.name || 'Solved'}
          </div>
          <div style={{ color: '#aaa', lineHeight: 1.4 }}>
            {STEPS.find(s => s.id === activeStep)?.description || 'Congratulations! Cube is solved.'}
          </div>
        </div>
      </div>

      {/* Status Message */}
      <div style={{
        padding: '12px 16px',
        background: 'rgba(254,250,224,0.05)',
        borderBottom: '1px solid rgba(255,255,255,0.1)',
        fontSize: '12px',
        color: currentHint.hints?.length === 0 ? '#00ff88' : '#fefae0'
      }}>
        {currentHint.message}
      </div>

      {/* Algorithms Section */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '12px 16px'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '10px'
        }}>
          <span style={{ fontSize: '11px', opacity: 0.6, letterSpacing: '0.1em' }}>
            ALGORITHMS
          </span>
          <button
            onClick={() => setShowAllHints(!showAllHints)}
            style={{
              background: 'none',
              border: 'none',
              color: '#9c6644',
              cursor: 'pointer',
              fontSize: '10px',
              textDecoration: 'underline'
            }}
          >
            {showAllHints ? 'Show Relevant' : 'Show All'}
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {(showAllHints ? allHints[activeStep] || [] : currentHint.hints || []).map((hint, idx) => (
            <AlgorithmCard
              key={idx}
              hint={hint}
              expanded={expandedHint === idx}
              onToggle={() => setExpandedHint(expandedHint === idx ? null : idx)}
            />
          ))}

          {(!showAllHints && (!currentHint.hints || currentHint.hints.length === 0)) && (
            <div style={{
              textAlign: 'center',
              padding: '20px',
              color: '#00ff88',
              fontSize: '12px'
            }}>
              Step complete! Click next step or continue solving.
            </div>
          )}
        </div>
      </div>

      {/* Footer Tips */}
      <div style={{
        padding: '12px 16px',
        borderTop: '1px solid rgba(255,255,255,0.1)',
        fontSize: '10px',
        color: '#9c6644',
        background: 'rgba(0,0,0,0.3)'
      }}>
        <strong>Tip:</strong> {
          activeStep === 'whiteCross' ? 'Look for white edges and bring them to the top face.' :
          activeStep === 'f2l' ? 'Find corner-edge pairs and insert them together.' :
          activeStep === 'oll' ? 'Focus on making the yellow face all yellow.' :
          activeStep === 'pll' ? 'Look for headlights (two same-colored pieces side by side).' :
          'Great job solving the cube!'
        }
      </div>
    </div>
  );
}

// Compact toggle button for mobile/minimal UI
export function SolveModeButton({ active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`btn-compact text ${active ? 'active' : ''}`}
      style={{
        color: active ? '#00ff88' : undefined,
        borderColor: active ? '#00ff88' : undefined
      }}
    >
      SOLVE
    </button>
  );
}
