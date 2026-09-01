// src/teach/useTeachMode.js
// Hook to manage Teach Mode state and step-by-step algorithm execution
//
// Sub-modes:
//   'demo'   — auto-solves fully; pauses after each move for observation
//   'guided' — suggests the next algorithm; player executes each step
//   'quiz'   — presents the current stage's algorithms as choices; wrong → hint

import { useState, useCallback, useRef, useEffect } from 'react';
import { useGameStore } from '../hooks/useGameStore.js';
import { BEGINNER_METHOD_3x3, parseAlgorithm } from './algorithms.js';
import { progressManager } from '../levels/ProgressManager.js';
import { awardMilestone, teachAlgorithmKey } from '../levels/rewards.js';
import { analyzeState } from './solver3x3.js';

// ---------------------------------------------------------------------------
// Build quiz options for the current stage
// ---------------------------------------------------------------------------
function buildQuizOptions(stageIndex, stages) {
  const currentStage = stages[stageIndex];
  if (!currentStage || currentStage.algorithms.length === 0) return [];

  const correct = currentStage.algorithms[0];

  // Pull distractors from adjacent stages
  const distractors = [];
  const otherIndices = [
    stageIndex > 0 ? stageIndex - 1 : stageIndex + 2,
    stageIndex < stages.length - 1 ? stageIndex + 1 : stageIndex - 2,
  ].filter((i, pos, arr) => i !== stageIndex && i >= 0 && i < stages.length && arr.indexOf(i) === pos);

  for (const idx of otherIndices) {
    const s = stages[idx];
    if (s && s.algorithms.length > 0) {
      distractors.push(s.algorithms[0]);
    }
    if (distractors.length >= 2) break;
  }

  const options = [correct, ...distractors].slice(0, 3).map((algo, i) => ({
    notation: algo.notation,
    name: algo.name,
    isCorrect: i === 0,
  }));

  // Fisher-Yates shuffle
  for (let i = options.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [options[i], options[j]] = [options[j], options[i]];
  }

  return options;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------
export function useTeachMode() {
  const cubies = useGameStore((s) => s.cubies);
  const size = useGameStore((s) => s.size);
  const animState = useGameStore((s) => s.animState);
  const setAnimState = useGameStore((s) => s.setAnimState);
  const setPendingMove = useGameStore((s) => s.setPendingMove);
  const setSolveHighlights = useGameStore((s) => s.setSolveHighlights);

  // Core state
  const [active, setActive] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [selectedAlgo, setSelectedAlgo] = useState(null); // { stageIndex, algoIndex }
  const [algoMoves, setAlgoMoves] = useState([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [layerHighlight, setLayerHighlight] = useState(null);

  // Sub-mode: 'guided' | 'demo' | 'quiz' | 'notation'
  const [subMode, setSubMode] = useState('guided');

  // Notation tab: the token currently being demonstrated on the cube
  const [notationToken, setNotationToken] = useState(null);

  // Quiz state
  const [quizOptions, setQuizOptions] = useState([]);
  const [quizAnswered, setQuizAnswered] = useState(null); // null | 'correct' | 'wrong'
  const [quizHintShown, setQuizHintShown] = useState(false);

  // Why card open state (per-algo)
  const [whyOpen, setWhyOpen] = useState(false);

  const isPlayingRef = useRef(false);
  const pendingNextRef = useRef(false);

  // Analyze cube state whenever cubies change and teach mode is active
  useEffect(() => {
    if (!active || size !== 3) return;
    const result = analyzeState(cubies);
    setAnalysis(result);
    setSolveHighlights(result.highlights || []);

    if (subMode === 'quiz') {
      setQuizOptions(buildQuizOptions(result.stageIndex, BEGINNER_METHOD_3x3.stages));
      setQuizAnswered(null);
      setQuizHintShown(false);
    }
  }, [active, cubies, size, setSolveHighlights, subMode]);

  // When animation finishes and we're auto-playing (demo mode), advance to next step
  useEffect(() => {
    if (pendingNextRef.current && !animState) {
      pendingNextRef.current = false;
      if (isPlayingRef.current) {
        const timer = setTimeout(() => {
          if (isPlayingRef.current) {
            advanceStep();
          }
        }, 400);
        return () => clearTimeout(timer);
      }
    }
  }, [animState]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------------------------------------------------------------------------
  // Enter / exit
  // ---------------------------------------------------------------------------
  const enterTeachMode = useCallback(() => {
    if (size !== 3) return;
    setActive(true);
    const result = analyzeState(cubies);
    setAnalysis(result);
    setSolveHighlights(result.highlights || []);
    setSelectedAlgo(null);
    setAlgoMoves([]);
    setCurrentStep(0);
    setIsPlaying(false);
    isPlayingRef.current = false;
    setLayerHighlight(null);
    setWhyOpen(false);
    setQuizAnswered(null);
    setQuizHintShown(false);
    setNotationToken(null);
    setQuizOptions(buildQuizOptions(result.stageIndex, BEGINNER_METHOD_3x3.stages));
  }, [cubies, size, setSolveHighlights]);

  const exitTeachMode = useCallback(() => {
    setActive(false);
    setAnalysis(null);
    setSelectedAlgo(null);
    setAlgoMoves([]);
    setCurrentStep(0);
    setIsPlaying(false);
    isPlayingRef.current = false;
    setLayerHighlight(null);
    setSolveHighlights([]);
    setWhyOpen(false);
    setQuizAnswered(null);
    setQuizHintShown(false);
    setNotationToken(null);
  }, [setSolveHighlights]);

  // ---------------------------------------------------------------------------
  // Sub-mode switching
  // ---------------------------------------------------------------------------
  const switchSubMode = useCallback((mode) => {
    setSubMode(mode);
    setIsPlaying(false);
    isPlayingRef.current = false;
    setQuizAnswered(null);
    setQuizHintShown(false);
    setWhyOpen(false);

    // The notation lesson drives the highlight itself, one token at a time —
    // leaving an algorithm's highlight up would point at the wrong layer.
    if (mode !== 'notation') setNotationToken(null);
    else {
      setSelectedAlgo(null);
      setAlgoMoves([]);
      setCurrentStep(0);
      setLayerHighlight(null);
    }

    if (mode === 'quiz' && analysis) {
      setQuizOptions(buildQuizOptions(analysis.stageIndex, BEGINNER_METHOD_3x3.stages));
    }

    if (mode === 'demo' && analysis && analysis.stageId !== 'solved') {
      const stage = BEGINNER_METHOD_3x3.stages[analysis.stageIndex];
      if (stage && stage.algorithms.length > 0) {
        const moves = parseAlgorithm(stage.algorithms[0].notation, 3);
        setSelectedAlgo({ stageIndex: analysis.stageIndex, algoIndex: 0 });
        setAlgoMoves(moves);
        setCurrentStep(0);
        if (moves.length > 0) {
          setLayerHighlight({ axis: moves[0].axis, sliceIndex: moves[0].sliceIndex, dir: moves[0].dir });
        }
      }
    }
  }, [analysis]);

  // ---------------------------------------------------------------------------
  // Select an algorithm to practice
  // ---------------------------------------------------------------------------
  const selectAlgorithm = useCallback((stageIndex, algoIndex) => {
    const stage = BEGINNER_METHOD_3x3.stages[stageIndex];
    if (!stage) return;
    const algo = stage.algorithms[algoIndex];
    if (!algo) return;

    const moves = parseAlgorithm(algo.notation, 3);
    setSelectedAlgo({ stageIndex, algoIndex });
    setAlgoMoves(moves);
    setCurrentStep(0);
    setIsPlaying(false);
    isPlayingRef.current = false;
    setWhyOpen(false);

    if (moves.length > 0) {
      setLayerHighlight({ axis: moves[0].axis, sliceIndex: moves[0].sliceIndex, dir: moves[0].dir });
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Execute the current step (one move)
  // ---------------------------------------------------------------------------
  const executeStep = useCallback(() => {
    if (!algoMoves.length || currentStep >= algoMoves.length) return;
    if (animState) return;

    const move = algoMoves[currentStep];
    // numTurns carries half turns (F2, U2): one token in the algorithm, two
    // quarter turns on the cube. Without it the demo teaches the wrong move.
    const numTurns = move.numTurns ?? 1;
    setAnimState({ axis: move.axis, dir: move.dir, sliceIndex: move.sliceIndex, t: 0, numTurns });
    setPendingMove({ axis: move.axis, dir: move.dir, sliceIndex: move.sliceIndex, numTurns });
    pendingNextRef.current = true;

    const nextStep = currentStep + 1;
    setCurrentStep(nextStep);

    if (nextStep < algoMoves.length) {
      setLayerHighlight({ axis: algoMoves[nextStep].axis, sliceIndex: algoMoves[nextStep].sliceIndex, dir: algoMoves[nextStep].dir });
    } else {
      setLayerHighlight(null);
      // Algorithm executed to its last move — Teach mode's one real completion
      // signal, and the only thing here worth paying for. Claimed once per
      // algorithm (levels/rewards.js), so practising a move again is free but
      // pays nothing, and the demo's teach cameo auto-plays so it must not pay.
      const stage = BEGINNER_METHOD_3x3.stages[selectedAlgo?.stageIndex];
      if (stage && selectedAlgo) {
        awardMilestone(teachAlgorithmKey(stage.id, selectedAlgo.algoIndex), {
          progress: progressManager,
          earn: (amount) => useGameStore.getState().earnCoins(amount),
          enabled: !useGameStore.getState().demoMode
        });
      }
    }
  }, [algoMoves, currentStep, animState, selectedAlgo, setAnimState, setPendingMove]);

  // Advance step (for auto-play / demo mode)
  const advanceStep = useCallback(() => {
    if (currentStep < algoMoves.length && !animState) {
      executeStep();
    } else {
      setIsPlaying(false);
      isPlayingRef.current = false;
    }
  }, [currentStep, algoMoves, animState, executeStep]);

  // Toggle auto-play
  const toggleAutoPlay = useCallback(() => {
    if (isPlaying) {
      setIsPlaying(false);
      isPlayingRef.current = false;
    } else {
      setIsPlaying(true);
      isPlayingRef.current = true;
      if (!animState && currentStep < algoMoves.length) {
        executeStep();
      }
    }
  }, [isPlaying, animState, currentStep, algoMoves, executeStep]);

  // Reset algorithm to start
  const resetAlgorithm = useCallback(() => {
    setCurrentStep(0);
    setIsPlaying(false);
    isPlayingRef.current = false;
    if (algoMoves.length > 0) {
      setLayerHighlight({ axis: algoMoves[0].axis, sliceIndex: algoMoves[0].sliceIndex, dir: algoMoves[0].dir });
    }
  }, [algoMoves]);

  // ---------------------------------------------------------------------------
  // Notation lesson actions
  // ---------------------------------------------------------------------------
  // Point the in-world gold guidance at the layer a token names, without
  // turning anything — the player reads the letter and sees the layer light up.
  const previewNotation = useCallback((token) => {
    const [move] = parseAlgorithm(token, 3);
    if (!move) return;
    setNotationToken(token);
    setLayerHighlight({ axis: move.axis, sliceIndex: move.sliceIndex, dir: move.dir });
  }, []);

  // Perform the token's turn so the letter, the highlighted layer and the
  // motion all land together.
  const playNotation = useCallback((token) => {
    const [move] = parseAlgorithm(token, 3);
    if (!move || animState) return;
    const numTurns = move.numTurns ?? 1;
    setNotationToken(token);
    setLayerHighlight({ axis: move.axis, sliceIndex: move.sliceIndex, dir: move.dir });
    setAnimState({ axis: move.axis, dir: move.dir, sliceIndex: move.sliceIndex, t: 0, numTurns });
    setPendingMove({ axis: move.axis, dir: move.dir, sliceIndex: move.sliceIndex, numTurns });
  }, [animState, setAnimState, setPendingMove]);

  // ---------------------------------------------------------------------------
  // Quiz actions
  // ---------------------------------------------------------------------------
  const answerQuiz = useCallback((optionIndex) => {
    const opt = quizOptions[optionIndex];
    if (!opt) return;
    if (opt.isCorrect) {
      setQuizAnswered('correct');
    } else {
      setQuizAnswered('wrong');
      setQuizHintShown(true);
    }
  }, [quizOptions]);

  const retryQuiz = useCallback(() => {
    setQuizAnswered(null);
    setQuizHintShown(false);
    if (analysis) {
      setQuizOptions(buildQuizOptions(analysis.stageIndex, BEGINNER_METHOD_3x3.stages));
    }
  }, [analysis]);

  // ---------------------------------------------------------------------------
  // Derived helpers
  // ---------------------------------------------------------------------------
  const getCurrentStageData = useCallback(() => {
    if (!analysis) return null;
    return BEGINNER_METHOD_3x3.stages[analysis.stageIndex] || null;
  }, [analysis]);

  const getSelectedAlgoInfo = useCallback(() => {
    if (!selectedAlgo) return null;
    const stage = BEGINNER_METHOD_3x3.stages[selectedAlgo.stageIndex];
    if (!stage) return null;
    return stage.algorithms[selectedAlgo.algoIndex] || null;
  }, [selectedAlgo]);

  return {
    // Core state
    active,
    analysis,
    selectedAlgo,
    algoMoves,
    currentStep,
    isPlaying,
    layerHighlight,
    stages: BEGINNER_METHOD_3x3.stages,
    methodName: BEGINNER_METHOD_3x3.name,

    // Sub-mode
    subMode,
    switchSubMode,

    // Notation lesson
    notationToken,
    previewNotation,
    playNotation,

    // Why card
    whyOpen,
    setWhyOpen,

    // Quiz
    quizOptions,
    quizAnswered,
    quizHintShown,
    answerQuiz,
    retryQuiz,

    // Actions
    enterTeachMode,
    exitTeachMode,
    selectAlgorithm,
    executeStep,
    toggleAutoPlay,
    resetAlgorithm,

    // Derived
    getCurrentStageData,
    getSelectedAlgoInfo,
    canExecute: algoMoves.length > 0 && currentStep < algoMoves.length && !animState,
    isAlgoComplete: algoMoves.length > 0 && currentStep >= algoMoves.length,
  };
}
