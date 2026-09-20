import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useGameStore } from '../../hooks/useGameStore.js';
import { useShallow } from 'zustand/react/shallow';
import { getSkins, getHats, getSchemes, getTiles, getTrails, STORE_CHARACTERS } from '../../utils/storeCatalog.js';
import { getSkin } from '../../worm/wormCosmeticsData.js';
import { TILE_STYLE_SECTIONS } from '../../utils/tileStyleCatalog.js';
import { COLOR_SCHEMES } from '../../utils/colorSchemes.js';
import {
  registerTilePreview,
  updateTilePreview,
  unregisterTilePreview,
} from '../../3d/TilePreviewRenderer.js';
import {
  UI_FONT, DISPLAY_FONT, PAPER_SHEET_RAISED, UI_MOSS,
  PAPER_BORDER_SOFT, PAPER_TEXT, PAPER_TEXT_MUTED, PAPER_TEXT_FAINT,
  PAPER_CARD_SHADOW, PAPER_BG_MUTED, NIGHT_SHEET, NIGHT_TEXT, NIGHT_TEXT_MUTED,
  Z, TEXT_MICRO, TEXT_XS
} from '../../utils/uiTheme.js';
import { wizardPaperBackground } from './WizardChrome.jsx';
import { useDialogBehavior } from '../ui/Panel.jsx';
import WormPreviewCanvas from '../../3d/WormPreviewCanvas.jsx';
import CubePreviewCanvas from '../../3d/CubePreviewCanvas.jsx';
import { resolveWizardColors } from './wizardSteps/index.jsx';
import ChestRoom from '../../economy/ChestRoom.jsx';
import './ParityStoreScreen.css';

const ACCENT = UI_MOSS;
const FONT = UI_FONT;
const TOUCH = { touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' };

const SKINS   = getSkins();
const HATS    = getHats();
const SCHEMES = getSchemes();
const TILES   = getTiles();

const TABS = [
  { id: 'characters', label: 'Worms', accent: '#ed5353', items: STORE_CHARACTERS },
  { id: 'trails', label: 'Trails', accent: '#ed8a39', items: getTrails() },
  { id: 'skins',   label: 'Skins',    accent: '#ed8a39', items: SKINS },
  { id: 'hats',    label: 'Hats',     accent: '#ed8a39', items: HATS },
  { id: 'schemes', label: 'Palettes', accent: '#53b968', items: SCHEMES },
  { id: 'tiles',   label: 'Tiles',    accent: '#469dea', items: TILES },
];

const ALL_ITEMS = [...STORE_CHARACTERS, ...getTrails(), ...SKINS, ...HATS, ...SCHEMES, ...TILES];

const TYPE_LABEL = {
  character: 'Worm Character',
  skin: 'Worm Skin',
  hat: 'Hat',
  trail: 'Trail',
  scheme: 'Color Palette',
  tile: 'Tile Style',
};

// Per-type accent for item cards
const typeAccent = (item) => {
  if (item.type === 'character') return '#bd4747';
  if (item.type === 'skin')   return item.glow || '#2D7A3A';
  if (item.type === 'hat')    return '#6A2C91';
  if (item.type === 'trail')  return item.glow || item.body || '#0D9488';
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

// ── Trail preview ─────────────────────────────────────────────────────────────
// A shrinking, wiggling run of daubs echoes the actual painted stroke WormTrail.jsx
// leaves behind the worm in-game — same idea (bright/wide near the head, dim/thin
// trailing off), just static and small enough for a store card.
const TRAIL_DOT_STEPS = [1, 0.82, 0.64, 0.48, 0.34, 0.22];
const TrailPreview = ({ body, glow, size = 44 }) => (
  <svg width={size} height={size} viewBox="0 0 44 44" style={{ display: 'block' }} aria-hidden="true">
    {TRAIL_DOT_STEPS.map((s, i) => {
      const x = 5 + i * 6.4;
      const y = 22 + Math.sin(i * 1.15) * 6.5;
      const r = 5.4 * s;
      return (
        <g key={i}>
          <circle cx={x} cy={y} r={r * 1.7} fill={glow} opacity={0.16 + s * 0.22} />
          <circle cx={x} cy={y} r={r} fill={body} opacity={0.32 + s * 0.62} />
        </g>
      );
    })}
  </svg>
);

// ── Card artwork ──────────────────────────────────────────────────────────────
// The grid stays cheap: real worms (one frame each, they don't animate here) and
// flat shader tiles. The live, turning version of whatever you tapped is on the
// plate above — one animated preview for the whole screen.
const CardArt = ({ item, size, characterId, skinId, tileColor }) => {
  if (item.type === 'character') return <WormPreviewCanvas characterId={item.characterId} skinId={skinId} size={size} />;
  if (item.type === 'skin') return (
    <WormPreviewCanvas characterId={characterId} skinId={item.skinId} size={size} />
  );
  if (item.type === 'hat') return (
    <WormPreviewCanvas characterId={characterId} skinId={skinId} hatId={item.hatId} size={size} framing="head" />
  );
  if (item.type === 'trail') {
    const equippedSkin = getSkin(skinId);
    return <TrailPreview body={item.body ?? equippedSkin.body} glow={item.glow ?? equippedSkin.glow} size={size * 0.9} />;
  }
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
    <button type="button"
      className={`store-card store-card-enter${equipped ? ' is-equipped' : ''}`}
      onClick={onTap}
      aria-pressed={focused}
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
          fontSize: TEXT_XS, fontWeight: 900, letterSpacing: '0.1em',
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
          fontSize: TEXT_MICRO, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
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
    </button>
  );
};

const TILE_BY_KEY = new Map(TILES.map(t => [t.tileKey, t]));
const TILE_SECTIONS = TILE_STYLE_SECTIONS.map(section => ({
  key: section.key,
  label: section.label,
  items: section.keys.map(k => TILE_BY_KEY.get(k)).filter(Boolean),
}));
// Arrow order through the Tiles tab follows the sections you see, not the raw
// catalogue order.
const TILE_ORDER = TILE_SECTIONS.flatMap(s => s.items);

const TAB_ITEMS = { characters: STORE_CHARACTERS, trails: getTrails(), skins: SKINS, hats: HATS, schemes: SCHEMES, tiles: TILE_ORDER };

// ── Main screen ───────────────────────────────────────────────────────────────
const StoreCollection = ({ onClose, onChests }) => {
  const gems = useGameStore(s => s.chestWallet.gems);
  const [tab, setTab] = useState('characters');
  const [tileFamily, setTileFamily] = useState('classic');
  const [ownedOnly, setOwnedOnly] = useState(false);
  const heroPx = 144;
  const dialogRef = useRef(null);
  const selectorRef = useRef(null);
  const resetScroll = () => { if (selectorRef.current) selectorRef.current.scrollTop = 0; };
  const onKeyDown = useDialogBehavior(dialogRef, onClose);

  const { parityPoints, ownedItems, wormSkin, wormHat, wormTrail, wormCharacter, buyItem, setWormSkin, setWormHat, setWormTrail, setWormCharacter } =
    useGameStore(useShallow(s => ({
      parityPoints: s.parityPoints,
      ownedItems: s.ownedItems,
      wormSkin: s.wormSkin,
      wormHat: s.wormHat,
      wormTrail: s.wormTrail,
      wormCharacter: s.wormCharacter,
      buyItem: s.buyItem,
      setWormCharacter: s.setWormCharacter,
      setWormSkin: s.setWormSkin,
      setWormHat: s.setWormHat,
      setWormTrail: s.setWormTrail,
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
    if (item.type === 'character') return wormCharacter === item.characterId;
    if (item.type === 'skin')   return wormSkin === item.skinId;
    if (item.type === 'hat')    return wormHat === item.hatId;
    if (item.type === 'trail')  return wormTrail === item.trailId;
    if (item.type === 'scheme') return settings?.colorScheme === item.schemeKey;
    if (item.type === 'tile') {
      const styles = settings?.manifoldStyles || {};
      return [1, 2, 3, 4, 5, 6].every(id => (styles[id] || 'solid') === item.tileKey);
    }
    return false;
  }, [wormSkin, wormHat, wormTrail, wormCharacter, settings]);

  const categoryItems = tab === 'tiles' ? TILE_SECTIONS.find(s => s.key === tileFamily).items : TAB_ITEMS[tab];
  const items = useMemo(() => ownedOnly ? categoryItems.filter(i => ownedItems.includes(i.id)) : categoryItems, [categoryItems, ownedOnly, ownedItems]);

  // Opening a tab lands on what you are already wearing, so the plate starts by
  // showing your cube rather than an arbitrary first item.
  const focusIndex = useMemo(() => {
    const byId = items.findIndex(i => i.id === focusedId);
    if (byId !== -1) return byId;
    const equippedIdx = items.findIndex(isEquipped);
    return equippedIdx === -1 ? 0 : equippedIdx;
  }, [items, focusedId, isEquipped]);

  const focused = items[focusIndex];
  const stepFocus = delta => { if (items.length) setFocusedId(items[(focusIndex + delta + items.length) % items.length].id); };

  const equip = (item) => {
    if (item.type === 'character') setWormCharacter(item.characterId);
    else if (item.type === 'skin') setWormSkin(item.skinId);
    else if (item.type === 'hat') setWormHat(item.hatId);
    else if (item.type === 'trail') setWormTrail(item.trailId);
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

  // Cards only select a preview. Spending or changing the loadout requires the explicit action.
  const tapCard = item => { setFocusedId(item.id); resetScroll(); };

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
    <div className="catalogue-grid">
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
    if (focused.type === 'character') return <WormPreviewCanvas characterId={focused.characterId} skinId={wormSkin} hatId={wormHat} size={heroPx} animated />;
    if (focused.type === 'skin') {
      return <WormPreviewCanvas characterId={wormCharacter} skinId={focused.skinId} hatId={wormHat} size={heroPx} animated />;
    }
    if (focused.type === 'hat') {
      return <WormPreviewCanvas characterId={wormCharacter} skinId={wormSkin} hatId={focused.hatId} size={heroPx} animated framing="portrait" />;
    }
    if (focused.type === 'trail') {
      const equippedSkin = getSkin(wormSkin);
      return <TrailPreview body={focused.body ?? equippedSkin.body} glow={focused.glow ?? equippedSkin.glow} size={heroPx * 0.7} />;
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

  return (
    <div ref={dialogRef} onKeyDown={onKeyDown} className="store-catalogue" role="dialog" aria-modal="true" aria-labelledby="catalogue-title"
      style={{ ...wizardPaperBackground, zIndex: Z.TOAST, fontFamily: FONT,
        '--paper-ink': PAPER_TEXT, '--paper-muted': PAPER_TEXT_MUTED, '--paper-line': PAPER_BORDER_SOFT,
        '--paper-soft': PAPER_BG_MUTED, '--moss': UI_MOSS, '--display-font': DISPLAY_FONT,
        '--night': NIGHT_SHEET, '--night-ink': NIGHT_TEXT, '--night-muted': NIGHT_TEXT_MUTED, '--category': activeTabAccent }}>
      <header className="catalogue-header">
        <div><span className="catalogue-kicker">THE PARITY STORE</span><h1 id="catalogue-title">COLLECTION</h1>
          <div className="catalogue-progress"><span style={{ width: `${collectedPct}%` }} /></div>
          <small>{ownedCount}/{ALL_ITEMS.length} collected</small>
        </div>
        <div className="catalogue-wallet"><strong><PPCoin size={15} /> {parityPoints.toLocaleString()} PP</strong><span>◆ {gems.toLocaleString()} gems</span></div>
        <button className="catalogue-close" onClick={onClose} aria-label="Close store">✕</button>
      </header>
      <div className="catalogue-layout">
        <nav className="catalogue-sidebar" aria-label="Store categories">
          <span className="catalogue-kicker">CATALOGUE</span>
          {TABS.map(t => <button key={t.id} className="catalogue-category" aria-pressed={tab === t.id}
            aria-controls="catalogue-selector" style={{ '--category': t.accent }}
            onClick={() => { setTab(t.id); setFocusedId(null); resetScroll(); }}>
            <i aria-hidden="true" /><span><strong>{t.label}</strong><small>{tabOwned[t.id]} / {t.items.length} owned</small></span><b aria-hidden="true">›</b>
          </button>)}
          <button className="catalogue-chests" onClick={onChests}><span aria-hidden="true">◇</span><strong>Cubie Chests</strong><small>Open →</small></button>
        </nav>
        <section ref={selectorRef} className="catalogue-selector" id="catalogue-selector" aria-label={`${activeTab.label} selector`}>
          <div className="catalogue-section-heading"><div><span className="catalogue-kicker">MAKE IT YOURS</span><h2>{activeTab.label}</h2></div>
            <button className="catalogue-owned" aria-pressed={ownedOnly} onClick={() => setOwnedOnly(v => !v)}>Owned only</button></div>
          {tab === 'tiles' && <nav className="catalogue-families" aria-label="Tile families">{TILE_SECTIONS.map(section =>
            <button key={section.key} aria-pressed={tileFamily === section.key} onClick={() => { setTileFamily(section.key); setFocusedId(null); resetScroll(); }}>{section.label}<small>{section.items.length}</small></button>
          )}</nav>}
          {focused ? <div className="catalogue-preview" style={{ '--item-accent': heroAccent }}>
            <div className="catalogue-preview-art">{heroArt()}</div>
            <div className="catalogue-preview-info"><span className="catalogue-kicker">{TYPE_LABEL[focused.type]} · {focusIndex + 1}/{items.length}</span>
              <h3>{focused.label}</h3>
              <button className="catalogue-action" disabled={heroEquipped || (!heroOwned && !canAfford)} onClick={() => {
                if (heroOwned) { equip(focused); showToast(`${focused.label} applied`); } else buy(focused);
              }}>{heroEquipped ? '✓ Equipped' : heroOwned ? 'Equip' : `Unlock · ${focused.price} PP`}</button>
              {!heroOwned && !canAfford && <small>{focused.price - parityPoints} more PP needed</small>}
            </div>
            <div className="catalogue-preview-nav"><button aria-label="Previous item" onClick={() => stepFocus(-1)}>‹</button><button aria-label="Next item" onClick={() => stepFocus(1)}>›</button></div>
          </div> : <div className="catalogue-empty"><h3>No items yet</h3><p>No owned items in this category yet.</p><button onClick={() => setOwnedOnly(false)}>Browse all items</button></div>}
          <div className="catalogue-grid-heading"><span>{tab === 'tiles' ? TILE_SECTIONS.find(s => s.key === tileFamily).label : 'Items'}</span><small>{items.length} items</small></div>
          {renderItems(items)}
        </section>
      </div>
      <footer className="catalogue-footer">Collect orbs in WORM and win Chaos bets to earn PP.</footer>
      {toast && <div className="store-toast catalogue-toast" role="status" style={{ background: toast.ok ? ACCENT : '#a34325' }}>{toast.msg}</div>}
    </div>
  );
};

export default function ParityStoreScreen({ onClose }) {
  const [chests, setChests] = useState(false);
  return chests ? <ChestRoom onBack={() => setChests(false)} onClose={onClose} /> : <StoreCollection onClose={onClose} onChests={() => setChests(true)} />;
}
