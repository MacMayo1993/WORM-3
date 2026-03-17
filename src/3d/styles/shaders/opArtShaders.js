// Op Art / perceptual illusion tile shaders (no shaderUtils needed)
// Includes: static illusions, animated motion illusions

export const opArtShaders = {
  // Café Wall — alternating offset brick rows; perfectly horizontal mortar lines
  // appear to lean in opposite directions on alternating rows (classic 1979 illusion).
  cafeWall: `
    uniform vec3 baseColor;
    varying vec2 vUv;

    void main() {
      // 6 columns × 8 rows
      vec2 uv = vUv * vec2(6.0, 8.0);
      float row   = floor(uv.y);
      // Odd rows shift by half a brick → the "café wall" offset
      float shift = mod(row, 2.0) * 0.5;
      float bx    = uv.x + shift;
      float brick = mod(floor(bx), 2.0);

      // Mortar gap between every brick
      vec2 local  = fract(vec2(bx, uv.y));
      float mortar = 1.0 - step(0.07, min(min(local.x, 1.0-local.x),
                                          min(local.y, 1.0-local.y)));

      // Two brick colours + medium grey mortar
      vec3 brickA   = baseColor * 1.05 + vec3(0.06);
      vec3 brickB   = baseColor * 0.10;
      vec3 mortarC  = mix(brickA, brickB, 0.52);

      vec3 color = mix(brickA, brickB, brick);
      color = mix(color, mortarC, mortar);
      gl_FragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
    }
  `,

  // Hermann Grid — dark cells in a bright grid; ghostly grey spots materialise at
  // every intersection where you are NOT looking (lateral-inhibition illusion).
  hermanGrid: `
    uniform vec3 baseColor;
    varying vec2 vUv;

    void main() {
      float N  = 7.0;
      float gw = 0.24;          // gutter (grid-line) fraction
      vec2  uv = vUv * N;
      vec2  f  = fract(uv);

      // Inside a grid channel?
      float onX = step(1.0 - gw, f.x);
      float onY = step(1.0 - gw, f.y);
      float onGrid = max(onX, onY);

      // Intersection: both channels active — here ghost spots appear
      float intersect = onX * onY;

      vec3 cellCol  = baseColor * 0.08;
      vec3 gridCol  = baseColor * 1.15 + vec3(0.12);
      // Ghost: intersection looks slightly darker than the lines
      vec3 ghostCol = mix(gridCol, cellCol, 0.38);

      vec3 color = mix(cellCol, gridCol, onGrid);
      color = mix(color, ghostCol, intersect * 0.55);
      gl_FragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
    }
  `,

  // Peripheral Drift — concentric rings with opposing sawtooth luminance ramps.
  // Static image; in peripheral vision the rings appear to rotate in opposite
  // directions (Kitaoka / Bains 2002 class of illusions).
  opticSpin: `
    uniform vec3 baseColor;
    varying vec2 vUv;

    void main() {
      const float PI = 3.14159265;
      vec2  c   = vUv - 0.5;
      float r   = length(c);
      float ang = atan(c.y, c.x);   // [-π, π]

      // 7 concentric rings; alternating spin direction
      float rings   = 7.0;
      float sectors = 14.0;
      float ringIdx = floor(r * rings * 2.0);
      float spinDir = mod(ringIdx, 2.0) * 2.0 - 1.0;   // +1 or -1

      float angNorm = ang / (2.0 * PI) + 0.5;           // [0, 1]
      float saw     = fract(angNorm * sectors + ringIdx * 0.5);
      saw = spinDir > 0.0 ? saw : 1.0 - saw;

      // 4 discrete luminance bands (sharper bands → stronger illusion)
      float lum = floor(saw * 4.0) / 3.0;
      vec3 col  = baseColor * (0.12 + lum * 0.88);

      // Circular vignette
      col *= 1.0 - smoothstep(0.42, 0.52, r);
      gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
    }
  `,

  // Ouchi — a central disc of horizontal stripes floats in front of (or behind)
  // the vertical-striped surround.  Move your eyes around and the disc appears
  // to shift and hover independently (Ouchi 1977).
  ouchi: `
    uniform vec3 baseColor;
    varying vec2 vUv;

    void main() {
      vec2  c    = vUv - 0.5;
      float r    = length(c);
      float freq = 18.0;

      // Inner disc: horizontal stripes
      float stripeH = step(0.5, fract(vUv.y * freq));
      // Outer ring: vertical stripes
      float stripeV = step(0.5, fract(vUv.x * freq));

      float inner  = step(r, 0.22);
      float stripe = mix(stripeV, stripeH, inner);

      vec3 light = baseColor * 1.12 + vec3(0.08);
      vec3 dark  = baseColor * 0.10;

      vec3 color = mix(dark, light, stripe);

      // Narrow anti-aliased boundary ring
      float bound = smoothstep(0.20, 0.22, r) * (1.0 - smoothstep(0.22, 0.24, r));
      color = mix(color, baseColor * 0.55, bound * 0.50);

      gl_FragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
    }
  `,

  // Scintillating Grid — white discs at every intersection of a bright grid on a
  // dark background; ghostly dark discs appear to flash at non-fixated junctions
  // (Lingelbach 1994 variant of the Hermann grid illusion).
  scintillatingGrid: `
    uniform vec3 baseColor;
    varying vec2 vUv;

    void main() {
      float N  = 6.0;
      float gw = 0.22;   // gutter (grid-line) width as fraction of cell
      vec2  uv = vUv * N;
      vec2  f  = fract(uv);

      float onX = step(1.0 - gw, f.x);
      float onY = step(1.0 - gw, f.y);
      float onGrid = max(onX, onY);

      // White disc centered at each intersection, in gutter-local coords [-1, 1]
      vec2  gutterLocal = (f - vec2(1.0 - gw * 0.5)) / (gw * 0.5);
      float discDist    = length(gutterLocal);
      float disc = (1.0 - smoothstep(0.5, 0.85, discDist)) * onX * onY;

      vec3 cellCol = baseColor * 0.07;
      vec3 gridCol = baseColor * 1.1 + vec3(0.12);
      vec3 color   = mix(cellCol, gridCol, onGrid);
      color = mix(color, vec3(1.0), disc);

      gl_FragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
    }
  `,

  // Zöllner — long parallel horizontal lines crossed by short hatch marks angled
  // ±45° on alternating rows; the parallel lines appear to tilt toward or away
  // from each other (Zöllner 1860).
  zoellner: `
    uniform vec3 baseColor;
    varying vec2 vUv;

    void main() {
      float nLines = 5.0;
      float lineW  = 0.06;
      float fy  = fract(vUv.y * nLines);
      float row = floor(vUv.y * nLines);

      // Main long horizontal lines
      float mainLine = smoothstep(lineW, lineW * 0.3, abs(fy - 0.5));

      // Short cross-hatches: direction alternates ±1 per row
      float dir   = mod(row, 2.0) * 2.0 - 1.0;
      float hN    = 18.0;
      float slant = fract(vUv.x * hN + dir * fy * 1.2);
      float hatch = smoothstep(0.07, 0.0, abs(slant - 0.5));
      // Restrict hatches to mid-band so they don't overlap the main line
      hatch *= smoothstep(0.0, 0.14, fy) * smoothstep(1.0, 0.86, fy);
      hatch *= (1.0 - mainLine);

      float pattern = max(mainLine, hatch * 0.75);

      vec3 light = baseColor * 1.1 + vec3(0.08);
      vec3 dark  = baseColor * 0.1;
      gl_FragColor = vec4(clamp(mix(dark, light, pattern), 0.0, 1.0), 1.0);
    }
  `,

  // Kanizsa — four pac-man inducers positioned at the corners of an implied
  // square; the brain fills in the missing edges as an illusory bright contour
  // even though no actual border is drawn (Kanizsa 1955).
  kanizsa: `
    uniform vec3 baseColor;
    varying vec2 vUv;

    void main() {
      const float PI = 3.14159265;
      vec2  c = vUv - 0.5;
      float r = 0.13;   // pac-man disc radius
      float d = 0.26;   // distance of each centre from tile centre

      float inducers = 0.0;
      for (int i = 0; i < 4; i++) {
        float a    = PI * 0.25 + float(i) * PI * 0.5;   // 45°, 135°, 225°, 315°
        vec2  pos  = vec2(cos(a), sin(a)) * d;
        vec2  dp   = c - pos;
        float dist = length(dp);

        // Mouth opens inward toward the tile centre
        float mouthDir = atan(-pos.y, -pos.x);
        float alpha    = atan(dp.y, dp.x);
        float dA       = abs(mod(alpha - mouthDir + PI, 2.0 * PI) - PI);

        float inDisc  = step(dist, r);
        float inMouth = step(dA, 0.62);   // ~35° half-angle
        inducers = max(inducers, inDisc * (1.0 - inMouth));
      }

      vec3 light = baseColor * 1.1 + vec3(0.08);
      vec3 dark  = baseColor * 0.08;
      gl_FragColor = vec4(clamp(mix(dark, light, inducers), 0.0, 1.0), 1.0);
    }
  `,

  // Fraser Spiral — nested concentric circles with a twisted-cord texture.
  // The cord markings are tilted off-tangent, so the brain reads the circles
  // as a tightening inward spiral even though every ring is perfectly circular
  // (Fraser 1908).
  fraserSpiral: `
    uniform vec3 baseColor;
    varying vec2 vUv;

    void main() {
      const float PI = 3.14159265;
      vec2  c    = vUv - 0.5;
      float r    = length(c);
      float ang  = atan(c.y, c.x);        // -PI .. PI

      // 8 concentric ring bands with narrow inter-ring gaps
      float nRings = 8.0;
      float ringT  = fract(r * nRings * 2.0);
      float inRing = step(0.14, ringT) * step(ringT, 0.86);

      // Twisted cord phase: angular position PLUS a radial twist term.
      // The radial term is what fools the visual system into reading a spiral.
      float nSegs = 38.0;
      float twist = 2.6;
      float phase = (ang / (2.0 * PI) + 0.5) * nSegs + r * nRings * twist;
      float cord  = step(0.5, fract(phase));

      vec3 light = baseColor * 1.10 + vec3(0.08);
      vec3 dark  = baseColor * 0.08;
      vec3 bg    = baseColor * 0.44;

      vec3 color = bg;
      color = mix(color, mix(dark, light, cord), inRing);
      color *= 1.0 - smoothstep(0.44, 0.52, r);   // circular vignette
      gl_FragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
    }
  `,

  // Müller-Lyer — alternating rows of horizontal lines; one row has outward-
  // pointing arrow fins (<--->) and the next has inward fins (>---<).  Both
  // lines span the same width, but the fins make them look longer and shorter
  // respectively (Müller-Lyer 1889).
  muellerLyer: `
    uniform vec3 baseColor;
    varying vec2 vUv;

    void main() {
      float nRows    = 4.0;
      float lineW    = 0.038;   // half-thickness of strokes
      float finSlope = 0.52;    // gradient of each fin arm
      float finHalf  = 0.13;    // half-length of a fin arm along x

      float ry  = fract(vUv.y * nRows);
      float row = floor(vUv.y * nRows);
      // dir=+1: arrow-in (fins open toward center → looks shorter)
      // dir=-1: arrow-out (fins open away from center → looks longer)
      float dir = mod(row, 2.0) * 2.0 - 1.0;
      float dy  = ry - 0.5;

      // Horizontal line spanning the tile
      float onLine = step(abs(dy), lineW)
                   * step(0.08, vUv.x) * step(vUv.x, 0.92);

      // Left fin tip at x = 0.20
      float dxL  = vUv.x - 0.20;
      float finL = max(
        step(abs(dy - finSlope * dxL * dir),  lineW * 1.15),
        step(abs(dy + finSlope * dxL * dir),  lineW * 1.15)
      ) * step(abs(dxL), finHalf) * (1.0 - onLine);

      // Right fin tip at x = 0.80
      float dxR  = vUv.x - 0.80;
      float finR = max(
        step(abs(dy - finSlope * dxR * (-dir)), lineW * 1.15),
        step(abs(dy + finSlope * dxR * (-dir)), lineW * 1.15)
      ) * step(abs(dxR), finHalf) * (1.0 - onLine);

      float pattern = max(onLine, max(finL, finR));
      vec3 light = baseColor * 1.10 + vec3(0.08);
      vec3 dark  = baseColor * 0.10;
      gl_FragColor = vec4(clamp(mix(dark, light, pattern), 0.0, 1.0), 1.0);
    }
  `,

  // Rotating Snakes — concentric ring bands filled with a 4-step asymmetric
  // luminance ramp.  In peripheral vision the rings appear to spin in opposite
  // directions even though the image is completely static (Kitaoka & Ashida 2003).
  rotatingSnakes: `
    uniform vec3 baseColor;
    varying vec2 vUv;

    void main() {
      const float PI = 3.14159265;
      vec2  c    = vUv - 0.5;
      float r    = length(c);
      float ang  = atan(c.y, c.x) / (2.0 * PI) + 0.5;  // 0 .. 1

      float nRings  = 5.0;
      float ringR   = r * nRings * 2.2;
      float ringT   = fract(ringR);
      float ringI   = floor(ringR);

      // Narrow ring bands separated by thin gaps
      float inRing  = step(0.18, ringT) * step(ringT, 0.82);

      // Alternating clockwise / counter-clockwise sector ordering per ring
      float spinDir = mod(ringI, 2.0) * 2.0 - 1.0;   // +1 or -1

      float nSectors = 12.0;
      float angOff   = ringI * 0.23;
      float phase    = fract((ang + angOff) * nSectors * spinDir);

      // 4-band asymmetric ramp — the unequal step sizes drive the motion signal
      float band = floor(phase * 4.0);
      float lum  = 0.04;
      lum = mix(lum, 0.30, step(1.0, band));   // dark grey
      lum = mix(lum, 0.96, step(2.0, band));   // white
      lum = mix(lum, 0.68, step(3.0, band));   // light grey

      vec3 color = baseColor * lum * inRing;
      color *= 1.0 - smoothstep(0.43, 0.51, r);   // vignette
      gl_FragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
    }
  `,

  // Poggendorff — diagonal lines pass behind an opaque vertical band.
  // The parallel edges of the band misdirect the eye so that the two visible
  // segments appear to be on different trajectories (Zöllner/Poggendorff 1860).
  poggendorff: `
    uniform vec3 baseColor;
    varying vec2 vUv;

    void main() {
      float lineW = 0.022;    // stroke half-width
      float bandL = 0.32;     // left edge of occluding band
      float bandR = 0.68;     // right edge of occluding band
      float slope = 0.55;     // shallower angle → stronger Poggendorff effect

      float inBand = step(bandL, vUv.x) * step(vUv.x, bandR);

      // Three parallel diagonal lines; occluded where they cross the band
      float onLine = 0.0;
      float base0  = slope * (vUv.x - 0.5);
      onLine = max(onLine, step(abs(vUv.y - (base0 + 0.22)), lineW));
      onLine = max(onLine, step(abs(vUv.y - (base0 + 0.52)), lineW));
      onLine = max(onLine, step(abs(vUv.y - (base0 + 0.82)), lineW));
      onLine *= (1.0 - inBand);   // hide inside the band

      // Band vertical edges — these are the parallel guides that misdirect
      float edgeW  = 0.009;
      float onEdge = max(step(abs(vUv.x - bandL), edgeW),
                         step(abs(vUv.x - bandR), edgeW));

      vec3 bgC   = baseColor * 0.10;
      vec3 bandC = baseColor * 0.44;
      vec3 lineC = baseColor * 1.10 + vec3(0.08);
      vec3 edgeC = mix(bandC, lineC, 0.45);

      vec3 color = mix(bgC, bandC, inBand);
      color = mix(color, lineC,  onLine);
      color = mix(color, edgeC,  onEdge);
      gl_FragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
    }
  `,

  // ── Animated motion illusions ──────────────────────────────────────────────

  // Moiré Rings — two sets of concentric rings whose centers drift slowly apart.
  moireRings: `
    uniform vec3 baseColor;
    uniform float time;
    varying vec2 vUv;

    void main() {
      const float PI = 3.14159265;
      float freq = 20.0;

      // Primary rings, fixed at tile center
      vec2 c1 = vUv - 0.5;
      float r1 = length(c1) * freq;

      // Secondary rings — center drifts in a slow Lissajous orbit
      float ox = 0.055 * sin(time * 0.25);
      float oy = 0.055 * cos(time * 0.18);
      vec2  c2 = vUv - vec2(0.5 + ox, 0.5 + oy);
      float r2 = length(c2) * freq;

      // Interference: product of two sine waves
      float moire = sin(r1 * PI * 2.0) * sin(r2 * PI * 2.0);
      float bright = moire * 0.5 + 0.5;

      vec3 color = mix(baseColor * 0.28, baseColor * 1.15, bright);
      // Soft circular vignette
      color *= 1.0 - smoothstep(0.44, 0.52, length(c1));
      gl_FragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
    }
  `,

  // Moiré Lines — two layers of fine parallel lines at slightly different angles.
  moireLines: `
    uniform vec3 baseColor;
    uniform float time;
    varying vec2 vUv;

    void main() {
      const float PI = 3.14159265;
      float freq = 28.0;

      // Layer 1 — fixed shallow angle
      float ang1 = 0.05;
      float proj1 = vUv.x * sin(ang1) + vUv.y * cos(ang1);
      float lines1 = sin(proj1 * freq * PI * 2.0);

      // Layer 2 — angle drifts slowly, plus a slow phase scroll
      float ang2 = ang1 + 0.07 + 0.022 * sin(time * 0.14);
      float proj2 = vUv.x * sin(ang2) + vUv.y * cos(ang2);
      float lines2 = sin(proj2 * freq * PI * 2.0 + time * 0.12);

      float moire = lines1 * lines2;
      float bright = moire * 0.5 + 0.5;

      vec3 color = mix(baseColor * 0.25, baseColor * 1.2, bright);
      gl_FragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
    }
  `,

  // Infinity Tunnel — nested square rings scroll toward the viewer, giving the
  // sensation of falling down a bottomless tunnel.
  infinityTunnel: `
    uniform vec3 baseColor;
    uniform float time;
    varying vec2 vUv;

    void main() {
      vec2  c = vUv - 0.5;

      // Chebyshev distance → square cross-section rings
      float r = max(abs(c.x), abs(c.y));

      // Logarithmic depth maps small r (center) to large depth values
      float depth = -log2(r + 0.001) * 0.38;

      // Scroll inward over time
      float scrolled = fract(depth + time * 0.55);

      // Alternate checkerboard sectors around the tunnel wall
      float ang   = atan(c.y, c.x) / (2.0 * 3.14159265) + 0.5;
      float sector = mod(floor(ang * 8.0) + floor(depth + time * 0.55), 2.0);

      float band  = mod(floor(scrolled * 2.0) + sector, 2.0);
      float fade  = smoothstep(0.5, 0.38, r);   // circular clip at tile edge

      vec3 colA  = baseColor * 1.1;
      vec3 colB  = baseColor * 0.28;
      vec3 color = mix(colA, colB, band) * fade;

      // Bright vanishing-point glow at the centre
      color += baseColor * smoothstep(0.07, 0.0, r) * 0.9;

      gl_FragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
    }
  `,

  // Vortex — logarithmic spiral arms spin inward like water draining.
  vortex: `
    uniform vec3 baseColor;
    uniform float time;
    varying vec2 vUv;

    void main() {
      const float PI = 3.14159265;
      vec2  c = vUv - 0.5;
      float r = length(c);
      float ang = atan(c.y, c.x);

      // Twist tightens toward centre (logarithmic)
      float twist = ang / (PI * 2.0) + log(r + 0.02) * 1.2 - time * 0.55;

      float nArms = 6.0;
      float spiral = sin(twist * nArms * PI * 2.0);
      float bright = spiral * 0.5 + 0.5;

      // Subtle luminance depth cue: darker toward edge
      bright *= 1.0 - r * 0.5;

      float fade  = 1.0 - smoothstep(0.37, 0.51, r);
      vec3  color = mix(baseColor * 0.22, baseColor * 1.25, bright) * fade;

      // Hot-white centre
      color = mix(color, baseColor * 1.6, smoothstep(0.06, 0.0, r));

      gl_FragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
    }
  `,

  // Shockwave — multiple concentric pulse rings travel outward at different speeds.
  shockwave: `
    uniform vec3 baseColor;
    uniform float time;
    varying vec2 vUv;

    void main() {
      vec2  c = vUv - 0.5;
      float r = length(c);

      // Three ring families at different spatial / temporal frequencies
      float w  = sin(r * 38.0 - time * 3.6) * 0.5 + 0.5;
      w += (sin(r * 22.0 - time * 2.2) * 0.5 + 0.5) * 0.55;
      w += (sin(r * 14.0 - time * 1.4) * 0.5 + 0.5) * 0.35;
      w /= 1.9;

      float bright = clamp(w, 0.0, 1.0);
      float fade   = 1.0 - smoothstep(0.43, 0.51, r);

      vec3 color = mix(baseColor * 0.22, baseColor * 1.3, bright) * fade;
      gl_FragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
    }
  `,
};
