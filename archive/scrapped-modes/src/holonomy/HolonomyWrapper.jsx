// src/holonomy/HolonomyWrapper.jsx
// Bridge component inside <Canvas> — runs useHolonomyMode, renders 3D tracer,
// and portals HolonomyHUD into the DOM.

import React from 'react';
import { Html } from '@react-three/drei';
import { useHolonomyMode } from './useHolonomyMode.js';
import HolonomyTracer from './HolonomyTracer.jsx';
import HolonomyHUD from './HolonomyHud.jsx';

export default function HolonomyWrapper() {
    const game = useHolonomyMode();

    return (
        <>
            {/* 3D tracer + swirl field lines */}
            <HolonomyTracer
                tracerFace={game.tracerFace}
                tracerU={game.tracerU}
                tracerV={game.tracerV}
                transportVec={game.transportVec}
                twistRef={game.twistRef}
                seamCount={game.seamCount}
                mobiusCount={game.mobiusCount}
                loopClosed={game.loopClosed}
            />

            {/* DOM HUD portalled out of canvas */}
            <Html
                portal={{ current: document.getElementById('root') || document.body }}
                style={{ width: 0, height: 0, overflow: 'visible' }}
            >
                <HolonomyHUD
                    holonomyAngle={game.holonomyAngle}
                    orientationParity={game.orientationParity}
                    holonomyMatrix={game.holonomyMatrix}
                    seamCount={game.seamCount}
                    mobiusCount={game.mobiusCount}
                    loopClosed={game.loopClosed}
                    onReset={game.resetHolonomy}
                    onTurnLeft={() => game.queueTurn('left')}
                    onTurnRight={() => game.queueTurn('right')}
                />
            </Html>
        </>
    );
}
