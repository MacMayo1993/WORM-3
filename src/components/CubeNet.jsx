import React, { useMemo } from 'react';
import { FACE_COLORS } from '../utils/constants.js';
import { faceRCFor } from '../game/coordinates.js';

// Face definitions for the cross-shaped net layout
// Grid layout (4 cols × 3 rows):
//          [Top/PY]
// [Left/NX][Front/PZ][Right/PX][Back/NZ]
//          [Bottom/NY]
const FACES = [
  { dirKey: 'PY', label: 'U', gridRow: 1, gridCol: 2, filter: (_x, y, _z, s) => y === s - 1 },
  { dirKey: 'NX', label: 'L', gridRow: 2, gridCol: 1, filter: (x, _y, _z, _s) => x === 0 },
  { dirKey: 'PZ', label: 'F', gridRow: 2, gridCol: 2, filter: (_x, _y, z, s) => z === s - 1 },
  { dirKey: 'PX', label: 'R', gridRow: 2, gridCol: 3, filter: (x, _y, _z, s) => x === s - 1 },
  { dirKey: 'NZ', label: 'B', gridRow: 2, gridCol: 4, filter: (_x, _y, z, _s) => z === 0 },
  { dirKey: 'NY', label: 'D', gridRow: 3, gridCol: 2, filter: (_x, y, _z, _s) => y === 0 },
];

export default function CubeNet({ cubies, size, onTapFlip, flipMode, onClose, faceColors }) {
  const fc = faceColors || FACE_COLORS;
  // Build face grids from cubies state
  const faceGrids = useMemo(() => {
    const grids = {};

    for (const face of FACES) {
      const grid = Array.from({ length: size }, () => Array(size).fill(null));

      for (let x = 0; x < size; x++) {
        for (let y = 0; y < size; y++) {
          for (let z = 0; z < size; z++) {
            if (!face.filter(x, y, z, size)) continue;
            const cubie = cubies[x]?.[y]?.[z];
            if (!cubie) continue;
            const sticker = cubie.stickers[face.dirKey];
            if (!sticker) continue;

            const { r, c } = faceRCFor(face.dirKey, x, y, z, size);
            grid[r][c] = {
              color: fc[sticker.curr],
              flips: sticker.flips || 0,
              x, y, z,
              dirKey: face.dirKey,
            };
          }
        }
      }

      grids[face.dirKey] = grid;
    }

    return grids;
  }, [cubies, size, fc]);

  const handleCellClick = (cell) => {
    if (!flipMode || !cell) return;
    onTapFlip({ x: cell.x, y: cell.y, z: cell.z }, cell.dirKey);
  };

  return (
    <div className="net-panel open">
      <div className="net-panel-header">
        <span className="net-panel-title">NET</span>
        <button className="net-close-btn" onClick={onClose}>&times;</button>
      </div>
      <div className="net-cross" style={{
        gridTemplateColumns: `repeat(4, ${size}fr)`,
        gridTemplateRows: `repeat(3, ${size}fr)`,
      }}>
        {FACES.map((face) => (
          <div
            key={face.dirKey}
            className="net-face"
            style={{
              gridRow: face.gridRow,
              gridColumn: face.gridCol,
              gridTemplateColumns: `repeat(${size}, 1fr)`,
              gridTemplateRows: `repeat(${size}, 1fr)`,
            }}
          >
            <span className="net-face-label">{face.label}</span>
            {faceGrids[face.dirKey]?.flat().map((cell, idx) => (
              <div
                key={idx}
                className={`net-cell${flipMode && cell ? ' clickable' : ''}${cell?.flips > 0 ? ' flipped' : ''}`}
                style={{ backgroundColor: cell?.color || '#222' }}
                onClick={() => handleCellClick(cell)}
              >
                {cell?.flips > 0 && <span className="net-flip-dot" />}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
