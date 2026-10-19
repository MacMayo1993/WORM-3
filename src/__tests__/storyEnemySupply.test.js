import { expect, it } from 'vitest';
import { WORM_STORY_LEVELS } from '../worm/story/levels.js';
import { makeStoryCombat, stepStoryCombat } from '../worm/story/combat.js';
import { surfacePose } from '../worm/combat/portalCombat.js';

it.each(WORM_STORY_LEVELS.filter(level => level.mechanics?.kills))(
  'level $id replaces a missed enemy encounter and supplies every required kill through real shots', level => {
    const size = level.cubeSize, c = makeStoryCombat(size);
    const head = { x: 0, y: 0, z: size - 1, dirKey: 'PZ' };
    const player = { head, heading: 'up', position: surfacePose(head, head, 0, size).position,
      phase: 'active', alive: true, healed: level.target, protected: true, elementT: 0 };
    const tick = count => { for (let i = 0; i < count; i++) stepStoryCombat(c, .05, player, level.mechanics.kills); };
    c.quiet = 0; tick(1); tick(51);
    expect(c.enemies).toHaveLength(1);
    c.remaining = .01; tick(1); // A missed encounter must earn no credit.
    expect(c.kills).toBe(0); expect(c.encounter).toBe(false);
    for (let kills = 0; kills < level.mechanics.kills; kills++) {
      c.quiet = 0; tick(1); tick(51);
      expect(c.enemies).toHaveLength(1);
      c.enemies[0].freeze = 15; c.fireHeld = true;
      tick(120);
      expect(c.kills).toBe(kills + 1); expect(c.encounter).toBe(false);
    }
    c.quiet = 0; tick(100);
    expect(c.encounter).toBe(false); expect(c.won).toBe(false);
  });
