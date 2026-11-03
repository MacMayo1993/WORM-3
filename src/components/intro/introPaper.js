import { RUBIKS_CLASSIC } from '../../utils/constants.js';
import { glslFloat, glslVec3 } from '../../utils/paperGrid.js';

// Broad sticker-colour washes at the edges keep the cube and white trailer
// lettering clear. This is compiled into the existing paper quad: no textures,
// extra draw calls or animated colours, including under reduced motion.
export const INTRO_PAPER_WASHES = [
  { color: RUBIKS_CLASSIC.red, at: [0, 0.8], radius: 0.5, strength: 0.30 },
  { color: RUBIKS_CLASSIC.orange, at: [0, 0.25], radius: 0.46, strength: 0.24 },
  { color: RUBIKS_CLASSIC.yellow, at: [0.5, -0.15], radius: 0.55, strength: 0.28 },
  { color: RUBIKS_CLASSIC.green, at: [1, 0.25], radius: 0.46, strength: 0.26 },
  { color: RUBIKS_CLASSIC.blue, at: [1, 0.8], radius: 0.5, strength: 0.30 },
];

// The paper shader writes display RGB directly, unlike the lit cube material.
const displayRgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);

export const INTRO_PAPER_SHADER = INTRO_PAPER_WASHES.map(({ color, at, radius, strength }) => `
  paper = mix(paper, ${glslVec3(displayRgb(color))},
    ${glslFloat(strength)} * exp(-pow(distance(paperUv, vec2(${at.map(glslFloat).join(', ')})) / ${glslFloat(radius)}, 2.0)));
`).join('');
