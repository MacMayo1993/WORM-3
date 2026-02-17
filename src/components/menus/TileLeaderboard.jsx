import React, { useMemo } from 'react';
import { getManifoldGridId } from '../../game/coordinates.js';
import { isOnEdge } from '../../game/cubeUtils.js';
import { ANTIPODAL_COLOR } from '../../utils/constants.js';
import './TileLeaderboard.css';

/**
 * TileLeaderboard - Live stats showing tiles with most flips in chaos mode
 *
 * Displays top tiles by flip count with manifold IDs and antipodal pair info
 */
const TileLeaderboard = ({ cubies, size, chaosMode }) => {
  const topTiles = useMemo(() => {
    if (!chaosMode || !cubies) return [];

    const tiles = [];

    // Collect all tiles with flip counts
    for (let x = 0; x < size; x++) {
      for (let y = 0; y < size; y++) {
        for (let z = 0; z < size; z++) {
          const cubie = cubies[x][y][z];
          for (const dirKey of Object.keys(cubie.stickers)) {
            const sticker = cubie.stickers[dirKey];
            if (sticker.flips > 0 && isOnEdge(x, y, z, dirKey, size)) {
              const manifoldId = getManifoldGridId(sticker, size);
              const antipodalFace = ANTIPODAL_COLOR[sticker.orig];
              tiles.push({
                manifoldId,
                flips: sticker.flips,
                faceColor: sticker.orig,
                antipodalFace,
                x,
                y,
                z,
                dirKey
              });
            }
          }
        }
      }
    }

    // Sort by flip count (descending) and take top 8
    return tiles.sort((a, b) => b.flips - a.flips).slice(0, 8);
  }, [cubies, size, chaosMode]);

  if (!chaosMode || topTiles.length === 0) return null;

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

  return (
    <div className="tile-leaderboard">
      <div className="leaderboard-header">
        <span className="leaderboard-title">🔥 Flip Leaderboard</span>
        <span className="leaderboard-subtitle">Most Active Tiles</span>
      </div>
      <div className="leaderboard-entries">
        {topTiles.map((tile, idx) => (
          <div key={`${tile.manifoldId}-${idx}`} className="leaderboard-entry">
            <span className="entry-rank">#{idx + 1}</span>
            <div className="entry-info">
              <div className="entry-tile">
                <span
                  className="tile-indicator"
                  style={{ backgroundColor: faceColors[tile.faceColor] }}
                  title={faceNames[tile.faceColor]}
                />
                <span className="tile-id">{tile.manifoldId}</span>
              </div>
              <div className="entry-antipodal">
                <span className="antipodal-arrow">↔</span>
                <span
                  className="tile-indicator"
                  style={{ backgroundColor: faceColors[tile.antipodalFace] }}
                  title={faceNames[tile.antipodalFace]}
                />
                <span className="antipodal-label">{faceNames[tile.antipodalFace]}</span>
              </div>
            </div>
            <span className="entry-flips">{tile.flips}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TileLeaderboard;
