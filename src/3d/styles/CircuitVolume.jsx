// CircuitVolume.jsx — volumetric PCB for the 'circuit' tile style
//
// Three layers in local +Z space:
//   1. Sticker base: circuit floor shader (grid lines, traces, solder points)
//   2. PCB body (thin box): translucent green FR4 board — trace glow on walls,
//      component silhouettes, data signal pulses sweeping through
//   3. Component surface (plane): raised IC pads, LED pips, and trace highlight
//      glow on the top face — animated pulses travel from chip to chip

import React, { useMemo } from 'react';
import * as THREE from 'three';
import { sharedUniforms } from './TileStyleMaterials.jsx';

const PCB_W    = 0.78;
const PCB_D    = 0.025;   // thin board
const SURF_SEGS = 1;

// ─── PCB body shaders ─────────────────────────────────────────────────────────

const bodyVertexShader = `
  varying vec2 vUv;
  varying vec3 vNormal;
  void main() {
    vUv     = uv;
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const bodyFragmentShader = `
  uniform vec3  pcbColor;
  uniform float time;
  varying vec2  vUv;
  varying vec3  vNormal;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }

  void main() {
    // FR4 board color — deep green tinted by face color
    vec3 fr4 = mix(vec3(0.04, 0.18, 0.06), pcbColor * 0.55, 0.35);

    // Trace grid on edges (PCB cross-section)
    vec2 grid = abs(fract(vUv * 10.0) - 0.5);
    float traceV = step(0.43, max(grid.x, grid.y)) * step(0.4, hash(floor(vUv*10.0)));
    vec3 traceCol = pcbColor * 1.4 + vec3(0.0, 0.10, 0.0);
    vec3 col = mix(fr4, traceCol, traceV * 0.60);

    // Traveling data pulse — bright band sweeping along traces
    float pulse = sin(vUv.x * 8.0 - time * 5.0 + hash(floor(vUv * 10.0)) * 6.28) * 0.5 + 0.5;
    pulse = pow(pulse, 6.0);
    col += pcbColor * pulse * traceV * 0.90;

    // Rim glow (edge-lit PCB)
    float rim = 1.0 - abs(dot(normalize(vNormal), vec3(0,0,1)));
    col += pcbColor * rim * 0.18;

    gl_FragColor = vec4(col, 0.62);
  }
`;

// ─── Component surface shaders ────────────────────────────────────────────────

const surfaceVertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const surfaceFragmentShader = `
  uniform vec3  pcbColor;
  uniform float time;
  varying vec2  vUv;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }

  void main() {
    vec2 uv = vUv * 10.0;
    vec2 cell = floor(uv);
    vec2 f    = fract(uv);

    // Trace routes — vertical + horizontal lines
    vec2 grid = abs(f - 0.5);
    float r   = hash(cell);
    float trace = 0.0;
    if (r > 0.65)      { trace = step(0.44, grid.x) * step(grid.y, 0.09); }
    else if (r > 0.35) { trace = step(0.44, grid.y) * step(grid.x, 0.09); }

    // IC pad rectangles — some cells are component pads
    float isPad  = step(0.80, hash(cell + 200.0));
    float padX   = smoothstep(0.28, 0.24, abs(f.x - 0.5));
    float padY   = smoothstep(0.28, 0.24, abs(f.y - 0.5));
    float pad    = padX * padY * isPad;

    // LED pip — tiny bright circle
    float isLed  = step(0.92, hash(cell + 300.0));
    float led    = smoothstep(0.10, 0.06, length(f - 0.5)) * isLed;

    // Signal pulse traveling along traces
    float pulse  = sin(time * 4.5 + cell.x * 1.8 + cell.y * 2.7) * 0.5 + 0.5;
    float lit    = pow(pulse, 4.0);

    // Background: FR4 green
    vec3 fr4  = mix(vec3(0.04, 0.18, 0.06), pcbColor * 0.55, 0.35);
    vec3 gold = pcbColor * 1.3 + vec3(0.10, 0.08, 0.0);
    vec3 col  = fr4;
    col = mix(col, gold, trace * 0.80);
    col = mix(col, gold * 1.20, pad);
    col += pcbColor * lit * trace * 0.70;
    // LED: bright pip
    col += vec3(0.55, 1.0, 0.35) * led * (sin(time * 6.0 + hash(cell)*6.28) * 0.4 + 0.6);
    // Solder joint dots
    float solder = smoothstep(0.06, 0.0, length(f - 0.5));
    col = mix(col, vec3(0.85, 0.80, 0.60), solder * step(0.75, hash(cell + 400.0)) * 0.60);

    float alpha = max(trace * 0.85, max(pad * 0.90, led * 0.95));
    alpha = max(alpha, solder * 0.55);
    gl_FragColor = vec4(col, alpha);
  }
`;

// ─── Component ───────────────────────────────────────────────────────────────

export default function CircuitVolume({ faceColor }) {
  const pcbCol = useMemo(() => {
    const fc = new THREE.Color(faceColor || '#22c55e');
    const pc = new THREE.Color(0.08, 0.45, 0.12);
    pc.lerp(fc, 0.40);
    return pc;
  }, [faceColor]);

  const bodyMat = useMemo(() => new THREE.ShaderMaterial({
    uniforms: { pcbColor: { value: pcbCol }, time: sharedUniforms.time },
    vertexShader: bodyVertexShader, fragmentShader: bodyFragmentShader,
    transparent: true, side: THREE.DoubleSide, depthWrite: false,
  }), [pcbCol]);

  const surfMat = useMemo(() => new THREE.ShaderMaterial({
    uniforms: { pcbColor: { value: pcbCol }, time: sharedUniforms.time },
    vertexShader: surfaceVertexShader, fragmentShader: surfaceFragmentShader,
    transparent: true, side: THREE.FrontSide, depthWrite: false,
    blending: THREE.AdditiveBlending,
  }), [pcbCol]);

  const bodyGeo = useMemo(() => new THREE.BoxGeometry(PCB_W, PCB_W, PCB_D), []);
  const surfGeo = useMemo(
    () => new THREE.PlaneGeometry(PCB_W, PCB_W, SURF_SEGS, SURF_SEGS), []
  );

  return (
    <>
      {/* PCB board volume — translucent green FR4 with trace glow on walls */}
      <mesh geometry={bodyGeo} material={bodyMat}
        position={[0, 0, PCB_D / 2 + 0.002]}
        frustumCulled={false} raycast={() => null} />

      {/* Component layer — trace routes, IC pads, LED pips, signal pulses */}
      <mesh geometry={surfGeo} material={surfMat}
        position={[0, 0, PCB_D + 0.003]}
        frustumCulled={false} raycast={() => null} />
    </>
  );
}
