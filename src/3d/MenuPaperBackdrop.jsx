import React, { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { PAPER_GRID as P, glslFloat as f, glslVec3 } from '../utils/paperGrid.js';
import { prefersReducedMotion } from '../utils/device.js';
import { getCarouselTheme, getCarouselFace, getCarouselCubeFrame, getModeDiveState, isCarouselActive } from '../components/menus/menuCarouselState.js';
import { menuLeanInto } from '../components/menus/menuPointer.js';
import { lightSweepAt } from '../components/menus/menuLightSweep.js';
import { DIVE_TOTAL } from '../components/menus/menuDiveLeap.js';
import { PAPER_FX as FX, carouselPaperLayoutInto, paintDoodles, paperTintInto } from '../components/menus/carouselPaper.js';

// The paper's numbers live in PAPER_GRID, which the loading screen also draws its
// 2D-canvas copy of this sheet from: tune them there and both stay one paper.
//
// The opening draws the plain sheet. The mode carousel (`carousel`) compiles a
// second program on the same shader (CAROUSEL) that makes the paper answer the
// screen: it glows in the presented mode's colour, dips round the cube, ripples
// when a swipe turns it, swirls into the PLAY dive, slides against the
// pointer's lean, catches the cube's light sweep, greys out for a locked mode,
// carries that mode's ink doodles in its margins, and has a doodle worm walking
// one of its lines. Everything is in this one quad; nothing new is drawn.
const fragmentShader = `varying vec2 paperUv;
        uniform float aspect;
        uniform float time;
        uniform float motion;
        #ifdef CAROUSEL
        uniform vec3 uCube;       // cube centre (x, y) and radius, in paper heights
        uniform vec3 uTint;
        uniform float uTintAmt;
        uniform vec2 uRipple;     // start (paper time), strength
        uniform float uDive;      // 0…1 through the PLAY dive
        uniform vec2 uLean;
        uniform float uLock;      // 0…1 a locked mode
        uniform vec2 uSheen;      // across (-1…1), strength
        uniform sampler2D uDoodle;
        uniform vec4 uDoodleAt;   // left anchor xy, right anchor xy
        uniform float uDoodleSize;
        uniform float uDoodleAlpha;
        uniform float uWormRow;
        uniform float uWormT;

        float paperHash(vec2 q) { return fract(sin(dot(q, vec2(127.1, 311.7))) * 43758.5453); }
        float paperNoise(vec2 q) {
          vec2 i = floor(q), u = fract(q);
          u = u * u * (3.0 - 2.0 * u);
          return mix(mix(paperHash(i), paperHash(i + vec2(1.0, 0.0)), u.x),
                     mix(paperHash(i + vec2(0.0, 1.0)), paperHash(i + vec2(1.0, 1.0)), u.x), u.y);
        }
        vec4 doodleAt(vec2 q, vec2 anchor, float slot) {
          vec2 local = (q - anchor) / uDoodleSize + 0.5;
          if (local.x < 0.0 || local.x > 1.0 || local.y < 0.0 || local.y > 1.0) return vec4(0.0);
          return texture2D(uDoodle, vec2((local.x + slot) * 0.5, local.y));
        }
        // One bead of the doodle worm: an ink ring round a pale fill.
        void wormBead(inout vec3 color, vec2 g, vec2 at, float radius, float aa, float keep) {
          float dd = length(g - at);
          float fill = 1.0 - smoothstep(radius - aa, radius + aa, dd);
          float ring = 1.0 - smoothstep(0.06 - aa, 0.06 + aa, abs(dd - radius));
          color = mix(color, vec3(0.86, 0.95, 0.84), fill * 0.9 * keep);
          color = mix(color, vec3(0.18, 0.29, 0.22), ring * 0.85 * keep);
        }
        #endif
        void main() {
          vec2 page = paperUv * vec2(aspect, 1.0);
          #ifdef CAROUSEL
          // Parallax: the sheet slides against the cube's lean.
          page -= uLean * ${f(FX.lean)};
          vec2 flat_ = page;
          vec2 c = uCube.xy;
          float r = max(uCube.z, 1e-3);
          vec2 d = page - c;
          float dist = length(d);
          vec2 dir = d / max(dist, 1e-4);
          // The paper dips round the cube: its lines are drawn in toward it.
          float well = exp(-pow(dist / (r * 1.6), 2.0));
          page = c + d * (1.0 + ${f(FX.well)} * well);
          // A swipe sends a ring out across the sheet.
          float rt = time - uRipple.x;
          float rippleShade = 0.0;
          if (rt > 0.0 && rt < ${f(FX.rippleLife)}) {
            float ring = r * 0.9 + rt * ${f(FX.rippleSpeed)};
            float band = exp(-pow((dist - ring) / 0.06, 2.0));
            rippleShade = band * (1.0 - rt / ${f(FX.rippleLife)}) * uRipple.y;
            page += dir * rippleShade * 0.042;
          }
          // PLAY: the sheet swirls and is drawn into the cube.
          if (uDive > 0.0) {
            float twist = uDive * uDive * 9.0 * exp(-dist / (r * 2.2));
            float cs = cos(twist), sn = sin(twist);
            vec2 v = page - c;
            page = c + mat2(cs, sn, -sn, cs) * v * (1.0 + uDive * 1.6 * exp(-dist / (r * 3.0)));
          }
          #endif
          vec2 gridUv = page * ${f(P.rows)};
          // Broad waves bend the grid by just over half a square, cycling
          // every 14–17 seconds so the motion reads within a glance on phones.
          // Opposing phases create a breathing-paper illusion, with
          // a single antialiased grid to avoid moire or flickering overlaps.
          vec2 wave = vec2(
            sin(gridUv.y * ${f(P.bendFreqY)} + time * ${f(P.bendSpeedY)}),
            sin(gridUv.x * ${f(P.bendFreqX)} - time * ${f(P.bendSpeedX)})
          );
          gridUv += motion * (wave * ${f(P.bend)} + vec2(
            sin(time * ${f(P.driftSpeedX)}), cos(time * ${f(P.driftSpeedY)})
          ) * ${f(P.drift)});
          vec2 line = abs(fract(gridUv - 0.5) - 0.5) / fwidth(gridUv);
          float grid = 1.0 - min(min(line.x, line.y), 1.0);
          vec3 paper = mix(${glslVec3(P.paperEdge)}, ${glslVec3(P.paperCentre)}, 1.0 - distance(paperUv, vec2(${P.highlight.map(f).join(', ')})));
          vec3 ink = ${glslVec3(P.line)};
          #ifdef CAROUSEL
          // Paper, not plastic: fibres and the odd speck, and a darker edge.
          float fibre = paperNoise(vec2(paperUv.x * aspect * 340.0, paperUv.y * 46.0));
          float speck = step(0.995, paperHash(floor(paperUv * vec2(aspect, 1.0) * 260.0)));
          paper *= 0.985 + 0.03 * fibre - 0.05 * speck;
          paper *= 1.0 - 0.09 * smoothstep(0.38, 0.78, distance(paperUv, vec2(0.5)));
          // The presented mode's colour glows round the cube, and tints its lines.
          float glow = uTintAmt * exp(-pow(dist / (r * 2.7), 2.0));
          paper = mix(paper, mix(paper, uTint, 0.42) + uTint * 0.06, glow * ${f(FX.tint)});
          ink = mix(ink, uTint * 0.62, glow * 0.6);
          // The cube's light sweep crosses the sheet at the same moment.
          float across = dot(flat_ - c, normalize(vec2(1.0, -0.45))) / (r * 2.4);
          paper += 0.05 * uSheen.y * exp(-pow((across - uSheen.x * 1.4) / 0.28, 2.0));
          #endif
          vec3 color = mix(paper, ink, grid * ${f(P.lineMix)});
          #ifdef CAROUSEL
          // The ripple's crest catches the light, its trough a shadow.
          color *= 1.0 + 0.05 * rippleShade;
          // The mode's doodles, inked in the margins (the right one is the
          // padlock stamp for a locked mode).
          // Everything drawn on the sheet fades as PLAY pulls it into the cube.
          float keep = 1.0 - smoothstep(0.0, 0.6, uDive);
          vec4 left = doodleAt(flat_, uDoodleAt.xy, 0.0) * keep;
          vec4 right = doodleAt(flat_, uDoodleAt.zw, 1.0) * keep;
          color = mix(color, left.rgb, left.a * uDoodleAlpha);
          color = mix(color, right.rgb, right.a * mix(uDoodleAlpha, 0.75, uLock));
          // The doodle worm, inching along a line of the grid it is drawn on.
          float aa = fwidth(gridUv.x) * 1.2;
          float span = aspect * ${f(P.rows)} + 10.0;
          float head = mod(uWormT * ${f(FX.wormSpeed)}, span) - 5.0;
          for (int k = 6; k >= 0; k--) {
            float fk = float(k);
            float inch = 0.12 * sin(uWormT * 4.0 - fk * 0.7);
            float radius = k == 0 ? 0.44 : 0.36 - fk * 0.02;
            vec2 at = vec2(head - fk * 0.5 + inch, uWormRow + radius + 0.04 + 0.08 * max(0.0, sin(uWormT * 4.0 - fk * 0.7)));
            wormBead(color, gridUv, at, radius, aa, keep);
          }
          float eye = 1.0 - smoothstep(0.07 - aa, 0.07 + aa, length(gridUv - vec2(head + 0.16 + 0.12 * sin(uWormT * 4.0), uWormRow + 0.6)));
          color = mix(color, vec3(0.1, 0.14, 0.11), eye * keep);
          // A locked mode's paper goes grey, under its stamp.
          float lum = dot(color, vec3(0.299, 0.587, 0.114));
          color = mix(color, vec3(lum) * 0.97, uLock * 0.75);
          color = mix(color, right.rgb, right.a * uLock * 0.75);
          #endif
          gl_FragColor = vec4(color, 1.0);
        }`;

const _center = new THREE.Vector3(), _edge = new THREE.Vector3(), _right = new THREE.Vector3();
const _tint = new THREE.Color();
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// The canvas the doodles are inked on: 2:1, two square slots.
function createDoodleCanvas() {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext?.('2d');
  return ctx ? { canvas, ctx } : null;
}

// A screen-aligned backdrop INSIDE the existing WebGL scene. The transparent
// carousel overlay never paints over the live cube. Grid density uses the
// viewport aspect, so it is stable on high-DPR phones too.
export default function MenuPaperBackdrop({ carousel = false }) {
  const size = useThree(state => state.size);
  const reducedMotion = useRef(true);
  const doodles = useMemo(() => {
    if (!carousel) return null;
    const surface = createDoodleCanvas();
    const texture = surface ? new THREE.CanvasTexture(surface.canvas) : new THREE.DataTexture(new Uint8Array(4), 1, 1);
    // The paper writes display colours straight out (no colour management), so
    // the ink is read as it was painted, not decoded from sRGB.
    texture.colorSpace = THREE.NoColorSpace;
    texture.needsUpdate = true;
    return { surface, texture, key: null, drawnAt: 0, progress: 1 };
  }, [carousel]);
  useEffect(() => () => doodles?.texture.dispose(), [doodles]);
  const uniforms = useMemo(() => ({
    aspect: { value: 1 },
    time: { value: 0 },
    motion: { value: 0 },
    ...(carousel ? {
      uCube: { value: new THREE.Vector3(0.5, 0.5, 0.25) },
      uTint: { value: new THREE.Color().setStyle('#2fa84f', THREE.LinearSRGBColorSpace) },
      uTintAmt: { value: 0 },
      uRipple: { value: new THREE.Vector2(-10, 0) },
      uDive: { value: 0 },
      uLean: { value: new THREE.Vector2() },
      uLock: { value: 0 },
      uSheen: { value: new THREE.Vector2() },
      uDoodle: { value: doodles.texture },
      uDoodleAt: { value: new THREE.Vector4() },
      uDoodleSize: { value: 0.2 },
      uDoodleAlpha: { value: FX.doodleAlpha },
      uWormRow: { value: 4 },
      // Starts a few squares onto the page, so the worm is there from the first look.
      uWormT: { value: 8 / FX.wormSpeed },
    } : {}),
  }), [carousel, doodles]);
  uniforms.aspect.value = size.width / Math.max(size.height, 1);
  const defines = useMemo(() => (carousel ? { CAROUSEL: 1 } : {}), [carousel]);
  const state = useMemo(() => ({ face: null, lean: { x: 0, y: 0 }, leanTarget: { x: 0, y: 0 }, layout: {}, cube: { x: 0.5, y: 0.5, r: 0.25 } }), []);

  useEffect(() => {
    const media = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const update = () => {
      reducedMotion.current = media?.matches ?? false;
      uniforms.motion.value = reducedMotion.current ? 0 : 1;
    };
    update();
    media?.addEventListener('change', update);
    return () => media?.removeEventListener('change', update);
  }, [uniforms]);

  useFrame((frame, delta) => {
    // Local time avoids a jump after the tab resumes. No React updates or
    // camera movement: only the paper coordinates drift inside the shader.
    const reduced = reducedMotion.current || prefersReducedMotion();
    const dt = Math.min(delta, 0.05);
    if (!reduced && !document.hidden) uniforms.time.value += dt;
    if (!carousel || !isCarouselActive()) return;
    const u = uniforms;
    const aspect = u.aspect.value;

    // Where the cube is on screen, in the paper's space (x in paper heights).
    const cube = getCarouselCubeFrame();
    if (cube.live) {
      _center.set(cube.x, cube.y, cube.z);
      _right.setFromMatrixColumn(frame.camera.matrixWorld, 0);
      _edge.copy(_center).addScaledVector(_right, cube.radius).project(frame.camera);
      _center.project(frame.camera);
      state.cube.x = (_center.x * 0.5 + 0.5) * aspect;
      state.cube.y = _center.y * 0.5 + 0.5;
      state.cube.r = Math.abs(_edge.x - _center.x) * 0.5 * aspect;
      u.uCube.value.set(state.cube.x, state.cube.y, state.cube.r);
    }
    carouselPaperLayoutInto(state.layout, state.cube, aspect, P.rows);
    u.uDoodleAt.value.set(state.layout.left.x, state.layout.left.y, state.layout.right.x, state.layout.right.y);
    u.uDoodleSize.value = state.layout.size;
    u.uWormRow.value = state.layout.wormRow;

    // The presented mode: its colour fades in, a new face sends a ripple out
    // and its doodles ink themselves in.
    const theme = getCarouselTheme();
    const ease = 1 - Math.exp(-FX.tintEase * dt);
    // Raw display values, like the rest of the paper (no sRGB decode).
    if (theme) u.uTint.value.lerp(paperTintInto(_tint, theme.color), reduced ? 1 : ease);
    u.uTintAmt.value += ((theme ? 1 : 0) - u.uTintAmt.value) * (reduced ? 1 : ease);
    u.uLock.value += ((theme?.locked ? 1 : 0) - u.uLock.value) * (reduced ? 1 : ease);
    // The ripple leaves with the cube's turn, not with the mode's details,
    // which the carousel commits a beat later.
    const face = getCarouselFace();
    if (face && face !== state.face) {
      if (state.face !== null && !reduced) u.uRipple.value.set(u.time.value, 1);
      state.face = face;
    }
    if (doodles?.surface) {
      const key = theme ? `${theme.face}|${theme.locked ? 1 : 0}` : null;
      if (key !== doodles.key) { doodles.key = key; doodles.drawnAt = frame.clock.elapsedTime; doodles.progress = -1; }
      const progress = reduced ? 1 : Math.min(1, (frame.clock.elapsedTime - doodles.drawnAt) / FX.drawSeconds);
      if (progress !== doodles.progress) {
        doodles.progress = progress;
        const { canvas, ctx } = doodles.surface;
        if (theme) paintDoodles(ctx, canvas.width, canvas.height, theme.face, progress, theme.locked);
        else ctx.clearRect(0, 0, canvas.width, canvas.height);
        doodles.texture.needsUpdate = true;
      }
    }

    // PLAY: the swirl follows the dive's own clock.
    const dive = getModeDiveState();
    u.uDive.value = dive && !dive.reduced ? smooth(0.05, DIVE_TOTAL, dive.t) : 0;

    // Lean, the light sweep and the doodle worm all rest under reduced motion.
    menuLeanInto(state.leanTarget);
    if (reduced) state.leanTarget.x = state.leanTarget.y = 0;
    const k = 1 - Math.exp(-3 * dt);
    state.lean.x += (state.leanTarget.x - state.lean.x) * k;
    state.lean.y += (state.leanTarget.y - state.lean.y) * k;
    u.uLean.value.set(state.lean.x, state.lean.y);
    const sweep = lightSweepAt(frame.clock.elapsedTime - 2.5);
    u.uSheen.value.set(sweep.x, reduced ? 0 : sweep.strength);
    if (!reduced && !document.hidden) u.uWormT.value += dt;
  });

  return <mesh frustumCulled={false} renderOrder={-0.5}>
    <planeGeometry args={[2, 2]} />
    <shaderMaterial depthWrite={false} toneMapped={false} uniforms={uniforms}
      defines={defines}
      vertexShader={`varying vec2 paperUv;
        void main() { paperUv = uv; gl_Position = vec4(position.xy, 0.999999, 1.0); }`}
      fragmentShader={fragmentShader}
      extensions={{ derivatives: true }} />
  </mesh>;
}
