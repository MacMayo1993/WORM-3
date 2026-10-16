// src/components/screens/LoadingScene.jsx
/**
 * LoadingScene — the loading screen's animated heart: the opening's Rubik's cube
 * falling for ever between two linked portals in the opening's graph paper.
 *
 * The same black-plastic cube with glossy classic stickers as IntroScene drops
 * out of a portal hanging above, falls into the wormhole in the paper, and comes
 * straight back out of the portal above — mid-transit it is split between them,
 * as much of it out of the top portal as has sunk into the paper. On the way its top layer
 * gives a half twist, and the sticker flip wave turns the cube to its antipodal
 * colours and back. LoadingPortal draws the waving paper and both portals.
 *
 * The cube is pure CSS 3D, animated on the compositor so it keeps moving while
 * the main thread is busy parsing; the paper and portals are 2D canvases (never
 * WebGL, which would compete with the app's R3F canvas for a context).
 *
 * It is also a toy (loadingPlay.js): the portals spring open as the cover
 * arrives, holding anywhere dives faster (every animation and both canvases
 * speed up together, with speed lines round the shaft), a tap kicks the cube
 * into a spin and rings both portals, and MOBI keeps count of the loops with a
 * line every couple of them. The view tilts with the mouse, a finger held on
 * the cover, or a phone's own tilt (where the browser offers it without a
 * permission prompt): the scene slides over the paper and the cube turns.
 *
 * Lazy-loaded by LoadingScreen, with its stylesheet, to keep both off the
 * initial route; preloadAssets.js warms the chunk during the opening.
 */

import React, { useEffect, useRef } from 'react';
import { RUBIKS_FACE_COLORS } from '../../utils/constants.js';
import { CUBE_YAW, LOADING_CUBE } from './loadingCube.js';
import { shaftClipPath } from './loadingWormhole.js';
import { createLoadingPlay, orientationAim, pointerAim } from './loadingPlay.js';
import { prefersReducedMotion } from '../../utils/device.js';
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
      {/* A tap spins this about the cube's own vertical axis. */}
      <div className="wl-spin">
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

// Between the two portals' near lips.
const SHAFT_STYLE = { clipPath: shaftClipPath() };
const MOBI_STYLE = { '--wl-mobi': `url("${import.meta.env.BASE_URL}Mobi.webp")` };

export default function LoadingScene({ translucent = false }) {
  const sceneRef = useRef(null);
  const fallRef = useRef(null);
  const wellRef = useRef(null);
  const topRef = useRef(null);
  const lineRef = useRef(null);
  const badgeRef = useRef(null);
  const playRef = useRef(null);
  const veilRef = useRef(null);

  // The toy: a press dives and kicks, letting go (anywhere) eases off. The whole
  // cover is the touch surface; nothing here sets React state.
  useEffect(() => {
    const scene = sceneRef.current;
    const root = scene?.parentElement;
    if (!scene || !root) return undefined;
    const play = createLoadingPlay({
      scene,
      veil: veilRef.current,
      line: lineRef.current,
      badge: badgeRef.current,
      reduced: prefersReducedMotion()
    });
    playRef.current = play;
    // The view leans toward a mouse anywhere over the cover, or a finger while it
    // is held there; a phone's tilt leans it the rest of the time.
    const at = { x: 0, y: 0 };
    let touching = false;
    const aimAt = (e) => {
      pointerAim(e.clientX, e.clientY, window.innerWidth, window.innerHeight, at);
      play.aim('pointer', at.x, at.y);
    };
    const press = (e) => {
      if (e.button > 0) return;
      if (e.pointerType !== 'mouse') touching = true;
      aimAt(e);
      play.press();
    };
    const move = (e) => {
      if (e.pointerType === 'mouse' || touching) aimAt(e);
    };
    const release = (e) => {
      if (touching && e?.pointerType !== 'mouse') {
        touching = false;
        play.aim('pointer', 0, 0, false);
      }
      play.release();
    };
    const leave = (e) => {
      if (!e.relatedTarget && e.pointerType === 'mouse') play.aim('pointer', 0, 0, false);
    };
    const base = { beta: null, gamma: null };
    const tilt = { x: 0, y: 0 };
    const orient = (e) => {
      if (e.beta === null || e.gamma === null) return;
      const angle = window.screen?.orientation?.angle ?? window.orientation ?? 0;
      orientationAim(e.beta, e.gamma, angle, base, tilt);
      play.aim('motion', tilt.x, tilt.y);
    };
    const noMenu = (e) => e.preventDefault();
    root.addEventListener('pointerdown', press);
    root.addEventListener('contextmenu', noMenu);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerout', leave);
    window.addEventListener('pointerup', release);
    window.addEventListener('pointercancel', release);
    window.addEventListener('blur', release);
    window.addEventListener('deviceorientation', orient);
    return () => {
      playRef.current = null;
      root.removeEventListener('pointerdown', press);
      root.removeEventListener('contextmenu', noMenu);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerout', leave);
      window.removeEventListener('pointerup', release);
      window.removeEventListener('pointercancel', release);
      window.removeEventListener('blur', release);
      window.removeEventListener('deviceorientation', orient);
    };
  }, []);

  // `wl-live` holds the scene still and hidden until LoadingPortal has drawn
  // the portals once and adds `wl-ready`; the portals then run off the fall's
  // own clock, so they stay in step with the cube.
  return (
    <>
      <LoadingPortal
        sceneRef={sceneRef}
        fallRef={fallRef}
        wellRef={wellRef}
        topRef={topRef}
        playRef={playRef}
        translucent={translucent}
      />
      <div className="wl-scene wl-live" ref={sceneRef}>
        <div className="wl-well" ref={topRef} />
        <div className="wl-gap" />
        <div className="wl-well" ref={wellRef}>
          <i className="wl-shadow" />
          <i className="wl-shock" />
        </div>
        {/* The cube and its twin one drop below: as the one goes into the
            paper, the other is the same cube coming out of the portal above. */}
        <div className="wl-shaft" style={SHAFT_STYLE}>
          <div className="wl-fall" ref={fallRef}>
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
      {/* Speed lines round the shaft while diving. */}
      <i className="wl-veil" ref={veilRef} aria-hidden="true" />
      {/* MOBI's company. Decorative: the status line is what the cover announces. */}
      <div className="wl-mobi" aria-hidden="true">
        <span className="wl-mobi-face" style={MOBI_STYLE}>
          <b className="wl-loops" ref={badgeRef} />
        </span>
        <span className="wl-mobi-say">
          <span className="wl-mobi-name">MOBI</span>
          <span className="wl-mobi-line" ref={lineRef} />
        </span>
      </div>
    </>
  );
}
