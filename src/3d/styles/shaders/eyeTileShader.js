// One opaque surface: sculpted globe/socket, static tissue and iris detail.
// Movement is limited to small held fixations and an infrequent single blink.
export const eyeTileFragmentShader = `
  uniform vec3 baseColor;
  uniform vec3 antipodalColor;
  uniform float time;
  uniform vec3 tileHome;
  uniform float tileFace;
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vViewPosition;

  float eyeHash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }
  float eyeNoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(eyeHash(i), eyeHash(i + vec2(1.0, 0.0)), f.x),
      mix(eyeHash(i + vec2(0.0, 1.0)), eyeHash(i + vec2(1.0)), f.x), f.y);
  }

  void main() {
    vec2 p = vUv - 0.5;
    float seed = eyeHash(tileHome.xy + tileHome.z * 1.7 + tileFace * 0.173);
    float phase = time + seed * 113.0;
    // Hold a fixation for several seconds, then make one small saccade.
    float fixation = phase / 5.7;
    float epoch = floor(fixation);
    vec2 gazeA = vec2(eyeHash(vec2(epoch, seed)), eyeHash(vec2(epoch, seed + 2.0)));
    vec2 gazeB = vec2(eyeHash(vec2(epoch + 1.0, seed)), eyeHash(vec2(epoch + 1.0, seed + 2.0)));
    vec2 gaze = (mix(gazeA, gazeB, smoothstep(0.965, 1.0, fract(fixation))) - 0.5) * 0.13;
    float bp = mod(phase, 9.0 + seed * 5.0);
    float blink = smoothstep(0.0, 0.075, bp) * (1.0 - smoothstep(0.11, 0.27, bp));

    const float eyeR = 0.35;
    vec2 q = p / eyeR;
    float r = length(q);
    float lx = clamp(q.x / 1.025, -1.0, 1.0);
    float arc = pow(max(1.0 - lx * lx, 0.0), 0.7);
    float upper = mix(0.68, -0.08, blink) * arc;
    float lower = mix(-0.57, -0.08, blink) * arc;
    float aa = max(fwidth(q.y) * 0.8, 0.005);
    float inX = 1.0 - smoothstep(0.98, 1.025, abs(q.x));
    float aperture = (1.0 - smoothstep(upper - aa, upper + aa, q.y))
      * smoothstep(lower - aa, lower + aa, q.y) * inX * (1.0 - blink);

    // A restrained socket with soft skin folds, inset into the palette tile.
    float grain = eyeNoise(p * 95.0 + seed * 17.0);
    float socketR = length(p / vec2(0.435, 0.36));
    float socket = 1.0 - smoothstep(0.87, 1.0, socketR);
    vec3 ground = mix(antipodalColor * 0.23, baseColor * 0.35, 0.7);
    float contact = 1.0 - smoothstep(0.93, 1.15, length((p - vec2(0.014, -0.025)) / vec2(0.435, 0.36)));
    ground *= 1.0 - contact * 0.65;
    vec3 skin = mix(vec3(0.50, 0.30, 0.24), vec3(0.68, 0.47, 0.37), 0.5 + p.y * 0.65);
    skin *= 0.96 + grain * 0.08;
    float upperD = q.y - upper;
    float lowerD = lower - q.y;
    float crease = exp(-pow((upperD - 0.17 * arc) / 0.026, 2.0)) * inX;
    skin *= 1.0 - crease * 0.24;
    float lidRim = exp(-pow(upperD / 0.045, 2.0)) + exp(-pow(lowerD / 0.04, 2.0));
    skin = mix(skin, vec3(0.40, 0.19, 0.16), clamp(lidRim * inX * 0.5, 0.0, 1.0));

    // Warm sclera, with fine fixed vessels fading inward from the corners.
    vec3 sclera = mix(vec3(0.90, 0.88, 0.81), vec3(0.70, 0.40, 0.37), smoothstep(0.55, 1.05, r) * 0.38);
    float angle = atan(q.y, q.x);
    float vessels = 0.0;
    for (int i = 0; i < 5; i++) {
      float fi = float(i);
      float a = angle - fi * 1.2566 - seed * 6.2832;
      a = atan(sin(a), cos(a));
      float path = a + sin(r * 17.0 + fi * 2.7) * 0.045 + sin(r * 31.0 + fi) * 0.014;
      float width = max(fwidth(path), 0.008);
      vessels += (1.0 - smoothstep(0.004, 0.004 + width, abs(path))) * smoothstep(0.50, 0.95, r);
    }
    sclera = mix(sclera, vec3(0.55, 0.20, 0.18), min(vessels * 0.28, 0.35));

    vec2 iq = q - gaze;
    float ir = length(iq);
    float ia = atan(iq.y, iq.x);
    const float irisR = 0.48;
    const float pupilR = 0.185;
    float radial = clamp((ir - pupilR) / (irisR - pupilR), 0.0, 1.0);
    // Angular noise is sampled on a circle to avoid a seam through the iris.
    vec2 angular = vec2(cos(ia), sin(ia));
    float fibers = eyeNoise(angular * 61.0 + vec2(ir * 12.0 + seed * 13.0));
    float fine = eyeNoise(angular * 117.0 + vec2(ir * 24.0));
    float collarette = 0.265 + (eyeNoise(angular * 15.0 + seed) - 0.5) * 0.035;
    float collar = exp(-pow((ir - collarette) / 0.023, 2.0));
    vec3 iris = mix(baseColor * 0.72 + vec3(0.10, 0.065, 0.025), baseColor * 0.42, radial);
    iris *= 0.62 + fibers * 0.68 + fine * 0.25;
    iris += vec3(0.14, 0.085, 0.028) * collar;
    iris *= 1.0 - smoothstep(0.425, irisR, ir) * 0.82;
    float irisAA = max(fwidth(ir), 0.004);
    vec3 ball = mix(sclera, iris, 1.0 - smoothstep(irisR - irisAA, irisR + irisAA, ir));
    ball = mix(ball, vec3(0.003, 0.004, 0.004), 1.0 - smoothstep(pupilR - irisAA, pupilR + irisAA, ir));

    // Lid occlusion anchors the globe; a fine tear meniscus catches the light.
    ball *= 0.66 + 0.34 * smoothstep(0.0, 0.23, upper - q.y);
    ball *= 1.0 - smoothstep(0.72, 1.05, r) * 0.30;
    float tear = exp(-pow((q.y - lower - 0.013) / 0.016, 2.0)) * inX;
    ball += vec3(0.22, 0.19, 0.16) * tear;

    // Small corneal reflections, view dependent instead of painted white dots.
    vec3 n = normalize(vNormal);
    vec3 view = normalize(vViewPosition);
    vec3 light = normalize(vec3(-0.35, 0.65, 1.0));
    float spec = pow(max(dot(n, normalize(light + view)), 0.0), 105.0);
    float soft = pow(max(dot(n, normalize(light + view)), 0.0), 24.0);
    ball += vec3(0.90, 0.95, 1.0) * (spec * 0.6 + soft * 0.055);

    vec3 col = mix(ground, skin, socket);
    col = mix(col, ball, aperture);
    gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
  }
`;
