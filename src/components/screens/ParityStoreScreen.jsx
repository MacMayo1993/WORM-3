import React, { useState, useRef, useEffect, useMemo } from 'react';
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
  PAPER_BACKDROP, PAPER_BACKDROP_BLUR, PAPER_SHEET_RAISED,
  PAPER_BORDER_SOFT, PAPER_TEXT, PAPER_TEXT_MUTED, PAPER_TEXT_FAINT,
  PAPER_BG_MUTED, PAPER_CARD_SHADOW, PAPER_SHADOW, UI_CREAM,
} from '../../utils/uiTheme.js';
import { wizardPaperBackground, WIZARD_FOOTER_BG, PENCIL_LEAD } from './WizardChrome.jsx';
import { WormSkinIcon, HatIcon } from '../ui/CosmeticIcons.jsx';
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
function TilePreviewCanvas({ styleKey, size = 44 }) {
  const canvasRef = useRef(null);
  const idRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = size;
    canvas.height = size;
    idRef.current = registerTilePreview(canvas, styleKey, '#e53935');
    return () => { if (idRef.current !== null) unregisterTilePreview(idRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (idRef.current !== null) updateTilePreview(idRef.current, styleKey, '#e53935');
  }, [styleKey]);
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

// ── Item artwork ──────────────────────────────────────────────────────────────
// One renderer for both the grid card and the big preview, so an item is drawn
// the same way at both sizes.
const ItemArt = ({ item, size, accent }) => {
  if (item.type === 'skin')   return <WormSkinIcon skin={item} size={size} />;
  if (item.type === 'hat')    return <HatIcon hatId={item.hatId} color={accent} size={size * 0.66} />;
  if (item.type === 'scheme') return (
    <div style={{ width: size * 0.92 }}>
      <SchemeDots schemeKey={item.schemeKey} gap={size > 70 ? '6px' : '3px'} radius={size > 70 ? '5px' : '3px'} />
    </div>
  );
  return <TilePreviewCanvas styleKey={item.tileKey} size={Math.round(size * 0.92)} />;
};

// ── Recessed specimen well ────────────────────────────────────────────────────
// Item art always sits in the same inset frame — on the card and in the modal —
// which is what makes a grid of very different artwork (worms, hats, colour
// swatches, rendered tiles) read as one collection.
const SpecimenWell = ({ children, height, locked, style }) => (
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
    ...style,
  }}>
    {children}
  </div>
);

// ── Purchase / preview modal ──────────────────────────────────────────────────
const PreviewModal = ({ item, owned, pp, onClose, onBuy, onEquip }) => {
  const ac = typeAccent(item);
  const canAfford = pp >= item.price;

  const actionStyle = {
    ...TOUCH, width: '100%', padding: '14px', borderRadius: '12px',
    background: ac, border: 'none',
    color: '#fff', fontSize: '14px', fontWeight: 800, letterSpacing: '0.04em',
    cursor: 'pointer', fontFamily: FONT,
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
    boxShadow: `0 4px 0 ${ac}aa, 0 6px 16px ${ac}44`,
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 100000,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px',
        background: PAPER_BACKDROP,
        backdropFilter: PAPER_BACKDROP_BLUR, WebkitBackdropFilter: PAPER_BACKDROP_BLUR,
        animation: 'modalBackdropIn 0.22s ease',
      }}
      onClick={onClose}
    >
      <div
        style={{
          ...wizardPaperBackground,
          border: '1px solid #cec8be',
          borderTop: `3px solid ${ac}`,
          borderRadius: '20px', padding: '24px 22px 20px',
          width: 'min(320px, 100%)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px',
          boxShadow: PAPER_SHADOW,
          fontFamily: FONT,
          animation: 'modalSheetIn 0.30s cubic-bezier(0.22, 1, 0.36, 1)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Type eyebrow */}
        <div style={{
          alignSelf: 'stretch', display: 'flex', alignItems: 'center', gap: '8px',
          fontSize: '9px', fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase',
          color: ac,
        }}>
          {TYPE_LABEL[item.type]}
          <div style={{ flex: 1, height: '1px', background: `${ac}33` }} />
          {owned && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: ac }}>
              <CheckIcon size={9} color={ac} /> Owned
            </span>
          )}
        </div>

        {/* Large specimen */}
        <SpecimenWell height="150px">
          <ItemArt item={item} size={120} accent={ac} />
        </SpecimenWell>

        {/* Name plate */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '19px', fontWeight: 800, color: PAPER_TEXT, letterSpacing: '-0.03em' }}>{item.label}</div>
        </div>

        {/* Action */}
        {owned ? (
          <button style={actionStyle} onClick={onEquip}>Equip</button>
        ) : (
          <>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px',
              padding: '9px 16px', borderRadius: '999px',
              background: canAfford ? `${ac}12` : PAPER_BG_MUTED,
              border: `1.5px solid ${canAfford ? `${ac}44` : PAPER_BORDER_SOFT}`,
            }}>
              <PPCoin size={16} color={canAfford ? ac : PAPER_TEXT_FAINT} />
              <span style={{ fontSize: '22px', fontWeight: 900, color: canAfford ? ac : PAPER_TEXT_FAINT, letterSpacing: '-0.03em', lineHeight: 1 }}>
                {item.price}
              </span>
              <span style={{ fontSize: '11px', color: PAPER_TEXT_FAINT, fontWeight: 600 }}>· you have {pp}</span>
            </div>
            {canAfford ? (
              <button style={actionStyle} onClick={onBuy}>
                <PPCoin size={15} color={UI_CREAM} ink={ac} /> Unlock for {item.price}
              </button>
            ) : (
              <div style={{
                width: '100%', padding: '13px', borderRadius: '12px', textAlign: 'center',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px',
                background: 'rgba(255,255,255,0.5)', border: `1.5px dashed ${PAPER_BORDER_SOFT}`,
                color: PAPER_TEXT_MUTED, fontSize: '12px', fontWeight: 600, fontFamily: FONT,
              }}>
                <LockIcon size={12} color={PAPER_TEXT_MUTED} />
                {item.price - pp} more PP to unlock
              </div>
            )}
          </>
        )}

        <button
          style={{
            ...TOUCH, width: '100%', padding: '10px', borderRadius: '10px',
            background: 'transparent', border: `1.5px solid ${PAPER_BORDER_SOFT}`,
            color: PAPER_TEXT_MUTED, fontSize: '13px', fontWeight: 600,
            cursor: 'pointer', fontFamily: FONT,
          }}
          onClick={onClose}
        >Close</button>
      </div>
    </div>
  );
};

// ── Item card ─────────────────────────────────────────────────────────────────
const ItemCard = ({ item, owned, equipped, pp, index, onPreview, onEquip }) => {
  const ac = typeAccent(item);
  const canAfford = pp >= item.price;
  const locked = !owned;

  return (
    <div
      className={`store-card store-card-enter${equipped ? ' is-equipped' : ''}`}
      onClick={owned ? onEquip : onPreview}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px',
        padding: '10px 9px 9px',
        background: equipped ? `${ac}12` : 'rgba(255,255,255,0.72)',
        border: equipped ? `2px solid ${ac}` : `2px solid ${PAPER_BORDER_SOFT}`,
        borderRadius: '14px', cursor: 'pointer', position: 'relative',
        boxShadow: equipped
          ? `inset 0 2px 5px rgba(83,72,56,0.13)`
          : `0 3px 0 ${PAPER_CARD_SHADOW}, 0 5px 12px rgba(83,72,56,0.10)`,
        transform: equipped ? 'translateY(1px)' : 'none',
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
          boxShadow: `0 1px 3px rgba(83,72,56,0.22)`,
        }}><LockIcon size={10} color={canAfford ? ac : PAPER_TEXT_FAINT} /></span>
      ) : null}

      <SpecimenWell height="52px" locked={locked}>
        <ItemArt item={item} size={46} accent={equipped ? ac : PAPER_TEXT_FAINT} />
      </SpecimenWell>

      {/* Label */}
      <span style={{
        fontSize: '10px',
        fontWeight: 700, letterSpacing: '0.01em',
        color: equipped ? PAPER_TEXT : PAPER_TEXT_MUTED,
        fontFamily: FONT, textAlign: 'center', lineHeight: 1.2,
      }}>{item.label}</span>

      {/* Price / status */}
      {owned ? (
        <span style={{
          marginTop: 'auto',
          fontSize: '9px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
          color: equipped ? ac : PAPER_TEXT_FAINT, fontFamily: FONT,
        }}>
          {equipped ? 'Equipped' : 'Tap to equip'}
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
    <div style={{
      display: 'flex', alignItems: 'center', gap: '10px',
      marginBottom: '10px',
    }}>
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

// ── Main screen ───────────────────────────────────────────────────────────────
const ParityStoreScreen = ({ onClose }) => {
  const [tab, setTab] = useState('skins');

  const { parityPoints, ownedItems, wormSkin, wormHat, buyItem, setWormSkin, setWormHat } =
    useGameStore(useShallow(s => ({
      parityPoints: s.parityPoints,
      ownedItems: s.ownedItems,
      wormSkin: s.wormSkin,
      wormHat: s.wormHat,
      buyItem: s.buyItem,
      setWormSkin: s.setWormSkin,
      setWormHat: s.setWormHat,
    })));

  const { settings, setSettings } = useGameStore(useShallow(s => ({
    settings: s.settings,
    setSettings: s.setSettings,
  })));

  const [toast, setToast] = useState(null);
  const [previewItem, setPreviewItem] = useState(null);

  const showToast = (msg, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 1800);
  };

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

  const handleBuy = (item) => {
    if (ownedItems.includes(item.id)) { equip(item); showToast(`${item.label} applied`); return; }
    const ok = buyItem(item.id, item.price);
    if (!ok) { showToast(`Need ${item.price - parityPoints} more PP`, false); return; }
    equip(item);
    showToast(`${item.label} unlocked!`);
  };

  const isEquipped = (item) => {
    if (item.type === 'skin')   return wormSkin === item.skinId;
    if (item.type === 'hat')    return wormHat === item.hatId;
    if (item.type === 'scheme') return settings?.colorScheme === item.schemeKey;
    if (item.type === 'tile') {
      const styles = settings?.manifoldStyles || {};
      return [1, 2, 3, 4, 5, 6].every(id => (styles[id] || 'solid') === item.tileKey);
    }
    return false;
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

  const renderItems = (items) => (
    <div style={{
      display: 'grid',
      gridTemplateColumns: `repeat(auto-fill, minmax(${tab === 'tiles' ? '92px' : '104px'}, 1fr))`,
      gap: '10px',
    }}>
      {items.map((item, i) => {
        const owned = ownedItems.includes(item.id);
        return (
          <ItemCard
            key={item.id} item={item} index={i}
            owned={owned} equipped={isEquipped(item)} pp={parityPoints}
            onPreview={() => setPreviewItem(item)}
            onEquip={() => { equip(item); showToast(`${item.label} applied`); }}
          />
        );
      })}
    </div>
  );

  const activeTab = TABS.find(t => t.id === tab) || TABS[0];
  const activeTabAccent = activeTab.accent;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 99999,
      display: 'flex', flexDirection: 'column',
      ...wizardPaperBackground,
      fontFamily: FONT,
      pointerEvents: 'auto',
    }}>

      {/* Header */}
      <div style={{
        ...COLUMN,
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px',
        padding: '18px 20px 0', flexShrink: 0,
      }}>
        <div style={{ minWidth: 0 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            background: ACCENT, borderRadius: '6px', padding: '4px 11px',
            marginBottom: '9px', boxShadow: `0 2px 0 ${ACCENT_SHADOW}`,
          }}>
            <PPCoin size={12} color={UI_CREAM} ink={ACCENT} />
            <span style={{ fontSize: '10px', fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#fff' }}>Parity Store</span>
          </div>
          <div style={{
            fontFamily: DISPLAY_FONT,
            fontSize: 'clamp(19px, 5.4vw, 26px)',
            color: PAPER_TEXT, letterSpacing: '0.01em', lineHeight: 1,
            textShadow: `0 2px 0 rgba(255,255,255,0.7)`,
          }}>YOUR COLLECTION</div>

          {/* Collection progress */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '9px', marginTop: '9px', maxWidth: '260px' }}>
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
            padding: '7px 13px', borderRadius: '12px',
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
      <div style={{ ...COLUMN, display: 'flex', gap: '7px', padding: '16px 20px 2px', flexShrink: 0, overflowX: 'auto', scrollbarWidth: 'none' }}>
        {TABS.map(t => {
          const active = tab === t.id;
          const total = t.items.length;
          return (
            <button
              key={t.id}
              className={`store-tab${active ? ' is-active' : ''}`}
              onPointerDown={() => setTab(t.id)}
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

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', scrollbarWidth: 'thin', scrollbarColor: `${PAPER_CARD_SHADOW} transparent` }}>
        <div style={{ ...COLUMN, padding: '16px 20px 18px' }}>
          {tab === 'skins'   && renderItems(SKINS)}
          {tab === 'hats'    && renderItems(HATS)}
          {tab === 'schemes' && renderItems(SCHEMES)}
          {tab === 'tiles' && TILE_SECTIONS.map(section => (
            <TileSection key={section.label} label={section.label} items={section.items} renderItems={renderItems} />
          ))}
        </div>
      </div>

      {/* Footer — Mobi's note on where PP comes from, in the same pencil hand the
          setup wizards use. */}
      <div style={{
        padding: '11px 20px 16px',
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
          boxShadow: `0 6px 22px rgba(0,0,0,0.24)`,
          pointerEvents: 'none', zIndex: 900,
        }}>
          {toast.ok ? <CheckIcon size={11} /> : <LockIcon size={12} color="#fff" />}
          {toast.msg}
        </div>
      )}

      {/* Preview modal */}
      {previewItem && (
        <PreviewModal
          item={previewItem}
          owned={ownedItems.includes(previewItem.id)}
          pp={parityPoints}
          onClose={() => setPreviewItem(null)}
          onBuy={() => { handleBuy(previewItem); setPreviewItem(null); }}
          onEquip={() => { equip(previewItem); showToast(`${previewItem.label} applied`); setPreviewItem(null); }}
        />
      )}
    </div>
  );
};

export default ParityStoreScreen;
