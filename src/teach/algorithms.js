// src/teach/algorithms.js
// Standard cube notation → internal engine rotation mapping and algorithm library
//
// Notation reference (Home Grip orientation):
//   F=PZ(Red)  B=NZ(Orange)  R=PX(Blue)  L=NX(Green)  U=PY(White)  D=NY(Yellow)

import { namedMoveToRotation, expandMove } from '../game/handsInput.js';

// ---------------------------------------------------------------------------
// Parse a notation string like "R U R' U'" into engine moves
// ---------------------------------------------------------------------------
export function parseAlgorithm(notation, size = 3) {
  const tokens = notation.trim().split(/\s+/);
  const moves = [];

  for (const token of tokens) {
    if (token.endsWith('2')) {
      const expanded = expandMove(token, size);
      for (const rot of expanded) {
        moves.push({ ...rot, notation: token });
      }
    } else {
      const rot = namedMoveToRotation(token, size);
      if (rot) {
        moves.push({ ...rot, notation: token });
      }
    }
  }

  return moves;
}

// ---------------------------------------------------------------------------
// Face name helpers for user-friendly descriptions
// ---------------------------------------------------------------------------
export const FACE_NAMES = {
  'col': { 0: 'Left (L)', last: 'Right (R)' },
  'row': { 0: 'Down (D)', last: 'Up (U)' },
  'depth': { 0: 'Back (B)', last: 'Front (F)' },
};

export function describeMove(move, size = 3) {
  const last = size - 1;
  const axisNames = FACE_NAMES[move.axis];
  const faceName = move.sliceIndex === 0 ? axisNames[0] : move.sliceIndex === last ? axisNames.last : 'Middle';
  const direction = move.dir === 1 ? 'counter-clockwise' : 'clockwise';
  return `Rotate the ${faceName} layer ${direction}`;
}

// ---------------------------------------------------------------------------
// Beginner's Method stages for 3x3
// ---------------------------------------------------------------------------
// Each stage has: name, goal (what it achieves), explanation, and algorithms
// used to handle common cases in that stage.
//
// Each algorithm also has:
//   why        — plain-language reason this alg achieves the goal
//   topologyTip — RP² / manifold connection for the curious
//   quizHint   — hint for Quiz sub-mode wrong-answer feedback

export const BEGINNER_METHOD_3x3 = {
  name: "Beginner's Method (Layer by Layer)",
  description: "The most common method for learning to solve a Rubik's cube. Build one layer at a time from top to bottom.",
  stages: [
    {
      id: 'white-cross',
      name: 'Step 1: White Cross',
      goal: 'Form a white cross on the top face with edges matching center colors',
      explanation: 'Start by making a plus sign (+) with white edges on the top face. Each white edge must also match the center color of its adjacent side face. This is mostly intuitive — look for white edge pieces and bring them to the top.',
      tips: [
        'Find a white edge piece in the bottom or middle layer',
        'Rotate the bottom/side to align it under its target position',
        'Bring it up to the top face',
        'If an edge is in the top layer but flipped wrong, use: F U\' R U',
      ],
      algorithms: [
        {
          name: 'Edge flip (in top, wrong orientation)',
          notation: "F U' R U",
          when: 'A white edge is on top but the white sticker faces sideways instead of up',
          why: 'This sequence kicks the edge out of the top layer, rotates it, then re-inserts it with the correct orientation — without disturbing any other already-placed edges.',
          topologyTip: 'On RP², each edge piece belongs to a pair of antipodal slots. Flipping an edge locally is equivalent to traversing the non-orientable loop — the piece returns to the same position but with reversed orientation, correcting the mismatch.',
          quizHint: 'Think about which move first frees the stuck edge from the top face.',
        },
        {
          name: 'Edge from bottom',
          notation: "F2",
          when: 'A white edge is on the bottom directly below its target',
          why: 'A 180° rotation (F2) is the shortest path to lift the edge straight up into the top face, preserving all other pieces in the top layer.',
          topologyTip: 'F2 is a "double" move — it traces a closed loop on the projective plane, returning to the start with even parity. This is why it never creates a parity mismatch.',
          quizHint: 'Only 2 moves on a single face are needed when the edge is directly below its target.',
        },
      ],
    },
    {
      id: 'white-corners',
      name: 'Step 2: White Corners',
      goal: 'Complete the entire white face by placing corners correctly',
      explanation: 'Now place the four white corner pieces to complete the top layer. Find a white corner in the bottom layer, position it below where it needs to go, then use the algorithm to insert it.',
      tips: [
        'Find a corner with a white sticker in the bottom layer',
        'Use D moves to position it below its target slot',
        'Apply the insert algorithm (may need 1-3 repetitions)',
        'If the corner is stuck in the top layer in the wrong spot, use the algorithm once to pop it out, then reinsert',
      ],
      algorithms: [
        {
          name: 'Right insert',
          notation: "R' D' R D",
          when: 'Corner is below-right of its target position. Repeat 1-3 times until the corner is correctly placed.',
          why: 'This is the "sexy move" in reverse: it temporarily displaces the top-right slot, rotates the bottom corner into position, then restores the top layer. Repeating 2 or 4 times fully orients the corner without moving neighbors.',
          topologyTip: 'Repeating this 6-move sequence 6 times returns the cube to its original state — this period-6 property reflects the cycle structure of the corner\'s orbit in the rotation group.',
          quizHint: 'The first move (R\') opens the right-top slot to receive the corner.',
        },
        {
          name: 'Left insert',
          notation: "L D L' D'",
          when: 'Corner is below-left of its target position. Repeat 1-3 times.',
          why: 'Mirror of the right insert: opens the left-top slot, swings the corner in from the bottom, then restores the top layer. Choose left vs. right based on which face the corner is closest to.',
          topologyTip: 'L and R generate the full rotation group of the cube. These two simple sequences together can solve the entire top two layers through composition.',
          quizHint: 'Use this when the white sticker of the corner faces the left (green) side.',
        },
      ],
    },
    {
      id: 'second-layer',
      name: 'Step 3: Middle Layer Edges',
      goal: 'Solve the middle layer by inserting edge pieces',
      explanation: 'Flip the cube upside down (white on bottom, yellow on top). Now find edge pieces in the top layer that do NOT have yellow on them, and insert them into the middle layer using one of two algorithms.',
      tips: [
        'Hold the cube with white on bottom, yellow on top',
        'Find a non-yellow edge in the top layer',
        'Rotate U to match the edge\'s front color with the front center',
        'Determine if the edge needs to go left or right',
        'Apply the corresponding algorithm',
      ],
      algorithms: [
        {
          name: 'Insert edge RIGHT',
          notation: "U R U' R' U' F' U F",
          when: 'The edge needs to go to the right side of the front face',
          why: 'This sequence temporarily opens the front-right slot (U R), inserts the edge (U\' R\'), closes the back (U\' F\' U F). It\'s a "slot preserving" commutator — each phase undoes the disruption of the previous one.',
          topologyTip: 'Commutators of the form [A, B] = A B A\' B\' are fundamental in group theory. This alg is a product of two commutators, ensuring the rest of the cube is unchanged — a perfect illustration of the cube\'s group structure.',
          quizHint: 'Match the edge\'s top color with the front center first (U moves), then choose right or left.',
        },
        {
          name: 'Insert edge LEFT',
          notation: "U' L' U L U F U' F'",
          when: 'The edge needs to go to the left side of the front face',
          why: 'Mirror of the right insert. It opens the front-left slot by first moving away from it, inserts the edge, then restores with F U\' F\'.',
          topologyTip: 'Left-right mirror algorithms correspond to conjugate elements in the cube group — they have the same cycle type and therefore the same effect on parity. Neither can create an odd permutation.',
          quizHint: 'If the side color matches the left center after a U\' move, this is the algorithm to use.',
        },
      ],
    },
    {
      id: 'yellow-cross',
      name: 'Step 4: Yellow Cross',
      goal: 'Form a yellow cross on the top face',
      explanation: 'With yellow on top, create a cross. You may start with a dot (no edges), an L-shape (two adjacent edges), or a line (two opposite edges). Apply the algorithm to progress: dot → L → line → cross.',
      tips: [
        'Look at the top face for yellow edges',
        'Dot: Apply algorithm once to get an L',
        'L-shape: Hold the L in the back-left corner, apply once to get a line',
        'Line: Hold it horizontal, apply once to get the cross',
      ],
      algorithms: [
        {
          name: 'Yellow cross builder',
          notation: "F R U R' U' F'",
          when: 'Dot → L-shape → Line → Cross. Apply repeatedly (with correct orientation each time)',
          why: 'This is a "wedge" alg: F sets up the last layer, then R U R\' U\' (the Sexy Move) orients two yellow edges at once, and F\' closes back. Applying it correctly-oriented 1-3 times always reaches the cross.',
          topologyTip: 'The cross configuration corresponds to even-parity elements of the orientation group Z₂³ for the four edges. Each application of this alg flips exactly two edge orientations, cycling through dot→L→line→cross.',
          quizHint: 'For a dot start, hold any face front; for an L, align the two yellow edges to back and left.',
        },
      ],
    },
    {
      id: 'yellow-edges',
      name: 'Step 5: Position Yellow Edges',
      goal: 'Move yellow edges so their side colors match the center colors',
      explanation: 'The yellow cross is done, but the side colors of the edges might not match their centers. Rotate the top to get as many matching as possible (at least one pair of adjacent matching edges). Hold the solved edges at the back and left, then apply the algorithm.',
      tips: [
        'Rotate U to find a position where at least 2 edges match',
        'If 2 adjacent edges match: hold them at back and left',
        'If 2 opposite edges match: do the algorithm once, then reposition',
        'If all 4 already match: skip this step!',
      ],
      algorithms: [
        {
          name: 'Cycle 3 edges',
          notation: "R U R' U R U2 R'",
          when: 'Two adjacent edges are correct (back & left). This cycles the other three.',
          why: 'Known as "Sune", this algorithm performs a 3-cycle of the top-layer edges. It\'s one of the most important OLL/PLL building blocks — applying it rotates three edge pieces clockwise while leaving two anchored.',
          topologyTip: 'A 3-cycle is an even permutation (product of two transpositions). This is crucial on RP²: the projective plane\'s non-trivial loop means some odd permutations can only be "undone" by traversing the entire manifold once — but 3-cycles are always safe.',
          quizHint: 'Hold the two matching edges at back and left before applying.',
        },
      ],
    },
    {
      id: 'yellow-corners-position',
      name: 'Step 6: Position Yellow Corners',
      goal: 'Get all four corners in the right positions (colors may be twisted)',
      explanation: 'Now position the yellow corners so each corner is between the three faces whose colors it contains. The corner colors may not be oriented correctly yet — that\'s the next step. Find one correctly positioned corner and hold it in the front-right. If none are correct, do the algorithm once from any angle.',
      tips: [
        'Check each corner: does it sit between its 3 colors?',
        'One correct corner: hold it front-right, apply algorithm',
        'No correct corners: apply once from any position, then check again',
      ],
      algorithms: [
        {
          name: 'Cycle 3 corners',
          notation: "U R U' L' U R' U' L",
          when: 'One corner is in the correct position (front-right). This cycles the other three.',
          why: 'This commutator-based 3-cycle anchors the front-right corner and rotates the remaining three counterclockwise. The conjugation structure (U...U\') ensures the cycle is pure — it only permutes the corners without affecting their orientation or the edges.',
          topologyTip: 'Corner 3-cycles are even permutations. On RP², corners come in antipodal pairs; this alg operates entirely on the local S₃ symmetry of the top layer, respecting the global Z₂ topology.',
          quizHint: 'First find (or create) one correctly positioned corner to use as the anchor.',
        },
      ],
    },
    {
      id: 'yellow-corners-orient',
      name: 'Step 7: Orient Yellow Corners',
      goal: 'Twist the corners so all yellow stickers face up — cube solved!',
      explanation: 'The final step! All corners are in the right spots but may be twisted. Use R\' D\' R D repeatedly on each corner until it\'s oriented, then move to the next corner with U. The cube will look scrambled during this step — trust the process!',
      tips: [
        'Hold the corner to orient in the front-right position',
        'Repeat R\' D\' R D until the yellow sticker faces up (2 or 4 times)',
        'DO NOT rotate the whole cube — only use U to bring the next corner to front-right',
        'The cube looks broken during this step — that\'s normal!',
        'After all corners are done, you may need U turns to align the top layer',
      ],
      algorithms: [
        {
          name: 'Orient corner',
          notation: "R' D' R D",
          when: 'Repeat 2 or 4 times until the front-right corner\'s yellow faces up. Then use U to bring the next unoriented corner to front-right.',
          why: 'This is the "anti-sexy move". Each application twists the front-right corner by 120° in place. After 2 applications (240°) or 4 applications (480° = 120°), the corner is fully oriented. The key insight: applying this to ANY corner in the FRD slot will orient it without permanently moving other pieces, as long as you only use U between corners.',
          topologyTip: 'Corner orientation is governed by Z₃ (three possible twists: 0°, 120°, 240°). The total twist of all corners must sum to 0 (mod 3) — this is the "corner orientation parity" invariant. On RP², this invariant is preserved by all legal moves, guaranteeing the cube can always be solved.',
          quizHint: 'Apply exactly 2 or 4 times — odd numbers will leave the corner in a twisted state.',
        },
      ],
    },
  ],
};

// ---------------------------------------------------------------------------
// All available teaching methods
// ---------------------------------------------------------------------------
export const TEACHING_METHODS = {
  'beginner-3x3': BEGINNER_METHOD_3x3,
};
