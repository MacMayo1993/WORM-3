import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useGameStore } from '../../hooks/useGameStore.js';
import { useShallow } from 'zustand/react/shallow';
import { getSkins, getHats, getSchemes, getTiles } from '../../utils/storeCatalog.js';
import { TILE_STYLE_SECTIONS } from '../../utils/tileStyleCatalog.js';
import { COLOR_SCHEMES } from '../../utils/colorSchemes.js';
import {
  registerTilePreview,
  updateTilePreview,
  unregisterTilePreview,
} from '../../3d/TilePreviewRenderer.js';
import {
  UI_FONT, DISPLAY_FONT, HAND_FONT,
  PAPER_SHEET_RAISED,
  PAPER_BORDER_SOFT, PAPER_TEXT, PAPER_TEXT_MUTED, PAPER_TEXT_FAINT,
  PAPER_BG_MUTED, PAPER_CARD_SHADOW, UI_CREAM,
  NIGHT_TEXT_MUTED,
} from '../../utils/uiTheme.js';
import { isMobile } from '../../utils/device.js';
import { wizardPaperBackground, WIZARD_FOOTER_BG, PENCIL_LEAD } from './WizardChrome.jsx';
import WormPreviewCanvas from '../../3d/WormPreviewCanvas.jsx';
import CubePreviewCanvas from '../../3d/CubePreviewCanvas.jsx';
import { SpecimenPlate, resolveWizardColors, bgOptionFor } from './wizardSteps/index.jsx';
import './ParityStoreScreen.css';

const ACCENT = '#0891B2';
const ACCENT_SHADOW = '#0e6985';
const FONT = UI_FONT;
const TOUCH = { touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' };

const SKINS   = getSkins();
const HATS    = getHats();
const SCHEMES = getSchemes();
const TILES   = getTiles();

const TABS = [
  { id: 'skins',   label: 'Skins',    accent: '#2D7A3A', items: SKINS },
  { id: 'hats',    label: 'Hats',     accent: '#6A2C91', items: HATS },
  { id: 'schemes', label: 'Palettes', accent: '#1565C0', items: SCHEMES },
  { id: 'tiles',   label: 'Tiles',    accent: '#C44B00', items: TILES },
];

const ALL_ITEMS = [...SKINS, ...HATS, ...SCHEMES, ...TILES];

// The store is full-bleed, but the collection itself is a column: past ~1000px
// the cards stop spreading so the masthead, tabs, grid, and footnote stay in one
// readable measure instead of drifting to opposite edges of a desktop screen.
const COLUMN = { width: '100%', maxWidth: '1000px', margin: '0 auto', boxSizing: 'border-box' };

const TYPE_LABEL = {
  skin: 'Worm Skin',
  hat: 'Hat',
  scheme: 'Color Palette',
  tile: 'Tile Style',
};

// Per-type accent for item cards
const typeAccent = (item) => {
  if (item.type === 'skin')   return item.glow || '#2D7A3A';
  if (item.type === 'hat')    return '#6A2C91';
  if (item.type === 'scheme') return '#1565C0';
  return '#C44B00';
};

// ── Parity point coin ─────────────────────────────────────────────────────────
// One drawn coin everywhere a price or a balance appears, so PP reads as a
// currency rather than two letters of body copy.
// `ink` is the P and the inner ring: on a coloured button or badge the coin
// itself goes light and the ink takes the surface's colour, otherwise a white
// coin would strike white and read as a blank dot.
const PPCoin = ({ size = 13, color = ACCENT, ink = '#fff' }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" style={{ display: 'block', flexShrink: 0 }} aria-hidden="true">
    <circle cx="8" cy="8" r="7" fill={color} />
    <circle cx="8" cy="8" r="5.2" fill="none" stroke={ink} strokeOpacity="0.45" strokeWidth="0.9" />
    <path d="M6.5 11.2 V4.9 h2.2 a1.75 1.75 0 0 1 0 3.5 H6.5"
      fill="none" stroke={ink} strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const LockIcon = ({ size = 11, color = PAPER_TEXT_FAINT }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" style={{ display: 'block', flexShrink: 0 }} aria-hidden="true">
    <path d="M5 7V5a3 3 0 0 1 6 0v2" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
    <rect x="3.2" y="7" width="9.6" height="7" rx="2" fill={color} />
  </svg>
);

const CheckIcon = ({ size = 10, color = '#fff' }) => (
  <svg width={size} height={size * 0.8} viewBox="0 0 10 8" fill="none" style={{ display: 'block' }} aria-hidden="true">
    <path d="M1 4L3.5 6.5L9 1" stroke={color} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// ── Tile preview canvas ───────────────────────────────────────────────────────
function TilePreviewCanvas({ styleKey, colorHex = '#e53935', size = 44 }) {
  const canvasRef = useRef(null);
  const idRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = size;
    canvas.height = size;
    idRef.current = registerTilePreview(canvas, styleKey, colorHex);
    return () => { if (idRef.current !== null) unregisterTilePreview(idRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (idRef.current !== null) updateTilePreview(idRef.current, styleKey, colorHex);
  }, [styleKey, colorHex]);
  return <canvas ref={canvasRef} width={size} height={size} style={{ borderRadius: 6, display: 'block' }} />;
}

// ── Scheme preview tiles ──────────────────────────────────────────────────────
const SchemeDots = ({ schemeKey, gap = '3px', radius = '3px' }) => {
  const colors = Object.values(COLOR_SCHEMES[schemeKey] || COLOR_SCHEMES.standard);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap, width: '100%' }}>
      {colors.slice(0, 6).map((c, i) => (
        <div key={i} style={{
          aspectRatio: '1', borderRadius: radius,
          background: c,
          boxShadow: '0 1px 3px rgba(0,0,0,0.20)',
        }} />
      ))}
    </div>
  );
};

// ── Card artwork ──────────────────────────────────────────────────────────────
// The grid stays cheap: real worms (one frame each, they don't animate here) and
// flat shader tiles. The live, turning version of whatever you tapped is on the
// plate above — one animated preview for the whole screen.
const CardArt = ({ item, size, characterId, skinId, tileColor }) => {
  if (item.type === 'skin') return (
    <WormPreviewCanvas characterId={characterId} skinId={item.skinId} size={size} />
  );
  if (item.type === 'hat') return (
    <WormPreviewCanvas characterId={characterId} skinId={skinId} hatId={item.hatId} size={size} framing="head" />
  );
  if (item.type === 'scheme') return (
    <div style={{ width: size * 0.92 }}>
      <SchemeDots schemeKey={item.schemeKey} />
    </div>
  );
  return <TilePreviewCanvas styleKey={item.tileKey} colorHex={tileColor} size={Math.round(size * 0.92)} />;
};

// ── Recessed specimen well ────────────────────────────────────────────────────
// Card art always sits in the same inset frame, which is what makes a grid of
// very different artwork (worms, hats, colour swatches, rendered tiles) read as
// one collection.
const SpecimenWell = ({ children, height, locked }) => (
  <div style={{
    width: '100%', height,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: PAPER_SHEET_RAISED,
    borderRadius: '10px',
    border: `1px solid ${PAPER_BORDER_SOFT}`,
    boxShadow: 'inset 0 1px 3px rgba(83,72,56,0.10)',
    overflow: 'hidden',
    filter: locked ? 'saturate(0.72)' : 'none',
    opacity: locked ? 0.86 : 1,
    transition: 'filter 0.2s ease, opacity 0.2s ease',
  }}>
    {children}
  </div>
);

// ── Item card ─────────────────────────────────────────────────────────────────
const ItemCard = ({ item, owned, equipped, focused, pp, index, characterId, skinId, tileColor, onTap }) => {
  const ac = typeAccent(item);
  const canAfford = pp >= item.price;
  const locked = !owned;

  return (
    <div
      className={`store-card store-card-enter${equipped ? ' is-equipped' : ''}`}
      onClick={onTap}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '7px',
        padding: '9px 8px 8px',
        background: equipped ? `${ac}12` : 'rgba(255,255,255,0.72)',
        // Focus is the loud state now: it is what the plate above is showing.
        border: focused ? `2px solid ${ac}` : `2px solid ${PAPER_BORDER_SOFT}`,
        borderRadius: '14px', cursor: 'pointer', position: 'relative',
        boxShadow: focused
          ? `0 0 0 3px ${ac}33, 0 4px 12px ${ac}33`
          : equipped
            ? 'inset 0 2px 5px rgba(83,72,56,0.13)'
            : `0 3px 0 ${PAPER_CARD_SHADOW}, 0 5px 12px rgba(83,72,56,0.10)`,
        transform: focused ? 'translateY(-2px)' : equipped ? 'translateY(1px)' : 'none',
        transition: 'transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease',
        fontFamily: FONT,
        animationDelay: `${Math.min(index, 14) * 22}ms`,
        ...TOUCH,
      }}
    >
      {/* Corner state marker */}
      {equipped ? (
        <span style={{
          position: 'absolute', top: -7, right: -5, zIndex: 2,
          display: 'flex', alignItems: 'center', gap: '3px',
          fontSize: '7px', fontWeight: 900, letterSpacing: '0.1em',
          color: '#fff', background: ac,
          borderRadius: '999px', padding: '3px 7px', fontFamily: FONT,
          boxShadow: `0 2px 5px ${ac}66`,
        }}><CheckIcon size={7} /> ON</span>
      ) : locked ? (
        <span style={{
          position: 'absolute', top: 6, right: 6, zIndex: 2,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 18, height: 18, borderRadius: '50%',
          background: 'rgba(255,255,255,0.9)',
          boxShadow: '0 1px 3px rgba(83,72,56,0.22)',
        }}><LockIcon size={10} color={canAfford ? ac : PAPER_TEXT_FAINT} /></span>
      ) : null}

      <SpecimenWell height="52px" locked={locked}>
        <CardArt item={item} size={48} characterId={characterId} skinId={skinId} tileColor={tileColor} />
      </SpecimenWell>

      <span style={{
        fontSize: '10px',
        fontWeight: 700, letterSpacing: '0.01em',
        color: focused || equipped ? PAPER_TEXT : PAPER_TEXT_MUTED,
        fontFamily: FONT, textAlign: 'center', lineHeight: 1.2,
      }}>{item.label}</span>

      {owned ? (
        <span style={{
          marginTop: 'auto',
          fontSize: '9px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
          color: equipped ? ac : PAPER_TEXT_FAINT, fontFamily: FONT,
        }}>
          {equipped ? 'Equipped' : 'Owned'}
        </span>
      ) : (
        <div style={{
          marginTop: 'auto',
          display: 'flex', alignItems: 'center', gap: '4px',
          padding: '3px 8px', borderRadius: '999px',
          background: canAfford ? `${ac}14` : 'rgba(255,255,255,0.6)',
          border: `1px solid ${canAfford ? `${ac}44` : PAPER_BORDER_SOFT}`,
        }}>
          <PPCoin size={10} color={canAfford ? ac : PAPER_TEXT_FAINT} />
          <span style={{ fontSize: '11px', fontWeight: 800, color: canAfford ? ac : PAPER_TEXT_FAINT, fontFamily: FONT }}>{item.price}</span>
        </div>
      )}
    </div>
  );
};

// ── Tile category section ─────────────────────────────────────────────────────
const TileSection = ({ label, items, renderItems }) => items.length === 0 ? null : (
  <div style={{ marginBottom: '22px' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
      <span style={{
        fontSize: '10px', fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase',
        color: PAPER_TEXT_MUTED, fontFamily: FONT, whiteSpace: 'nowrap',
      }}>{label}</span>
      <div style={{ flex: 1, height: '1px', background: PAPER_BORDER_SOFT }} />
    </div>
    {renderItems(items)}
  </div>
);

// Store sections mirror the tile catalog exactly, so a style is purchasable the
// moment it is added to a section and it sits under the same heading here as in
// the settings panel. These used to be inferred from tileType and price, and any
// tile matching none of those buckets silently vanished from the store — a
// 'procedural' tile priced over 100 could never be bought.
const TILE_BY_KEY = new Map(TILES.map(t => [t.tileKey, t]));
const TILE_SECTIONS = TILE_STYLE_SECTIONS.map(section => ({
  label: section.label,
  items: section.keys.map(k => TILE_BY_KEY.get(k)).filter(Boolean),
}));
// Arrow order through the Tiles tab follows the sections you see, not the raw
// catalogue order.
const TILE_ORDER = TILE_SECTIONS.flatMap(s => s.items);

const TAB_ITEMS = { skins: SKINS, hats: HATS, schemes: SCHEMES, tiles: TILE_ORDER };

// ── Viewport ──────────────────────────────────────────────────────────────────
// The plate is sized from the screen rather than a fixed px so a phone spends
// most of its height on the thing being sold.
function useHeroSize() {
  const measure = () => {
    if (typeof window === 'undefined') return 200;
    const { innerWidth: w, innerHeight: h } = window;
    return isMobile
      ? Math.round(Math.max(150, Math.min(h * 0.34, w * 0.66)))
      : Math.round(Math.max(180, Math.min(h * 0.30, 280)));
  };
  const [size, setSize] = useState(measure);
  useEffect(() => {
    const onResize = () => setSize(measure());
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    };
  }, []);
  return size;
}

// ── Main screen ───────────────────────────────────────────────────────────────
const ParityStoreScreen = ({ onClose }) => {
  const [tab, setTab] = useState('skins');
  const heroPx = useHeroSize();

  const { parityPoints, ownedItems, wormSkin, wormHat, wormCharacter, buyItem, setWormSkin, setWormHat } =
    useGameStore(useShallow(s => ({
      parityPoints: s.parityPoints,
      ownedItems: s.ownedItems,
      wormSkin: s.wormSkin,
      wormHat: s.wormHat,
      wormCharacter: s.wormCharacter,
      buyItem: s.buyItem,
      setWormSkin: s.setWormSkin,
      setWormHat: s.setWormHat,
    })));

  const { settings, setSettings } = useGameStore(useShallow(s => ({
    settings: s.settings,
    setSettings: s.setSettings,
  })));

  const [toast, setToast] = useState(null);
  const [focusedId, setFocusedId] = useState(null);

  const showToast = (msg, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 1800);
  };

  const isEquipped = useCallback((item) => {
    if (item.type === 'skin')   return wormSkin === item.skinId;
    if (item.type === 'hat')    return wormHat === item.hatId;
    if (item.type === 'scheme') return settings?.colorScheme === item.schemeKey;
    if (item.type === 'tile') {
      const styles = settings?.manifoldStyles || {};
      return [1, 2, 3, 4, 5, 6].every(id => (styles[id] || 'solid') === item.tileKey);
    }
    return false;
  }, [wormSkin, wormHat, settings]);

  const items = TAB_ITEMS[tab];

  // Opening a tab lands on what you are already wearing, so the plate starts by
  // showing your cube rather than an arbitrary first item.
  const focusIndex = useMemo(() => {
    const byId = items.findIndex(i => i.id === focusedId);
    if (byId !== -1) return byId;
    const equippedIdx = items.findIndex(isEquipped);
    return equippedIdx === -1 ? 0 : equippedIdx;
  }, [items, focusedId, isEquipped]);

  const focused = items[focusIndex];
  const stepFocus = delta => setFocusedId(items[(focusIndex + delta + items.length) % items.length].id);

  const equip = (item) => {
    if (item.type === 'skin') setWormSkin(item.skinId);
    else if (item.type === 'hat') setWormHat(item.hatId);
    else if (item.type === 'scheme') setSettings({ ...settings, colorScheme: item.schemeKey });
    else if (item.type === 'tile') {
      const s = {};
      [1, 2, 3, 4, 5, 6].forEach(id => { s[id] = item.tileKey; });
      setSettings({ ...settings, manifoldStyles: s });
    }
  };

  const buy = (item) => {
    const ok = buyItem(item.id, item.price);
    if (!ok) { showToast(`Need ${item.price - parityPoints} more PP`, false); return; }
    equip(item);
    showToast(`${item.label} unlocked!`);
  };

  // Tap to bring an item to the plate; tap the one already on the plate to act
  // on it. Keeps the one-tap equip for something you are going straight back to
  // without making every stray tap change your cube.
  const tapCard = (item) => {
    if (item.id !== focused?.id) { setFocusedId(item.id); return; }
    if (ownedItems.includes(item.id)) { equip(item); showToast(`${item.label} applied`); }
    else buy(item);
  };

  // Collection progress — the whole catalog, and per-tab for the tab chips.
  const ownedCount = useMemo(
    () => ALL_ITEMS.filter(i => ownedItems.includes(i.id)).length,
    [ownedItems]
  );
  const tabOwned = useMemo(
    () => Object.fromEntries(TABS.map(t => [t.id, t.items.filter(i => ownedItems.includes(i.id)).length])),
    [ownedItems]
  );
  const collectedPct = Math.round((ownedCount / ALL_ITEMS.length) * 100);

  // What the cube on the plate wears when it is not the thing being sold.
  const currentColors = useMemo(() => resolveWizardColors(settings || {}), [settings]);
  const cardTileColor = currentColors[1] || '#e53935';

  const renderItems = (list) => (
    <div style={{
      display: 'grid',
      gridTemplateColumns: `repeat(auto-fill, minmax(${tab === 'tiles' ? '88px' : '96px'}, 1fr))`,
      gap: '9px',
    }}>
      {list.map((item, i) => (
        <ItemCard
          key={item.id} item={item} index={i}
          characterId={wormCharacter} skinId={wormSkin} tileColor={cardTileColor}
          owned={ownedItems.includes(item.id)}
          equipped={isEquipped(item)}
          focused={focused?.id === item.id}
          pp={parityPoints}
          onTap={() => tapCard(item)}
        />
      ))}
    </div>
  );

  const activeTab = TABS.find(t => t.id === tab) || TABS[0];
  const activeTabAccent = activeTab.accent;

  // ── The plate ───────────────────────────────────────────────────────────────
  // Worm things are drawn by the worm renderer and cube things by the cube
  // renderer, both the same ones the game uses — so what you are buying is
  // exactly what you will be looking at afterwards.
  const heroArt = () => {
    if (!focused) return null;
    if (focused.type === 'skin') {
      return <WormPreviewCanvas characterId={wormCharacter} skinId={focused.skinId} hatId={wormHat} size={heroPx} animated />;
    }
    if (focused.type === 'hat') {
      return <WormPreviewCanvas characterId={wormCharacter} skinId={wormSkin} hatId={focused.hatId} size={heroPx} animated framing="portrait" />;
    }
    if (focused.type === 'scheme') {
      // Palettes show on plain tiles, not on whatever style you have equipped.
      // A palette card is answering "what are these six colours", and half the
      // catalogue is dark ornate shaders that swallow a pale palette whole —
      // pastel under a mandelbrot is six shades of near-black.
      return (
        <CubePreviewCanvas
          px={heroPx} size={3}
          colors={COLOR_SCHEMES[focused.schemeKey] || COLOR_SCHEMES.standard}
          tileStyle="solid"
        />
      );
    }
    return <CubePreviewCanvas px={heroPx} size={3} colors={currentColors} tileStyle={focused.tileKey} />;
  };

  const heroOwned = focused ? ownedItems.includes(focused.id) : false;
  const heroEquipped = focused ? isEquipped(focused) : false;
  const heroAccent = focused ? typeAccent(focused) : ACCENT;
  const canAfford = focused ? parityPoints >= focused.price : false;

  const heroActionStyle = {
    ...TOUCH, padding: '12px 26px', borderRadius: '12px',
    background: heroAccent, border: 'none',
    color: '#fff', fontSize: '14px', fontWeight: 800, letterSpacing: '0.04em',
    cursor: 'pointer', fontFamily: FONT,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
    boxShadow: `0 4px 0 ${heroAccent}aa, 0 6px 16px ${heroAccent}44`,
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 99999,
      display: 'flex', flexDirection: 'column',
      ...wizardPaperBackground,
      fontFamily: FONT,
      pointerEvents: 'auto',
    }}>

      {/* Header — compact on a phone, where every row it gives up goes to the plate */}
      <div style={{
        ...COLUMN,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px',
        padding: isMobile ? 'calc(10px + env(safe-area-inset-top)) 16px 0' : '18px 20px 0',
        flexShrink: 0,
      }}>
        <div style={{ minWidth: 0 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            background: ACCENT, borderRadius: '6px', padding: '4px 11px',
            marginBottom: isMobile ? '6px' : '9px', boxShadow: `0 2px 0 ${ACCENT_SHADOW}`,
          }}>
            <PPCoin size={12} color={UI_CREAM} ink={ACCENT} />
            <span style={{ fontSize: '10px', fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#fff' }}>Parity Store</span>
          </div>
          <div style={{
            fontFamily: DISPLAY_FONT,
            fontSize: isMobile ? '17px' : 'clamp(19px, 5.4vw, 26px)',
            color: PAPER_TEXT, letterSpacing: '0.01em', lineHeight: 1,
            textShadow: '0 2px 0 rgba(255,255,255,0.7)',
          }}>YOUR COLLECTION</div>

          {/* Collection progress */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '9px', marginTop: isMobile ? '6px' : '9px', maxWidth: '260px' }}>
            <div style={{
              flex: 1, height: '5px', borderRadius: '999px',
              background: 'rgba(255,255,255,0.66)',
              border: `1px solid ${PAPER_BORDER_SOFT}`, overflow: 'hidden',
            }}>
              <div style={{
                width: `${collectedPct}%`, height: '100%',
                background: `linear-gradient(90deg, ${ACCENT}, ${activeTabAccent})`,
                borderRadius: '999px', transition: 'width 0.4s cubic-bezier(0.22,1,0.36,1), background 0.3s ease',
              }} />
            </div>
            <span style={{ fontSize: '10px', fontWeight: 700, color: PAPER_TEXT_MUTED, whiteSpace: 'nowrap' }}>
              {ownedCount}/{ALL_ITEMS.length} collected
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '9px', flexShrink: 0 }}>
          {/* PP balance */}
          <div style={{
            padding: isMobile ? '6px 11px' : '7px 13px', borderRadius: '12px',
            background: 'rgba(255,255,255,0.82)', border: `1.5px solid ${PAPER_BORDER_SOFT}`,
            boxShadow: `0 3px 0 ${PAPER_CARD_SHADOW}`,
            textAlign: 'right',
          }}>
            <div style={{ fontSize: '8px', fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: PAPER_TEXT_FAINT }}>Balance</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '2px' }}>
              <PPCoin size={14} />
              <span style={{ fontSize: '19px', fontWeight: 900, color: ACCENT, letterSpacing: '-0.03em', lineHeight: 1 }}>
                {parityPoints}
              </span>
              <span style={{ fontSize: '10px', fontWeight: 800, color: PAPER_TEXT_FAINT }}>PP</span>
            </div>
          </div>

          {/* Close */}
          <button
            className="store-icon-btn"
            onPointerDown={onClose}
            aria-label="Close store"
            style={{
              ...TOUCH, width: 40, height: 40, borderRadius: '12px',
              background: 'rgba(255,255,255,0.82)', border: `1.5px solid ${PAPER_BORDER_SOFT}`,
              color: PAPER_TEXT_MUTED, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: `0 3px 0 ${PAPER_CARD_SHADOW}`, fontFamily: FONT,
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{
        ...COLUMN, display: 'flex', gap: '7px',
        padding: isMobile ? '10px 16px 2px' : '16px 20px 2px',
        flexShrink: 0, overflowX: 'auto', scrollbarWidth: 'none',
      }}>
        {TABS.map(t => {
          const active = tab === t.id;
          const total = t.items.length;
          return (
            <button
              key={t.id}
              className={`store-tab${active ? ' is-active' : ''}`}
              onPointerDown={() => { setTab(t.id); setFocusedId(null); }}
              style={{
                ...TOUCH,
                display: 'flex', alignItems: 'center', gap: '7px',
                padding: '8px 14px', borderRadius: '999px', cursor: 'pointer',
                background: active ? t.accent : 'rgba(255,255,255,0.72)',
                border: active ? `2px solid ${t.accent}` : `2px solid ${PAPER_BORDER_SOFT}`,
                color: active ? '#fff' : PAPER_TEXT_MUTED,
                fontSize: '12px', fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase',
                fontFamily: FONT, whiteSpace: 'nowrap',
                boxShadow: active ? `0 3px 0 ${t.accent}88, 0 5px 14px ${t.accent}44` : `0 2px 0 ${PAPER_CARD_SHADOW}`,
              }}
            >
              {t.label}
              <span style={{
                fontSize: '9px', fontWeight: 800, letterSpacing: '0.02em',
                padding: '2px 6px', borderRadius: '999px',
                background: active ? 'rgba(255,255,255,0.24)' : PAPER_BG_MUTED,
                color: active ? '#fff' : PAPER_TEXT_FAINT,
              }}>{tabOwned[t.id]}/{total}</span>
            </button>
          );
        })}
      </div>

      {/* Content — the plate rides the top of the scroller, so whatever you scroll
          down to is still landing on something you can see. */}
      <div style={{ flex: 1, overflowY: 'auto', overscrollBehavior: 'contain', scrollbarWidth: 'thin', scrollbarColor: `${PAPER_CARD_SHADOW} transparent` }}>
        <div style={{ ...COLUMN, padding: isMobile ? '10px 16px 18px' : '16px 20px 18px' }}>
          {focused && (
            <SpecimenPlate
              sticky
              caption={TYPE_LABEL[focused.type]}
              index={focusIndex + 1}
              total={items.length}
              title={focused.label}
              glow={heroAccent}
              // Your chosen scene follows you in here too, so a skin is judged
              // against the environment you actually play it in.
              backdrop={bgOptionFor(settings?.backgroundTheme)}
              onPrev={() => stepFocus(-1)}
              onNext={() => stepFocus(1)}
              art={heroArt()}
              hint={focused.type === 'scheme' || focused.type === 'tile' ? 'drag the cube to turn it' : null}
              subtitle={
                heroEquipped ? (
                  <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: '6px',
                    background: `${heroAccent}28`, border: `1px solid ${heroAccent}55`,
                    color: heroAccent, fontSize: '9px', fontWeight: 800,
                    letterSpacing: '0.14em', textTransform: 'uppercase',
                    padding: '3px 11px', borderRadius: '999px',
                  }}>
                    <CheckIcon size={9} color={heroAccent} /> Equipped
                  </div>
                ) : null
              }
            >
              {/* Action — the plate is the purchase counter now, so nothing has to
                  open on top of the thing you are trying to look at. */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', zIndex: 1 }}>
                {heroOwned ? (
                  !heroEquipped && (
                    <button style={heroActionStyle} onClick={() => { equip(focused); showToast(`${focused.label} applied`); }}>
                      Equip
                    </button>
                  )
                ) : canAfford ? (
                  <button style={heroActionStyle} onClick={() => buy(focused)}>
                    <PPCoin size={15} color={UI_CREAM} ink={heroAccent} /> Unlock for {focused.price}
                  </button>
                ) : (
                  <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: '7px',
                    padding: '11px 20px', borderRadius: '12px',
                    background: 'rgba(255,245,220,0.08)', border: '1.5px dashed rgba(255,245,220,0.28)',
                    color: NIGHT_TEXT_MUTED, fontSize: '12px', fontWeight: 700,
                  }}>
                    <LockIcon size={12} color={NIGHT_TEXT_MUTED} />
                    {focused.price - parityPoints} more PP to unlock
                  </div>
                )}
                {!heroOwned && (
                  <span style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: NIGHT_TEXT_MUTED }}>
                    You have {parityPoints} PP
                  </span>
                )}
              </div>
            </SpecimenPlate>
          )}

          {tab === 'tiles'
            ? TILE_SECTIONS.map(section => (
              <TileSection key={section.label} label={section.label} items={section.items} renderItems={renderItems} />
            ))
            : renderItems(items)}
        </div>
      </div>

      {/* Footer — Mobi's note on where PP comes from, in the same pencil hand the
          setup wizards use. */}
      <div style={{
        padding: isMobile ? '8px 16px calc(10px + env(safe-area-inset-bottom))' : '11px 20px 16px',
        borderTop: `1px solid ${PAPER_BORDER_SOFT}`, flexShrink: 0,
        background: WIZARD_FOOTER_BG,
      }}>
        <div style={{
          ...COLUMN,
          display: 'flex', gap: '11px', alignItems: 'center',
          padding: '9px 13px', borderRadius: '10px',
          borderLeft: `3px solid ${ACCENT}`,
          background: 'rgba(255,255,255,0.5)',
          boxShadow: 'inset 0 0 0 1px rgba(91,72,45,0.08)',
        }}>
          <span style={{
            fontSize: '9px', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase',
            color: ACCENT, opacity: 0.85, flexShrink: 0,
          }}>Earning PP</span>
          <span style={{ fontFamily: HAND_FONT, fontSize: '17px', lineHeight: 1.25, color: PENCIL_LEAD }}>
            Collect orbs in Worm mode and win Chaos bets.
          </span>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className="store-toast" style={{
          position: 'fixed', bottom: '92px', left: '50%',
          display: 'flex', alignItems: 'center', gap: '8px',
          background: toast.ok ? activeTabAccent : '#c44b00',
          border: 'none',
          borderRadius: '999px', padding: '11px 20px',
          color: '#fff',
          fontSize: '13px', fontWeight: 700, fontFamily: FONT,
          boxShadow: '0 6px 22px rgba(0,0,0,0.24)',
          pointerEvents: 'none', zIndex: 900,
        }}>
          {toast.ok ? <CheckIcon size={11} /> : <LockIcon size={12} color="#fff" />}
          {toast.msg}
        </div>
      )}
    </div>
  );
};

export default ParityStoreScreen;
