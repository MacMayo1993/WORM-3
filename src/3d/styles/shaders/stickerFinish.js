// The menu cube's sticker finish, for the tile styles.
//
// A plain tile is a MeshPhysicalMaterial lit by the studio rig (cubeLighting.js)
// with a full clearcoat (rubiksPiece.js). The style shaders are unlit: they wrote
// their pattern straight to the screen, so a styled tile had no shading between
// faces, no gloss on its bevel, and showed its palette colour in the wrong space
// (THREE.Color holds linear values, and an unlit ShaderMaterial never encodes
// them, so '#3973E8' came out navy). withStickerFinish wraps a style's fragment
// shader so that it
//   1. sees baseColor / antipodalColor as the palette's own hex values, and
//   2. is shaded by the same rig and wears a clearcoat highlight and edge sheen,
// leaving the style's pattern, and every constant it mixes with, untouched.
// Pure string work, no Three imports, so tests can check every style.

import { CUBE_LIGHT_RIG } from '../../cubeLighting.js';

const glf = (n) => (Number.isInteger(n) ? `${n}.0` : `${n}`);
const dirOf = ([x, y, z]) => {
  const l = Math.hypot(x, y, z);
  return `vec3(${glf(+(x / l).toFixed(4))}, ${glf(+(y / l).toFixed(4))}, ${glf(+(z / l).toFixed(4))})`;
};

/** Varyings the style vertex shaders write for the finish (world space). */
export const STICKER_FINISH_VARYINGS = `
  varying vec3 vStickerPos;
  varying vec3 vStickerNormal;
`;

/** Vertex-shader lines that fill STICKER_FINISH_VARYINGS; `pos` is the object-space position used. */
export const stickerFinishVertex = (pos = 'position') => `
    vStickerPos = (modelMatrix * vec4(${pos}, 1.0)).xyz;
    vStickerNormal = normalize(mat3(modelMatrix) * normal);
`;

// Colours the style reads. Each uniform keeps its name for the JS side; inside the
// shader every use is redirected to a display-space copy set before the style runs.
const FINISH_COLORS = ['baseColor', 'antipodalColor'];
// A style that draws something other than sticker plastic (the eye's skin and
// wet globe) declares `float tileCoat;` and sets it per pixel: 1 keeps the
// clearcoat, 0 leaves only the rig's shading. It starts at 1 each pixel.
const TILE_COAT = /\bfloat\s+tileCoat\s*;/;
const MAIN = /void\s+main\s*\(\s*(?:void)?\s*\)/g;

const FINISH_GLSL = `
${STICKER_FINISH_VARYINGS}
vec3 stickerToDisplay(vec3 c) {
  c = clamp(c, 0.0, 1.0);
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}
// The studio rig: ambient plus key and fill, normalised so a tile facing the
// key reads at its own colour and one turned away settles about a fifth darker.
// coatAmount scales the clearcoat (see TILE_COAT below).
vec3 stickerFinish(vec3 col, float coatAmount) {
  vec3 n = normalize(vStickerNormal);
  if (!gl_FrontFacing) n = -n;
  vec3 v = normalize(cameraPosition - vStickerPos);
  const vec3 KEY = ${dirOf(CUBE_LIGHT_RIG.key.position)};
  const vec3 FILL = ${dirOf(CUBE_LIGHT_RIG.fill.position)};
  const vec3 RIM = ${dirOf(CUBE_LIGHT_RIG.rim.position)};
  float shade = 0.78 + 0.22 * max(dot(n, KEY), 0.0) + 0.08 * max(dot(n, FILL), 0.0);
  col *= shade;
  // Clearcoat: a tight key highlight on a soft sheen, a cool glint from the rim,
  // and a Fresnel lift that makes the bevel read against the black plastic.
  float kh = max(dot(n, normalize(KEY + v)), 0.0);
  float rh = max(dot(n, normalize(RIM + v)), 0.0);
  float fres = pow(1.0 - clamp(dot(n, v), 0.0, 1.0), 5.0);
  vec3 coat = vec3(1.0, 0.97, 0.94) * (pow(kh, 140.0) * 0.55 + pow(kh, 18.0) * 0.05)
            + vec3(0.9, 0.93, 1.0) * (pow(rh, 90.0) * 0.3)
            + vec3(0.2) * fres;
  return col + coat * coatAmount;
}
vec3 stickerFinish(vec3 col) { return stickerFinish(col, 1.0); }
`;

/**
 * Wrap a tile style's fragment shader in the sticker finish. The style's own
 * main() becomes tileStyleMain(); the new main() sets up the display-space
 * colours, runs the style, then finishes its gl_FragColor. A shader without
 * exactly one main() comes back unchanged.
 */
export function withStickerFinish(fragmentShader) {
  const mains = fragmentShader.match(MAIN);
  if (!mains || mains.length !== 1) return fragmentShader;
  let src = fragmentShader.replace(MAIN, 'void tileStyleMain()');
  const shown = [];
  for (const name of FINISH_COLORS) {
    const decl = new RegExp(`uniform\\s+vec3\\s+${name}\\s*;`);
    if (!decl.test(src)) continue;
    src = src
      .replace(new RegExp(`\\b${name}\\b`, 'g'), `${name}Shown`)
      .replace(new RegExp(`uniform\\s+vec3\\s+${name}Shown\\s*;`), `uniform vec3 ${name};\nvec3 ${name}Shown;`);
    shown.push(name);
  }
  const coated = TILE_COAT.test(src);
  return `${FINISH_GLSL}
${src}
void main() {
${shown.map((name) => `  ${name}Shown = stickerToDisplay(${name});`).join('\n')}${coated ? '\n  tileCoat = 1.0;' : ''}
  tileStyleMain();
  gl_FragColor.rgb = ${coated ? 'stickerFinish(gl_FragColor.rgb, tileCoat)' : 'stickerFinish(gl_FragColor.rgb)'};
}
`;
}
