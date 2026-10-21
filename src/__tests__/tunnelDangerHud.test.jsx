import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, afterEach, expect, it } from 'vitest';
import TunnelNeedsCard from '../worm/TunnelNeedsCard.jsx';
import { useGameStore } from '../hooks/useGameStore.js';
import { wormBuffs } from '../worm/wormBuffs.js';
let host, root;
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  useGameStore.setState({ wormAlive: true, wormGamePhase: 'active', demoMode: false });
  host = document.createElement('div'); root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount()); wormBuffs.tunnelNeeds = null;
  useGameStore.setState({ demoMode: false });
  delete globalThis.IS_REACT_ACT_ENVIRONMENT;
});
it.each([true, false])('prioritizes fatal entry over funded healing in compact=%s', compact => {
  // Worn out: it caves in behind the worm once the tail is clear (tunnelPits.js).
  wormBuffs.tunnelNeeds = { uses: 3, ready: true, color: '#fff', pickupsNeeded: 0 };
  act(() => root.render(<TunnelNeedsCard compact={compact} />));
  expect(host.textContent).toContain('Caving in · stay off it');
  expect(host.textContent).toContain(compact ? "Don't land on it" : "Worn out · it caves in once you're clear");
  expect(host.textContent).not.toMatch(/Heal ready|Ready to heal|Last traversal/);
  expect(host.querySelector('[data-tunnel-danger="true"]').dataset.healReady).toBe('false');
});
it('warns of collapse during transit and calls the third trip the last, safe ride', () => {
  wormBuffs.tunnelNeeds = { uses: 4, ready: true, inTransit: true, collapsing: true, color: '#fff' };
  act(() => root.render(<TunnelNeedsCard compact />));
  expect(host.textContent).toContain('Tunnel collapsing');
  act(() => root.unmount()); root = createRoot(host);
  wormBuffs.tunnelNeeds = { uses: 3, inTransit: true, color: '#fff', pickupsNeeded: 2 };
  act(() => root.render(<TunnelNeedsCard />));
  expect(host.textContent).toContain('Last ride');
  expect(host.textContent).toContain('Last ride · it caves in behind you');
  expect(host.querySelector('[data-tunnel-danger="true"]')).toBeNull();
});

it('warns before the last ride that it collapses behind you, unless that ride heals it', () => {
  wormBuffs.tunnelNeeds = { uses: 2, ready: false, pickupsNeeded: 2, color: '#fff' };
  act(() => root.render(<TunnelNeedsCard />));
  expect(host.textContent).toContain('Last ride · then it collapses');
  expect(host.textContent).toContain('Ride it once more and it caves in behind you');
  expect(host.querySelector('[data-tunnel-danger="true"]')).toBeNull();
  act(() => root.unmount()); root = createRoot(host);
  wormBuffs.tunnelNeeds = { uses: 2, ready: true, pickupsNeeded: 0, color: '#fff' };
  act(() => root.render(<TunnelNeedsCard />));
  expect(host.textContent).toContain('Last ride · then it collapses');
  expect(host.textContent).not.toContain('caves in behind you');
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

it('uses the live pad danger wording in demo lessons', () => {
  useGameStore.setState({ demoMode: true });
  wormBuffs.tunnelNeeds = { uses: 3, ready: true, color: '#fff', pickupsNeeded: 0 };
  act(() => root.render(<TunnelNeedsCard />));
  expect(host.textContent).toContain('Caving in · stay off it');
  expect(host.textContent).toContain("Worn out · it caves in once you're clear");
});

it.each([[false, 'Jump on to spend your carried orbs'], [true, 'Jump on to spend your carried orbs']])('describes the route in force (demo=%s)', (demo, caption) => {
  useGameStore.setState({ demoMode: demo });
  wormBuffs.tunnelNeeds = { uses: 1, ready: true, color: '#fff', pickupsNeeded: 0 };
  act(() => root.render(<TunnelNeedsCard />));
  expect(host.textContent).toContain(caption);
});

it('tells a jump-to-ride player a collapsed tunnel is a pit to go around', () => {
  wormBuffs.tunnelNeeds = { uses: 3, voided: true, color: '#fff' };
  act(() => root.render(<TunnelNeedsCard compact />));
  expect(host.textContent).toContain("Pit · don't go in");
  expect(host.textContent).toContain('Go around it');
  act(() => root.unmount()); root = createRoot(host);
  act(() => root.render(<TunnelNeedsCard />));
  expect(host.textContent).toContain('A collapsed tunnel · go around it or jump clear');
});

