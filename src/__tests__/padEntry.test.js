import { describe, it, expect } from 'vitest';
import { padEntryDecision } from '../worm/healerWorm/padEntry.js';
const pad = { rule: 'pad', flipped: true, resolved: true };
describe('pad entry truth table', () => {
  it.each([
    [{ event: 'crawl' }, 'pass'],
    [{ event: 'jump' }, 'ride'],
    [{ event: 'land' }, 'ride'],
    [{ event: 'crawl', rule: 'crawl' }, 'ride'],
    [{ event: 'crawl', airborne: true }, 'pass'],
    [{ event: 'land', rocket: true }, 'pass'],
    [{ event: 'land', grace: true }, 'pass'],
    [{ event: 'land', allowDive: false }, 'pass'],
    [{ event: 'land', turning: true }, 'pass'],
    [{ event: 'jump', locked: true }, 'pass'],
    [{ event: 'land', resolved: false }, 'pass'],
    [{ event: 'crawl', voided: true }, 'pit'],
    [{ event: 'land', voided: true }, 'pit'],
    [{ event: 'crawl', voided: true, airborne: true }, 'pass']
  ])('%j → %s', (input, expected) => {
    expect(padEntryDecision({ ...pad, ...input })).toBe(expected);
  });
});
