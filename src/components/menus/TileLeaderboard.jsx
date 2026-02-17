import React, { useMemo, useState } from 'react';
import { getManifoldGridId } from '../../game/coordinates.js';
import { isOnEdge } from '../../game/cubeUtils.js';
import { ANTIPODAL_COLOR } from '../../utils/constants.js';
import './TileLeaderboard.css';

const faceNames = {
  1: 'Red',
  2: 'Green',
  3: 'White',
  4: 'Orange',
  5: 'Blue',
  6: 'Yellow'
};

const faceColors = {
  1: '#e74c3c',
  2: '#2ecc71',
  3: '#ecf0f1',
  4: '#e67e22',
  5: '#3498db',
  6: '#f1c40f'
};

/**
 * TileLeaderboard - Toggleable live stats showing antipodal pairs with most flips
 *
 * Groups tiles by antipodal pairs and displays combined flip counts.
 * Hidden by default; toggled via a small button.
 */
const TileLeaderboard = ({ cubies, size, chaosMode }) => {
  const [open, setOpen] = useState(false);

  const topPairs = useMemo(() => {
    if (!chaosMode || !cubies) return [];

    // Collect all flipped edge stickers keyed by manifold ID
    const byId = {};

    for (let x = 0; x < size; x++) {
      for (let y = 0; y < size; y++) {
        for (let z = 0; z < size; z++) {
          const cubie = cubies[x][y][z];
          for (const dirKey of Object.keys(cubie.stickers)) {
            const sticker = cubie.stickers[dirKey];
            if (sticker.flips > 0 && isOnEdge(x, y, z, dirKey, size)) {
              const manifoldId = getManifoldGridId(sticker, size);
              byId[manifoldId] = {
                manifoldId,
                flips: sticker.flips,
                faceColor: sticker.orig,
                antipodalFace: ANTIPODAL_COLOR[sticker.orig]
              };
            }
          }
        }
      }
    }

    // Group into antipodal pairs using a canonical key (lower face ID first)
    const pairMap = {};
    for (const tile of Object.values(byId)) {
      const a = Math.min(tile.faceColor, tile.antipodalFace);
      const b = Math.max(tile.faceColor, tile.antipodalFace);
      const pairKey = `${a}-${b}`;
      if (!pairMap[pairKey]) {
        pairMap[pairKey] = { faceA: a, faceB: b, totalFlips: 0, tiles: [] };
      }
      pairMap[pairKey].totalFlips += tile.flips;
      pairMap[pairKey].tiles.push(tile);
    }

    // Sort pairs by total flips descending, take top 4
    return Object.values(pairMap)
      .sort((a, b) => b.totalFlips - a.totalFlips)
      .slice(0, 4);
  }, [cubies, size, chaosMode]);

  if (!chaosMode || topPairs.length === 0) return null;

  // Toggle button only when closed
  if (!open) {
    return (
      <button className="leaderboard-toggle-btn" onClick={() => setOpen(true)} title="Show Flip Leaderboard">
        <span className="toggle-icon">LB</span>
      </button>
    );
  }

  return (
    <div className="tile-leaderboard">
      <div className="leaderboard-header">
        <span className="leaderboard-title">Flip Leaderboard</span>
        <button className="leaderboard-close-btn" onClick={() => setOpen(false)} title="Hide Leaderboard">
          x
        </button>
      </div>
      <div className="leaderboard-entries">
        {topPairs.map((pair, idx) => (
          <div key={`${pair.faceA}-${pair.faceB}`} className="leaderboard-entry">
            <span className="entry-rank">#{idx + 1}</span>
            <div className="entry-pair">
              <span
                className="tile-indicator"
                style={{ backgroundColor: faceColors[pair.faceA] }}
                title={faceNames[pair.faceA]}
              />
              <span className="pair-arrow">&#8596;</span>
              <span
                className="tile-indicator"
                style={{ backgroundColor: faceColors[pair.faceB] }}
                title={faceNames[pair.faceB]}
              />
              <span className="pair-label">
                {faceNames[pair.faceA]}/{faceNames[pair.faceB]}
              </span>
            </div>
            <span className="entry-flips">{pair.totalFlips}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TileLeaderboard;
