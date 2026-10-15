import { expect, it } from 'vitest';
import { coreOpeningRadius } from '../3d/corePassage.js';
import { tunnelRiderDockWidth } from '../utils/tunnelPath.js';

it('leaves a rim around the occupied riding lane at every size and zoom', () => {
  for (let size = 2; size <= 15; size++) for (const zoom of [1,2,4,6]) {
    expect(coreOpeningRadius(size,zoom)*2).toBeLessThan(tunnelRiderDockWidth(size)*zoom);
    expect(coreOpeningRadius(size,zoom)*2).toBeGreaterThan(tunnelRiderDockWidth(size)*zoom*.85);
  }
});
