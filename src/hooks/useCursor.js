/**
 * useCursor Hook
 *
 * Manages keyboard cursor navigation on cube faces.
 */

import { useCallback } from 'react';
import { useGameStore } from './useGameStore.js';

/**
 * Hook for cursor management
 */
export function useCursor() {
  const size = useGameStore((state) => state.size);
  const cursor = useGameStore((state) => state.cursor);
  const showCursor = useGameStore((state) => state.showCursor);
  const setCursor = useGameStore((state) => state.setCursor);
  const setShowCursor = useGameStore((state) => state.setShowCursor);

  // Convert cursor (face, row, col) to cube coordinates (x, y, z) and dirKey
  const cursorToCubePos = useCallback((cur) => {
    const { face, row, col } = cur;
    const maxIdx = size - 1;

    switch (face) {
      case 'PZ': // Front face (red) - z = maxIdx
        return { x: col, y: maxIdx - row, z: maxIdx, dirKey: 'PZ' };
      case 'NZ': // Back face (orange) - z = 0
        return { x: maxIdx - col, y: maxIdx - row, z: 0, dirKey: 'NZ' };
      case 'PX': // Right face (blue) - x = maxIdx
        return { x: maxIdx, y: maxIdx - row, z: maxIdx - col, dirKey: 'PX' };
      case 'NX': // Left face (green) - x = 0
        return { x: 0, y: maxIdx - row, z: col, dirKey: 'NX' };
      case 'PY': // Top face (white) - y = maxIdx
        return { x: col, y: maxIdx, z: row, dirKey: 'PY' };
      case 'NY': // Bottom face (yellow) - y = 0
        return { x: col, y: 0, z: maxIdx - row, dirKey: 'NY' };
      default:
        return { x: 1, y: 1, z: maxIdx, dirKey: 'PZ' };
    }
  }, [size]);

  // Convert cube coordinates (x, y, z) + dirKey to cursor (face, row, col)
  const cubePosToCursor = useCallback((pos, dirKey) => {
    const { x, y, z } = pos;
    const maxIdx = size - 1;

    switch (dirKey) {
      case 'PZ': // Front face - z = maxIdx
        return { face: 'PZ', row: maxIdx - y, col: x };
      case 'NZ': // Back face - z = 0
        return { face: 'NZ', row: maxIdx - y, col: maxIdx - x };
      case 'PX': // Right face - x = maxIdx
        return { face: 'PX', row: maxIdx - y, col: maxIdx - z };
      case 'NX': // Left face - x = 0
        return { face: 'NX', row: maxIdx - y, col: z };
      case 'PY': // Top face - y = maxIdx
        return { face: 'PY', row: z, col: x };
      case 'NY': // Bottom face - y = 0
        return { face: 'NY', row: maxIdx - z, col: x };
      default:
        return { face: 'PZ', row: 1, col: 1 };
    }
  }, [size]);

  // Move cursor with face wrapping
  const moveCursor = useCallback((direction) => {
    const maxIdx = size - 1;

    // Define face adjacencies for wrapping
    const adjacencies = {
      PZ: {
        up: ['PY', (_r, c) => [maxIdx, c]],
        down: ['NY', (_r, c) => [0, c]],
        left: ['NX', (r, _c) => [r, maxIdx]],
        right: ['PX', (r, _c) => [r, 0]]
      },
      NZ: {
        up: ['PY', (_r, c) => [0, maxIdx - c]],
        down: ['NY', (_r, c) => [maxIdx, maxIdx - c]],
        left: ['PX', (r, _c) => [r, maxIdx]],
        right: ['NX', (r, _c) => [r, 0]]
      },
      PX: {
        up: ['PY', (_r, c) => [maxIdx - c, maxIdx]],
        down: ['NY', (_r, c) => [c, maxIdx]],
        left: ['PZ', (r, _c) => [r, maxIdx]],
        right: ['NZ', (r, _c) => [r, 0]]
      },
      NX: {
        up: ['PY', (_r, c) => [c, 0]],
        down: ['NY', (_r, c) => [maxIdx - c, 0]],
        left: ['NZ', (r, _c) => [r, maxIdx]],
        right: ['PZ', (r, _c) => [r, 0]]
      },
      PY: {
        up: ['NZ', (r, c) => [0, maxIdx - c]],
        down: ['PZ', (r, c) => [0, c]],
        left: ['NX', (r, c) => [0, c]],
        right: ['PX', (r, c) => [0, maxIdx - c]]
      },
      NY: {
        up: ['PZ', (r, c) => [maxIdx, c]],
        down: ['NZ', (r, c) => [maxIdx, maxIdx - c]],
        left: ['NX', (r, c) => [maxIdx, maxIdx - c]],
        right: ['PX', (r, c) => [maxIdx, c]]
      }
    };

    setCursor((cur) => {
      const { face, row, col } = cur;
      let newRow = row, newCol = col, newFace = face;

      switch (direction) {
        case 'up':
          if (row > 0) {
            newRow = row - 1;
          } else {
            const [nf, transform] = adjacencies[face].up;
            newFace = nf;
            [newRow, newCol] = transform(row, col);
          }
          break;
        case 'down':
          if (row < maxIdx) {
            newRow = row + 1;
          } else {
            const [nf, transform] = adjacencies[face].down;
            newFace = nf;
            [newRow, newCol] = transform(row, col);
          }
          break;
        case 'left':
          if (col > 0) {
            newCol = col - 1;
          } else {
            const [nf, transform] = adjacencies[face].left;
            newFace = nf;
            [newRow, newCol] = transform(row, col);
          }
          break;
        case 'right':
          if (col < maxIdx) {
            newCol = col + 1;
          } else {
            const [nf, transform] = adjacencies[face].right;
            newFace = nf;
            [newRow, newCol] = transform(row, col);
          }
          break;
      }

      return { face: newFace, row: newRow, col: newCol };
    });
    setShowCursor(true);
  }, [size, setCursor, setShowCursor]);

  // Get rotation parameters based on cursor position and rotation type
  const getRotationParams = useCallback((rotationType) => {
    const pos = cursorToCubePos(cursor);
    const { face } = cursor;

    let axis, dir;

    switch (rotationType) {
      case 'up':
        switch (face) {
          case 'PZ': axis = 'col'; dir = -1; break;
          case 'NZ': axis = 'col'; dir = 1; break;
          case 'PX': axis = 'depth'; dir = 1; break;
          case 'NX': axis = 'depth'; dir = -1; break;
          case 'PY': axis = 'depth'; dir = -1; break;
          case 'NY': axis = 'depth'; dir = 1; break;
        }
        break;
      case 'down':
        switch (face) {
          case 'PZ': axis = 'col'; dir = 1; break;
          case 'NZ': axis = 'col'; dir = -1; break;
          case 'PX': axis = 'depth'; dir = -1; break;
          case 'NX': axis = 'depth'; dir = 1; break;
          case 'PY': axis = 'depth'; dir = 1; break;
          case 'NY': axis = 'depth'; dir = -1; break;
        }
        break;
      case 'left':
        switch (face) {
          case 'PZ': axis = 'row'; dir = -1; break;
          case 'NZ': axis = 'row'; dir = -1; break;
          case 'PX': axis = 'row'; dir = -1; break;
          case 'NX': axis = 'row'; dir = -1; break;
          case 'PY': axis = 'col'; dir = -1; break;
          case 'NY': axis = 'col'; dir = 1; break;
        }
        break;
      case 'right':
        switch (face) {
          case 'PZ': axis = 'row'; dir = 1; break;
          case 'NZ': axis = 'row'; dir = 1; break;
          case 'PX': axis = 'row'; dir = 1; break;
          case 'NX': axis = 'row'; dir = 1; break;
          case 'PY': axis = 'col'; dir = 1; break;
          case 'NY': axis = 'col'; dir = -1; break;
        }
        break;
      case 'cw':
        switch (face) {
          case 'PZ': axis = 'depth'; dir = -1; break;
          case 'NZ': axis = 'depth'; dir = 1; break;
          case 'PX': axis = 'col'; dir = -1; break;
          case 'NX': axis = 'col'; dir = 1; break;
          case 'PY': axis = 'row'; dir = 1; break;
          case 'NY': axis = 'row'; dir = -1; break;
        }
        break;
      case 'ccw':
        switch (face) {
          case 'PZ': axis = 'depth'; dir = 1; break;
          case 'NZ': axis = 'depth'; dir = -1; break;
          case 'PX': axis = 'col'; dir = 1; break;
          case 'NX': axis = 'col'; dir = -1; break;
          case 'PY': axis = 'row'; dir = -1; break;
          case 'NY': axis = 'row'; dir = 1; break;
        }
        break;
    }

    return { axis, dir, pos };
  }, [cursor, cursorToCubePos]);

  return {
    // State
    cursor,
    showCursor,

    // Actions
    setCursor,
    setShowCursor,
    moveCursor,
    cursorToCubePos,
    cubePosToCursor,
    getRotationParams,
  };
}
