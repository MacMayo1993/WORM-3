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
 * It is also a toy (loadingPlay.js): holding anywhere dives faster
 * (every animation and both canvases
 * speed up together, with speed lines round the shaft), a tap kicks the cube
 * into a spin and rings both portals, and MOBI keeps count of the loops with a
 * line every couple of them. The view tilts with the mouse, a finger held on
 * the cover, or a phone's own tilt (where the browser offers it without a
 * permission prompt): the scene slides over the paper and the cube turns.
 *
 * Lazy-loaded by LoadingScreen, with its stylesheet, to keep both off the
 * initial route; preloadAssets.js warms the chunk during the opening.
 */

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { RUBIKS_FACE_COLORS } from '../../utils/constants.js';
import { CUBE_YAW, LOADING_CUBE } from './loadingCube.js';
import { EXIT_RIM_DEPTH, LOADING_START_PHASE, shaftClipPath, shaftFadeMask } from './loadingWormhole.js';
import { createLoadingPlay, openingLine, orientationAim, pointerAim } from './loadingPlay.js';
import { prefersReducedMotion } from '../../utils/device.js';
import LoadingPortal from './LoadingPortal.jsx';
import { RING_COLORS, RING_SECONDS, TUNNEL_RINGS, stormLayout } from './loadingDepths.js';
import './LoadingScene.css';

function Face({ face }) {
  const cls = `wl-face wl-sticker-bed wl-${face.side}${face.cap ? ' wl-cap' : ''}`;
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
  return (
    <div className="wl-airflow" aria-hidden="true">
      {AIR_STREAMS.map((stream, i) => (
        <i
          key={i}
          className="wl-air-streak"
          style={{
            left: stream.x,
            height: stream.length,
            animationDelay: stream.delay,
            '--wl-air-drift': stream.drift
          }}
        />
      ))}
      <i className="wl-air-wake wl-air-wake-left" />
      <i className="wl-air-wake wl-air-wake-right" />
    </div>
  );
});

// The tunnel the cube falls down (loadingDepths.js).
const Tunnel = React.memo(function Tunnel() {
  return (
    <div className="wl-tunnel" aria-hidden="true">
      {Array.from({ length: TUNNEL_RINGS }, (_, i) => (
        <i
          key={i}
          className="wl-ring"
          style={{
            '--wl-ring-c': `var(--wl-${RING_COLORS[i % RING_COLORS.length]})`,
            animationDelay: `${(-(i * RING_SECONDS) / TUNNEL_RINGS).toFixed(3)}s`
          }}
        />
      ))}
    </div>
  );
});

// The sticker storm (loadingDepths.js), laid out once.
const STORM = stormLayout();

const Storm = React.memo(function Storm({ near }) {
  return (
    <div className={`wl-storm${near ? ' wl-storm-near' : ''}`} aria-hidden="true">
      {STORM.filter((layer) => (layer.depth === 'near') === near).map((layer) =>
        layer.chips.map((chip) => (
          <i
            key={chip.key}
            className={`wl-chip wl-chip-${layer.depth}`}
            style={{
              left: `${chip.x}%`,
              '--wl-chip': `calc(var(--wl-cube) * ${layer.size})`,
              '--wl-chip-c': `var(--wl-${chip.color})`,
              '--wl-tz': `${chip.tz}deg`,
              '--wl-tx': `${chip.tx}deg`,
              '--wl-sway': `${chip.sway}px`,
              '--wl-y': chip.y,
              opacity: layer.opacity,
              animationDuration: `${layer.seconds}s`,
              animationDelay: `${chip.delay}s`
            }}
          />
        ))
      )}
    </div>
  );
});

// Between the two portals' near lips, fading into the floor portal's throat.
const SHAFT_MASK = shaftFadeMask();
const SHAFT_STYLE = { clipPath: shaftClipPath(), maskImage: SHAFT_MASK, WebkitMaskImage: SHAFT_MASK };
const SCENE_STYLE = { '--wl-exit-rim': EXIT_RIM_DEPTH, '--wl-start-phase': `${LOADING_START_PHASE}s` };
const MOBI_STYLE = { '--wl-mobi': `url("${import.meta.env.BASE_URL}Mobi.webp")` };

export default function LoadingScene({ translucent = false, onAnimationStart }) {
  const sceneRef = useRef(null);
  const fallRef = useRef(null);
  const wellRef = useRef(null);
  const topRef = useRef(null);
  const lineRef = useRef(null);
  const badgeRef = useRef(null);
  const playRef = useRef(null);
  const veilRef = useRef(null);
  const nameRef = useRef(null);
  const clockRef = useRef(null);
  const backRef = useRef(null);
  const nearRef = useRef(null);
  // MOBI's first line is rendered with the cover, so it is there in the first
  // paint even if the main thread then stalls before any frame callback runs.
  const [opening] = useState(() => openingLine(prefersReducedMotion()));

  useLayoutEffect(() => {
    onAnimationStart?.();
  }, [onAnimationStart]);

  // The toy: a press dives and kicks, letting go (anywhere) eases off. The whole
  // cover is the touch surface; nothing here sets React state.
  useEffect(() => {
    const scene = sceneRef.current;
    const root = scene?.parentElement;
    if (!scene || !root) return undefined;
    const play = createLoadingPlay({
      scene,
      layers: [backRef.current, nearRef.current],
      veil: veilRef.current,
      line: lineRef.current,
      badge: badgeRef.current,
      name: nameRef.current,
      clock: clockRef.current,
      opening,
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
  }, [opening]);

  // Where the shaft sits on the cover, for the tunnel's centre and the exit's
  // zoom (LoadingScene.css). Read on layout changes only.
  useEffect(() => {
    const scene = sceneRef.current;
    const root = scene?.parentElement;
    if (!scene || !root) return undefined;
    const place = () => {
      const s = scene.getBoundingClientRect();
      const r = root.getBoundingClientRect();
      root.style.setProperty('--wl-sx', `${(s.left + s.width / 2 - r.left).toFixed(1)}px`);
      root.style.setProperty('--wl-sy', `${(s.top + s.height / 2 - r.top).toFixed(1)}px`);
    };
    place();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(place);
    observer?.observe(root);
    observer?.observe(scene);
    if (!observer) window.addEventListener('resize', place);
    return () => {
      observer?.disconnect();
      if (!observer) window.removeEventListener('resize', place);
    };
  }, []);

  // The cubes fall on the compositor, without waiting for the canvases to paint.
  // CSS stand-ins hold the mouths' places until LoadingPortal adds `wl-ready`.
  return (
    <>
      <LoadingPortal sceneRef={sceneRef} fallRef={fallRef} wellRef={wellRef} topRef={topRef} playRef={playRef} translucent={translucent}>
        <div className="wl-depths" ref={backRef}>
          <Tunnel />
          <Storm near={false} />
        </div>
      </LoadingPortal>
      <div className="wl-scene" ref={sceneRef} style={SCENE_STYLE}>
        <div className="wl-well" ref={topRef} />
        <div className="wl-gap" />
        <div className="wl-well" ref={wellRef}>
          <i className="wl-shadow" />
          <i className="wl-shock" />
        </div>
        {/* Stagger two full trips. As one sinks into the floor the other
            emerges above; neither is visible when its own animation wraps. */}
        <div className="wl-shaft" style={SHAFT_STYLE}>
          <div className="wl-fall" ref={fallRef}>
            <div className="wl-view">
              <Airflow />
              <Cube />
            </div>
          </div>
          <div className="wl-fall wl-twin">
            <div className="wl-view">
              <Airflow />
              <Cube />
            </div>
          </div>
        </div>
      </div>
      {/* The nearest stickers fly past in front of the scene, at the sides. */}
      <div className="wl-depths wl-depths-near" ref={nearRef}>
        <Storm near />
      </div>
      {/* Speed lines round the shaft while diving. */}
      <i className="wl-veil" ref={veilRef} aria-hidden="true" />
      {/* MOBI's company. Decorative: the status line is what the cover announces. */}
      <div className="wl-mobi" aria-hidden="true">
        <span className="wl-mobi-face" style={MOBI_STYLE}>
          <b className="wl-loops" ref={badgeRef} />
        </span>
        <span className="wl-mobi-say">
          <span className="wl-mobi-name" ref={nameRef}>
            {opening.kind === 'tip' ? 'MOBI · TIP' : 'MOBI'}
          </span>
          <span className="wl-mobi-line" ref={lineRef}>
            {opening.text}
          </span>
          {/* Runs down until MOBI's next line. */}
          <span className="wl-mobi-clock" ref={clockRef} />
        </span>
      </div>
    </>
  );
}
