import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, afterEach, expect, it } from 'vitest';
import TunnelNeedsCard from '../worm/TunnelNeedsCard.jsx';
import { useGameStore } from '../hooks/useGameStore.js';
import { wormBuffs } from '../worm/wormBuffs.js';
let host, root;
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  useGameStore.setState({ wormAlive: true, wormGamePhase: 'active' });
  host = document.createElement('div'); root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount()); wormBuffs.tunnelNeeds = null;
  delete globalThis.IS_REACT_ACT_ENVIRONMENT;
});
it.each([true, false])('prioritizes fatal entry over funded healing in compact=%s', compact => {
  wormBuffs.tunnelNeeds = { uses: 3, ready: true, color: '#fff', pickupsNeeded: 0 };
  act(() => root.render(<TunnelNeedsCard compact={compact} />));
  expect(host.textContent).toContain('Fatal tunnel · turn away');
  expect(host.textContent).not.toMatch(/Heal ready|Ready to heal|Last traversal/);
  expect(host.querySelector('[data-tunnel-danger="true"]').dataset.healReady).toBe('false');
});
it('warns of collapse during transit and identifies the third trip as safe', () => {
  wormBuffs.tunnelNeeds = { uses: 4, ready: true, inTransit: true, collapsing: true, color: '#fff' };
  act(() => root.render(<TunnelNeedsCard compact />));
  expect(host.textContent).toContain('Tunnel collapsing');
  act(() => root.unmount()); root = createRoot(host);
  wormBuffs.tunnelNeeds = { uses: 3, inTransit: true, color: '#fff' };
  act(() => root.render(<TunnelNeedsCard compact />));
  expect(host.textContent).toContain('Final safe trip');
  expect(host.querySelector('[data-tunnel-danger="true"]')).toBeNull();
});
it('shows safe entry separately from unaffordable healing', () => {
  wormBuffs.tunnelNeeds = { uses: 1, ready: false, pickupsNeeded: 2, color: '#fff' };
  act(() => root.render(<TunnelNeedsCard compact />));
  expect(host.textContent).toContain('2 safe passes left');
  expect(host.textContent).toContain('Need 2 orbs to heal');
  expect(host.querySelector('[data-tunnel-danger="true"]')).toBeNull();
});

it('explains automatic tail clearance in traversal lessons', () => {
  wormBuffs.tunnelNeeds = { uses: 1, ready: true, traversalTrial: true, inTransit: true, color: '#fff' };
  act(() => root.render(<TunnelNeedsCard compact />));
  expect(host.textContent).toContain('Clears after your tail');
  expect(host.textContent).not.toContain('orbs to heal');
});
