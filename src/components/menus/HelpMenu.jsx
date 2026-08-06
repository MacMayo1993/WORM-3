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
      <PanelHeader surface="night" title="How to Play" titleId="help-title" onClose={onClose} />

      <PanelBody>
        <Section title="The One Rule That Isn't Rubik's">
          <Row label="Every tile has a twin" desc="Directly opposite it, through the middle of the cube" />
          <Row label="Flipping" desc="Tap a tile to swap it with its twin — both change at once" />
          <Row label="Why it matters" desc="Some tangles are far quicker to fix through the cube than around it" />
        </Section>

        <Section title="Moving the Cube">
          <Row label="Drag" desc="Rotates a slice — just like a real Rubik's Cube" />
          <Row label="Shift + Drag" desc="Twists the entire face" />
          <Row label="Click a sticker" desc="Sends it through the middle to its twin — the tile dead opposite it" />
          <Row label="Bottom bar" desc="Reset, Shuffle, Flip, Views and More — everything without a keyboard" />
        </Section>

        <Section title="Game Modes">
          <Row label="Story" desc="Ten chapters, one new idea each. Start here if you're new" />
          <Row label="Cube" desc="Freeplay — any size 2×2 to 7×7, your palette, no timer" />
          <Row label="Worm" desc="Steer a worm across the cube to heal it. Eat orbs, earn points" />
          <Row label="Chaos" desc="Tiles flip on their own. Stake points on how long you last" />
          <Row label="Random" desc="The cube redecorates itself mid-solve" />
          <Row label="More Modes" desc="Merge, Biome, Crawler, Holonomy — the odd corners" />
        </Section>

        <Section title="Special Features">
          <Row label="Tunnels" desc="Colored tunnels drawn between a tile and its twin on the far side" />
          <Row label="Flip Mode" desc="Toggle color flipping on or off" />
          <Row label="Chaos Mode" desc="Watch instability cascade across the cube!" />
        </Section>

        <Section title="Views">
          <Row label="Classic" desc="Standard colorful cube" />
          <Row label="Grid" desc="Position labels (M1-001, etc.)" />
          <Row label="Sudoku" desc="Numbers instead of colors" />
          <Row label="Wireframe" desc="See-through edges with lights" />
          <Row label="Explode" desc="Spreads cube apart to see all sides" />
        </Section>

        <Section title="HUD Numbers">
          <Row label="M" desc="Moves made" />
          <Row label="F" desc="Color flips" />
          <Row label="W" desc="Active flipped pairs" />
          <Row label="Pressure bar" desc="Shows chaos intensity" />
        </Section>

        <Section title="Keyboard Controls (optional)">
          <KeyRow keys="Arrow keys" desc="Move cursor to select a tile" />
          <KeyRow keys="W / S" desc="Rotate selected row up / down" />
          <KeyRow keys="A / D" desc="Rotate selected column left / right" />
          <KeyRow keys="Q / E" desc="Rotate face counter-clockwise / clockwise" />
          <KeyRow keys="F" desc="Send the selected tile through to its twin" />
        </Section>

        <Section title="Hands Mode (P) — Speedcuber">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
            <KeyRow keys="I / K" desc="U / U'" />
            <KeyRow keys="O" desc="U2" />
            <KeyRow keys="J / L" desc="R / R'" />
            <KeyRow keys="F / D" desc="L / L'" />
            <KeyRow keys="H / G" desc="F / F'" />
            <KeyRow keys="W / E" desc="B / B'" />
            <KeyRow keys="S / ;" desc="D / D'" />
            <KeyRow keys=", / M" desc="M' / M" />
          </div>
        </Section>

        <Section title="Quick Shortcuts">
          <KeyRow keys="H / ?" desc="Open / close this help menu" />
          <KeyRow keys="Space" desc="Shuffle the cube" />
          <KeyRow keys="R" desc="Reset everything" />
          <KeyRow keys="G" desc="Toggle flip mode" />
          <KeyRow keys="T" desc="Show / hide tunnels" />
          <KeyRow keys="X" desc="Toggle explosion view" />
          <KeyRow keys="V" desc="Cycle view mode" />
          <KeyRow keys="C" desc="Toggle Chaos Mode" />
          <KeyRow keys="P" desc="Toggle Hands Mode" />
          <KeyRow keys="Esc" desc="Close menus / exit Hands Mode" />
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
          <strong style={{ color: UI_GOLD }}>What you're learning:</strong> This puzzle demonstrates a special mathematical space —
          the real projective plane — where opposite points are the same location. When you flip a color you're creating a connection
          through this space. That's what the tunnels represent.
        </div>
      </PanelBody>
    </Panel>
  </Overlay>
);

export default HelpMenu;
