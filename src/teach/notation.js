// src/teach/notation.js
// The notation curriculum for Teach Mode's Notation tab.
//
// Every entry is a real token the rest of the game already understands: the
// tokens here are fed straight through parseAlgorithm(), so what the lesson
// teaches and what the cube does can never drift apart.

import { parseAlgorithm, describeMove } from './algorithms.js';

// One notation token, resolved to the turn it performs on a 3×3.
// Returns null for anything the parser doesn't recognise.
export function resolveToken(token) {
  const [move] = parseAlgorithm(token, 3);
  return move ?? null;
}

// ─── The six faces ────────────────────────────────────────────────────────────
// A bare letter is a quarter turn clockwise, looking straight at that face.
export const FACE_TOKENS = [
  { token: 'F', face: 'Front', hint: 'the face pointing at you' },
  { token: 'B', face: 'Back',  hint: 'the face pointing away' },
  { token: 'R', face: 'Right', hint: 'the right-hand layer' },
  { token: 'L', face: 'Left',  hint: 'the left-hand layer' },
  { token: 'U', face: 'Up',    hint: 'the top layer' },
  { token: 'D', face: 'Down',  hint: 'the bottom layer' }
];

// ─── Modifiers ────────────────────────────────────────────────────────────────
// Shown on R so the three variants can be compared on one layer.
export const MODIFIER_TOKENS = [
  { token: 'R',  name: 'Quarter turn',      hint: 'clockwise, as if you were looking at that face' },
  { token: "R'", name: 'Prime — reversed',  hint: "the apostrophe means counter-clockwise" },
  { token: 'R2', name: 'Half turn',         hint: 'two quarter turns; direction does not matter' }
];

// ─── Middle slices ────────────────────────────────────────────────────────────
// The layer between two opposite faces. Each follows the face it sits next to.
export const SLICE_TOKENS = [
  { token: 'M', name: 'Middle', hint: 'the slice between L and R — follows L' },
  { token: 'E', name: 'Equator', hint: 'the slice between U and D — follows D' },
  { token: 'S', name: 'Standing', hint: 'the slice between F and B — follows F' }
];

// A worked example: the sequence Teach Mode itself suggests first.
export const EXAMPLE_SEQUENCE = "F U' R U";

// Lesson copy for the tokens that have it; anything else (a prime inside the
// worked example, say) falls back to the parser's own description of the turn.
// Faces come last so they win the one token that appears in two groups: plain
// R is taught as a face, while R' and R2 keep the modifier copy.
const TOKEN_INDEX = Object.fromEntries([
  ...MODIFIER_TOKENS.map((m) => [m.token, { title: m.name, hint: m.hint }]),
  ...SLICE_TOKENS.map((s) => [s.token, { title: s.name, hint: s.hint }]),
  ...FACE_TOKENS.map((f) => [f.token, { title: f.face, hint: f.hint }])
]);

export function describeToken(token) {
  const entry = TOKEN_INDEX[token];
  if (entry) return entry;
  const move = resolveToken(token);
  return move ? { title: describeMove(move, 3), hint: '' } : null;
}

// Short lesson copy, kept beside the tokens it explains.
export const NOTATION_LESSON = {
  intro:
    'An algorithm is just a list of turns. Each letter names one layer, and the mark after it says how far to turn.',
  reading:
    'Read left to right, one token at a time. Every turn is a quarter turn unless a 2 says otherwise.',
  // WORM-3 sits on a projective plane, so a turn also carries stickers through
  // the antipodal identification. The notation itself is unchanged — worth
  // saying plainly so notation practice transfers to a normal cube and back.
  manifold:
    'Notation here means exactly what it means on an ordinary cube. What changes on this cube is where a turned sticker can end up — antipodal partners (red↔orange, green↔blue, white↔yellow) are identified, so a layer can carry a sticker through to its partner face.'
};
