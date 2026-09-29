// Same exponential-map, per-stroke wobble and breathing as updateWorld() in
// the creator. Group matrices and curve samples never change after upload.
export const motifVertexShader = `
  attribute vec4 ends, curve, style, group0, group1;
  attribute vec3 group2;
  attribute vec3 extra;
  uniform vec3 center, first, second, turns[24], palette[8];
  uniform float reach, resolution, glow;
  #ifdef USE_MOTION_ATLAS
    uniform sampler2D motionMap;
    uniform vec2 motionSize;
  #endif
  varying vec3 ink;
  varying vec2 local;
  varying float segment, core, outer, opacity, kind, along, lineWidth;
  vec3 world(vec2 uv) {
    #ifdef USE_MOTION_ATLAS
      float index = uv.x * 2.0;
      vec2 texel = vec2(mod(index, motionSize.x), floor(index / motionSize.x));
      vec3 hi = texture2D(motionMap, (texel + .5) / motionSize).rgb;
      vec3 lo = texture2D(motionMap, (texel + vec2(1.5, .5)) / motionSize).rgb;
      return (hi * 65280.0 + lo * 255.0) / 65535.0 * 2.0 - 1.0;
    #else
    vec3 turn = turns[int(curve.z)];
    vec2 q = (uv - curve.xy) * turn.z;
    q = curve.xy + mat2(turn.x, turn.y, -turn.y, turn.x) * q;
    float r = length(q) * reach;
    return cos(r) * center + (r < .000001 ? reach : sin(r) * reach / r) * (q.x * first + q.y * second);
    #endif
  }
  vec2 project(vec3 p) {
    float r = length(p.xy);
    return .94 * p.xy * (atan(r, max(p.z, 0.0)) / (1.57079632679 * max(r, .000001)));
  }
  void main() {
    mat3 group = mat3(group0.xyz, group1.xyz, group2);
    float sheet = group1.w;
    // Reject a whole stroke's conservative spherical cap before point lookup.
    if ((group * center).z * sheet < -extra.z) { gl_Position = vec4(2.0, 2.0, 0.0, 1.0); return; }
    kind = position.z;
    vec3 a = group * world(ends.xy), b = kind > .5 ? a : group * world(ends.zw);
    float az = a.z * sheet, bz = b.z * sheet;
    kind = position.z; opacity = style.y;
    ink = palette[int(style.z + 4.0 * group0.w)];
    lineWidth = max(.8, style.x * resolution / 900.0);
    core = kind > .5 ? lineWidth * extra.y : .5 * lineWidth;
    outer = core * (kind < .5 ? 1.0 + 5.0 * glow : 1.0) + 1.0;
    local = vec2(0.0); segment = 0.0; along = 0.0;
    // Conservative whole-fill rejection at the equator, matching the creator's
    // policy of filling only closed paths that do not split across the rim.
    bool hidden = max(az, bz) < 0.0;
    if (kind > 1.5) hidden = az < 0.0 || abs((group * world(curve.xy)).z) <= curve.w;
    if (hidden) { gl_Position = vec4(2.0, 2.0, 0.0, 1.0); return; }
    if (kind > 1.5) { gl_Position = vec4(project(a * sheet), 0.0, 1.0); return; }
    float clipA = 0.0, clipB = 1.0;
    if (az < 0.0) clipA = az / (az - bz);
    if (bz < 0.0) clipB = az / (az - bz);
    vec3 ca = normalize(mix(a, b, clipA)) * sheet;
    vec3 cb = normalize(mix(a, b, clipB)) * sheet;
    vec2 pa = project(ca), pb = project(cb);
    vec2 delta = (pb - pa) * .5 * resolution;
    segment = length(delta);
    vec2 tangent = segment > .0001 ? delta / segment : vec2(1.0, 0.0);
    vec2 normal = vec2(-tangent.y, tangent.x);
    float end = position.x;
    vec2 offset = tangent * (end * 2.0 - 1.0) * outer + normal * position.y * outer;
    local = vec2(end * segment + (end * 2.0 - 1.0) * outer, position.y * outer);
    along = (style.w + extra.x * mix(clipA, clipB, end)) * reach * .47 * resolution;
    gl_Position = vec4(mix(pa, pb, end) + offset * 2.0 / resolution, 0.0, 1.0);
  }
`;

// Two RGBA8 texels encode each unit direction to 16 bits per component.
// Unlike floating-point render targets, these work on both WebGL versions
// without float color-buffer extensions. Every group reuses the same points.
export const motionVertexShader = `
  attribute vec2 curveCenter;
  attribute float pixelIndex;
  uniform vec3 center, first, second, turns[24];
  uniform float reach;
  uniform vec2 motionSize;
  varying vec3 code;
  void main() {
    vec3 turn = turns[int(position.z)];
    vec2 q = (position.xy - curveCenter) * turn.z;
    q = curveCenter + mat2(turn.x, turn.y, -turn.y, turn.x) * q;
    float r = length(q) * reach;
    vec3 p = cos(r) * center + (r < .000001 ? reach : sin(r) * reach / r) * (q.x * first + q.y * second);
    vec3 quantized = floor(clamp(p * .5 + .5, 0.0, 1.0) * 65535.0 + .5);
    code = (mod(pixelIndex, 2.0) < .5 ? floor(quantized / 256.0) : mod(quantized, 256.0)) / 255.0;
    vec2 texel = vec2(mod(pixelIndex, motionSize.x), floor(pixelIndex / motionSize.x));
    gl_Position = vec4((texel + .5) / motionSize * 2.0 - 1.0, 0.0, 1.0);
    gl_PointSize = 1.0;
  }
`;
export const motionFragmentShader = `
  varying vec3 code;
  void main() { gl_FragColor = vec4(code, 1.0); }
`;

export const motifFragmentShader = `
  uniform float glow, dash;
  varying vec3 ink;
  varying vec2 local;
  varying float segment, core, outer, opacity, kind, along, lineWidth;
  void main() {
    float a = opacity;
    if (kind < 1.5) {
      float cap = max(max(-local.x, local.x - segment), 0.0);
      float distance = length(vec2(cap, local.y));
      float coverage = 1.0 - smoothstep(core - .65, core + .65, distance);
      float halo = kind < .5 ? .25 * glow * (1.0 - smoothstep(core, outer, distance)) : 0.0;
      if (kind < .5 && dash > .5) {
        float period = lineWidth * (dash < 1.5 ? 5.6 : 2.4);
        float mark = lineWidth * (dash < 1.5 ? 3.2 : .5);
        coverage *= 1.0 - smoothstep(mark - .5, mark + .5, mod(along, period));
      }
      a *= max(coverage, halo);
    }
    if (a < .001) discard;
    gl_FragColor = vec4(ink * a, a);
  }
`;

export const compositeVertexShader = `
  varying vec2 coord;
  void main() { coord = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

// History and strokes are already GPU textures: no canvas readback or upload.
// This small compositor handles decay and blend modes in a fixed pixel budget.
export const compositeFragmentShader = `
  uniform sampler2D strokes, history;
  uniform vec3 ground;
  uniform float fade, fresh, blend, bloom, pixel;
  varying vec2 coord;
  vec3 mixInk(vec3 dst, vec3 src) {
    if (blend < .5) return src;
    if (blend < 1.5) return min(vec3(1.0), dst + src);
    if (blend < 2.5) return vec3(1.0) - (vec3(1.0) - dst) * (vec3(1.0) - src);
    if (blend < 3.5) return dst * src;
    return abs(dst - src);
  }
  void main() {
    vec3 previous = texture2D(history, coord).rgb;
    vec3 base = mix(previous, ground, max(fade, fresh));
    vec4 ink = texture2D(strokes, coord);
    float contribution = blend < .5 ? 1.0 : pow(fade, .9);
    vec3 color = ink.rgb / max(ink.a, .00001);
    vec3 result = mix(base, mixInk(base, color), ink.a * contribution);
    if (bloom > .001) {
      vec2 dx = vec2(pixel * 3.0, 0.0), dy = dx.yx;
      vec4 soft = .25 * (texture2D(strokes, coord + dx) + texture2D(strokes, coord - dx)
        + texture2D(strokes, coord + dy) + texture2D(strokes, coord - dy));
      result = mix(result, mixInk(result, soft.rgb / max(soft.a, .00001)), soft.a * bloom * .25 * contribution);
    }
    gl_FragColor = vec4(result, 1.0);
  }
`;
