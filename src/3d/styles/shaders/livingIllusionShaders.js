// Edge-to-edge living illusions. No border, vignette, alpha mask or central badge.
// Bounded trigonometric fields keep the whole UV square covered without ray marching.
const COMMON = `
  uniform vec3 baseColor;
  uniform vec3 antipodalColor;
  uniform float time;
  varying vec2 vUv;
  float band(float field) {
    float aa = max(fwidth(field), 0.025);
    return smoothstep(-aa, aa, field);
  }
  vec3 ink() { return baseColor * 0.28 + vec3(0.035); }
  vec3 paper() { return mix(baseColor, vec3(1.0), 0.72); }
`;

export const livingIllusionShaders = {
  liquidCheckers: `${COMMON}
    void main() {
      vec2 p = (vUv - 0.5) * 5.0;
      float t = time * 0.24;
      p += 0.32 * vec2(sin(p.y * 1.7 + t), cos(p.x * 1.5 - t));
      float checks = band(sin(p.x * 3.141593) * sin(p.y * 3.141593));
      vec3 light = mix(paper(), antipodalColor, 0.16);
      vec3 col = mix(ink(), light, checks);
      float fold = 0.5 + 0.5 * sin(p.x * 1.4 + p.y * 1.2 + t);
      col *= 0.82 + 0.18 * fold;
      gl_FragColor = vec4(col, 1.0);
    }
  `,
  velvetFolds: `${COMMON}
    void main() {
      vec2 p = vUv * 2.0 - 1.0;
      float t = time * 0.22;
      float bend = p.x + 0.2 * sin(p.y * 3.0 + t);
      float phase = bend * 19.0 + 1.6 * sin(p.y * 2.2 - t);
      float fold = 0.5 + 0.5 * cos(phase);
      float fine = band(sin(phase * 2.0 + p.y * 3.0));
      vec3 col = mix(ink(), baseColor, 0.25 + 0.75 * fold);
      col = mix(col, paper(), pow(fold, 8.0) * 0.65);
      col = mix(col, mix(baseColor, antipodalColor, 0.25), fine * 0.16);
      gl_FragColor = vec4(col, 1.0);
    }
  `,
  dreamMarble: `${COMMON}
    void main() {
      vec2 p = (vUv - 0.5) * 4.0;
      float t = time * 0.16;
      vec2 q = vec2(sin(p.y * 1.7 + t) + cos(p.x * 1.3 - t),
                    sin(p.x * 1.6 - t) + cos(p.y * 1.4 + t));
      float field = p.x + p.y * 0.55 + 0.85 * sin(q.x + q.y);
      float veins = band(sin(field * 7.0 + t));
      float clouds = 0.5 + 0.5 * sin(q.x * 1.5 - q.y + t);
      vec3 col = mix(ink(), baseColor, clouds * 0.7 + 0.3);
      col = mix(col, mix(paper(), antipodalColor, clouds * 0.3), veins * 0.72);
      float thread = pow(0.5 + 0.5 * cos(field * 7.0 + t), 16.0);
      col = mix(col, paper(), thread * 0.55);
      gl_FragColor = vec4(col, 1.0);
    }
  `,
  paradoxWeave: `${COMMON}
    void main() {
      vec2 p = vUv * 5.0;
      float t = time * 0.25;
      p += 0.18 * vec2(sin(p.y * 1.3 + t), sin(p.x * 1.3 - t));
      vec2 waves = cos(p * 6.283185);
      float horizontal = band(waves.y + 0.35);
      float vertical = band(waves.x + 0.35);
      float parity = cos(floor(p.x + 0.5) * 3.141593 + floor(p.y + 0.5) * 3.141593);
      float over = smoothstep(-0.55, 0.55, parity * sin(t));
      vec3 h = mix(baseColor * 0.45, paper(), 0.5 + 0.5 * waves.y);
      vec3 v = mix(ink(), mix(baseColor, antipodalColor, 0.35), 0.5 + 0.5 * waves.x);
      vec3 hOver = mix(mix(ink(), v, vertical), h, horizontal);
      vec3 vOver = mix(mix(ink(), h, horizontal), v, vertical);
      gl_FragColor = vec4(mix(hOver, vOver, over), 1.0);
    }
  `,
};
