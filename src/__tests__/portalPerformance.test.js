import { expect, it } from 'vitest';
import { createPortalPerformanceGuard, inspectionBudget } from '../3d/inspectionBridge.js';

it('permits continuous live frames, but latches off after sustained slow captures', () => {
  const guard = createPortalPerformanceGuard();
  for (let i = 0; i < 120; i++) expect(guard.allowFrame(1 / 60, true, false)).toBe(true);
  expect(guard.allowFrame(2, true, false)).toBe(true); // one shader hitch / tab restoration
  for (let i = 0; i < 30; i++) expect(guard.allowFrame(1 / 60, true, false)).toBe(true);
  for (let i = 0; i < 12; i++) guard.allowFrame(1 / 20, true, false);
  expect(guard.allowFrame(1 / 60, false, false)).toBe(false);
  guard.reset();
  expect(guard.allowFrame(1 / 60, false, false)).toBe(true);
  for (let i = 0; i < 12; i++) guard.allowFrame(0.4, true, false);
  expect(guard.allowFrame(1 / 60, true, false)).toBe(false); // very slow devices also stop
});

it('does not count uncaptured frames, and honors reduced quality immediately', () => {
  const guard = createPortalPerformanceGuard();
  for (let i = 0; i < 60; i++) expect(guard.allowFrame(1 / 10, false, false)).toBe(true);
  expect(guard.allowFrame(1 / 60, false, true)).toBe(false);
  expect(guard.allowFrame(1 / 60, false, false)).toBe(false);
  expect(inspectionBudget().portals).toBe(1);
  expect(inspectionBudget({ mobile: true }).portalSize).toBe(128);
});

it('catches bursty stalls even when fast frames occur between them', () => {
  const guard = createPortalPerformanceGuard();
  for (let i = 0; i < 12; i++) guard.allowFrame(i % 3 === 0 ? 0.09 : 1 / 60, true, false);
  expect(guard.allowFrame(1 / 60, true, false)).toBe(false);
});
