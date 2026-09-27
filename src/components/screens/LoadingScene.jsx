// src/components/screens/LoadingScene.jsx
/**
 * LoadingScene — the loading screen's animated heart: the opening's Rubik's cube
 * falling for ever between two linked portals in the opening's graph paper.
 *
 * The same black-plastic cube with glossy classic stickers as IntroScene drops
 * out of a portal hanging above, falls into the wormhole in the paper, and comes
 * straight back out of the portal above — mid-transit it is in both at once, its
 * lower half already falling out of the top portal. On the way its top layer
 * gives a half twist, and the sticker flip wave turns the cube to its antipodal
 * colours and back. LoadingPortal draws the waving paper and both portals.
 *
 * The cube is pure CSS 3D, animated on the compositor so it keeps moving while
 * the main thread is busy parsing; the paper and portals are 2D canvases (never
 * WebGL, which would compete with the app's R3F canvas for a context).
 *
 * Lazy-loaded by LoadingScreen, with its stylesheet, to keep both off the
 * initial route; preloadAssets.js warms the chunk during the opening.
 */

import React, { useRef, useState } from 'react';
import { RUBIKS_FACE_COLORS } from '../../utils/constants.js';
import { CUBE_YAW, LOADING_CUBE } from './loadingCube.js';
import { shaftClipPath } from './loadingWormhole.js';
import LoadingPortal from './LoadingPortal.jsx';
import './LoadingScene.css';

function Face({ face }) {
  const cls = `wl-face wl-${face.side}${face.cap ? ' wl-cap' : ''}`;
  const colors = { '--wl-sc': RUBIKS_FACE_COLORS[face.color], '--wl-ac': RUBIKS_FACE_COLORS[face.antipode] };
  return (
    <div className={cls} style={colors}>
      {face.stickers.map((s) => (
        <i key={s.key} className="wl-sticker" style={{ '--wl-d': `${s.delay}s` }} />
      ))}
    </div>
  );
}

const Cube = React.memo(function Cube() {
  return (
    <div className="wl-cube" style={{ '--wl-yaw': `${CUBE_YAW}deg` }}>
      {LOADING_CUBE.map((layer) => (
        <div key={layer.key} className={`wl-layer wl-layer-${layer.key}`}>
          {layer.faces.map((face) => (
            <Face key={face.side} face={face} />
          ))}
          {layer.plastic.map((side) => (
            <div key={side} className={`wl-face wl-cap wl-${side}`} />
          ))}
        </div>
      ))}
    </div>
  );
});

// A small, fixed set of compositor-animated streaks. They travel with each
// cube's fall, so the existing shaft clip also hides them inside the portals.
const AIR_STREAMS = [
  { x: '-30%', length: '80%', delay: '-0.08s', drift: '-14px' },
  { x: '-15%', length: '56%', delay: '-0.28s', drift: '-8px' },
  { x: '4%', length: '42%', delay: '-0.16s', drift: '-4px' },
  { x: '96%', length: '46%', delay: '-0.36s', drift: '4px' },
  { x: '115%', length: '68%', delay: '-0.05s', drift: '8px' },
  { x: '132%', length: '84%', delay: '-0.23s', drift: '14px' }
];

const Airflow = React.memo(function Airflow() {
  return <div className="wl-airflow" aria-hidden="true">
    {AIR_STREAMS.map((stream, i) => <i key={i} className="wl-air-streak" style={{
      left: stream.x, height: stream.length, animationDelay: stream.delay, '--wl-air-drift': stream.drift
    }} />)}
    <i className="wl-air-wake wl-air-wake-left" />
    <i className="wl-air-wake wl-air-wake-right" />
  </div>;
});

// Everything between the two portals' near edges; see shaftClipPath.
const SHAFT_STYLE = { clipPath: shaftClipPath() };

export default function LoadingScene({ translucent = false }) {
  const wellRef = useRef(null);
  const topRef = useRef(null);
  // The CSS animations start as the scene mounts; the portals keep the same clock.
  const [startedAt] = useState(() => performance.now());
  return (
    <>
      <LoadingPortal wellRef={wellRef} topRef={topRef} startedAt={startedAt} translucent={translucent} />
      <div className="wl-scene">
        <div className="wl-well" ref={topRef} />
        <div className="wl-gap" />
        <div className="wl-well" ref={wellRef}>
          <i className="wl-shadow" />
          <i className="wl-shock" />
        </div>
        {/* The cube and its twin one drop below: as the one goes into the
            paper, the other is the same cube coming out of the portal above. */}
        <div className="wl-shaft" style={SHAFT_STYLE}>
          <div className="wl-fall">
            <div className="wl-view">
              <Airflow />
              <Cube />
            </div>
            <div className="wl-view wl-twin">
              <Airflow />
              <Cube />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
