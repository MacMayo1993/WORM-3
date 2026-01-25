// src/worm/WormModeController.jsx
// Controller component that manages WORM mode state and renders all pieces

import React, { useCallback } from 'react';
import { useWormGame, WormMode3D, WormGameLoop } from './WormMode.jsx';
import WormHUD from './WormHUD.jsx';

// This component should be rendered inside the Canvas
export function WormModeCanvas({
  cubies,
  size,
  explosionFactor,
  animState,
  game
}) {
  return (
    <>
      <WormMode3D
        worm={game.worm}
        orbs={game.orbs}
        size={size}
        explosionFactor={explosionFactor}
        gameState={game.gameState}
      />
      <WormGameLoop
        cubies={cubies}
        size={size}
        animState={animState}
        game={game}
      />
    </>
  );
}

// This component should be rendered outside the Canvas (HTML layer)
export function WormModeUI({
  game,
  onQuit
}) {
  const {
    gameState,
    worm,
    orbs,
    score,
    warps,
    speed,
    orbsTotal,
    setGameState,
    restart
  } = game;

  const handlePause = useCallback(() => {
    setGameState('paused');
  }, [setGameState]);

  const handleResume = useCallback(() => {
    setGameState('playing');
  }, [setGameState]);

  return (
    <WormHUD
      score={score}
      length={worm.length}
      orbsRemaining={orbs.length}
      orbsTotal={orbsTotal}
      warps={warps}
      gameState={gameState}
      speed={speed}
      onPause={handlePause}
      onResume={handleResume}
      onRestart={restart}
      onQuit={onQuit}
    />
  );
}

// Hook wrapper for external use
export { useWormGame };
