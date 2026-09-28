import { expect, it } from 'vitest';
import { coreOpeningRadius } from '../3d/corePassage.js';
import { tunnelDockWidth } from '../utils/tunnelPath.js';

it('limits the opening diameter to one displayed tile at every size and zoom', () => {
  for (let size = 2; size <= 15; size++) for (const zoom of [1,2,4,6]) {
    expect(coreOpeningRadius(size,zoom)*2).toBeLessThan(tunnelDockWidth(size)*zoom);
    expect(coreOpeningRadius(size,zoom)*2).toBeGreaterThan(tunnelDockWidth(size)*zoom*.85);
  }
});
