// Distant-cube versions of the game's view styles. One instanced draw, no
// per-cube textures, lights, transmission passes, or gameplay material state.
import * as THREE from 'three';
import { COLOR_SCHEMES } from '../utils/colorSchemes.js';
import { AMBIENCE_STYLES } from './backgroundAmbience.js';
const BOX_FACE_IDS = [5, 2, 3, 6, 1, 4];

export function ambienceCubeGeometry(cubes) {
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  geometry.setAttribute('faceIndex', new THREE.Float32BufferAttribute(
    BOX_FACE_IDS.flatMap((_, i) => [i, i, i, i]), 1));
  const color = new THREE.Color();
  BOX_FACE_IDS.forEach((face, index) => {
    const values = new Float32Array(cubes.length * 3);
    cubes.forEach((cube, i) => color.set(COLOR_SCHEMES[cube.palette][face]).toArray(values, i * 3));
    geometry.setAttribute(`palette${index}`, new THREE.InstancedBufferAttribute(values, 3));
  });
  geometry.setAttribute('cubeStyle', new THREE.InstancedBufferAttribute(
    new Float32Array(cubes.map(cube => AMBIENCE_STYLES.indexOf(cube.style))), 1));
  return geometry;
}

export function ambienceCubeMaterial() {
  return new THREE.ShaderMaterial({
    toneMapped: false,
    vertexShader: /* glsl */`
      attribute float faceIndex;
      attribute float cubeStyle;
      attribute vec3 palette0, palette1, palette2, palette3, palette4, palette5;
      varying vec2 vUv;
      varying vec3 vColor, vNormal;
      varying float vStyle;
      void main() {
        vUv = uv; vStyle = cubeStyle;
        vColor = faceIndex < .5 ? palette0 : faceIndex < 1.5 ? palette1 : faceIndex < 2.5 ? palette2
          : faceIndex < 3.5 ? palette3 : faceIndex < 4.5 ? palette4 : palette5;
        vNormal = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
        gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */`
      varying vec2 vUv;
      varying vec3 vColor, vNormal;
      varying float vStyle;
      void main() {
        vec2 p = fract(vUv * 3.) - .5;
        float edge = max(abs(p.x), abs(p.y));
        float aa = max(fwidth(edge), .006);
        float gap = vStyle > 6.5 ? .34 : .435;
        float tile = 1. - smoothstep(gap - aa, gap + aa, edge);
        float bevel = smoothstep(.29, .43, edge);
        float light = .72 + .28 * max(dot(normalize(vNormal), normalize(vec3(.4, .8, .6))), 0.);
        vec3 ink = vec3(.018, .022, .032);
        vec3 face = vColor * (1. - bevel * .23);
        if (vStyle > .5 && vStyle < 1.5) {
          // Frosted glass: broad reflections and pale inset rims, kept opaque
          // at sky distance to avoid sorting forty overlapping transparent boxes.
          float reflection = smoothstep(.02, .17, abs(vUv.x + vUv.y * .65 - .8));
          face = mix(vColor * .45, mix(vColor, vec3(.85), .48), reflection);
          face += vec3(.24) * bevel;
          ink = mix(vColor, vec3(.6), .6) * .25;
        } else if (vStyle > 1.5 && vStyle < 2.5) {
          float rim = smoothstep(.32, .39, edge);
          face = mix(vColor * .12, vColor * 1.25 + .12, rim);
        } else if (vStyle > 2.5 && vStyle < 3.5) {
          // Nine embossed studs on each face, with a lit lip and a shaded base.
          float r = length(p);
          float stud = 1. - smoothstep(.23 - aa, .23 + aa, r);
          face *= 1. - .32 * (1. - smoothstep(.25, .3, length(p - vec2(.025, -.035))));
          face = mix(face, vColor * (1.04 + .3 * p.y / .23), stud);
          face += vec3(.16) * (1. - smoothstep(.015, .05, abs(r - .20))) * stud;
        } else if (vStyle > 3.5 && vStyle < 4.5) {
          float band = .5 + .5 * sin((vUv.y + vUv.x * .4) * 9.);
          face = mix(vColor * .22, mix(vColor, vec3(.92), .7), band);
          ink = vec3(.18);
        } else if (vStyle > 4.5 && vStyle < 5.5) {
          face = mix(ink, vColor * 1.15 + .12, smoothstep(.35, .40, edge));
        } else if (vStyle > 5.5 && vStyle < 6.5) {
          float grid = 1. - smoothstep(.025, .025 + aa, min(abs(p.x), abs(p.y)));
          face = mix(face, mix(vColor, vec3(1.), .6), grid * .8);
        }
        gl_FragColor = vec4(mix(ink, face, tile) * light, 1.);
        #include <colorspace_fragment>
      }`,
  });
}
