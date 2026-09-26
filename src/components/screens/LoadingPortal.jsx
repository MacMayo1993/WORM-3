// src/components/screens/LoadingPortal.jsx
/**
 * LoadingPortal — the loading screen's paper, and the wormhole spinning in it.
 *
 * Two full-screen 2D canvases (NOT WebGL: the app's single R3F canvas owns the
 * only WebGL context). The lower one draws the opening's cream graph paper line
 * for line — the same squares and the same breathing waves MenuPaperBackdrop's
 * shader bends (utils/paperGrid.js) — dragged down into the mouth under the cube.
 * The upper one draws the spinning funnel: a Rubik-coloured lip, the grid swirling
 * in, sticker confetti falling through, and a worm riding the vortex out of the
 * throat and back.
 *
 * The mouth sits wherever LoadingScene's `.wl-well` element is, so the cube's
 * CSS shadow and landing ring always line up with it. Time is measured from
 * `startedAt`, the moment the cube's CSS animations began, so the vortex kicks as
 * the cube lands. The RAF loop is torn down on unmount; reduced motion draws a
 * still frame on a flat, unmoving sheet.
 */

import React, { useEffect, useRef } from 'react';
import { RUBIKS_FACE_COLORS } from '../../utils/constants.js';
import { prefersReducedMotion } from '../../utils/device.js';
import { PAPER_GRID as P, paperRgb, paperShiftX, paperShiftY } from '../../utils/paperGrid.js';
import {
  MOTE_COUNT,
  THROAT,
  WORM_SEGMENTS,
  funnelPoint,
  funnelRadius,
  funnelSink,
  landingPulse,
  landings,
  lensPaperPoint,
  mote,
  spinAngle,
  wormPose
} from './loadingWormhole.js';

const TAU = Math.PI * 2;
const INK = '#26372d';
const DEEP = '#101729'; // the dark inset of the opening's tunnel mouths
const RIM_ORDER = [1, 4, 6, 2, 5, 3]; // red, orange, yellow, green, blue, white
const ARMS = 12;
const SWIRL = 2.6; // how far an arm winds between rim and throat, radians
const RIM = 0.045; // half the lip's width, as a fraction of the mouth
const STILL_TIME = 2.8; // the reduced-motion frame: settled, worm half out
const PAPER_INTERVAL = 30; // ms between paper redraws: every other frame at 60Hz

const rgbOf = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const FACE_RGB = Object.fromEntries(Object.entries(RUBIKS_FACE_COLORS).map(([id, hex]) => [id, rgbOf(hex)]));
const LINE_RGB = P.line.map((v) => Math.round(v * 255)).join(',');
const rgba = (rgb, a) => `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${a})`;
const shade = (rgb, k) => rgb.map((v) => Math.round(k > 0 ? v + (255 - v) * k : v * (1 + k)));
const mixRgb = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
const clamp01 = (v) => Math.max(0, Math.min(1, v));

// Walk from `start` to `end`, stepping finely through [fineStart, fineEnd]
// where the wormhole bends the lines and coarsely everywhere else.
function eachSample(start, end, fineStart, fineEnd, visit) {
  const coarse = 32;
  const fine = 7;
  for (let v = start; ; ) {
    visit(v);
    if (v >= end) return;
    v = Math.min(end, v + (v >= fineStart - coarse && v <= fineEnd ? fine : coarse));
  }
}

// ── The paper ────────────────────────────────────────────────────────────────
function drawPaper(ctx, W, H, t, motion, well, pulse, opacity, dpr) {
  ctx.save();
  ctx.globalAlpha = opacity;
  // The shader's highlight is measured in uv, so its falloff stretches with the screen.
  ctx.translate(W * P.highlight[0], H * (1 - P.highlight[1]));
  ctx.scale(W, H);
  const paper = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
  paper.addColorStop(0, paperRgb(P.paperCentre));
  paper.addColorStop(1, paperRgb(P.paperEdge));
  ctx.fillStyle = paper;
  ctx.fillRect(-P.highlight[0], P.highlight[1] - 1, 1, 1);
  ctx.restore();
  if (!well) return;

  // The paper sags toward the mouth: a soft ink shade that deepens at the rim.
  ctx.save();
  ctx.translate(well.cx, well.cy);
  ctx.scale(well.a, well.b);
  const sag = ctx.createRadialGradient(0, 0, 0.95, 0, 0, 1.8);
  sag.addColorStop(0, 'rgba(38,55,45,0.16)');
  sag.addColorStop(1, 'rgba(38,55,45,0)');
  ctx.fillStyle = sag;
  ctx.fillRect(-2.3, -2.3, 4.6, 4.6);
  ctx.restore();

  // The grid, bent by the backdrop's waves and then dragged into the mouth.
  const cell = H / P.rows;
  const slack = P.bend + P.drift + 1;
  const fineX = 2 * well.a;
  const fineY = 2 * well.b;
  const at = { x: 0, y: 0 };
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, W, H);
  ctx.ellipse(well.cx, well.cy, well.a, well.b, 0, 0, TAU);
  ctx.clip('evenodd');
  ctx.beginPath();
  for (let n = Math.floor(-slack); n <= Math.ceil(W / cell + slack); n++) {
    const near = Math.abs(n * cell - well.cx) < fineX + slack * cell;
    let first = true;
    eachSample(-cell, H + cell, near ? well.cy - fineY : Infinity, well.cy + fineY, (y) => {
      const x = (n - motion * paperShiftX((H - y) / cell, t)) * cell;
      lensPaperPoint(well, x, y, pulse, at);
      if (first) ctx.moveTo(at.x, at.y);
      else ctx.lineTo(at.x, at.y);
      first = false;
    });
  }
  for (let m = Math.floor(-slack); m <= Math.ceil(H / cell + slack); m++) {
    const near = Math.abs(H - m * cell - well.cy) < fineY + slack * cell;
    let first = true;
    eachSample(-cell, W + cell, near ? well.cx - fineX : Infinity, well.cx + fineX, (x) => {
      const y = H - (m - motion * paperShiftY(x / cell, t)) * cell;
      lensPaperPoint(well, x, y, pulse, at);
      if (first) ctx.moveTo(at.x, at.y);
      else ctx.lineTo(at.x, at.y);
      first = false;
    });
  }
  // The shader's antialiased line covers about one device pixel.
  ctx.lineWidth = 1 / dpr;
  ctx.strokeStyle = `rgba(${LINE_RGB},${P.lineMix})`;
  ctx.stroke();
  ctx.restore();
}

// ── Sticker confetti ─────────────────────────────────────────────────────────
function drawMote(ctx, x, y, size, spin, rgb, alpha) {
  if (alpha <= 0.01 || size <= 0.4) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.scale(1, 0.72); // lying on the paper, seen at the same slant as the mouth
  ctx.rotate(spin);
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(-size / 2, -size / 2, size, size, size * 0.24);
  else ctx.rect(-size / 2, -size / 2, size, size);
  ctx.fillStyle = rgba(rgb, 1);
  ctx.fill();
  ctx.lineWidth = Math.max(0.8, size * 0.12);
  ctx.strokeStyle = 'rgba(16,23,41,0.7)';
  ctx.stroke();
  ctx.restore();
}

function drawMotes(ctx, well, t, outside) {
  const at = {};
  for (let i = 0; i < MOTE_COUNT; i++) {
    const m = mote(i, t);
    if (m.outside !== outside) continue;
    const base = well.a * (0.034 + 0.018 * ((i * 0.37) % 1));
    if (outside) {
      drawMote(
        ctx,
        well.cx + Math.cos(m.angle) * m.rho * well.a,
        well.cy + Math.sin(m.angle) * m.rho * well.b,
        base,
        m.spin,
        FACE_RGB[m.color],
        m.alpha
      );
    } else {
      funnelPoint(well, m.s, m.angle, at);
      const fade = m.alpha * (1 - clamp01((m.s - 0.8) / 0.2));
      drawMote(ctx, at.x, at.y, base * at.r, m.spin, shade(FACE_RGB[m.color], -0.45 * m.s), fade);
    }
  }
}

// ── The worm riding the vortex ───────────────────────────────────────────────
function drawWorm(ctx, well, t) {
  const { colors, segments } = wormPose(t);
  if (segments[0].s >= 0.99) return;
  const head = FACE_RGB[colors[0]];
  const tail = FACE_RGB[colors[1]];
  const points = segments.map((seg) => funnelPoint(well, seg.s, seg.angle, {}));
  const radius = (j) => {
    const emerge = clamp01((1 - segments[j].s) / 0.1);
    return well.a * 0.058 * points[j].r * (1 - (0.4 * j) / WORM_SEGMENTS) * emerge;
  };
  for (let j = WORM_SEGMENTS - 1; j >= 0; j--) {
    const R = radius(j);
    if (R < 0.5) continue;
    const { x, y } = points[j];
    // Deeper segments sink into the throat's shadow.
    const body = shade(mixRgb(head, tail, j / (WORM_SEGMENTS - 1)), -0.5 * clamp01((segments[j].s - 0.5) / 0.5));
    const gloss = ctx.createRadialGradient(x - R * 0.35, y - R * 0.42, R * 0.08, x, y, R);
    gloss.addColorStop(0, rgba(shade(body, 0.6), 1));
    gloss.addColorStop(0.55, rgba(body, 1));
    gloss.addColorStop(1, rgba(shade(body, -0.35), 1));
    ctx.beginPath();
    ctx.arc(x, y, R, 0, TAU);
    ctx.fillStyle = gloss;
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(16,23,41,0.5)';
    ctx.stroke();
  }
  // Eyes look the way the head is going, as on the opening's worms.
  const R = radius(0);
  if (R < 2) return;
  let dx = points[0].x - points[1].x;
  let dy = points[0].y - points[1].y;
  const len = Math.hypot(dx, dy) || 1;
  dx /= len;
  dy /= len;
  for (const side of [-1, 1]) {
    const ex = points[0].x - dy * side * R * 0.42 + dx * R * 0.3;
    const ey = points[0].y + dx * side * R * 0.42 + dy * R * 0.3 - R * 0.28;
    ctx.beginPath();
    ctx.arc(ex, ey, R * 0.34, 0, TAU);
    ctx.fillStyle = '#fffdf2';
    ctx.fill();
    ctx.lineWidth = 0.8;
    ctx.strokeStyle = DEEP;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(ex + dx * R * 0.13, ey + dy * R * 0.13, R * 0.17, 0, TAU);
    ctx.fillStyle = DEEP;
    ctx.fill();
  }
}

// ── The funnel ───────────────────────────────────────────────────────────────
function drawFunnel(ctx, well, t, spin, pulse) {
  const { cx, cy, a, b } = well;
  const throatY = cy + funnelSink(1) * b;
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(cx, cy, a, b, 0, 0, TAU);
  ctx.clip();

  // The wall darkens as it falls away from the light toward the throat.
  ctx.save();
  ctx.translate(cx, throatY);
  ctx.scale(1, b / a);
  const wall = ctx.createRadialGradient(0, 0, 0, 0, 0, a * 1.3);
  wall.addColorStop(0, DEEP);
  wall.addColorStop(THROAT * 0.8, DEEP);
  wall.addColorStop(0.4, '#2f3a44');
  wall.addColorStop(0.72, '#8f9486');
  wall.addColorStop(1, '#d9d3bf');
  ctx.fillStyle = wall;
  ctx.fillRect(-a * 1.4, -a * 3, a * 2.8, a * 6);
  ctx.restore();

  // The paper's grid carries on down the wall as rings and spiral arms.
  const at = {};
  for (let k = 1; k <= 7; k++) {
    const s = k / 8;
    const r = funnelRadius(s);
    ctx.beginPath();
    ctx.ellipse(cx, cy + funnelSink(s) * b, r * a, r * b, 0, 0, TAU);
    ctx.lineWidth = 1;
    ctx.strokeStyle = s < 0.45 ? `rgba(${LINE_RGB},0.55)` : `rgba(236,232,214,${0.1 + 0.18 * (1 - s)})`;
    ctx.stroke();
  }
  for (let i = 0; i < ARMS; i++) {
    const coloured = i % 2 === 0;
    const rgb = coloured ? FACE_RGB[RIM_ORDER[(i / 2) % RIM_ORDER.length]] : [236, 232, 214];
    const base = spin + (i * TAU) / ARMS;
    for (const [from, to, width] of [
      [0, 0.5, coloured ? 2.4 : 1.2],
      [0.5, 1, coloured ? 1.5 : 0.8]
    ]) {
      ctx.beginPath();
      for (let step = 0; step <= 12; step++) {
        const s = from + ((to - from) * step) / 12;
        funnelPoint(well, s, base + SWIRL * Math.pow(s, 1.2), at);
        if (step === 0) ctx.moveTo(at.x, at.y);
        else ctx.lineTo(at.x, at.y);
      }
      ctx.lineWidth = width * (a / 200);
      ctx.strokeStyle = rgba(rgb, coloured ? 0.85 : 0.3);
      ctx.stroke();
    }
  }

  drawMotes(ctx, well, t, false);

  // The throat, ringed in the colour of the cube's last landing, with a glint
  // of the far side — where everything that falls in comes out antipodal.
  const glow = FACE_RGB[RIM_ORDER[landings(t) % RIM_ORDER.length]];
  ctx.beginPath();
  ctx.ellipse(cx, throatY, THROAT * a, THROAT * b, 0, 0, TAU);
  ctx.fillStyle = DEEP;
  ctx.fill();
  ctx.lineWidth = 2 + 2 * pulse;
  ctx.strokeStyle = rgba(glow, 0.6 + 0.4 * pulse);
  ctx.stroke();
  ctx.save();
  ctx.translate(cx, throatY);
  ctx.scale(1, b / a);
  const far = ctx.createRadialGradient(0, 0, 0, 0, 0, THROAT * a * 0.8);
  far.addColorStop(0, rgba(shade(glow, 0.7), 0.55 + 0.4 * pulse));
  far.addColorStop(1, rgba(glow, 0));
  ctx.fillStyle = far;
  ctx.fillRect(-THROAT * a, -THROAT * a, THROAT * a * 2, THROAT * a * 2);
  ctx.restore();

  drawWorm(ctx, well, t);

  // The lip shades the top of the wall.
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(1, b / a);
  const lip = ctx.createRadialGradient(0, 0, a * 0.78, 0, 0, a);
  lip.addColorStop(0, 'rgba(16,23,41,0)');
  lip.addColorStop(1, 'rgba(16,23,41,0.38)');
  ctx.fillStyle = lip;
  ctx.fillRect(-a, -a, a * 2, a * 2);
  ctx.restore();
  ctx.restore();
}

// ── The lip: a toy-bright ring of the six sticker colours, turning with the vortex
function drawRim(ctx, well, spin, pulse) {
  const { cx, cy, a, b } = well;
  const outer = [a * (1 + RIM), b * (1 + RIM)];
  const inner = [a * (1 - RIM), b * (1 - RIM)];
  const turn = spin * 0.4;
  const segments = RIM_ORDER.length * 2;
  for (let k = 0; k < segments; k++) {
    const from = turn + (k * TAU) / segments;
    const to = from + TAU / segments + 0.004;
    ctx.beginPath();
    ctx.ellipse(cx, cy, outer[0], outer[1], 0, from, to);
    ctx.ellipse(cx, cy, inner[0], inner[1], 0, to, from, true);
    ctx.closePath();
    ctx.fillStyle = RUBIKS_FACE_COLORS[RIM_ORDER[k % RIM_ORDER.length]];
    ctx.fill();
  }
  // Gloss along the top of the lip, flaring when the cube lands.
  ctx.beginPath();
  ctx.ellipse(cx, cy - RIM * b * 0.25, a, b, 0, 0, TAU);
  ctx.lineWidth = Math.max(1.5, RIM * b * 0.7);
  ctx.strokeStyle = `rgba(255,255,255,${0.35 + 0.45 * pulse})`;
  ctx.stroke();
  ctx.lineWidth = 2;
  ctx.strokeStyle = INK;
  for (const [rx, ry] of [outer, inner]) {
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, TAU);
    ctx.stroke();
  }
}

export default function LoadingPortal({ wellRef, startedAt, translucent = false }) {
  const paperRef = useRef(null);
  const vortexRef = useRef(null);

  useEffect(() => {
    const paperCanvas = paperRef.current;
    const canvas = vortexRef.current;
    const paper = paperCanvas?.getContext('2d');
    const ctx = canvas?.getContext('2d');
    if (!paper || !ctx) return undefined;
    const reduced = prefersReducedMotion();
    let W = 0;
    let H = 0;
    let dpr = 1;
    let raf = 0;
    // The paper drifts a few pixels a second, so it lives on its own canvas and
    // is redrawn at half rate (or at once when the mouth moves); only the vortex
    // above it is drawn every frame.
    let paperAt = -Infinity;
    let paperKey = '';

    const measureWell = () => {
      const rect = wellRef?.current?.getBoundingClientRect();
      if (!rect?.width) return null;
      const box = canvas.getBoundingClientRect();
      return { cx: rect.left - box.left + rect.width / 2, cy: rect.top - box.top + rect.height / 2, a: rect.width / 2, b: rect.height / 2 };
    };

    const draw = (t, now) => {
      if (!W || !H) return;
      const well = measureWell();
      const pulse = reduced ? 0 : landingPulse(t);
      const key = well ? `${Math.round(well.cx)},${Math.round(well.cy)},${Math.round(well.a)}` : '';
      if (key !== paperKey || now - paperAt >= PAPER_INTERVAL) {
        paper.setTransform(dpr, 0, 0, dpr, 0, 0);
        paper.clearRect(0, 0, W, H);
        drawPaper(paper, W, H, t, reduced ? 0 : 1, well, pulse, translucent ? 0.84 : 1, dpr);
        paperAt = now;
        paperKey = key;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      if (!well) return;
      const spin = spinAngle(t);
      drawFunnel(ctx, well, t, spin, pulse);
      drawRim(ctx, well, spin, pulse);
      drawMotes(ctx, well, t, true);
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      dpr = Math.min(2, window.devicePixelRatio || 1);
      W = rect.width;
      H = rect.height;
      paperCanvas.width = canvas.width = Math.max(1, Math.round(W * dpr));
      paperCanvas.height = canvas.height = Math.max(1, Math.round(H * dpr));
      paperKey = null; // resizing blanked the paper
      if (reduced) draw(STILL_TIME, performance.now());
    };
    resize();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(resize);
    observer?.observe(canvas);
    if (!observer) window.addEventListener('resize', resize);

    let still = 0;
    if (reduced) {
      // One still frame, redrawn now and then in case late webfonts move the well.
      still = window.setInterval(() => draw(STILL_TIME, performance.now()), 500);
    } else {
      const frame = (now) => {
        if (!document.hidden) draw((now - startedAt) / 1000, now);
        raf = requestAnimationFrame(frame);
      };
      raf = requestAnimationFrame(frame);
    }
    return () => {
      cancelAnimationFrame(raf);
      window.clearInterval(still);
      observer?.disconnect();
      if (!observer) window.removeEventListener('resize', resize);
    };
  }, [wellRef, startedAt, translucent]);

  return (
    <>
      <canvas ref={paperRef} className="wl-backdrop" aria-hidden="true" />
      <canvas ref={vortexRef} className="wl-backdrop" aria-hidden="true" />
    </>
  );
}
