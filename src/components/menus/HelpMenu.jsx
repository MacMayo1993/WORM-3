// HelpMenu — "How to Play".
//
// This screen was the last holdout of the cold navy glass family that
// uiTheme.js records as removed: a #080a16 backdrop, #e8edf8 ink, and blue-grey
// muted text, all hardcoded. Over the warm field-guide game it read as a
// different app. It now takes the NIGHT surface (it layers over the live scene,
// so PAPER would be wrong) via the shared primitives, which also gives it the
// Escape handling, focus trap, and dialog semantics it never had.

import React from 'react';
import { UI_FONT, NIGHT_TEXT, NIGHT_TEXT_MUTED, NIGHT_PANEL, NIGHT_BORDER, UI_GOLD, UI_MOSS_LIGHT, TEXT_XS, TEXT_SM, RADIUS_SM, RADIUS_MD, Z } from '../../utils/uiTheme.js';
import { Overlay, Panel, PanelHeader, PanelBody, PanelSectionTitle } from '../ui/index.js';

const ROW_STYLE = {
  display: 'flex',
  gap: '10px',
  padding: '7px 10px',
  borderRadius: RADIUS_SM,
  background: NIGHT_PANEL,
  border: `1px solid ${NIGHT_BORDER}`
};

const Section = ({ title, children }) => (
  <section style={{ marginBottom: '24px' }}>
    <PanelSectionTitle surface="night">{title}</PanelSectionTitle>
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>{children}</div>
  </section>
);

const Row = ({ label, desc }) => (
  <div style={{ ...ROW_STYLE, alignItems: 'baseline', fontSize: TEXT_SM, lineHeight: 1.5 }}>
    <span style={{ fontWeight: 600, color: NIGHT_TEXT, whiteSpace: 'nowrap', flexShrink: 0 }}>{label}</span>
    <span style={{ color: NIGHT_TEXT_MUTED }}>{desc}</span>
  </div>
);

const KeyRow = ({ keys, desc }) => (
  <div style={{ ...ROW_STYLE, alignItems: 'center' }}>
    <span style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
      {keys.split('/').map((k, i) => (
        <kbd
          key={i}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '2px 7px',
            background: 'rgba(255,253,242,0.10)',
            border: `1px solid ${NIGHT_BORDER}`,
            borderRadius: '5px',
            fontSize: TEXT_XS,
            fontWeight: 600,
            fontFamily: UI_FONT,
            color: NIGHT_TEXT,
            minWidth: '22px'
          }}
        >
          {k.trim()}
        </kbd>
      ))}
    </span>
    <span style={{ fontSize: TEXT_SM, color: NIGHT_TEXT_MUTED, lineHeight: 1.4 }}>{desc}</span>
  </div>
);

const HelpMenu = ({ onClose }) => (
  <Overlay surface="night" zIndex={Z.MENU_DIALOG} onClose={onClose} labelledBy="help-title">
    <Panel surface="night" width={560}>
      <PanelHeader surface="night" title="How to play" titleId="help-title" onClose={onClose} />

      <PanelBody>
        <Section title="The one rule that isn't Rubik's">
          <Row label="Every tile has a twin" desc="The tile directly opposite it, straight through the middle of the cube" />
          <Row label="Flip" desc="With Flip on, tap a tile to swap it with its twin. Both change at once" />
          <Row label="Why it matters" desc="Some tangles are much quicker to fix through the cube than around it" />
        </Section>

        <Section title="Moving the cube">
          <Row label="Drag a tile" desc="Turns that row or column, like a real Rubik's Cube" />
          <Row label="Shift + drag" desc="Twists the whole face you're dragging on" />
          <Row label="Drag empty space" desc="Spins the cube so you can see every side" />
          <Row label="Bottom bar" desc="Undo, Flip, Views and More. Shuffle and Reset live under More" />
        </Section>

        <Section title="Game modes">
          <Row label="Teach" desc="Learn notation, practice the beginner method, then solve a 3×3 independently" />
          <Row label="Cube" desc="Free play: any size from 2×2 to 10×10, your colors, no timer" />
          <Row label="Worm" desc="Steer a worm across the cube, collect orbs, and heal flipped tiles" />
          <Row label="Chaos" desc="Tiles flip on their own. Predict which color pair lasts longest" />
          <Row label="Random" desc="The colors and tile styles change every 10 seconds while you solve" />
          <Row label="More modes" desc="Biome and Möbius Cubelet, from the main menu" />
        </Section>

        <Section title="Views">
          <Row label="Classic" desc="The standard colored cube" />
          <Row label="Grid" desc="Every tile labeled with its position (M1-001 and so on)" />
          <Row label="Sudoku" desc="Numbers instead of colors" />
          <Row label="More looks" desc="Wireframe, Glass, Chrome, Neon, Gap and Lego" />
          <Row label="Explode" desc="Pulls the pieces apart so you can see inside" />
          <Row label="Net" desc="A flat map of all six faces" />
          <Row label="Tunnels" desc="Draws a tunnel from each tile to its twin. Tap again for more detail" />
        </Section>

        <Section title="Top bar">
          <Row label="%" desc="How much of the cube is solved" />
          <Row label="Chaos / Flip tags" desc="Which rules are switched on right now" />
          <Row label="Menu (☰)" desc="Your Parity Points, flip counts, Settings and Main menu" />
          <Row label="Pressure bar" desc="In Chaos, how much of the cube is flipping" />
        </Section>

        <Section title="Keyboard (optional)">
          <KeyRow keys="Arrow keys" desc="Move the cursor between tiles" />
          <KeyRow keys="W / S" desc="Turn the selected column up / down" />
          <KeyRow keys="A / D" desc="Turn the selected row left / right" />
          <KeyRow keys="Q / E" desc="Turn the face counter-clockwise / clockwise" />
          <KeyRow keys="F" desc="Flip the selected tile with its twin (Flip must be on)" />
        </Section>

        <Section title="Shortcuts">
          <KeyRow keys="H / ?" desc="Open or close this help" />
          <KeyRow keys="U" desc="Undo the last move" />
          <KeyRow keys="Space" desc="Shuffle the cube" />
          <KeyRow keys="R" desc="Reset the cube" />
          <KeyRow keys="G" desc="Turn Flip on or off" />
          <KeyRow keys="T" desc="Show or hide tunnels" />
          <KeyRow keys="X" desc="Explode view" />
          <KeyRow keys="N" desc="Show or hide the net" />
          <KeyRow keys="V" desc="Next view style" />
          <KeyRow keys="C" desc="Turn Chaos on or off" />
          <KeyRow keys="Esc" desc="Close the top menu, or hide the cursor" />
        </Section>

        {/* Footnote — the one place this screen earns an accent, so it reads as
            an aside rather than another row. Gold on moss, not the old blue. */}
        <div
          style={{
            marginTop: '8px',
            padding: '14px 16px',
            background: 'rgba(159,219,122,0.08)',
            borderRadius: RADIUS_MD,
            fontSize: TEXT_SM,
            color: NIGHT_TEXT_MUTED,
            lineHeight: 1.6,
            border: `1px solid ${UI_MOSS_LIGHT}33`
          }}
        >
          <strong style={{ color: UI_GOLD }}>The math, if you want it:</strong> treating opposite points as the same point turns the cube's
          surface into a shape called the real projective plane. Twins are two views of one spot, and each tunnel is the path between them.
        </div>
      </PanelBody>
    </Panel>
  </Overlay>
);

export default HelpMenu;
