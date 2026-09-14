# Mobile demo UI review — 14 September 2026

Reviewed main commit `898b9bb89554d54fac3248ff2cad6fbc1de72b46`. Review only; no gameplay or UI changes.

## Scope and evidence

Reviewed demo entry, Mobi dialogue, four core lessons, worm HUD, pause/death/retry, completion, seven optional lessons, forecast/settings/store transitions, accessibility and rendering cost. Read the current components, CSS and transition handlers. On the public build, observed the main menu, demo introduction, first lesson, hands-on controls and twin lesson through DOM interactions. The browser reports WebGL disabled; the cube and worm cannot render there. The available browser has no advertised mobile viewport emulation, so this is a mobile-focused source/flow review with limited live UI verification, not a completed phone playthrough. Exact mobile overlaps, text scaling and GPU performance require device validation.

Ran five existing demo regression files: 47 tests passed. These cover configuration, progression, retry, settings restoration and related guidance. They do not establish pixel layout or touch usability.

## Findings, ordered by impact

### 1. High: demo chrome remains above the worm pause menu

`src/App.jsx:634` defines demoChromeQuiet using Store, Settings and Help, but not worm pause. `src/worm/WormCrawlerHUD.jsx:229` puts the HUD at Z.PANEL (600); its pause overlay is a child at local z-index 10. Demo hint/progress/Next controls use 10900–11500. The pause card cannot cover them. The Next-step timer also uses wall-clock time and is not stopped by pausing.

Result: a paused lesson retains higher-layer tutorial guidance and can expose a working Next step action over the pause interface. This is a code-confirmed ownership conflict; exact obscured controls vary by screen height.

Fix: expose pause-menu visibility to the demo shell, suppress tutorial chrome while any blocking panel owns the screen, and suspend lesson timers. Do not use wormPaused alone: the game also sets it during countdown and tunnel/finish sequences.

Check: pause before and after the 10-second Next timer; only pause actions should remain visible/clickable. Resume must return to the same lesson.

### 2. High: guidance arrows target the old five-button dock

`src/components/screens/DemoFlowController.jsx:835` assigns Reset/Shuffle/Flip/Views/More slots 1–5. DemoControlTour calculates offsets around slot 3. The Flip spotlight arrow is centered and Views assumes the fourth of five slots.

`src/components/menus/BottomNavBar.jsx:26` now renders four buttons. Reset and Shuffle temporarily replace Undo in the first slot; Flip is second, Views third, More fourth. `instrumentHud.css` also makes Flip wider and caps the dock at 380px, so equal-slot arithmetic is insufficient. The live DOM confirms four controls.

Fix: anchor the arrow to the highlighted button's measured rectangle, remeasure on resize, and teach where Reset/Shuffle actually live after the tour. Correct the first lesson's unqualified Reset reference too.

Check: all five tour beats and the core Flip prompt at 320, 360, 390 and 430px widths; arrow center must coincide with the target button center.

### 3. Medium: worm guidance layout is a set of fixed offsets

Demo progress sits 100px above the bottom, Next at 144px and the worm hint at 252px (`DemoFlowController.jsx`, demo shell styles). The HUD sizes its own controls with separate vh/vw and short-height rules. The demo styles have no equivalent short-height arrangement. The duplicate generic worm hint is already suppressed by DemoStepHint, which is good; the remaining three independently positioned pieces still span roughly the bottom 300px when the instruction wraps.

Risk: a short phone or landscape viewport loses substantial cube space; font enlargement can close the gaps or overlap the top HUD. This is a responsive-layout risk derived from CSS, not a measured phone screenshot.

Fix: one content-sized instruction dock above a measured control tray, with compact progress and a secondary skip action; move the instruction to a side panel in landscape. Hide nonessential reserve/stats during the first worm lesson.

Check: 360×640, 390×844, 430×932 and 844×390, browser toolbar expanded/collapsed, safe-area insets and enlarged text. The worm, its next tile and the target tunnel must remain visible.

### 4. Medium: worm pause target is only 34×34px

`src/worm/WormCrawlerHUD.jsx:614` sets PAUSE_BTN_STYLE width and height to 34 with zero padding and no enlarged hit area. Most newer demo actions already have 48px minimum heights.

Fix: give Pause a 48×48px hit area while keeping its icon compact. Check all secondary actions against the same product target.

### 5. Medium: the first worm lesson includes unexplained hazards

`DemoFlowController.jsx:719` starts a 6×6 worm game with 25 orbs and speed 1.5. The normal bomb loop in `src/worm/HealerWormMode.jsx:340` still runs; its spawn interval is 20 seconds. The tutorial teaches steering, collecting and tunnels, without teaching bombs or their blast area.

On death, `DemoWormControlHint` only distinguishes self-collision from every other cause: bomb deaths receive advice to take a wider turn and aim at a tunnel. This fails to explain what actually happened. Retry now reinitializes the run, and the existing retry regression passes; the old background-disposal crash was not reproduced here.

Fix: delay bombs and advanced pickups until after the first successful tunnel, or introduce them explicitly. Give cause-specific death copy. Keep Try again primary and Skip step clearly secondary, with spacing and a grouped layout.

### 6. Medium: progress and advance labels mix incompatible meanings

The optional progress pill switches to EXPLORE 1/7, but the same first optional lesson is introduced as Step 5. The final optional lesson is Step 11 while its pill says 7/7. Both tours finish on a screen whose progress returns to DEMO 4/4 (`DemoProgressBar`, `DemoStepIntro`, `DemoEndScreen`).

During hands-on play, Next step advances regardless of whether the task was completed. In the worm lesson it appears after 10 seconds. The same general wording also appears after genuine success.

Fix: use lesson names with one consistent count per tour; distinguish Skip lesson from success-state Continue. After the optional tour, show Explore complete and remove the invitation to continue an already-finished optional tour.

### 7. Medium: modal accessibility is inconsistent

Mobi focuses its primary action and restores focus, and the worm pause menu has dialog behavior. However, Mobi's blocking overlay is a region without a focus trap; the forecast picker and end screen lack equivalent dialog semantics/focus management. The death panel inserts actionable buttons into a live status region without moving focus. DemoStepComplete nests a native button inside an element with role=button.

Risk: keyboard and assistive-technology navigation can reach obscured game controls or announce unclear nested actions. TalkBack/VoiceOver behavior still needs direct testing.

Fix: use the existing dialog behavior for blocking panels, restore focus deliberately, mark background controls inert where appropriate, and keep completion actions semantically separate from the decorative fullscreen layer. Announce progress as a labeled progressbar/status rather than unlabeled visual spans.

### 8. Medium: demo effects bypass the mobile blur/reduced-motion policy

`src/App.css:4103` disables token-based paper/night blur for touch devices. Demo end, forecast and completion use literal 9px backdrop blur; tutorial spotlights also use literal blur. Demo stamp zooms/flashes and hint bobbing have no matching reduced-motion overrides in the demo stylesheet. Mobi shortens its dismissal timer for reduced motion, but its inline entrance/portrait animations remain.

Fix: route demo surfaces through shared blur tokens, provide reduced-motion rules for demo/Mobi animations, and use a stable scrim on mobile. Actual GPU improvement must be measured; none is claimed here.

### 9. Lower priority: too much optional-tour ceremony

The main four-lesson boundary is good, and the end screen already makes Play WORM primary with other modes collapsed. However, it still combines a recap paragraph, recommended-mode badge, mode expansion, optional-tour button, solver/teacher explanation, Replay and Menu actions. The optional control tour also auto-advances every 15 seconds, including closing a sheet a player may still be reading.

Fix: end on a concise success message, Play WORM and Explore more. Move detailed tool explanations into their actual screens. Replace reading-time auto-advance with a visible skip/help affordance; do not treat a timeout as proof of learning.

## What is already working

- Four core lessons are separated from the optional tour.
- Mobi copy is mostly short, concrete and action-oriented.
- Many primary/secondary demo buttons have 48px minimum heights.
- Mobi text and several full-screen panels have scroll accommodation.
- Worm instructions change with steering, collection and tunnel progress.
- Retry resets a failed run instead of advancing it; completion waits for tunnel emergence.
- The demo suppresses the normal delayed worm death menu.
- Store/Settings/Help suppress most demo chrome, and exit restores borrowed settings.

## Recommended implementation sequence

1. Fix pause ownership and target-based spotlight positioning.
2. Consolidate the mobile instruction/progress/skip layout; enlarge Pause.
3. Simplify the first worm lesson and add accurate death feedback.
4. Unify counts, skip/continue wording and optional-tour completion.
5. Apply shared dialog, reduced-motion and blur behavior.

## Remaining acceptance checks

Real Android Chrome and iOS Safari: cold/warm entry; portrait and landscape; browser chrome changes; 200% text; left/right steering with hints visible; pause with a pending skip timer; self and bomb death then repeated retry; tunnel emergence; opening/closing Settings/Views/More; all spotlight targets; optional tour end; TalkBack/VoiceOver focus; reduced motion; performance on a slower device. No code changes or live deployment were made by this review.

## Implementation follow-up

The findings above describe the pre-fix build. The following changes now accompany this review:

- Worm pause-menu visibility is explicit; demo chrome hides while paused and pending lesson delays retain their remaining time.
- Spotlight arrows measure the actual button, including resize. Reset/Shuffle copy points to More after their shared first-slot tour beat.
- A single content-sized worm instruction dock uses measured control clearance, scrolls when needed and uses a landscape side layout. The demo hides the six-color reserve row; Pause is 48×48px.
- The first-tunnel lesson excludes bombs, automatic layer hazards and advanced pickups. Ordinary runs preserve those mechanics. Retry explains bomb/self-collision/rotation causes and separates primary retry from secondary skip.
- Explore counts run 1–7, completion stays 7/7, completed optional tours no longer invite repetition, and skip labels differ from successful Continue actions.
- Demo dialogs share focus trapping/restoration and manage inert background controls, including overlapping screen transitions. Completion no longer nests button roles. Progress has accessible values.
- Demo blur uses the shared mobile tokens; reduced-motion rules disable Mobi/demo entrance, bobbing and flash effects. Completion copy is shorter; the control tour waits for interaction.

Validation: 235 tests across 12 focused files passed after updating the explicit store-key contract for the three new UI state fields. This includes real HUD pause/resume ownership, measured arrow placement, dialog focus/background cleanup, paused timers, retry and simulation pickup behavior. Production build and bundle budgets pass. Changed-source lint has no errors (existing Fast Refresh warnings remain). Real mobile WebGL/assistive-technology validation remains pending; no phone frame-rate or pixel-perfect layout claim is made.
