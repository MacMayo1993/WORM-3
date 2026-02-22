// src/teach/solver3x3.js
// Beginner layer-by-layer solver for 3x3 cube
//
// Analyzes the CURRENT cube state and determines:
//   1. Which stage of solving the user is at
//   2. What the next move(s) should be for the current stage
//   3. Which pieces to highlight
//
// Color mapping (from cubeState.js):
//   1=Red(PZ/Front), 2=Green(NX/Left), 3=White(PY/Top),
//   4=Orange(NZ/Back), 5=Blue(PX/Right), 6=Yellow(NY/Bottom)
//
// After "flip" orientation (white on bottom for stages 3-7):
//   U=Yellow(6), D=White(3), F=Red(1), B=Orange(4), R=Blue(5), L=Green(2)

// Face direction → solved color mapping
const DIR_TO_COLOR = { PZ: 1, NX: 2, PY: 3, NZ: 4, PX: 5, NY: 6 };
const COLOR_TO_DIR = { 1: 'PZ', 2: 'NX', 3: 'PY', 4: 'NZ', 5: 'PX', 6: 'NY' };

// Helper: get sticker color at a specific position and face direction
function getSticker(cubies, x, y, z, dir) {
  const st = cubies[x]?.[y]?.[z]?.stickers[dir];
  return st ? st.curr : null;
}

// Check how many white edges are correctly placed on the top (PY) face
function countWhiteCrossEdges(cubies) {
  let count = 0;
  // White edge positions on top face (PY, y=2) — edges are at non-corner positions
  // Front-top edge: (1,2,2) — PY should be white(3), PZ should be red(1)
  if (getSticker(cubies, 1, 2, 2, 'PY') === 3 && getSticker(cubies, 1, 2, 2, 'PZ') === 1) count++;
  // Right-top edge: (2,2,1) — PY should be white(3), PX should be blue(5)
  if (getSticker(cubies, 2, 2, 1, 'PY') === 3 && getSticker(cubies, 2, 2, 1, 'PX') === 5) count++;
  // Back-top edge: (1,2,0) — PY should be white(3), NZ should be orange(4)
  if (getSticker(cubies, 1, 2, 0, 'PY') === 3 && getSticker(cubies, 1, 2, 0, 'NZ') === 4) count++;
  // Left-top edge: (0,2,1) — PY should be white(3), NX should be green(2)
  if (getSticker(cubies, 0, 2, 1, 'PY') === 3 && getSticker(cubies, 0, 2, 1, 'NX') === 2) count++;
  return count;
}

// Check how many white corners are correctly placed
function countWhiteCorners(cubies) {
  let count = 0;
  // 4 corners of the top white face
  // Front-right-top: (2,2,2) — PY=white, PX=blue, PZ=red
  if (getSticker(cubies, 2, 2, 2, 'PY') === 3 && getSticker(cubies, 2, 2, 2, 'PX') === 5 && getSticker(cubies, 2, 2, 2, 'PZ') === 1) count++;
  // Front-left-top: (0,2,2) — PY=white, NX=green, PZ=red
  if (getSticker(cubies, 0, 2, 2, 'PY') === 3 && getSticker(cubies, 0, 2, 2, 'NX') === 2 && getSticker(cubies, 0, 2, 2, 'PZ') === 1) count++;
  // Back-right-top: (2,2,0) — PY=white, PX=blue, NZ=orange
  if (getSticker(cubies, 2, 2, 0, 'PY') === 3 && getSticker(cubies, 2, 2, 0, 'PX') === 5 && getSticker(cubies, 2, 2, 0, 'NZ') === 4) count++;
  // Back-left-top: (0,2,0) — PY=white, NX=green, NZ=orange
  if (getSticker(cubies, 0, 2, 0, 'PY') === 3 && getSticker(cubies, 0, 2, 0, 'NX') === 2 && getSticker(cubies, 0, 2, 0, 'NZ') === 4) count++;
  return count;
}

// Check middle layer edges (after the cube orientation is white on top)
function countMiddleEdges(cubies) {
  let count = 0;
  // Middle layer edge positions (y=1):
  // Front-right: (2,1,2) — PX=blue(5), PZ=red(1)
  if (getSticker(cubies, 2, 1, 2, 'PX') === 5 && getSticker(cubies, 2, 1, 2, 'PZ') === 1) count++;
  // Front-left: (0,1,2) — NX=green(2), PZ=red(1)
  if (getSticker(cubies, 0, 1, 2, 'NX') === 2 && getSticker(cubies, 0, 1, 2, 'PZ') === 1) count++;
  // Back-right: (2,1,0) — PX=blue(5), NZ=orange(4)
  if (getSticker(cubies, 2, 1, 0, 'PX') === 5 && getSticker(cubies, 2, 1, 0, 'NZ') === 4) count++;
  // Back-left: (0,1,0) — NX=green(2), NZ=orange(4)
  if (getSticker(cubies, 0, 1, 0, 'NX') === 2 && getSticker(cubies, 0, 1, 0, 'NZ') === 4) count++;
  return count;
}

// Count yellow edges on bottom face (NY)
function countYellowCrossEdges(cubies) {
  let count = 0;
  // Bottom face edges (y=0):
  if (getSticker(cubies, 1, 0, 2, 'NY') === 6) count++; // Front-bottom
  if (getSticker(cubies, 2, 0, 1, 'NY') === 6) count++; // Right-bottom
  if (getSticker(cubies, 1, 0, 0, 'NY') === 6) count++; // Back-bottom
  if (getSticker(cubies, 0, 0, 1, 'NY') === 6) count++; // Left-bottom
  return count;
}

// Check if yellow edges are correctly positioned (match side centers)
function countYellowEdgesPositioned(cubies) {
  let count = 0;
  // Front-bottom edge side color matches front center
  if (getSticker(cubies, 1, 0, 2, 'PZ') === 1) count++;
  // Right-bottom edge side color matches right center
  if (getSticker(cubies, 2, 0, 1, 'PX') === 5) count++;
  // Back-bottom edge side color matches back center
  if (getSticker(cubies, 1, 0, 0, 'NZ') === 4) count++;
  // Left-bottom edge side color matches left center
  if (getSticker(cubies, 0, 0, 1, 'NX') === 2) count++;
  return count;
}

// Check if yellow corners are in correct positions (contain the right 3 colors)
function countYellowCornersPositioned(cubies) {
  let count = 0;

  const checkCorner = (x, y, z, dirs, expectedColors) => {
    const colors = new Set(dirs.map(d => getSticker(cubies, x, y, z, d)));
    return expectedColors.every(c => colors.has(c));
  };

  // Front-right-bottom: (2,0,2) should have yellow(6), red(1), blue(5)
  if (checkCorner(2, 0, 2, ['NY', 'PX', 'PZ'], [6, 1, 5])) count++;
  // Front-left-bottom: (0,0,2) should have yellow(6), red(1), green(2)
  if (checkCorner(0, 0, 2, ['NY', 'NX', 'PZ'], [6, 1, 2])) count++;
  // Back-right-bottom: (2,0,0) should have yellow(6), orange(4), blue(5)
  if (checkCorner(2, 0, 0, ['NY', 'PX', 'NZ'], [6, 4, 5])) count++;
  // Back-left-bottom: (0,0,0) should have yellow(6), orange(4), green(2)
  if (checkCorner(0, 0, 0, ['NY', 'NX', 'NZ'], [6, 4, 2])) count++;

  return count;
}

// Check if yellow corners are fully oriented (yellow faces down)
function countYellowCornersOriented(cubies) {
  let count = 0;
  if (getSticker(cubies, 2, 0, 2, 'NY') === 6) count++;
  if (getSticker(cubies, 0, 0, 2, 'NY') === 6) count++;
  if (getSticker(cubies, 2, 0, 0, 'NY') === 6) count++;
  if (getSticker(cubies, 0, 0, 0, 'NY') === 6) count++;
  return count;
}

// Check if the cube is fully solved
function isSolved(cubies) {
  for (let x = 0; x < 3; x++) {
    for (let y = 0; y < 3; y++) {
      for (let z = 0; z < 3; z++) {
        for (const [dir, st] of Object.entries(cubies[x][y][z].stickers)) {
          if (st.curr !== DIR_TO_COLOR[dir]) return false;
        }
      }
    }
  }
  return true;
}

// ---------------------------------------------------------------------------
// Main analysis: determine current stage and provide guidance
// ---------------------------------------------------------------------------
export function analyzeState(cubies) {
  if (isSolved(cubies)) {
    return {
      stageIndex: 7,
      stageId: 'solved',
      stageName: 'Solved!',
      description: 'The cube is solved. Congratulations!',
      progress: { current: 7, total: 7 },
      highlights: [],
      nextMoves: null,
    };
  }

  const whiteCross = countWhiteCrossEdges(cubies);
  const whiteCorners = countWhiteCorners(cubies);
  const middleEdges = countMiddleEdges(cubies);
  const yellowCross = countYellowCrossEdges(cubies);
  const yellowEdgesPos = countYellowEdgesPositioned(cubies);
  const yellowCornersPos = countYellowCornersPositioned(cubies);
  const yellowCornersOri = countYellowCornersOriented(cubies);

  // Determine stage
  if (whiteCross < 4) {
    return buildStageResult(0, 'white-cross', cubies, whiteCross, 4);
  }
  if (whiteCorners < 4) {
    return buildStageResult(1, 'white-corners', cubies, whiteCorners, 4);
  }
  if (middleEdges < 4) {
    return buildStageResult(2, 'second-layer', cubies, middleEdges, 4);
  }
  if (yellowCross < 4) {
    return buildStageResult(3, 'yellow-cross', cubies, yellowCross, 4);
  }
  if (yellowEdgesPos < 4) {
    return buildStageResult(4, 'yellow-edges', cubies, yellowEdgesPos, 4);
  }
  if (yellowCornersPos < 4) {
    return buildStageResult(5, 'yellow-corners-position', cubies, yellowCornersPos, 4);
  }
  if (yellowCornersOri < 4) {
    return buildStageResult(6, 'yellow-corners-orient', cubies, yellowCornersOri, 4);
  }

  // Everything checks out individually but isSolved returned false
  // This can happen if the last U-layer alignment is off
  return {
    stageIndex: 6,
    stageId: 'yellow-corners-orient',
    stageName: 'Step 7: Orient Yellow Corners',
    description: 'Almost there! Use U turns to align the last layer.',
    progress: { current: 6, total: 7 },
    highlights: [],
    nextMoves: null,
  };
}

function buildStageResult(stageIndex, stageId, cubies, completed, total) {
  const STAGE_NAMES = [
    'Step 1: White Cross',
    'Step 2: White Corners',
    'Step 3: Middle Layer Edges',
    'Step 4: Yellow Cross',
    'Step 5: Position Yellow Edges',
    'Step 6: Position Yellow Corners',
    'Step 7: Orient Yellow Corners',
  ];

  const highlights = getHighlightsForStage(stageIndex, cubies);

  return {
    stageIndex,
    stageId,
    stageName: STAGE_NAMES[stageIndex],
    progress: { current: stageIndex, total: 7, stepProgress: `${completed}/${total}` },
    highlights,
    nextMoves: null,
  };
}

// ---------------------------------------------------------------------------
// Highlight pieces relevant to the current stage
// ---------------------------------------------------------------------------
function getHighlightsForStage(stageIndex, cubies) {
  const highlights = [];

  switch (stageIndex) {
    case 0: {
      // White cross: highlight white edge pieces wherever they are
      for (let x = 0; x < 3; x++) {
        for (let y = 0; y < 3; y++) {
          for (let z = 0; z < 3; z++) {
            const stickers = cubies[x][y][z].stickers;
            const isEdge = Object.keys(stickers).length === 2;
            if (!isEdge) continue;
            const hasWhite = Object.values(stickers).some(s => s.curr === 3);
            if (!hasWhite) continue;
            // Check if this edge is already correctly placed
            const isCorrectPY = stickers.PY?.curr === 3;
            let sideCorrect = false;
            if (isCorrectPY) {
              if (stickers.PZ?.curr === 1) sideCorrect = true;
              if (stickers.NZ?.curr === 4) sideCorrect = true;
              if (stickers.PX?.curr === 5) sideCorrect = true;
              if (stickers.NX?.curr === 2) sideCorrect = true;
            }
            for (const dir of Object.keys(stickers)) {
              highlights.push({
                x, y, z, dir,
                type: (isCorrectPY && sideCorrect) ? 'solved' : 'target',
                solved: isCorrectPY && sideCorrect,
              });
            }
          }
        }
      }
      break;
    }
    case 1: {
      // White corners: highlight white corner pieces
      for (let x = 0; x < 3; x++) {
        for (let y = 0; y < 3; y++) {
          for (let z = 0; z < 3; z++) {
            const stickers = cubies[x][y][z].stickers;
            const isCorner = Object.keys(stickers).length === 3;
            if (!isCorner) continue;
            const hasWhite = Object.values(stickers).some(s => s.curr === 3);
            if (!hasWhite) continue;
            const solved = y === 2 && stickers.PY?.curr === 3;
            for (const dir of Object.keys(stickers)) {
              highlights.push({
                x, y, z, dir,
                type: solved ? 'solved' : 'corner',
                solved,
              });
            }
          }
        }
      }
      break;
    }
    case 2: {
      // Middle layer edges
      const middlePositions = [
        { x: 2, y: 1, z: 2, dirs: ['PX', 'PZ'], colors: [5, 1] },
        { x: 0, y: 1, z: 2, dirs: ['NX', 'PZ'], colors: [2, 1] },
        { x: 2, y: 1, z: 0, dirs: ['PX', 'NZ'], colors: [5, 4] },
        { x: 0, y: 1, z: 0, dirs: ['NX', 'NZ'], colors: [2, 4] },
      ];
      for (const pos of middlePositions) {
        const solved = pos.dirs.every((d, i) => getSticker(cubies, pos.x, pos.y, pos.z, d) === pos.colors[i]);
        for (const dir of pos.dirs) {
          highlights.push({
            x: pos.x, y: pos.y, z: pos.z, dir,
            type: solved ? 'solved' : 'edge',
            solved,
          });
        }
      }
      break;
    }
    case 3: {
      // Yellow cross: highlight bottom edge positions
      const edges = [
        { x: 1, y: 0, z: 2 },
        { x: 2, y: 0, z: 1 },
        { x: 1, y: 0, z: 0 },
        { x: 0, y: 0, z: 1 },
      ];
      for (const e of edges) {
        const solved = getSticker(cubies, e.x, e.y, e.z, 'NY') === 6;
        highlights.push({
          ...e, dir: 'NY',
          type: solved ? 'solved' : 'target',
          solved,
        });
      }
      break;
    }
    case 4: {
      // Yellow edges position: highlight bottom edges with side colors
      const edges = [
        { x: 1, y: 0, z: 2, sideDir: 'PZ', sideColor: 1 },
        { x: 2, y: 0, z: 1, sideDir: 'PX', sideColor: 5 },
        { x: 1, y: 0, z: 0, sideDir: 'NZ', sideColor: 4 },
        { x: 0, y: 0, z: 1, sideDir: 'NX', sideColor: 2 },
      ];
      for (const e of edges) {
        const solved = getSticker(cubies, e.x, e.y, e.z, e.sideDir) === e.sideColor;
        highlights.push({
          x: e.x, y: e.y, z: e.z, dir: e.sideDir,
          type: solved ? 'solved' : 'edge',
          solved,
        });
      }
      break;
    }
    case 5: {
      // Yellow corners position
      const corners = [
        { x: 2, y: 0, z: 2, expected: [6, 1, 5] },
        { x: 0, y: 0, z: 2, expected: [6, 1, 2] },
        { x: 2, y: 0, z: 0, expected: [6, 4, 5] },
        { x: 0, y: 0, z: 0, expected: [6, 4, 2] },
      ];
      for (const c of corners) {
        const stickers = cubies[c.x][c.y][c.z].stickers;
        const colors = new Set(Object.values(stickers).map(s => s.curr));
        const solved = c.expected.every(e => colors.has(e));
        for (const dir of Object.keys(stickers)) {
          highlights.push({
            x: c.x, y: c.y, z: c.z, dir,
            type: solved ? 'solved' : 'corner',
            solved,
          });
        }
      }
      break;
    }
    case 6: {
      // Yellow corners orientation
      const corners = [
        { x: 2, y: 0, z: 2 },
        { x: 0, y: 0, z: 2 },
        { x: 2, y: 0, z: 0 },
        { x: 0, y: 0, z: 0 },
      ];
      for (const c of corners) {
        const solved = getSticker(cubies, c.x, c.y, c.z, 'NY') === 6;
        const stickers = cubies[c.x][c.y][c.z].stickers;
        for (const dir of Object.keys(stickers)) {
          highlights.push({
            x: c.x, y: c.y, z: c.z, dir,
            type: solved ? 'solved' : 'corner',
            solved,
          });
        }
      }
      break;
    }
  }

  return highlights;
}

// ---------------------------------------------------------------------------
// Get the layer highlight for a pending move
// Returns { axis, sliceIndex } to visually highlight
// ---------------------------------------------------------------------------
export function getLayerHighlight(move) {
  if (!move) return null;
  return {
    axis: move.axis,
    sliceIndex: move.sliceIndex,
    dir: move.dir,
  };
}
