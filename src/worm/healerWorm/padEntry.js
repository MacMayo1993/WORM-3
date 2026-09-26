// Pure entry policy. Event is 'crawl', 'land', or an intentional 'jump'.
// Runtime WORM uses pad rules; demo retains crawl rules. A captured platform
// landing carries its intentional-entry provenance through the entire jump.
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

// Which entry rule a WORM run uses. Demo lessons keep the legacy crawl route;
// every other run rides by jumping onto raised pads. The sim and any copy that
// describes the route read this one definition, so they cannot disagree.
export const tunnelEntryRule = state => (state?.demoMode ? 'crawl' : 'pad');
