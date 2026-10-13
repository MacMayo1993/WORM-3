# Air, Earth and ordered Steam

Steam is **Fire → Water**. **Water → Fire** produces Quench. Both use their existing reaction rules, visuals and objective IDs; lessons, hints and the level auditor show the new order.

The former Nature/Grass element is now **Earth**, with a mountain crest. Its spring pads and living terrain remain. The internal `grass` ID is intentionally retained for saved progress, authored levels, achievements and existing fusion keys. The separate Grass cosmetic tile style is unchanged.

**Air** is a sixth elemental pickup, with a mint-and-white vortex, wind ribbons, drifting wind particles and an ascending wind sound. Its updraft multiplies jump distance by 1.35 and height by 1.4, including double jumps and Earth spring launches. Rocket flight keeps its existing arc. Each jump starts from the normal arc, so repeated jumps do not compound the multiplier. An in-progress jump finishes its arc when the element expires.

Air is in free-play offerings, the demo, portal combat drops and the later story curriculum. Level 64 introduces six-element collection; level 70 and later full-element mastery goals include Air. Air mastery requires an updraft jump followed by a safe landing. Existing five-element prefixes, including level 40, remain unchanged. In portal combat an Air shot pushes an enemy back and stuns it for one second.

All 30 ordered pairs now have distinct reaction rules, ignitions, HUD readouts and visual treatments. Air keeps its basic jump boost in every combination.

| Order | Reaction | Additional gameplay |
| --- | --- | --- |
| Water → Air | Sea Breeze | Builds and retains water momentum in flight, keeps it through airborne turns, and raises the airborne speed bonus to 40%. Grounded turns still shed momentum. |
| Air → Water | Rainwind | Land to refill momentum, stun enemies and douse bombs in the surrounding 3×3. |
| Fire → Air | Updraft | A grounded jump from a hot trail tile adds 1 tile of travel and 1.2 lift after the normal Air multiplier. Double jumps do not repeat the hot-tile bonus. |
| Air → Fire | Bellows | Every tile passed during a jump gains a six-second fire trail. These firebreaks also speed bomb fuses. |
| Earth → Air | Dust Devil | Spring-pad takeoffs stun enemies within two surface steps of the launch. Ordinary hops do not trigger the gust. |
| Air → Earth | Highlands | Landings grow charged pads lasting 12 seconds. Their launches use the charged spring arc plus Air’s lift. |
| Ice → Air | Snowdrift | Airborne movement lays seven-second frost tiles, freezing enemies and pausing bombs that touch them. |
| Air → Ice | Polar Wind | Removes grounded ice steering delay. Ground takeoffs freeze a cross reaching two tiles each way for three seconds. |
| Lightning → Air | Thunderhead | Marked strikes stun enemies and grant a 35% speed burst for 1.5 seconds. They never damage the worm or flip tiles while this fusion is active. |
| Air → Lightning | Stormwind | Landing discharges a cross reaching two tiles each way, defeating enemies there. Its ordinary storm marks remain dangerous. |

Reactions use the active ordered pair at the instant of a launch, committed step, landing or strike. Switching pairs or expiring stops new reactions; existing fire/frost/pads finish their own lifetimes. Storm marks follow the existing storm rule: they keep their telegraph after the wash expires, so Thunderhead’s protection ends with the fusion.

Movement reactions run on the simulation clock and avoid writes during a moving slice. Rocket flight does not paint airborne trails or receive takeoff boosts. Ignitions and landing bursts use the existing bounded burst queue, consumed once by the hazard scheduler, so Rainwind bomb rewards cannot repeat. Ten visual palettes reuse the existing reaction shaders and warm-up path; no additional shader family or uncapped particle stream is introduced.
