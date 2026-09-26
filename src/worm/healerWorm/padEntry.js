// Pure entry policy. Event is 'crawl', 'land', or an intentional 'jump'.
// The legacy sim currently consumes crawl rules; pad rollout must route EVERY
// trigger (including rotation commits and rescue landings) through this policy.
export function padEntryDecision({ rule = 'crawl', event = 'crawl', flipped = false, resolved = false,
  voided = false, locked = false, turning = false, rocket = false, grace = false,
  airborne = false, allowDive = true }) {
  if (!flipped || !resolved || locked || turning || rocket || grace) return 'pass';
  if (airborne && event !== 'land') return 'pass';
  // Rescue protection stops a ride, not the contact lethality of a collapsed pit.
  if (voided) return 'pit';
  if (!allowDive) return 'pass';
  return rule === 'pad' && event === 'crawl' ? 'pass' : 'ride';
}
