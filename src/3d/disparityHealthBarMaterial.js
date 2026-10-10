// src/3d/disparityHealthBarMaterial.js
// The flip-pressure bar's one shared program (DisparityHealthBar.jsx), module-level
// so every bar shares it and the WORM warm-up can compile it ahead of the first flip.
import * as THREE from 'three';

export const W = 0.82, H = 0.05;
// The pip sits above the track's right end: centre (0.37, 0.08), 0.07 square.
const PIP_X = 0.37, PIP_Y = 0.08, PIP = 0.07;
export const TOP = PIP_Y + PIP / 2;

export const healthBarMaterial = new THREE.ShaderMaterial({
  vertexShader: `
    attribute vec4 aFill;   // rgb, opacity
    attribute vec2 aState;  // fill fraction, warning pip on
    varying vec2 vPos;
    varying vec4 vFill;
    varying vec2 vState;
    void main() {
      vPos = position.xy;
      vFill = aFill;
      vState = aState;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    varying vec2 vPos;
    varying vec4 vFill;
    varying vec2 vState;
    void main() {
      vec4 c = vec4(0.0);
      if (abs(vPos.y) <= ${(H / 2).toFixed(3)}) {
        // Dark track at half opacity, the fill laid over it from the left.
        vec3 track = vec3(0.0056);
        float ta = 0.5;
        float filled = step(vPos.x, -${(W / 2).toFixed(3)} + vState.x * ${W.toFixed(3)});
        float fa = vFill.a * filled;
        float a = 1.0 - (1.0 - fa) * (1.0 - ta);
        c = vec4((vFill.rgb * fa + track * ta * (1.0 - fa)) / a, a);
      } else if (vState.y > 0.5 && abs(vPos.x - ${PIP_X.toFixed(3)}) <= ${(PIP / 2).toFixed(3)}
                 && abs(vPos.y - ${PIP_Y.toFixed(3)}) <= ${(PIP / 2).toFixed(3)}) {
        c = vec4(0.98, 0.98, 0.9, 1.0);
      }
      if (c.a < 0.01) discard;
      gl_FragColor = c;
      #include <colorspace_fragment>
    }
  `,
  transparent: true,
  depthWrite: false,
  toneMapped: false
});
