// TileStyleMaterials.jsx - Shared shader materials for tile styles
// Uses GPU-based procedural textures to avoid memory overhead

import * as THREE from 'three';

// Shared time uniform updated by useFrame in parent
export const sharedUniforms = {
  time: { value: 0 },
};

// Update time uniform (call from useFrame)
export function updateSharedTime(elapsed) {
  sharedUniforms.time.value = elapsed;
}

// ─── Shared tremor state ─────────────────────────────────────────────────────
// Pre-computed ONCE per frame by CubeAssembly, then read by every StickerPlane
// and ParityBreakthrough instance.  Eliminates the identical 3×sin + pow + max
// that was previously duplicated across every wormhole sticker per frame.
// At 54 flipped stickers on a 3×3 @ 60 fps this removes ~32 k redundant trig
// calls / second before scaling to 4×4 or 5×5.
export const sharedTremorState = {
  surge: 0, // Math.pow(Math.max(0, raw), 2) — pure magnitude in [0, 1]
  mult: 1,  // 1 + surge * 4 — position scale-factor used by tremor code
};

// ─── Flip burst map ───────────────────────────────────────────────────────────
// Written by StickerPlane during a flip (key = sticker gridId, value = rawP
// 0→1). Read by WormholeTunnel to drive the arch-lift and opacity burst.
// Entries are deleted when the flip completes (spinT hits 0).
export const flipBurstMap = new Map();

/**
 * Recompute tremor state from the current elapsed clock time.
 * Must be called once per frame from CubeAssembly's useFrame, before any
 * StickerPlane reads sharedTremorState.
 */
export function updateSharedTremor(elapsedTime) {
  const raw =
    Math.sin(elapsedTime * 1.5) * 0.45 +
    Math.sin(elapsedTime * 2.7) * 0.3 +
    Math.sin(elapsedTime * 0.6) * 0.25;
  const surge = Math.pow(Math.max(0, raw), 2.0);
  sharedTremorState.surge = surge;
  sharedTremorState.mult = 1 + surge * 4;
}

// Common vertex shader for all styles
const baseVertexShader = `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vViewPosition;

  void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vViewPosition = -mvPosition.xyz;
    gl_Position = projectionMatrix * mvPosition;
  }
`;

// Utility functions shared across shaders
const shaderUtils = `
  // Hash functions for procedural patterns
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  float hash3(vec3 p) {
    return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453);
  }

  // Simplex-style noise
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  // FBM for organic patterns
  float fbm(vec2 p) {
    float f = 0.0;
    f += 0.5 * noise(p); p *= 2.01;
    f += 0.25 * noise(p); p *= 2.02;
    f += 0.125 * noise(p); p *= 2.03;
    f += 0.0625 * noise(p);
    return f;
  }
`;

// Style-specific fragment shaders
const fragmentShaders = {
  // Solid - simple flat color
  solid: `
    uniform vec3 baseColor;
    varying vec2 vUv;

    void main() {
      gl_FragColor = vec4(baseColor, 1.0);
    }
  `,

  // Glossy - specular highlights
  glossy: `
    uniform vec3 baseColor;
    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vViewPosition;

    void main() {
      vec3 normal = normalize(vNormal);
      vec3 viewDir = normalize(vViewPosition);

      // Fake specular highlight
      vec3 lightDir = normalize(vec3(1.0, 1.0, 1.0));
      vec3 halfDir = normalize(lightDir + viewDir);
      float spec = pow(max(dot(normal, halfDir), 0.0), 32.0);

      vec3 color = baseColor + vec3(spec * 0.5);
      gl_FragColor = vec4(color, 1.0);
    }
  `,

  // Matte - soft diffuse
  matte: `
    uniform vec3 baseColor;
    varying vec2 vUv;
    varying vec3 vNormal;

    void main() {
      vec3 normal = normalize(vNormal);
      float diffuse = max(dot(normal, normalize(vec3(0.5, 1.0, 0.5))), 0.3);
      vec3 color = baseColor * (0.7 + diffuse * 0.3);
      gl_FragColor = vec4(color, 1.0);
    }
  `,

  // Metallic - brushed metal with anisotropic highlight
  metallic: `
    uniform vec3 baseColor;
    uniform float time;
    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vViewPosition;

    ${shaderUtils}

    void main() {
      vec3 normal = normalize(vNormal);
      vec3 viewDir = normalize(vViewPosition);

      // Brushed metal streaks
      float brushed = noise(vUv * vec2(50.0, 5.0)) * 0.1;

      // Anisotropic-style highlight
      vec3 lightDir = normalize(vec3(1.0, 1.0, 0.5));
      float NdotL = max(dot(normal, lightDir), 0.0);
      vec3 halfDir = normalize(lightDir + viewDir);
      float spec = pow(max(dot(normal, halfDir), 0.0), 64.0);

      vec3 color = baseColor * (0.6 + NdotL * 0.3) + brushed;
      color += vec3(spec * 0.8);

      gl_FragColor = vec4(color, 1.0);
    }
  `,

  // Carbon Fiber - woven pattern
  carbonFiber: `
    uniform vec3 baseColor;
    varying vec2 vUv;

    void main() {
      vec2 uv = vUv * 8.0;

      // Woven pattern
      float weave1 = step(0.5, fract(uv.x)) * step(0.5, fract(uv.y + 0.5 * floor(uv.x)));
      float weave2 = step(0.5, fract(uv.x + 0.5)) * step(0.5, fract(uv.y + 0.5 * floor(uv.x + 0.5)));
      float pattern = weave1 + weave2 * 0.5;

      vec3 darkColor = baseColor * 0.3;
      vec3 color = mix(darkColor, baseColor, pattern * 0.7 + 0.3);

      // Subtle sheen
      color += vec3(0.05) * (1.0 - abs(vUv.x - 0.5) * 2.0);

      gl_FragColor = vec4(color, 1.0);
    }
  `,

  // Hexagon Grid - honeycomb pattern
  hexGrid: `
    uniform vec3 baseColor;
    varying vec2 vUv;

    float hexDistance(vec2 p) {
      p = abs(p);
      return max(p.x * 0.866025 + p.y * 0.5, p.y);
    }

    void main() {
      vec2 uv = vUv * 6.0;

      // Hex grid
      vec2 r = vec2(1.0, 1.732);
      vec2 h = r * 0.5;
      vec2 a = mod(uv, r) - h;
      vec2 b = mod(uv - h, r) - h;
      vec2 gv = length(a) < length(b) ? a : b;

      float d = hexDistance(gv);
      float edge = smoothstep(0.4, 0.45, d);

      vec3 edgeColor = baseColor * 0.4;
      vec3 color = mix(baseColor, edgeColor, edge);

      gl_FragColor = vec4(color, 1.0);
    }
  `,

  // Circuit Board - tech traces
  circuit: `
    uniform vec3 baseColor;
    uniform float time;
    varying vec2 vUv;

    ${shaderUtils}

    void main() {
      vec2 uv = vUv * 10.0;

      // Grid lines
      vec2 grid = abs(fract(uv) - 0.5);
      float lines = step(0.45, max(grid.x, grid.y));

      // Random traces
      vec2 cell = floor(uv);
      float r = hash(cell);
      float trace = 0.0;
      if (r > 0.7) {
        trace = step(0.4, grid.x) * step(grid.y, 0.1);
      } else if (r > 0.4) {
        trace = step(0.4, grid.y) * step(grid.x, 0.1);
      }

      // Solder points
      float point = 1.0 - smoothstep(0.0, 0.15, length(fract(uv) - 0.5));
      point *= step(0.8, hash(cell + 100.0));

      // Animated pulse along traces
      float pulse = sin(time * 3.0 + cell.x * 2.0 + cell.y * 3.0) * 0.5 + 0.5;

      vec3 traceColor = baseColor * 1.5;
      vec3 bgColor = baseColor * 0.3;
      vec3 color = bgColor;
      color = mix(color, baseColor * 0.6, lines);
      color = mix(color, traceColor, trace);
      color = mix(color, traceColor * (1.0 + pulse * 0.5), point);

      gl_FragColor = vec4(color, 1.0);
    }
  `,

  // Holographic - rainbow iridescence
  holographic: `
    uniform vec3 baseColor;
    uniform float time;
    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vViewPosition;

    void main() {
      vec3 viewDir = normalize(vViewPosition);
      vec3 normal = normalize(vNormal);

      // View-dependent color shift
      float fresnel = 1.0 - abs(dot(viewDir, normal));

      // Rainbow based on UV and time
      float hue = fract(vUv.x * 2.0 + vUv.y + time * 0.3);
      vec3 rainbow;
      rainbow.r = abs(hue * 6.0 - 3.0) - 1.0;
      rainbow.g = 2.0 - abs(hue * 6.0 - 2.0);
      rainbow.b = 2.0 - abs(hue * 6.0 - 4.0);
      rainbow = clamp(rainbow, 0.0, 1.0);

      // Blend base color with rainbow
      vec3 color = mix(baseColor, rainbow, fresnel * 0.6);

      // Sparkle
      float sparkle = pow(fresnel, 4.0) * 0.5;
      color += vec3(sparkle);

      gl_FragColor = vec4(color, 1.0);
    }
  `,

  // Pulse - animated brightness wave (square rings via Chebyshev distance)
  pulse: `
    uniform vec3 baseColor;
    uniform float time;
    varying vec2 vUv;

    void main() {
      // Chebyshev (L-inf) distance — produces square concentric rings instead of circular
      vec2 d = abs(vUv - 0.5);
      float dist = max(d.x, d.y) * 2.0;
      float wave = sin(dist * 10.0 - time * 4.0) * 0.5 + 0.5;
      wave *= 1.0 - dist; // Fade at edges

      vec3 color = baseColor * (0.7 + wave * 0.5);

      // Bright center
      float center = 1.0 - smoothstep(0.0, 0.3, dist);
      color += baseColor * center * 0.3 * (sin(time * 2.0) * 0.5 + 0.5);

      gl_FragColor = vec4(color, 1.0);
    }
  `,

  // Lava - molten flow
  lava: `
    uniform vec3 baseColor;
    uniform float time;
    varying vec2 vUv;

    ${shaderUtils}

    void main() {
      vec2 uv = vUv * 3.0;

      // Flowing lava pattern
      float n1 = fbm(uv + time * 0.2);
      float n2 = fbm(uv * 2.0 - time * 0.15);
      float lava = n1 * n2;

      // Hot spots
      float hot = pow(lava, 2.0);

      // Color gradient: dark crust to bright lava
      vec3 crustColor = baseColor * 0.35;
      vec3 hotColor = baseColor * 1.5 + vec3(0.3, 0.1, 0.0);
      vec3 brightColor = vec3(1.0, 0.8, 0.3);

      vec3 color = mix(crustColor, hotColor, lava);
      color = mix(color, brightColor, hot * 0.5);

      // Cracks
      float crack = smoothstep(0.4, 0.45, n1);
      color = mix(color, brightColor, crack * 0.3);

      gl_FragColor = vec4(color, 1.0);
    }
  `,

  // Galaxy - stars and nebula
  galaxy: `
    uniform vec3 baseColor;
    uniform float time;
    varying vec2 vUv;

    ${shaderUtils}

    void main() {
      vec2 uv = vUv;

      // Nebula background
      float nebula = fbm(uv * 4.0 + time * 0.05);
      vec3 nebulaColor = mix(baseColor * 0.10, baseColor * 0.55, nebula);

      // Stars
      vec2 starUv = uv * 20.0;
      vec2 starCell = floor(starUv);
      float stars = 0.0;

      for (int x = -1; x <= 1; x++) {
        for (int y = -1; y <= 1; y++) {
          vec2 cell = starCell + vec2(float(x), float(y));
          vec2 starPos = cell + vec2(hash(cell), hash(cell + 50.0));
          float d = length(starUv - starPos);
          float twinkle = sin(time * (2.0 + hash(cell) * 3.0) + hash(cell) * 6.28) * 0.3 + 0.7;
          stars += smoothstep(0.15, 0.0, d) * twinkle * step(0.85, hash(cell + 100.0));
        }
      }

      vec3 color = nebulaColor + vec3(stars);

      // Central glow
      float glow = 1.0 - length(uv - 0.5) * 1.5;
      color += baseColor * glow * 0.2;

      gl_FragColor = vec4(color, 1.0);
    }
  `,

  // Glass - translucent with Fresnel edge glow and specular highlights
  glass: `
    uniform vec3 baseColor;
    uniform float time;
    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vViewPosition;

    void main() {
      vec3 normal = normalize(vNormal);
      vec3 viewDir = normalize(vViewPosition);

      // Fresnel: more reflective (brighter) at glancing angles, more transparent head-on
      float fresnel = pow(1.0 - abs(dot(viewDir, normal)), 3.0);

      // Multiple specular highlights simulating light refraction
      vec3 light1 = normalize(vec3(1.0, 1.0, 1.0));
      vec3 light2 = normalize(vec3(-0.5, 0.8, 0.3));
      vec3 half1 = normalize(light1 + viewDir);
      vec3 half2 = normalize(light2 + viewDir);
      float spec1 = pow(max(dot(normal, half1), 0.0), 64.0);
      float spec2 = pow(max(dot(normal, half2), 0.0), 48.0);

      // Subtle color dispersion at edges (chromatic aberration hint)
      vec3 tint = baseColor;
      tint.r += fresnel * 0.08;
      tint.b += fresnel * 0.05;

      // Base glass color: tinted and translucent
      vec3 color = tint * (0.5 + fresnel * 0.6);

      // Add specular highlights (white glints like real glass)
      color += vec3(spec1 * 0.9 + spec2 * 0.4);

      // Bright edge rim like light catching glass edges
      float edgeX = smoothstep(0.0, 0.08, min(vUv.x, 1.0 - vUv.x));
      float edgeY = smoothstep(0.0, 0.08, min(vUv.y, 1.0 - vUv.y));
      float edgeFactor = 1.0 - edgeX * edgeY;
      color += vec3(edgeFactor * 0.6) * (baseColor * 0.5 + 0.5);

      // Alpha: more transparent in center, less at edges (Fresnel)
      float alpha = 0.25 + fresnel * 0.45 + edgeFactor * 0.3;

      gl_FragColor = vec4(color, alpha);
    }
  `,

  // Comic Book - bold outlines and halftone
  comic: `
    uniform vec3 baseColor;
    varying vec2 vUv;
    varying vec3 vNormal;

    void main() {
      vec3 normal = normalize(vNormal);
      float light = max(dot(normal, normalize(vec3(1.0, 1.0, 1.0))), 0.0);

      // Halftone dots for shading
      vec2 uv = vUv * 20.0;
      float dot = length(fract(uv) - 0.5);
      float halftone = step(dot, 0.3 * (1.0 - light));

      vec3 color = baseColor;
      color = mix(color, baseColor * 0.5, halftone);

      // Edge darkening (fake outline)
      float edge = smoothstep(0.0, 0.1, min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y)));
      color *= edge * 0.3 + 0.7;

      gl_FragColor = vec4(color, 1.0);
    }
  `,

  // Grass ground — earthy dirt/soil base visible between grass blades
  grass: `
    uniform vec3 baseColor;
    uniform float time;
    varying vec2 vUv;

    ${shaderUtils}

    void main() {
      vec2 uv = vUv * 6.0;

      // Earthy base: mix face color with brown soil tones
      vec3 soil = vec3(0.28, 0.18, 0.08);
      vec3 earth = mix(soil, baseColor * 0.4, 0.25);

      // Noise for dirt texture variation
      float n = fbm(uv + 0.5);
      earth = mix(earth, earth * 1.4, n * 0.5);

      // Small pebble/grain spots
      float grain = noise(uv * 8.0);
      earth = mix(earth, earth * 0.6, smoothstep(0.7, 0.75, grain) * 0.4);

      // Subtle darker patches (moisture)
      float moisture = fbm(uv * 0.8 + 10.0);
      earth = mix(earth, earth * 0.7, smoothstep(0.5, 0.7, moisture) * 0.3);

      gl_FragColor = vec4(earth, 1.0);
    }
  `,

  // Ice — frozen crystalline surface with cracks and shimmer
  ice: `
    uniform vec3 baseColor;
    uniform float time;
    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vViewPosition;

    ${shaderUtils}

    // Voronoi for crack/cell pattern
    vec2 voronoi(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      float d1 = 1.0;
      float d2 = 1.0;
      for (int x = -1; x <= 1; x++) {
        for (int y = -1; y <= 1; y++) {
          vec2 n = vec2(float(x), float(y));
          vec2 pos = vec2(hash(i + n), hash(i + n + 50.0));
          float d = length(f - n - pos);
          if (d < d1) { d2 = d1; d1 = d; }
          else if (d < d2) { d2 = d; }
        }
      }
      return vec2(d1, d2);
    }

    void main() {
      vec2 uv = vUv * 5.0;
      vec3 normal = normalize(vNormal);
      vec3 viewDir = normalize(vViewPosition);

      // Ice base color — cool blue/white
      vec3 iceBase = mix(baseColor, vec3(0.75, 0.88, 1.0), 0.5);

      // Voronoi cracks
      vec2 v = voronoi(uv);
      float crack = smoothstep(0.02, 0.06, v.y - v.x);
      // Deep cracks are darker
      vec3 crackColor = iceBase * 0.3;

      // Subsurface scattering simulation — light bleeding through
      float sss = fbm(uv * 2.0 + time * 0.03) * 0.3;
      vec3 subsurface = mix(iceBase, vec3(0.4, 0.7, 1.0), sss);

      vec3 color = mix(crackColor, subsurface, crack);

      // Frost crystals at edges
      float edgeDist = min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y));
      float frost = noise(uv * 12.0) * smoothstep(0.15, 0.0, edgeDist);
      color = mix(color, vec3(0.9, 0.95, 1.0), frost * 0.6);

      // Fresnel rim — brighter at glancing angles
      float fresnel = pow(1.0 - abs(dot(viewDir, normal)), 3.0);
      color += vec3(0.3, 0.5, 0.8) * fresnel * 0.4;

      // Sparkle: tiny bright spots that shift with view/time
      float sparkle = noise(uv * 30.0 + time * 0.5);
      sparkle = pow(sparkle, 12.0) * 3.0;
      color += vec3(sparkle);

      gl_FragColor = vec4(color, 1.0);
    }
  `,

  // Sand — animated hourglass with falling sand
  sand: `
    uniform vec3 baseColor;
    uniform float time;
    varying vec2 vUv;

    ${shaderUtils}

    void main() {
      vec2 uv = vUv;
      // Flip y so fy=0 is the visual top and fy=1 is the visual bottom
      float fy = 1.0 - uv.y;
      float cx = uv.x - 0.5;   // [-0.5, 0.5], 0 = horizontal center
      float cy = fy - 0.5;     // [-0.5, 0.5], 0 = neck

      // 8-second fill cycle then instant "flip" (mod restart)
      float t = mod(time * 0.125, 1.0);   // 0 → 1 over 8 s

      // ── Hourglass geometry ─────────────────────────────────────────
      // Half-width tapers from 0.42 at top/bottom (|cy|=0.5) to 0.04 at neck
      float halfW   = 0.04 + abs(cy) * 0.76;
      float inGlass = step(abs(cx), halfW)
                    * step(0.03, fy)
                    * step(0.03, 1.0 - fy);

      // Glass border: side walls + top/bottom caps
      float borderW = 0.018;
      float sideBdr = (step(abs(cx), halfW) - step(abs(cx), halfW - borderW))
                    * step(0.03, fy) * step(0.03, 1.0 - fy);
      float topCap  = step(fy, 0.036)         * step(abs(cx), halfW);
      float botCap  = step(1.0 - 0.036, fy)   * step(abs(cx), halfW);
      float onBorder = max(sideBdr, max(topCap, botCap));

      // ── Upper sand (top chamber, fy < 0.5): surface drops toward neck ─
      float upperFill   = 1.0 - t;
      float sandSurface = upperFill * 0.45;   // fy of sand's bottom edge
      float inUpperSand = inGlass
                        * step(fy, 0.5)
                        * step(fy, sandSurface);

      // ── Lower sand pile (fy > 0.5): cone grows upward from bottom ───
      float pileH      = t * 0.45;
      float apexFY     = 0.97 - pileH;          // fy of pile apex (rising)
      float pileSlope  = 0.65;
      float pileSurfFY = apexFY + abs(cx) * pileSlope;  // cone in fy space
      float inLowerSand = inGlass
                        * step(0.5, fy)
                        * step(pileSurfFY, fy)   // below the cone surface
                        * step(0.005, pileH);

      // ── Falling stream at neck (fy increasing = downward) ──────────
      float streamW  = 0.030;
      float inStream = step(abs(cx), streamW) * inGlass
                     * (1.0 - inUpperSand) * (1.0 - inLowerSand);
      // noise argument decreases over time → pattern moves toward larger fy (downward)
      float fallNoise = noise(vec2(cx * 25.0 + 1.3, fy * 7.0 - time * 4.5));
      float stream    = smoothstep(0.5, 1.0, fallNoise) * inStream;
      stream *= smoothstep(0.0, 0.06, t) * smoothstep(1.0, 0.93, t);

      // ── Surface grain texture ──────────────────────────────────────
      float shimmer = noise(uv * 55.0 + vec2(time * 0.08, 0.0)) * 0.07;

      // ── Colors ────────────────────────────────────────────────────
      // Sand: face color is the dominant hue; earthy brown mixed in for grit
      vec3 sandBrown = vec3(0.52, 0.35, 0.16);
      vec3 sandTone  = mix(baseColor, sandBrown, 0.28) + shimmer;
      vec3 upperC    = sandTone;
      vec3 lowerC    = sandTone * 0.82;           // pile slightly shadowed
      vec3 streamC   = mix(sandTone, vec3(1.0), 0.15) * 1.15;  // bright falling grains

      // Glass edge: baseColor brightened toward white — looks like translucent glass
      vec3 glassC    = mix(baseColor, vec3(0.88, 0.92, 0.96), 0.55);

      vec3 bg    = baseColor * 0.05 + vec3(0.02, 0.03, 0.06);
      vec3 inner = bg * 1.6;   // slightly lighter interior void

      vec3 color = mix(vec3(0.0), inner, inGlass);
      color = mix(color, lowerC,  inLowerSand);
      color = mix(color, upperC,  inUpperSand);
      color = mix(color, streamC, stream);
      color = mix(color, glassC,  onBorder * 0.78);

      gl_FragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
    }
  `,

  // Water — underwater floor visible through the WaterVolume component above it.
  // Sandy/rocky seabed with caustic light patterns refracting down from the surface.
  // Connects to: physics (wave optics, refraction), oceanography, fluid dynamics
  water: `
    uniform vec3 baseColor;
    uniform float time;
    varying vec2 vUv;

    ${shaderUtils}

    void main() {
      vec2 uv = vUv * 4.5;

      // Sandy/rocky ocean floor tinted by face colour
      vec3 sand  = mix(vec3(0.58, 0.47, 0.30), baseColor * 0.42, 0.28);
      float n    = fbm(uv * 1.3 + 0.35);
      sand = mix(sand * 0.80, sand * 1.20, n * 0.55);

      // Refraction-shadow ripples — darker stripes between caustic foci
      float ripple = sin(uv.x * 7.0 + fbm(uv * 0.9) * 3.2 - time * 0.52) * 0.5 + 0.5;
      sand = mix(sand * 0.88, sand, ripple);

      // Bright caustic foci — light focused by surface waves
      float c1     = noise(uv * 3.8 + time * 0.50);
      float c2     = noise(uv * 3.8 - time * 0.40 + 0.85);
      float caustic = pow(c1 * c2, 2.6) * 5.5;

      // Overall deep-water tint (blue-green veil over the floor)
      vec3 waterTint = mix(vec3(0.03, 0.14, 0.40), baseColor * 0.28, 0.20);

      vec3 color = mix(waterTint * 0.60, sand, 0.52);
      color += vec3(0.32, 0.58, 0.88) * caustic * 0.28;

      gl_FragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
    }
  `,

  // Wood — tree cross-section with growth rings, medullary rays, heartwood gradient
  // Connects to: biology (dendrochronology, plant anatomy), ecology, time/age
  wood: `
    uniform vec3 baseColor;
    uniform float time;
    varying vec2 vUv;

    ${shaderUtils}

    void main() {
      vec2 uv = vUv - 0.5;

      // Radial distance for annual growth rings
      float r = length(uv) * 9.0;
      // Organic warp makes rings non-circular
      float warp = fbm(uv * 2.8 + 0.5) * 1.1;
      float ring  = sin((r + warp) * 3.14159) * 0.5 + 0.5;

      // Heartwood (dark, dense center) fades to lighter sapwood at rim
      float heartwood = 1.0 - smoothstep(0.0, 0.38, length(uv));

      // Wood palette: warm honey-brown, tinted by face color
      vec3 light = mix(vec3(0.72, 0.52, 0.30), baseColor * 0.45, 0.22);
      vec3 dark  = light * 0.52;
      vec3 heart = mix(light * 0.58, vec3(0.30, 0.16, 0.08), 0.48);

      vec3 color = mix(dark, light, ring);
      color = mix(color, heart, heartwood * 0.62);

      // Radial medullary rays — bright thin lines radiating from pith
      float angle = atan(uv.y, uv.x);
      float ray   = pow(smoothstep(0.88, 1.0, sin(angle * 22.0) * 0.5 + 0.5), 2.0);
      color = mix(color, light * 1.25, ray * 0.14);

      // Fine longitudinal grain
      float grain = noise(vUv * vec2(3.5, 55.0));
      color = mix(color, color * 1.14, grain * 0.18);

      gl_FragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
    }
  `,

  // Neural — synaptic soma nodes with animated signal pulses along the dendrite web
  // Connects to: neuroscience (action potentials), graph theory, machine learning
  neural: `
    uniform vec3 baseColor;
    uniform float time;
    varying vec2 vUv;

    ${shaderUtils}

    void main() {
      vec2 uv = vUv * 6.0;
      vec2 cell = floor(uv);
      vec2 f    = fract(uv);

      // Soma nodes: one per Voronoi cell, pulsing at individual rates
      float glow = 0.0;
      float minD = 10.0;
      vec2 closestCell = cell;
      for (int x = -1; x <= 1; x++) {
        for (int y = -1; y <= 1; y++) {
          vec2 n   = vec2(float(x), float(y));
          vec2 pos = n + vec2(hash(cell + n), hash(cell + n + 50.0));
          float d  = length(f - pos);
          float hz = 1.4 + hash(cell + n + 20.0) * 2.2;
          float ph = hash(cell + n) * 6.28;
          float pulse = sin(time * hz + ph) * 0.5 + 0.5;
          glow += smoothstep(0.14, 0.0, d) * (0.55 + pulse * 0.9);
          if (d < minD) { minD = d; closestCell = cell + n; }
        }
      }

      // Axon web: fbm-shaped filaments carry traveling signals
      float webN = fbm(uv * 0.85 + time * 0.04);
      float web  = abs(sin(uv.x * 4.2 + webN * 3.1) * sin(uv.y * 4.2 + webN * 2.3));
      web = smoothstep(0.82, 0.93, web) * 0.45;

      float signal = web * (sin(uv.x * 4.2 + uv.y * 3.3 - time * 2.8) * 0.5 + 0.5);

      // Dark neural background (slightly lighter so patterns read on all colors)
      vec3 bg    = mix(vec3(0.06, 0.10, 0.25), baseColor * 0.22, 0.55);
      vec3 color = bg;
      color += baseColor * glow * 0.85;
      color += baseColor * 0.45 * web;
      color += vec3(0.55, 0.78, 1.0) * signal * 0.55;

      gl_FragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
    }
  `,

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
  // luminance ramp (black → dark-grey → white → light-grey).  Alternate rings
  // use the reversed order.  In peripheral vision the rings appear to spin in
  // opposite directions even though the image is completely static
  // (Kitaoka & Ashida 2003 class of peripheral-drift illusions).
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
  // segments appear to be on different trajectories, even though they form a
  // single straight line (Zöllner/Poggendorff 1860).
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

  // ── Animated motion illusions (Living section) ─────────────────────────────

  // Moiré Rings — two sets of concentric rings whose centers drift slowly apart.
  // Their interference pattern creates shimmering, morphing moiré bands.
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
  // As the angle drifts over time the interference bands drift and morph.
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
  // sensation of falling down a bottomless tunnel (Chebyshev metric + log depth).
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

  // Vortex — logarithmic spiral arms spin inward like water draining, stronger
  // twist near the centre gives convincing depth and rotational velocity.
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

  // Shockwave — multiple concentric pulse rings travel outward at different
  // speeds and frequencies; their overlap creates a sense of depth and motion.
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

  // ── Antipodal-color patterns ────────────────────────────────────────────────
  // These use both baseColor (this face) and antipodalColor (opposite face).
  // When antipodalColor is not provided (e.g. style previews), getTileStyleMaterial
  // derives a hue-shifted contrast color automatically.

  // Polka Dots — small circles (~20% coverage) of antipodalColor on a baseColor background.
  // Asymmetric: base dominates; flipped version shows base dots on antipodal field — clearly different.
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
  // Asymmetric: thin antipodal chevrons on a base field; flipped shows thin base chevrons on antipodal — clearly different.
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
  // Asymmetric: base dominates as wide tiles; flipped shows antipodal tiles with base grout — clearly different.
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
  // Asymmetric: thin stripes on a base field; flipped shows thin base stripes on antipodal — clearly different.
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

  // ── New asymmetric antipodal patterns ──────────────────────────────────────
  // All use a clear majority/minority split so flipping base↔antipodal
  // produces a visually distinct result — you can always tell which manifold is which.

  // Corner Accent — antipodalColor triangle in bottom-left corner (~19% coverage).
  // Base color fills the rest. Flipped: small base triangle on antipodal field.
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
  // Flipped: big antipodal field with a base-colored circle center — very different feel.
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
  // Flipped: base cross on antipodal field — clearly different visual weight.
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
  // Flipped: antipodal interior with base frame — the center color completely swaps.
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
  // Two sets of 45°/135° thin lines. Flipped: solid antipodal with base cross-hatch.
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
  // Flipped: six base dots on antipodal field — the surrounding color completely swaps.
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
};

// ─── LRU material cache ───────────────────────────────────────────────────────
// Key: "${style}_${colorHex}".  200 slots covers 20 styles × 6 face colors ×
// several active color schemes with room to spare.  On eviction the GPU program
// is disposed immediately so memory doesn't accumulate over long sessions.
//
// NOTE: clearMaterialCache() disposes everything at once and should be called
// before a color-scheme change re-renders (e.g. at the top of the Zustand
// setSettings action that mutates face hex values).  Calling it after the new
// materials have already been created would dispose them out from under active
// meshes.  The LRU cap handles slow drift (custom colour pickers, many style
// previews) without needing precise timing.
const MAX_MAT_CACHE = 200;
const materialCache = new Map();

function _matCacheGet(key) {
  if (!materialCache.has(key)) return undefined;
  // LRU promotion: move to tail (most-recently-used end)
  const mat = materialCache.get(key);
  materialCache.delete(key);
  materialCache.set(key, mat);
  return mat;
}

function _matCachePut(key, mat) {
  if (materialCache.has(key)) materialCache.delete(key);
  materialCache.set(key, mat);
  // Evict the least-recently-used entry when over cap
  if (materialCache.size > MAX_MAT_CACHE) {
    const lruKey = materialCache.keys().next().value;
    materialCache.get(lruKey).dispose();
    materialCache.delete(lruKey);
  }
}

// Styles that use a second antipodalColor uniform (opposite face's color)
const ANTIPODAL_STYLES = new Set([
  'polkaDots', 'zigzag', 'checkerboard', 'diagStripes',
  'cornerAccent', 'innerDisc', 'crossPlus', 'borderFrame', 'thinHatch', 'dotRing',
]);

/**
 * Get or create a shader material for a tile style.
 * @param {string} style - tile style key
 * @param {string} colorHex - hex color for this face
 * @param {boolean} useTexture - unused (reserved)
 * @param {object} texture - unused (reserved)
 * @param {string|null} antipodalHex - hex color of the antipodal face (for antipodal patterns).
 *   When null for an antipodal-style, a hue-shifted contrast color is derived automatically.
 */
export function getTileStyleMaterial(style, colorHex, useTexture = false, texture = null, antipodalHex = null) {
  // Texture path: currently unused (all callers pass useTexture=false, null).
  // If activated, cache by texture.uuid to avoid per-call allocations and leaks.
  if (useTexture && texture) {
    return new THREE.MeshStandardMaterial({
      map: texture,
      color: '#ffffff',
      metalness: 0.1,
      roughness: 0.8,
    });
  }

  // Validate inputs
  const safeStyle = style || 'solid';
  const safeColorHex = colorHex || '#888888';

  // Cache key includes antipodal hex for antipodal-style patterns so each face pair
  // gets its own compiled material; other styles are unaffected.
  const antipodalSuffix = ANTIPODAL_STYLES.has(safeStyle) && antipodalHex ? `_${antipodalHex}` : '';
  const cacheKey = `${safeStyle}_${safeColorHex}${antipodalSuffix}`;
  const cached = _matCacheGet(cacheKey);
  if (cached) return cached;

  const fragmentShader = fragmentShaders[safeStyle] || fragmentShaders.solid;

  let color;
  try {
    color = new THREE.Color(safeColorHex);
  } catch (_e) {
    console.warn('Invalid color:', safeColorHex, '- using fallback');
    color = new THREE.Color('#888888');
  }

  const isGlass = safeStyle === 'glass';

  const uniforms = {
    baseColor: { value: color },
    time: sharedUniforms.time,
  };

  // Antipodal patterns need a second color uniform.  Use the provided antipodal
  // hex when available; otherwise derive a hue-shifted contrast (e.g. previews).
  if (ANTIPODAL_STYLES.has(safeStyle)) {
    let antiColor;
    if (antipodalHex) {
      try { antiColor = new THREE.Color(antipodalHex); } catch (_e) { antiColor = color.clone().offsetHSL(0.5, 0, 0); }
    } else {
      antiColor = color.clone().offsetHSL(0.5, 0.1, 0);
    }
    uniforms.antipodalColor = { value: antiColor };
  }

  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: baseVertexShader,
    fragmentShader: fragmentShader,
    side: isGlass ? THREE.DoubleSide : THREE.FrontSide,
    transparent: isGlass,
    depthWrite: !isGlass,
    blending: isGlass ? THREE.NormalBlending : THREE.NormalBlending,
  });

  _matCachePut(cacheKey, material);
  return material;
}

/**
 * Get a glass material for the glass visual mode.
 * This is a convenience wrapper that always returns a transparent glass shader.
 */
export function getGlassMaterial(colorHex) {
  return getTileStyleMaterial('glass', colorHex);
}

/**
 * Clear material cache (call on settings change)
 */
export function clearMaterialCache() {
  materialCache.forEach(mat => mat.dispose());
  materialCache.clear();
}

// Module-level Set: O(1) lookup instead of allocating an array + O(N) includes
// every time isAnimatedStyle is called (which happens per sticker per render).
const ANIMATED_STYLES = new Set(['holographic', 'pulse', 'lava', 'galaxy', 'circuit', 'grass', 'ice', 'sand', 'water', 'neural', 'moireRings', 'moireLines', 'infinityTunnel', 'vortex', 'shockwave']);

/**
 * Check if a style needs time updates (animated)
 */
export function isAnimatedStyle(style) {
  return ANIMATED_STYLES.has(style);
}

// ─── Shader warm-up ──────────────────────────────────────────────────────────
// The first time a ShaderMaterial is rendered the browser blocks ~200 ms to
// compile the GLSL.  Pre-compiling before the user interacts eliminates that
// stall.  renderer.compile() triggers the GPU pipeline without producing any
// visible output.

const DEFAULT_WARMUP_STYLES = ['solid', 'glossy', 'matte', 'metallic', 'circuit', 'holographic'];

/**
 * Pre-compile the 6 most-used tile styles for every face colour.
 * Call once on mount inside the Canvas context (CubeAssembly useEffect).
 *
 * @param {THREE.WebGLRenderer} renderer
 * @param {THREE.Camera}        camera
 * @param {string[]}            colorHexArray - one hex per cube face (length 6)
 */
export function warmUpDefaultStyles(renderer, camera, colorHexArray) {
  const scene = new THREE.Scene();
  const geo = new THREE.PlaneGeometry(0.1, 0.1);
  for (const style of DEFAULT_WARMUP_STYLES) {
    for (const colorHex of colorHexArray) {
      scene.add(new THREE.Mesh(geo, getTileStyleMaterial(style, colorHex)));
    }
  }
  renderer.compile(scene, camera);
  scene.clear(); // remove dummy meshes; materials stay cached
  geo.dispose();
}

/**
 * Pre-compile ALL tile styles for every face colour.
 * Call lazily on the first time the Tiles settings panel is opened so that
 * subsequent style selections incur zero compile stalls.
 *
 * @param {THREE.WebGLRenderer} renderer
 * @param {THREE.Camera}        camera
 * @param {string[]}            colorHexArray
 */
export function warmUpAllStyles(renderer, camera, colorHexArray) {
  const scene = new THREE.Scene();
  const geo = new THREE.PlaneGeometry(0.1, 0.1);
  for (const style of Object.keys(fragmentShaders)) {
    for (const colorHex of colorHexArray) {
      scene.add(new THREE.Mesh(geo, getTileStyleMaterial(style, colorHex)));
    }
  }
  renderer.compile(scene, camera);
  scene.clear();
  geo.dispose();
}
