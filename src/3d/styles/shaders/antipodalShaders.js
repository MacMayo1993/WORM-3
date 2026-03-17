// Antipodal-color tile shaders — use both baseColor (this face) and antipodalColor (opposite face).
// When antipodalColor is not provided (e.g. style previews), getTileStyleMaterial derives a
// hue-shifted contrast color automatically.

export const antipodalShaders = {
  // Polka Dots — small circles (~20% coverage) of antipodalColor on a baseColor background.
  polkaDots: `
    uniform vec3 baseColor;
    uniform vec3 antipodalColor;
    varying vec2 vUv;

    void main() {
      float grid = 4.0;
      vec2 f = fract(vUv * grid) - 0.5;
      float dist = length(f);
      float circ = smoothstep(0.22, 0.17, dist);
      vec3 color = mix(baseColor, antipodalColor, circ);
      gl_FragColor = vec4(color, 1.0);
    }
  `,

  // Zigzag — narrow chevron stripes (~30% antipodalColor, 70% baseColor).
  zigzag: `
    uniform vec3 baseColor;
    uniform vec3 antipodalColor;
    varying vec2 vUv;

    void main() {
      float nBands = 7.0;
      // Triangle wave in x offsets the y stripe boundary → chevron/zigzag
      float tx = abs(fract(vUv.x * nBands) * 2.0 - 1.0);
      float zy = fract(vUv.y * nBands + tx * 0.5);
      float band = step(0.70, zy);
      vec3 color = mix(baseColor, antipodalColor, band);
      gl_FragColor = vec4(color, 1.0);
    }
  `,

  // Checkerboard — large base-color tiles with thin antipodalColor grout lines (~22% antipodal).
  checkerboard: `
    uniform vec3 baseColor;
    uniform vec3 antipodalColor;
    varying vec2 vUv;

    void main() {
      float grid = 4.0;
      vec2 f = fract(vUv * grid);
      float grout = 0.12;
      float isGrout = step(1.0 - grout, f.x) + step(1.0 - grout, f.y);
      isGrout = clamp(isGrout, 0.0, 1.0);
      vec3 color = mix(baseColor, antipodalColor, isGrout);
      gl_FragColor = vec4(color, 1.0);
    }
  `,

  // Diagonal Stripes — thin 45-degree antipodalColor stripes on base (~20% antipodal).
  diagStripes: `
    uniform vec3 baseColor;
    uniform vec3 antipodalColor;
    varying vec2 vUv;

    void main() {
      float freq = 8.0;
      float stripe = step(0.80, fract((vUv.x + vUv.y) * freq * 0.5));
      vec3 color = mix(baseColor, antipodalColor, stripe);
      gl_FragColor = vec4(color, 1.0);
    }
  `,

  // Corner Accent — antipodalColor triangle in bottom-left corner (~19% coverage).
  cornerAccent: `
    uniform vec3 baseColor;
    uniform vec3 antipodalColor;
    varying vec2 vUv;

    void main() {
      float inTri = 1.0 - step(0.62, vUv.x + vUv.y);
      vec3 color = mix(baseColor, antipodalColor, inTri);
      gl_FragColor = vec4(color, 1.0);
    }
  `,

  // Inner Disc — single large centered disc of antipodalColor (~25% coverage).
  innerDisc: `
    uniform vec3 baseColor;
    uniform vec3 antipodalColor;
    varying vec2 vUv;

    void main() {
      float r = length(vUv - 0.5);
      float disc = smoothstep(0.30, 0.26, r);
      vec3 color = mix(baseColor, antipodalColor, disc);
      gl_FragColor = vec4(color, 1.0);
    }
  `,

  // Cross Plus — thin plus-sign of antipodalColor on base (~28% coverage).
  crossPlus: `
    uniform vec3 baseColor;
    uniform vec3 antipodalColor;
    varying vec2 vUv;

    void main() {
      float armW = 0.08;
      vec2 p = abs(vUv - 0.5);
      float onArm = step(p.x, armW) + step(p.y, armW);
      onArm = clamp(onArm, 0.0, 1.0);
      vec3 color = mix(baseColor, antipodalColor, onArm);
      gl_FragColor = vec4(color, 1.0);
    }
  `,

  // Border Frame — antipodalColor frame around a base-color interior (~29% coverage).
  borderFrame: `
    uniform vec3 baseColor;
    uniform vec3 antipodalColor;
    varying vec2 vUv;

    void main() {
      float border = 0.08;
      vec2 p = abs(vUv - 0.5);
      float isFrame = step(0.5 - border, max(p.x, p.y));
      vec3 color = mix(baseColor, antipodalColor, isFrame);
      gl_FragColor = vec4(color, 1.0);
    }
  `,

  // Thin Hatch — diagonal cross-hatch lines of antipodalColor on base (~27% coverage).
  thinHatch: `
    uniform vec3 baseColor;
    uniform vec3 antipodalColor;
    varying vec2 vUv;

    void main() {
      float freq = 5.0;
      float lineW = 0.15;
      float d1 = step(1.0 - lineW, fract((vUv.x + vUv.y) * freq * 0.5));
      float d2 = step(1.0 - lineW, fract((vUv.x - vUv.y + 1.0) * freq * 0.5));
      float hatch = clamp(d1 + d2, 0.0, 1.0);
      vec3 color = mix(baseColor, antipodalColor, hatch);
      gl_FragColor = vec4(color, 1.0);
    }
  `,

  // Dot Ring — six small antipodalColor dots arranged in a hexagonal ring (~20% coverage).
  dotRing: `
    uniform vec3 baseColor;
    uniform vec3 antipodalColor;
    varying vec2 vUv;

    void main() {
      vec2 c = vUv - 0.5;
      float minDist = 1.0;
      for (int i = 0; i < 6; i++) {
        float a = float(i) * 1.0472;
        vec2 dotCenter = vec2(cos(a), sin(a)) * 0.32;
        minDist = min(minDist, length(c - dotCenter));
      }
      float dots = smoothstep(0.11, 0.08, minDist);
      vec3 color = mix(baseColor, antipodalColor, dots);
      gl_FragColor = vec4(color, 1.0);
    }
  `,

  // Op Art expansion pack — antipodal-color driven illusions
  opConcentric: `
    uniform vec3 baseColor;
    uniform vec3 antipodalColor;
    varying vec2 vUv;
    void main() {
      float r = length(vUv - 0.5);
      float ring = step(0.58, fract(r * 16.0));
      vec3 color = mix(baseColor, antipodalColor, ring);
      gl_FragColor = vec4(color, 1.0);
    }
  `,
  opRadialSpokes: `
    uniform vec3 baseColor;
    uniform vec3 antipodalColor;
    varying vec2 vUv;
    void main() {
      vec2 p = vUv - 0.5;
      float a = atan(p.y, p.x);
      float spoke = step(0.66, fract((a + 3.14159) * 3.2));
      vec3 color = mix(baseColor, antipodalColor, spoke);
      gl_FragColor = vec4(color, 1.0);
    }
  `,
  opTiltMosaic: `
    uniform vec3 baseColor;
    uniform vec3 antipodalColor;
    varying vec2 vUv;
    void main() {
      vec2 t = vUv * 7.0;
      vec2 c = floor(t);
      float tilt = mod(c.x + c.y, 2.0);
      vec2 f = fract(t) - 0.5;
      float mask = step(0.20, abs(f.x + (tilt > 0.5 ? f.y : -f.y)));
      vec3 color = mix(baseColor, antipodalColor, mask);
      gl_FragColor = vec4(color, 1.0);
    }
  `,
  opDiamondWave: `
    uniform vec3 baseColor;
    uniform vec3 antipodalColor;
    varying vec2 vUv;
    void main() {
      vec2 p = abs(vUv - 0.5);
      float d = p.x + p.y;
      float band = step(0.70, fract(d * 10.0));
      vec3 color = mix(baseColor, antipodalColor, band);
      gl_FragColor = vec4(color, 1.0);
    }
  `,
  opBullseyeSteps: `
    uniform vec3 baseColor;
    uniform vec3 antipodalColor;
    varying vec2 vUv;
    void main() {
      float r = length(vUv - 0.5);
      float zone = floor(r * 8.0);
      float mask = step(0.5, mod(zone, 2.0));
      vec3 color = mix(baseColor, antipodalColor, mask);
      gl_FragColor = vec4(color, 1.0);
    }
  `,
  opWarpGrid: `
    uniform vec3 baseColor;
    uniform vec3 antipodalColor;
    varying vec2 vUv;
    void main() {
      vec2 p = vUv - 0.5;
      vec2 warp = p * (1.0 + length(p) * 1.8);
      float gx = step(0.86, fract((warp.x + 0.5) * 8.0));
      float gy = step(0.86, fract((warp.y + 0.5) * 8.0));
      float mask = clamp(gx + gy, 0.0, 1.0);
      vec3 color = mix(baseColor, antipodalColor, mask);
      gl_FragColor = vec4(color, 1.0);
    }
  `,
  opChevronBands: `
    uniform vec3 baseColor;
    uniform vec3 antipodalColor;
    varying vec2 vUv;
    void main() {
      float tx = abs(fract(vUv.x * 9.0) * 2.0 - 1.0);
      float vy = fract(vUv.y * 7.0 + tx * 0.9);
      float band = step(0.74, vy);
      vec3 color = mix(baseColor, antipodalColor, band);
      gl_FragColor = vec4(color, 1.0);
    }
  `,
  opInterferencePlaid: `
    uniform vec3 baseColor;
    uniform vec3 antipodalColor;
    varying vec2 vUv;
    void main() {
      float sx = step(0.82, fract(vUv.x * 13.0));
      float sy = step(0.82, fract(vUv.y * 11.0));
      float diag = step(0.88, fract((vUv.x + vUv.y) * 9.0));
      float mask = clamp(sx + sy + diag, 0.0, 1.0);
      vec3 color = mix(baseColor, antipodalColor, mask);
      gl_FragColor = vec4(color, 1.0);
    }
  `,
  opRibbonTwist: `
    uniform vec3 baseColor;
    uniform vec3 antipodalColor;
    varying vec2 vUv;
    void main() {
      float y = 0.5 + sin((vUv.x - 0.5) * 18.0) * 0.18;
      float ribbon = smoothstep(0.15, 0.12, abs(vUv.y - y));
      float cut = step(0.65, fract(vUv.x * 6.0));
      float mask = ribbon * cut;
      vec3 color = mix(baseColor, antipodalColor, mask);
      gl_FragColor = vec4(color, 1.0);
    }
  `,
  opPinwheel: `
    uniform vec3 baseColor;
    uniform vec3 antipodalColor;
    varying vec2 vUv;
    void main() {
      vec2 p = vUv - 0.5;
      float a = atan(p.y, p.x);
      float r = length(p);
      float swirl = fract((a + r * 14.0 + 3.14159) * 2.2);
      float blade = step(0.7, swirl);
      vec3 color = mix(baseColor, antipodalColor, blade);
      gl_FragColor = vec4(color, 1.0);
    }
  `,
};
