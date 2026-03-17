// Nature / organic tile shaders: lava, galaxy, glass, comic, grass, ice, sand, water, wood
import { shaderUtils } from './shaderBase.js';

export const natureShaders = {
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
};
