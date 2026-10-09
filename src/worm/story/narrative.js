// Authored story stays outside generated.js so rebuilding a level pack cannot
// overwrite it. IDs refer to WORM levels, not the separate Flip Cube campaign.
// Mobi speaks before play and after success; objectives remain mechanical.
export const WORM_STORY_NARRATIVE = {
  1: {
    briefing: 'Great Worm War 3 left this Flip Cube damaged and far from WORM³, my home. Help me gather its scattered energy. We have to start somewhere. Preferably with breakfast.',
    debrief: 'A little longer, a little stronger. Those colors belong together. So do the places we are going to mend.'
  },
  2: {
    briefing: 'These tunnels connected twin tiles long before the war. Then armies used them to cross the world in a blink. Let’s find which passages still hold.',
    debrief: 'Four passages crossed. Same old shortcuts. I wish they still led to quieter places.'
  },
  3: {
    briefing: 'Growing gives you more body to work with, and more tail to trip over. We need a long worm for the repairs ahead. Mind your own feet. Figuratively.',
    debrief: 'You can cross your own trail safely now. That will matter when the routes get crowded.'
  },
  4: {
    briefing: 'During the war, turning a layer could cut off an escape route. The damaged machinery still turns. Watch its warning, then find safe ground.',
    debrief: 'The turns keep repeating. Whatever started them left the machinery running.'
  },
  5: {
    briefing: 'Every tunnel joins two ends of the same wound. Carry the matching colors through and let your whole tail clear. We can put both tiles home.',
    debrief: 'Both ends healed together. In my world, helping the far side helps this side too.'
  },
  6: {
    briefing: 'This stretch used to be a way home. Now every passage needs repair. Gather energy, keep clear of the turns, and leave no damaged tunnel open.',
    debrief: 'One stretch restored. My way home has a chance again. Thank you.'
  },
  7: {
    briefing: 'The old couriers had to cross broken ground fast. Their tools still work: a burst of speed, a higher jump, a little flight. The landing is your department.',
    debrief: 'You would have made a fine courier. You even remembered to land.'
  },
  8: {
    briefing: 'These powers belong to the world itself. The war found uses for them. We can find better ones while we repair the route.',
    debrief: 'Life can still return to these tiles. There is more here than the war left behind.'
  },
  9: {
    briefing: 'An old defensive position. The bomb is still armed, and a guard still holds the route. Grow long, surround the danger, and give us a safe way through.',
    debrief: 'The position is clear. Someone left a guard here long after the fighting was supposed to end.'
  },
  10: {
    briefing: 'One last crossing before we reach the old routes. Gather what you need, repair the passages, and get past the guard. I remember the way from here. Mostly.',
    debrief: 'We have a foothold. But the turns, guards, and blocked passages fit together too neatly. This damage was planned.'
  },
  11: {
    briefing: 'The old routes linked Flip Cubes of every size. This little one was a gathering place. Let’s recover its scattered energy and trace the way home.',
    debrief: 'A small place can still hold all six colors. I had forgotten how much I missed that.'
  },
  12: {
    briefing: 'Each tile has an address here. Couriers used them to find the right passage when the layers moved. Follow the routes that survived.',
    debrief: 'These crossings line up with the route we just repaired. We are following a network.'
  },
  13: {
    briefing: 'The numbers helped travelers keep their bearings. Your tail needs the same attention. Cross it carefully while we work our way through.',
    debrief: 'The numbers changed places. The connections did not. Keep that in mind.'
  },
  14: {
    briefing: 'Glass makes the moving pieces easier to see. This place once carried travelers between routes. Its machinery is still going through the motions.',
    debrief: 'Another repeating sequence. These stations were built to work together.'
  },
  15: {
    briefing: 'Chrome Works kept the routes running. War turned repair stations into strongpoints. Bring the colors back together and mend the passages we can reach.',
    debrief: 'Repair tools and defenses in the same place. This was a home before it became a front.'
  },
  16: {
    briefing: 'Seven layers of old sea routes. Whole stretches were twisted away from their destinations. Heal the crossings while the machinery turns beneath us.',
    debrief: 'The same damage on another route. Whoever did this knew exactly how the network connected.'
  },
  17: {
    briefing: 'Launch pads helped couriers cross gaps when the surface routes failed. I know this approach. Build speed, take the air, and leave yourself room to land.',
    debrief: 'That landing brings back memories. We used to arrive here with messages from every face.'
  },
  18: {
    briefing: 'The explode power pulls the pieces apart for a time. Learn to travel while they are separated. Even a fractured cube still has connections worth repairing.',
    debrief: 'The pieces separate, but the twins remain connected. Breaking the surface could never settle this war.'
  },
  19: {
    briefing: 'The lights marked a relay through the larger cubes. Cross the remaining passages. I want to know where this route was meant to lead.',
    debrief: 'I recognize the route now. It leads inward. We carried messages along it before the ceasefire.'
  },
  20: {
    briefing: 'These routes were cut in a pattern. Restore this crossing and we can follow that pattern deeper. My way home runs through whatever they tried to shut away.',
    debrief: 'They told us the war was over. Then why seal the routes from inside? We need to look beneath the surface.'
  }
};

export const storyNarrative = id => WORM_STORY_NARRATIVE[id] ?? null;
