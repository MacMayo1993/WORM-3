// src/game/solveDetection.js
// Detection logic for CFOP solve stages and algorithm hints

// Color mapping: 1=Red(PZ), 2=Green(NX), 3=White(PY), 4=Orange(NZ), 5=Blue(PX), 6=Yellow(NY)
// Direction mapping: PZ=front(red), NX=left(green), PY=top(white), NZ=back(orange), PX=right(blue), NY=bottom(yellow)

const DIR_TO_COLOR = { PZ: 1, NX: 2, PY: 3, NZ: 4, PX: 5, NY: 6 };
const COLOR_TO_DIR = { 1: 'PZ', 2: 'NX', 3: 'PY', 4: 'NZ', 5: 'PX', 6: 'NY' };
const COLOR_NAMES = { 1: 'Red', 2: 'Green', 3: 'White', 4: 'Orange', 5: 'Blue', 6: 'Yellow' };

// Get sticker at a specific position and direction
const getSticker = (cubies, x, y, z, dir) => {
  return cubies[x]?.[y]?.[z]?.stickers?.[dir];
};

// ============================================
// WHITE CROSS DETECTION (Step 1)
// ============================================

// White cross edges positions on a 3x3 (size-relative)
// These are the 4 edge pieces around the white center (PY face)
const getWhiteCrossEdges = (size) => {
  const mid = Math.floor(size / 2);
  const max = size - 1;

  return [
    // Front-top edge (white + red)
    { x: mid, y: max, z: max, whiteDir: 'PY', adjDir: 'PZ', adjColor: 1, name: 'Front' },
    // Back-top edge (white + orange)
    { x: mid, y: max, z: 0, whiteDir: 'PY', adjDir: 'NZ', adjColor: 4, name: 'Back' },
    // Left-top edge (white + green)
    { x: 0, y: max, z: mid, whiteDir: 'PY', adjDir: 'NX', adjColor: 2, name: 'Left' },
    // Right-top edge (white + blue)
    { x: max, y: max, z: mid, whiteDir: 'PY', adjDir: 'PX', adjColor: 5, name: 'Right' },
  ];
};

// Check if a single white cross edge is correctly placed
const isWhiteCrossEdgeSolved = (cubies, edge) => {
  const whiteSticker = getSticker(cubies, edge.x, edge.y, edge.z, edge.whiteDir);
  const adjSticker = getSticker(cubies, edge.x, edge.y, edge.z, edge.adjDir);

  if (!whiteSticker || !adjSticker) return false;

  // White sticker must be white (3) and adjacent must match its face color
  return whiteSticker.curr === 3 && adjSticker.curr === edge.adjColor;
};

// Find all white edge pieces in the entire cube (for hints)
const findAllWhiteEdges = (cubies, size) => {
  const edges = [];
  const mid = Math.floor(size / 2);
  const max = size - 1;

  // Edge positions (not corners, not centers)
  const edgePositions = [];

  // Top and bottom layer edges
  for (const y of [0, max]) {
    // Front/back edges
    edgePositions.push({ x: mid, y, z: 0 });
    edgePositions.push({ x: mid, y, z: max });
    // Left/right edges
    edgePositions.push({ x: 0, y, z: mid });
    edgePositions.push({ x: max, y, z: mid });
  }

  // Middle layer edges
  edgePositions.push({ x: 0, y: mid, z: 0 });
  edgePositions.push({ x: 0, y: mid, z: max });
  edgePositions.push({ x: max, y: mid, z: 0 });
  edgePositions.push({ x: max, y: mid, z: max });

  for (const pos of edgePositions) {
    const cubie = cubies[pos.x]?.[pos.y]?.[pos.z];
    if (!cubie) continue;

    for (const [dir, sticker] of Object.entries(cubie.stickers)) {
      if (sticker.curr === 3) { // White
        edges.push({
          x: pos.x, y: pos.y, z: pos.z,
          whiteDir: dir,
          sticker
        });
      }
    }
  }

  return edges;
};

// Check white cross completion status
export const checkWhiteCross = (cubies, size) => {
  const targetEdges = getWhiteCrossEdges(size);
  const results = targetEdges.map(edge => ({
    ...edge,
    solved: isWhiteCrossEdgeSolved(cubies, edge)
  }));

  const solvedCount = results.filter(r => r.solved).length;

  return {
    complete: solvedCount === 4,
    solvedCount,
    total: 4,
    edges: results
  };
};

// ============================================
// F2L DETECTION (Step 2 - First Two Layers)
// ============================================

// F2L corner positions (white corners that go in bottom layer of white face)
const getF2LCorners = (size) => {
  const max = size - 1;

  return [
    // Front-right corner (white + red + blue)
    { x: max, y: max, z: max, dirs: ['PY', 'PZ', 'PX'], colors: [3, 1, 5], name: 'Front-Right' },
    // Front-left corner (white + red + green)
    { x: 0, y: max, z: max, dirs: ['PY', 'PZ', 'NX'], colors: [3, 1, 2], name: 'Front-Left' },
    // Back-right corner (white + orange + blue)
    { x: max, y: max, z: 0, dirs: ['PY', 'NZ', 'PX'], colors: [3, 4, 5], name: 'Back-Right' },
    // Back-left corner (white + orange + green)
    { x: 0, y: max, z: 0, dirs: ['PY', 'NZ', 'NX'], colors: [3, 4, 2], name: 'Back-Left' },
  ];
};

// F2L edge positions (middle layer edges)
const getF2LEdges = (size) => {
  const mid = Math.floor(size / 2);
  const max = size - 1;

  return [
    // Front-right edge (red + blue)
    { x: max, y: mid, z: max, dirs: ['PZ', 'PX'], colors: [1, 5], name: 'Front-Right' },
    // Front-left edge (red + green)
    { x: 0, y: mid, z: max, dirs: ['PZ', 'NX'], colors: [1, 2], name: 'Front-Left' },
    // Back-right edge (orange + blue)
    { x: max, y: mid, z: 0, dirs: ['NZ', 'PX'], colors: [4, 5], name: 'Back-Right' },
    // Back-left edge (orange + green)
    { x: 0, y: mid, z: 0, dirs: ['NZ', 'NX'], colors: [4, 2], name: 'Back-Left' },
  ];
};

const isF2LCornerSolved = (cubies, corner) => {
  for (let i = 0; i < corner.dirs.length; i++) {
    const sticker = getSticker(cubies, corner.x, corner.y, corner.z, corner.dirs[i]);
    if (!sticker || sticker.curr !== corner.colors[i]) return false;
  }
  return true;
};

const isF2LEdgeSolved = (cubies, edge) => {
  for (let i = 0; i < edge.dirs.length; i++) {
    const sticker = getSticker(cubies, edge.x, edge.y, edge.z, edge.dirs[i]);
    if (!sticker || sticker.curr !== edge.colors[i]) return false;
  }
  return true;
};

export const checkF2L = (cubies, size) => {
  const corners = getF2LCorners(size);
  const edges = getF2LEdges(size);

  const cornerResults = corners.map(c => ({ ...c, solved: isF2LCornerSolved(cubies, c) }));
  const edgeResults = edges.map(e => ({ ...e, solved: isF2LEdgeSolved(cubies, e) }));

  // F2L pairs: corner + its adjacent edge
  const pairs = [
    { corner: cornerResults[0], edge: edgeResults[0], name: 'Front-Right' },
    { corner: cornerResults[1], edge: edgeResults[1], name: 'Front-Left' },
    { corner: cornerResults[2], edge: edgeResults[2], name: 'Back-Right' },
    { corner: cornerResults[3], edge: edgeResults[3], name: 'Back-Left' },
  ].map(p => ({ ...p, solved: p.corner.solved && p.edge.solved }));

  const solvedPairs = pairs.filter(p => p.solved).length;

  return {
    complete: solvedPairs === 4,
    solvedCount: solvedPairs,
    total: 4,
    pairs,
    corners: cornerResults,
    edges: edgeResults
  };
};

// ============================================
// OLL DETECTION (Step 3 - Orient Last Layer)
// ============================================

export const checkOLL = (cubies, size) => {
  const _max = size - 1;
  let yellowCount = 0;
  const total = size * size;

  // Check all stickers on bottom face (NY = yellow)
  for (let x = 0; x < size; x++) {
    for (let z = 0; z < size; z++) {
      const sticker = getSticker(cubies, x, 0, z, 'NY');
      if (sticker && sticker.curr === 6) { // Yellow = 6
        yellowCount++;
      }
    }
  }

  return {
    complete: yellowCount === total,
    solvedCount: yellowCount,
    total,
    percentage: Math.round((yellowCount / total) * 100)
  };
};

// ============================================
// PLL DETECTION (Step 4 - Permute Last Layer)
// ============================================

export const checkPLL = (cubies, size) => {
  const max = size - 1;

  // Check if each side of bottom layer is uniform
  const sides = [
    { face: 'PZ', y: 0, check: (_x, z) => z === 0 }, // Front row
    { face: 'NZ', y: 0, check: (_x, z) => z === max }, // Back row
    { face: 'PX', y: 0, check: (x, _z) => x === max }, // Right row
    { face: 'NX', y: 0, check: (x, _z) => x === 0 }, // Left row
  ];

  let solvedSides = 0;

  for (const side of sides) {
    const expectedColor = DIR_TO_COLOR[side.face];
    let sideComplete = true;

    for (let x = 0; x < size && sideComplete; x++) {
      for (let z = 0; z < size && sideComplete; z++) {
        if (side.check(x, z)) {
          // This position is on the edge of the bottom layer facing this side
          // We need to check the sticker on the side face
        }
      }
    }

    // Simplified: check if bottom row of each face is correct color
    for (let i = 0; i < size; i++) {
      let x, z;
      switch (side.face) {
        case 'PZ': x = i; z = max; break;
        case 'NZ': x = i; z = 0; break;
        case 'PX': x = max; z = i; break;
        case 'NX': x = 0; z = i; break;
      }
      const sticker = getSticker(cubies, x, 0, z, side.face);
      if (!sticker || sticker.curr !== expectedColor) {
        sideComplete = false;
        break;
      }
    }

    if (sideComplete) solvedSides++;
  }

  // Also need OLL to be complete for PLL to matter
  const ollStatus = checkOLL(cubies, size);

  return {
    complete: solvedSides === 4 && ollStatus.complete,
    solvedCount: solvedSides,
    total: 4,
    ollComplete: ollStatus.complete
  };
};

// ============================================
// ALGORITHM HINTS
// ============================================

// Common algorithms for white cross situations
export const WHITE_CROSS_HINTS = [
  {
    name: 'Edge in Bottom Layer',
    description: 'White edge is on the bottom - bring it up',
    algorithm: "F2 (or R2, L2, B2 depending on position)",
    situation: 'White edge facing down'
  },
  {
    name: 'Edge in Middle Layer',
    description: 'White edge is in the middle layer',
    algorithm: "F' U' (to bring edge to top, then position)",
    situation: 'White edge in middle slot'
  },
  {
    name: 'Edge Flipped on Top',
    description: 'White is on top but facing wrong direction',
    algorithm: "F U R U' R' F'",
    situation: 'White edge on top but flipped'
  },
  {
    name: 'Position Edge',
    description: 'Move edge to correct position on top layer',
    algorithm: "U (or U', U2)",
    situation: 'Edge on top, needs alignment'
  }
];

// F2L algorithm hints
export const F2L_HINTS = [
  {
    name: 'Basic Insert',
    description: 'Corner and edge are paired, insert into slot',
    algorithm: "R U R' (or mirror)",
    situation: 'Pair ready to insert'
  },
  {
    name: 'Separate and Pair',
    description: 'Corner in slot, edge on top',
    algorithm: "R U R' U' (Sexy Move) to extract, then pair",
    situation: 'Need to extract corner first'
  },
  {
    name: 'Edge in Wrong Slot',
    description: 'Edge is in a slot but wrong one',
    algorithm: "R U R' U' to extract edge",
    situation: 'Edge needs repositioning'
  }
];

// OLL algorithm hints (simplified)
export const OLL_HINTS = [
  {
    name: 'Sune',
    description: 'Orients 3 corners (headlights pattern)',
    algorithm: "R U R' U R U2 R'",
    situation: 'One corner oriented, headlights on left'
  },
  {
    name: 'Anti-Sune',
    description: 'Orients 3 corners (opposite pattern)',
    algorithm: "R U2 R' U' R U' R'",
    situation: 'One corner oriented, headlights on right'
  },
  {
    name: 'Double Sune',
    description: 'No corners oriented',
    algorithm: "Sune + Sune (with setup)",
    situation: 'All corners need flipping'
  },
  {
    name: 'Sledgehammer',
    description: 'Useful combo move',
    algorithm: "R' F R F'",
    situation: 'Edge flip situations'
  }
];

// PLL algorithm hints
export const PLL_HINTS = [
  {
    name: 'T-Perm',
    description: 'Swaps 2 adjacent corners and 2 edges',
    algorithm: "R U R' U' R' F R2 U' R' U' R U R' F'",
    situation: 'Headlights on one side'
  },
  {
    name: 'U-Perm (a)',
    description: 'Cycles 3 edges clockwise',
    algorithm: "R U' R U R U R U' R' U' R2",
    situation: 'All corners solved, edges need cycling'
  },
  {
    name: 'U-Perm (b)',
    description: 'Cycles 3 edges counter-clockwise',
    algorithm: "R2 U R U R' U' R' U' R' U R'",
    situation: 'All corners solved, edges need cycling (opposite)'
  }
];

// Get contextual hint based on current solve state
export const getHintForState = (cubies, size, currentStep) => {
  switch (currentStep) {
    case 'whiteCross': {
      const status = checkWhiteCross(cubies, size);
      const unsolved = status.edges.filter(e => !e.solved);
      if (unsolved.length === 0) return { message: 'White cross complete! Move to F2L.', hints: [] };

      // Find where the needed white edges currently are
      const whiteEdges = findAllWhiteEdges(cubies, size);

      return {
        message: `Need ${unsolved.length} more edge(s): ${unsolved.map(e => e.name).join(', ')}`,
        hints: WHITE_CROSS_HINTS,
        targetEdges: unsolved,
        currentWhiteEdges: whiteEdges
      };
    }

    case 'f2l': {
      const status = checkF2L(cubies, size);
      const unsolved = status.pairs.filter(p => !p.solved);
      if (unsolved.length === 0) return { message: 'F2L complete! Move to OLL.', hints: [] };

      return {
        message: `Need ${unsolved.length} more pair(s): ${unsolved.map(p => p.name).join(', ')}`,
        hints: F2L_HINTS,
        targetPairs: unsolved
      };
    }

    case 'oll': {
      const status = checkOLL(cubies, size);
      if (status.complete) return { message: 'OLL complete! Move to PLL.', hints: [] };

      return {
        message: `${status.solvedCount}/${status.total} yellow pieces oriented (${status.percentage}%)`,
        hints: OLL_HINTS
      };
    }

    case 'pll': {
      const status = checkPLL(cubies, size);
      if (status.complete) return { message: 'Solved! Congratulations!', hints: [] };

      return {
        message: `${status.solvedCount}/4 sides positioned`,
        hints: PLL_HINTS
      };
    }

    default:
      return { message: 'Select a step to begin', hints: [] };
  }
};

// Main solve progress checker
export const checkSolveProgress = (cubies, size) => {
  const whiteCross = checkWhiteCross(cubies, size);
  const f2l = checkF2L(cubies, size);
  const oll = checkOLL(cubies, size);
  const pll = checkPLL(cubies, size);

  // Determine current step
  let currentStep = 'whiteCross';
  if (whiteCross.complete) currentStep = 'f2l';
  if (whiteCross.complete && f2l.complete) currentStep = 'oll';
  if (whiteCross.complete && f2l.complete && oll.complete) currentStep = 'pll';
  if (pll.complete) currentStep = 'solved';

  return {
    currentStep,
    whiteCross,
    f2l,
    oll,
    pll,
    solved: pll.complete
  };
};

// Get pieces to highlight for current step
export const getPiecesToHighlight = (cubies, size, currentStep) => {
  const highlights = [];

  switch (currentStep) {
    case 'whiteCross': {
      const status = checkWhiteCross(cubies, size);
      // Highlight unsolved edge target positions
      for (const edge of status.edges) {
        highlights.push({
          x: edge.x, y: edge.y, z: edge.z,
          dir: edge.whiteDir,
          solved: edge.solved,
          type: 'target'
        });
      }
      // Highlight where white edges currently are
      const whiteEdges = findAllWhiteEdges(cubies, size);
      for (const edge of whiteEdges) {
        // Only highlight if not already in correct position
        const isTarget = status.edges.some(t =>
          t.x === edge.x && t.y === edge.y && t.z === edge.z && t.whiteDir === edge.whiteDir
        );
        if (!isTarget) {
          highlights.push({
            x: edge.x, y: edge.y, z: edge.z,
            dir: edge.whiteDir,
            solved: false,
            type: 'current'
          });
        }
      }
      break;
    }

    case 'f2l': {
      const status = checkF2L(cubies, size);
      for (const pair of status.pairs) {
        // Highlight corner
        highlights.push({
          x: pair.corner.x, y: pair.corner.y, z: pair.corner.z,
          dir: pair.corner.dirs[0],
          solved: pair.corner.solved,
          type: 'corner'
        });
        // Highlight edge
        highlights.push({
          x: pair.edge.x, y: pair.edge.y, z: pair.edge.z,
          dir: pair.edge.dirs[0],
          solved: pair.edge.solved,
          type: 'edge'
        });
      }
      break;
    }

    case 'oll': {
      // Highlight all bottom face pieces
      for (let x = 0; x < size; x++) {
        for (let z = 0; z < size; z++) {
          const sticker = getSticker(cubies, x, 0, z, 'NY');
          highlights.push({
            x, y: 0, z,
            dir: 'NY',
            solved: sticker?.curr === 6,
            type: 'oll'
          });
        }
      }
      break;
    }

    case 'pll': {
      // Highlight bottom row of each side
      const max = size - 1;
      const sides = [
        { dir: 'PZ', positions: Array.from({length: size}, (_, i) => ({x: i, y: 0, z: max})) },
        { dir: 'NZ', positions: Array.from({length: size}, (_, i) => ({x: i, y: 0, z: 0})) },
        { dir: 'PX', positions: Array.from({length: size}, (_, i) => ({x: max, y: 0, z: i})) },
        { dir: 'NX', positions: Array.from({length: size}, (_, i) => ({x: 0, y: 0, z: i})) },
      ];

      for (const side of sides) {
        const expectedColor = DIR_TO_COLOR[side.dir];
        for (const pos of side.positions) {
          const sticker = getSticker(cubies, pos.x, pos.y, pos.z, side.dir);
          highlights.push({
            ...pos,
            dir: side.dir,
            solved: sticker?.curr === expectedColor,
            type: 'pll'
          });
        }
      }
      break;
    }
  }

  return highlights;
};
