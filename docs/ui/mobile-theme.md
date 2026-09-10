# Mobile field-guide theme

The home screen retains its rotating photo panorama behind the live cube, with cream paper, ink headings and moss actions on the controls. The paper theme does not replace the environment. Settings and setup retain dark specimen surfaces, now drawn from the same warm NIGHT tokens as pause and results. Cosmetics and cube-face colours continue to identify game content.

`src/utils/uiTheme.js` owns semantic colours, fonts and action shadows. `UI_CSS_VARS` is installed by `main.jsx` so CSS screens receive the same values. Use `ActionButton` and `IconButton` for new controls; the shared target is 48 CSS pixels. Status accents should not replace the moss primary action.

## Navigation

- Let's Play opens the existing Worm setup wizard.
- Change and Modes open the existing animated mode carousel.
- Collection / Store opens the existing catalogue, with its real inventory and prices.
- Demo, feedback and Settings remain reachable from home.

The store keeps its existing categories (skins, hats, trails, palettes and tiles). The concept's illustrative character categories and prices are not new catalogue data.

## Touch behaviour

Home uses safe-area insets and dynamic viewport height. Short landscape layouts scroll the action column. The idle cube is framed separately from the carousel and dive animation to leave room for home controls. Gameplay steering remains on its original event path.

Store tabs/close and pause/results buttons use click activation. Pause has a focus trap, Escape-to-resume, a scrolling card and sticky Resume action. Coarse pointers and reduced-motion preferences disable shared backdrop blur.

## Verification

Automated lint, unit tests, production build and bundle budget checks pass. The available preview browser rejected the local URL with `ERR_BLOCKED_BY_CLIENT`; rendered device validation is outstanding.

Before leaving draft, inspect home, carousel, Worm setup, store, Settings, pause and results at 360×640, 390×844 and 844×390. Confirm that the cube clears text, all controls remain reachable, tabs scroll without activating on touch-down, and Resume restores play. Also check desktop keyboard navigation and reduced-motion mode.
