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
 * TileLeaderboard - Shows individual tiles paired with their antipodal twin.
 * Each row is one manifold pair: tile A flips ↔ tile B flips.
 * Sorted by the higher of the two flip counts, top 5.
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
                face: sticker.orig
              };
            }
          }
        }
      }
    }

    // Build 1:1 antipodal pairs using canonical key (lower manifold ID first)
    const pairMap = {};
    for (const tile of Object.values(byId)) {
      const antipodalFace = ANTIPODAL_COLOR[tile.face];
      // Derive antipodal manifold ID — same positional index, opposite face
      const posIdx = tile.manifoldId.split('-')[1];
      const antipodalId = `M${antipodalFace}-${posIdx}`;

      // Canonical key: alphabetically lower ID first to avoid duplicates
      const keyA = tile.manifoldId < antipodalId ? tile.manifoldId : antipodalId;
      const keyB = tile.manifoldId < antipodalId ? antipodalId : tile.manifoldId;
      const pairKey = `${keyA}|${keyB}`;

      if (!pairMap[pairKey]) {
        const faceA = tile.manifoldId < antipodalId ? tile.face : antipodalFace;
        const faceB = tile.manifoldId < antipodalId ? antipodalFace : tile.face;
        pairMap[pairKey] = {
          key: pairKey,
          faceA,
          faceB,
          flipsA: 0,
          flipsB: 0,
          idA: keyA,
          idB: keyB
        };
      }

      // Assign flips to the correct side
      if (tile.manifoldId === pairMap[pairKey].idA) {
        pairMap[pairKey].flipsA = tile.flips;
      } else {
        pairMap[pairKey].flipsB = tile.flips;
      }
    }

    // Sort by highest flip in the pair, take top 5
    return Object.values(pairMap)
      .map((p) => ({ ...p, maxFlips: Math.max(p.flipsA, p.flipsB) }))
      .sort((a, b) => b.maxFlips - a.maxFlips)
      .slice(0, 5);
  }, [cubies, size]);

  if (!visible) return null;

  return (
    <div className="tile-leaderboard">
      <div className="leaderboard-header">
        <span className="leaderboard-title">Flip Pairs</span>
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
          {topPairs.map((pair, idx) => {
            const deadA = pair.flipsA >= FLIP_CAP;
            const deadB = pair.flipsB >= FLIP_CAP;
            const bothDead = deadA && deadB;
            const eitherDead = deadA || deadB;
            return (
              <div key={pair.key} className={`leaderboard-entry${bothDead ? ' entry-row-dead' : ''}`}>
                <span className="entry-rank">#{idx + 1}</span>
                <div className="entry-pair-detail">
                  {/* Side A */}
                  <div className={`pair-side${deadA ? ' side-dead' : ''}`}>
                    <span
                      className="tile-indicator"
                      style={{ backgroundColor: deadA ? '#555' : faceColors[pair.faceA] }}
                      title={faceNames[pair.faceA]}
                    />
                    <span className="side-flips">
                      {deadA ? 'X' : pair.flipsA}
                    </span>
                  </div>
                  {/* Arrow */}
                  <span className={`pair-arrow-detail${eitherDead ? ' arrow-severed' : ''}`}>
                    {bothDead ? '//': '\u2194'}
                  </span>
                  {/* Side B */}
                  <div className={`pair-side${deadB ? ' side-dead' : ''}`}>
                    <span className="side-flips">
                      {deadB ? 'X' : pair.flipsB}
                    </span>
                    <span
                      className="tile-indicator"
                      style={{ backgroundColor: deadB ? '#555' : faceColors[pair.faceB] }}
                      title={faceNames[pair.faceB]}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default TileLeaderboard;
