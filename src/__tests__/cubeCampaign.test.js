import { describe, it, expect } from 'vitest';
import { createLevel } from '../levels/schema.js';
import { CUBE_CAMPAIGN_LEVELS, getCubeCampaignLevel } from '../levels/data/cube-campaign.js';
import { getNextLevel, getLevel } from '../levels/index.js';

describe('createLevel scrambleMoves', () => {
  it('preserves an explicit scrambleMoves override', () => {
    const level = createLevel({ id: 1, scrambleMoves: 3 });
    expect(level.scrambleMoves).toBe(3);
  });

  it('defaults scrambleMoves to null when omitted', () => {
    const level = createLevel({ id: 1 });
    expect(level.scrambleMoves).toBeNull();
  });
});

describe('CUBE campaign levels', () => {
  it('carries each level scrambleMoves through createLevel', () => {
    const expected = { 1: 3, 2: 5, 3: 4, 4: 6, 5: 8, 6: 12 };
    for (const level of CUBE_CAMPAIGN_LEVELS) {
      expect(level.scrambleMoves).toBe(expected[level.id]);
    }
  });

  it('exposes the campaign through the level manager', () => {
    expect(getLevel(1)).toBe(getCubeCampaignLevel(1));
  });

  it('has a next level for every level except the last', () => {
    const lastId = CUBE_CAMPAIGN_LEVELS[CUBE_CAMPAIGN_LEVELS.length - 1].id;
    for (const level of CUBE_CAMPAIGN_LEVELS) {
      if (level.id === lastId) {
        expect(getNextLevel(level.id)).toBeNull();
      } else {
        expect(getNextLevel(level.id)).not.toBeNull();
      }
    }
  });
});
