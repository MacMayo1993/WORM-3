// src/components/screens/LoadingScene.jsx
/**
 * LoadingScene — the loading screen's animated heart: the opening's Rubik's cube
 * hopping over a wormhole in the opening's graph paper.
 *
 * The same black-plastic cube with glossy classic stickers as IntroScene drops
 * in as its top layer clacks home, then keeps hopping — a quarter twist of the
 * top layer on every hop, the sticker flip wave turning the cube to its antipodal
 * colours and back — while LoadingPortal draws the waving paper and the funnel
 * spinning beneath it.
 *
 * The cube is pure CSS 3D, animated on the compositor so it keeps moving while
 * the main thread is busy parsing; the paper and wormhole are 2D canvases (never
 * WebGL, which would compete with the app's R3F canvas for a context).
 *
 * Lazy-loaded by LoadingScreen, with its stylesheet, to keep both off the
 * initial route; preloadAssets.js warms the chunk during the opening.
 */

import React, { useRef, useState } from 'react';
import { RUBIKS_FACE_COLORS } from '../../utils/constants.js';
import { CUBE_YAW, LOADING_CUBE } from './loadingCube.js';
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

export default function LoadingScene({ translucent = false }) {
  const wellRef = useRef(null);
  // The CSS animations start as the scene mounts; the wormhole keeps the same clock.
  const [startedAt] = useState(() => performance.now());
  return (
    <>
      <LoadingPortal wellRef={wellRef} startedAt={startedAt} translucent={translucent} />
      <div className="wl-scene">
        <div className="wl-stage">
          <div className="wl-drop">
            <div className="wl-hop">
              <Cube />
            </div>
          </div>
        </div>
        <div className="wl-well" ref={wellRef}>
          <i className="wl-shadow" />
          <i className="wl-shock" />
        </div>
      </div>
    </>
  );
}
