import React, { useMemo } from 'react';
import { getManifoldGridId } from '../../game/coordinates.js';
import { isOnEdge } from '../../game/cubeUtils.js';
import { ANTIPODAL_COLOR, FLIP_CAP } from '../../utils/constants.js';
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
 * TileLeaderboard - Live stats showing antipodal pairs with most flips
 *
 * Groups tiles by antipodal pairs and displays the highest individual
 * tile flip count per pair (not the sum). Shows DEAD when a tile hits cap.
 */
const TileLeaderboard = ({ cubies, size, chaosMode, visible, onClose }) => {
  const topPairs = useMemo(() => {
    if (!cubies) return [];

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
                flips: Math.min(sticker.flips, FLIP_CAP),
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
        pairMap[pairKey] = { faceA: a, faceB: b, maxFlips: 0, deadCount: 0, tileCount: 0 };
      }
      pairMap[pairKey].tileCount++;
      if (tile.flips > pairMap[pairKey].maxFlips) pairMap[pairKey].maxFlips = tile.flips;
      if (tile.flips >= FLIP_CAP) pairMap[pairKey].deadCount++;
    }

    // Sort pairs by max flips descending, take top 4
    return Object.values(pairMap)
      .sort((a, b) => b.maxFlips - a.maxFlips)
      .slice(0, 4);
  }, [cubies, size]);

  if (!visible) return null;

  return (
    <div className="tile-leaderboard">
      <div className="leaderboard-header">
        <span className="leaderboard-title">Flip Leaderboard</span>
        <button className="leaderboard-close-btn" onClick={onClose} title="Hide Leaderboard">
          x
        </button>
      </div>
      {topPairs.length === 0 ? (
        <div className="leaderboard-empty">
          {chaosMode ? 'Waiting for flips...' : 'No flips yet'}
        </div>
      ) : (
        <div className="leaderboard-entries">
          {topPairs.map((pair, idx) => (
            <div key={`${pair.faceA}-${pair.faceB}`} className={`leaderboard-entry${pair.deadCount > 0 ? ' entry-row-dead' : ''}`}>
              <span className="entry-rank">#{idx + 1}</span>
              <div className="entry-pair">
                <span
                  className="tile-indicator"
                  style={{ backgroundColor: pair.deadCount > 0 ? '#555' : faceColors[pair.faceA] }}
                  title={faceNames[pair.faceA]}
                />
                <span className="pair-arrow">&#8596;</span>
                <span
                  className="tile-indicator"
                  style={{ backgroundColor: pair.deadCount > 0 ? '#555' : faceColors[pair.faceB] }}
                  title={faceNames[pair.faceB]}
                />
                <span className="pair-label">
                  {faceNames[pair.faceA]}/{faceNames[pair.faceB]}
                </span>
              </div>
              {pair.deadCount > 0 ? (
                <span className="entry-flips entry-dead">DEAD</span>
              ) : (
                <span className="entry-flips">{pair.maxFlips}/{FLIP_CAP}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TileLeaderboard;
