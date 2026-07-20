// src/components/screens/LoadingPortal.jsx
/**
 * LoadingPortal — the spinning black-hole portal beneath the loading cube.
 *
 * A 2D <canvas> (NOT WebGL, so it never competes for a WebGL context with the
 * app's R3F canvas): a colour-cycling vortex with concentric rings, light rays,
 * "spaghetti" strands and particles spiralling inward. The RAF loop is fully
 * torn down on unmount, and prefers-reduced-motion renders a single static frame.
 *
 * Colours are the real game palette so the portal matches the cube above it.
 */

import React, { useEffect, useRef } from 'react';

// Game palette (utils/constants.js) as RGB triples: white, yellow, red, orange, blue, green.
const PAL = [
  [250, 250, 250],
  [234, 179, 8],
  [239, 68, 68],
  [249, 115, 22],
  [59, 130, 246],
  [34, 197, 94]
];

const lerp = (a, b, t) => a + (b - a) * t;
const lerpArr = (a, b, t) => a.map((v, i) => lerp(v, b[i], t));

export default function LoadingPortal({ width = 520, height = 300 }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;

    const W = width;
    const H = height;
    const cx = W / 2;
    const cy = H * 0.64;
    const RX = W * 0.45;
    const RY = RX * 0.15;
    const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    let glowRgb = [...PAL[4]];
    let glowTarget = [...PAL[4]];
    let nextColorChange = 0;

    const makeRay = () => ({
      angle: -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.1,
      len: 40 + Math.random() * 90,
      colorIdx: Math.floor(Math.random() * 6),
      waveAmp: 2 + Math.random() * 6,
      waveFreq: 1.5 + Math.random() * 3,
      useCos: Math.random() > 0.5,
      phaseOff: Math.random() * Math.PI * 2,
      phaseSpd: 0.04 + Math.random() * 0.06,
      opacity: 0.1 + Math.random() * 0.28,
      width: 1.0 + Math.random() * 2.8,
      life: Math.random(),
      lifeSpeed: 0.004 + Math.random() * 0.007
    });

    const makeStrand = (rndLife) => {
      const freq = 1.5 + Math.random() * 3.5;
      return {
        colorIdx: Math.floor(Math.random() * 6),
        useCos: Math.random() > 0.5,
        freq,
        amp: 3 + Math.random() * 9,
        amp2: Math.random() > 0.4 ? 2 + Math.random() * 5 : 0,
        freq2: freq * (1.5 + Math.random()),
        phaseOffset: Math.random() * Math.PI * 2,
        phaseSpeed: 0.03 + Math.random() * 0.05,
        angle: Math.random() * Math.PI * 2,
        dist: 50 + Math.random() * 80,
        strandLen: 40 + Math.random() * 70,
        inSpeed: 0.22 + Math.random() * 0.28,
        spiralSpeed: 0.012 + Math.random() * 0.018,
        yOff: -5 + Math.random() * 18,
        width: 2.5 + Math.random() * 3.5,
        life: rndLife ? Math.random() : 0,
        opacity: 0.55 + Math.random() * 0.45
      };
    };

    const spawnPart = () => ({
      angle: Math.random() * Math.PI * 2,
      dist: 80 + Math.random() * 80,
      speed: 0.007 + Math.random() * 0.013,
      spiralSpeed: 0.02 + Math.random() * 0.025,
      size: 2 + Math.random() * 3.5,
      colorIdx: Math.floor(Math.random() * 6),
      opacity: 0.8 + Math.random() * 0.2,
      yOff: -30 - Math.random() * 60,
      ySpd: 0.3 + Math.random() * 0.5
    });

    const rays = Array.from({ length: 20 }, makeRay);
    const strands = Array.from({ length: 18 }, () => makeStrand(true));
    const parts = Array.from({ length: 45 }, () => {
      const p = spawnPart();
      p.dist = 5 + Math.random() * 110;
      p.yOff = -80 + Math.random() * 90;
      return p;
    });

    const portalPt = (angle, dist, yOff) => ({
      x: cx + Math.cos(angle) * dist * (RX / 62),
      y: cy + Math.sin(angle) * dist * (RY / 62) + yOff
    });
    const perpDir = (angle) => ({ x: -Math.sin(angle), y: Math.cos(angle) * 0.25 });

    let t = 0;
    let lastTs = null;
    let raf;

    const draw = (ts) => {
      if (!lastTs) lastTs = ts;
      const dt = reduced ? 1 : Math.min((ts - lastTs) / 16, 3);
      lastTs = ts;
      t += dt;
      ctx.clearRect(0, 0, W, H);

      if (ts > nextColorChange) {
        glowTarget = [...PAL[Math.floor(Math.random() * 6)]];
        nextColorChange = ts + 350 + Math.random() * 1100;
      }
      glowRgb = lerpArr(glowRgb, glowTarget, 0.045 * dt);
      const [gr, gg, gb] = glowRgb.map((v) => v | 0);
      const bOff = Math.sin(t * 0.025) * 4;

      // 1. LIGHT RAYS
      ctx.save();
      ctx.translate(0, bOff);
      for (let i = 0; i < rays.length; i++) {
        const r = rays[i];
        r.life += r.lifeSpeed * dt;
        r.phaseOff += r.phaseSpd * dt;
        if (r.life > 1) {
          rays[i] = makeRay();
          rays[i].life = 0;
          continue;
        }
        const fade = r.life < 0.25 ? r.life / 0.25 : r.life > 0.65 ? (1 - r.life) / 0.35 : 1;
        const [rr, rg, rb] = PAL[r.colorIdx];
        const STEPS = 20;
        const pts = [];
        for (let k = 0; k <= STEPS; k++) {
          const frac = k / STEPS;
          const px = cx + Math.cos(r.angle) * r.len * frac;
          const py = cy + Math.sin(r.angle) * r.len * frac;
          const perpX = -Math.sin(r.angle);
          const perpY = Math.cos(r.angle);
          const wp = frac * r.waveFreq * Math.PI * 2 + r.phaseOff;
          const wave = (r.useCos ? Math.cos(wp) : Math.sin(wp)) * r.waveAmp * frac;
          pts.push({ x: px + perpX * wave, y: py + perpY * wave });
        }
        const alpha = r.opacity * fade;
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let k = 1; k < pts.length - 1; k++) {
          const mx = (pts[k].x + pts[k + 1].x) / 2;
          const my = (pts[k].y + pts[k + 1].y) / 2;
          ctx.quadraticCurveTo(pts[k].x, pts[k].y, mx, my);
        }
        ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
        const grad = ctx.createLinearGradient(pts[0].x, pts[0].y, pts[pts.length - 1].x, pts[pts.length - 1].y);
        grad.addColorStop(0, `rgba(${rr},${rg},${rb},${alpha})`);
        grad.addColorStop(1, `rgba(${rr},${rg},${rb},0)`);
        ctx.strokeStyle = grad;
        ctx.lineWidth = r.width * fade;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();
      }
      ctx.restore();

      // 2. PORTAL
      ctx.save();
      ctx.translate(0, bOff);
      const halo = ctx.createRadialGradient(cx, cy, 2, cx, cy, RX * 1.15);
      halo.addColorStop(0, `rgba(${gr},${gg},${gb},0.32)`);
      halo.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.save();
      ctx.scale(1, RY / RX);
      ctx.beginPath();
      ctx.arc(cx, cy * (RX / RY), RX * 1.15, 0, Math.PI * 2);
      ctx.fillStyle = halo;
      ctx.fill();
      ctx.restore();
      const ring = (rx2, ry2, lw, alpha) => {
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx2, ry2, 0, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${gr},${gg},${gb},${alpha})`;
        ctx.lineWidth = lw;
        ctx.stroke();
      };
      ring(RX, RY, 1.2, 0.28);
      ring(RX * 0.88, RY * 0.88, 0.8, 0.35);
      const pGrad = ctx.createRadialGradient(cx, cy - 2, 3, cx, cy, RX * 0.83);
      pGrad.addColorStop(0, `rgba(${gr},${(gg * 0.5) | 0},${gb},0.5)`);
      pGrad.addColorStop(0.45, '#2a2200');
      pGrad.addColorStop(1, '#0d0900');
      ctx.beginPath();
      ctx.ellipse(cx, cy, RX * 0.83, RY * 0.83, 0, 0, Math.PI * 2);
      ctx.fillStyle = pGrad;
      ctx.fill();
      const vort = ctx.createRadialGradient(cx, cy, 0, cx, cy, RX * 0.48);
      vort.addColorStop(0, `rgba(${gr},${gg},${gb},0.75)`);
      vort.addColorStop(0.45, `rgba(${gr},${gg},${gb},0.22)`);
      vort.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.beginPath();
      ctx.ellipse(cx, cy, RX * 0.48, RY * 0.48, 0, 0, Math.PI * 2);
      ctx.fillStyle = vort;
      ctx.fill();
      ring(RX * 0.62, RY * 0.62, 0.5, 0.25);
      ring(RX * 0.36, RY * 0.36, 0.5, 0.2);
      ctx.beginPath();
      ctx.ellipse(cx, cy, RX * 0.84, RY * 0.84, 0, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(${gr},${gg},${gb},0.75)`;
      ctx.lineWidth = 1.3;
      ctx.stroke();
      ctx.restore();

      // 3. SPAGHETTI
      ctx.save();
      ctx.translate(0, bOff);
      for (let i = 0; i < strands.length; i++) {
        const s = strands[i];
        s.dist -= s.inSpeed * dt;
        s.angle += s.spiralSpeed * dt;
        s.phaseOffset += s.phaseSpeed * dt;
        const pull = Math.max(0, 1 - s.dist / 65);
        s.yOff += (0 - s.yOff) * 0.018 * dt * (1 + pull * 4);
        if (s.dist < 1) {
          strands[i] = makeStrand(false);
          continue;
        }
        const distFrac = Math.max(0, s.dist / 110);
        const [rr, rg, rb] = PAL[s.colorIdx];
        const STEPS = 28;
        const pts = [];
        for (let k = 0; k <= STEPS; k++) {
          const frac = k / STEPS;
          const d = s.dist + s.strandLen * (1 - frac);
          const a = s.angle - s.spiralSpeed * s.strandLen * (1 - frac) * 0.18;
          const waveFrac = 1 - frac;
          const wp = frac * s.freq * Math.PI * 2 + s.phaseOffset;
          const wp2 = frac * s.freq2 * Math.PI * 2 + s.phaseOffset * 1.3;
          const wave =
            (s.useCos ? Math.cos(wp) : Math.sin(wp)) * s.amp * waveFrac * distFrac +
            (s.amp2 ? Math.sin(wp2) * s.amp2 * waveFrac * distFrac * 0.6 : 0);
          const base = portalPt(a, d, s.yOff * (0.5 + 0.5 * (1 - frac)));
          const perp = perpDir(a);
          pts.push({ x: base.x + perp.x * wave, y: base.y + perp.y * wave });
        }
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let k = 1; k < pts.length - 1; k++) {
          const mx = (pts[k].x + pts[k + 1].x) / 2;
          const my = (pts[k].y + pts[k + 1].y) / 2;
          ctx.quadraticCurveTo(pts[k].x, pts[k].y, mx, my);
        }
        ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
        const alpha = s.opacity * distFrac;
        const headPt = pts[pts.length - 1];
        const tailPt = pts[0];
        const grad = ctx.createLinearGradient(tailPt.x, tailPt.y, headPt.x, headPt.y);
        grad.addColorStop(0, `rgba(${rr},${rg},${rb},0)`);
        grad.addColorStop(0.3, `rgba(${rr},${rg},${rb},${alpha})`);
        grad.addColorStop(0.85, `rgba(${rr},${rg},${rb},${alpha * 0.8})`);
        grad.addColorStop(1, `rgba(${rr},${rg},${rb},0)`);
        ctx.strokeStyle = grad;
        ctx.lineWidth = s.width * (0.4 + 0.6 * distFrac);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();
      }
      ctx.restore();

      // 4. PARTICLES
      ctx.save();
      ctx.translate(0, bOff);
      for (let i = 0; i < parts.length; i++) {
        const p = parts[i];
        p.dist -= p.speed * dt;
        p.angle += p.spiralSpeed * dt;
        const pull = Math.max(0, 1 - p.dist / 75);
        p.yOff += (0 - p.yOff) * 0.012 * dt * (1 + pull * 3);
        p.yOff -= p.ySpd * pull * dt * 0.4;
        const distFrac = Math.max(0, p.dist / 90);
        const alpha = p.opacity * distFrac;
        if (p.dist < 2 || alpha < 0.015) {
          parts[i] = spawnPart();
          continue;
        }
        const pos = portalPt(p.angle, p.dist, p.yOff);
        const sz = p.size * (0.3 + 0.7 * distFrac);
        const [rr, rg, rb] = PAL[p.colorIdx];
        ctx.globalAlpha = Math.min(alpha, 1);
        ctx.fillStyle = `rgb(${rr},${rg},${rb})`;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, sz, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.restore();

      if (!reduced) raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => {
      if (raf) cancelAnimationFrame(raf);
    };
  }, [width, height]);

  return <canvas ref={canvasRef} width={width} height={height} className="wl-portal" aria-hidden="true" />;
}
