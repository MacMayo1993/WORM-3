import React, { useState, useRef, useEffect } from 'react';
import { useGameStore } from '../../hooks/useGameStore.js';
import { useShallow } from 'zustand/react/shallow';
import { getSkins, getHats, getSchemes, getTiles } from '../../utils/storeCatalog.js';
import { COLOR_SCHEMES } from '../../utils/colorSchemes.js';
import {
  registerTilePreview,
  updateTilePreview,
  unregisterTilePreview,
} from '../../3d/TilePreviewRenderer.js';

const FONT = "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', system-ui, sans-serif";
const TOUCH_BTN = { touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' };

const SKINS   = getSkins();
const HATS    = getHats();
const SCHEMES = getSchemes();
const TILES   = getTiles();

const TABS = [
  { id: 'skins',   label: 'Skins' },
  { id: 'hats',    label: 'Hats' },
  { id: 'schemes', label: 'Palettes' },
  { id: 'tiles',   label: 'Tiles' },
];

// ── Tile preview canvas (WebGL, works outside R3F canvas) ─────────────────────
function TilePreviewCanvas({ styleKey, size = 40 }) {
  const canvasRef = useRef(null);
  const idRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = size;
    canvas.height = size;
    idRef.current = registerTilePreview(canvas, styleKey, '#4a7fa5');
    return () => { if (idRef.current !== null) unregisterTilePreview(idRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (idRef.current !== null) updateTilePreview(idRef.current, styleKey, '#4a7fa5');
  }, [styleKey]);
  return <canvas ref={canvasRef} width={size} height={size} style={{ borderRadius: 6, display: 'block' }} />;
}

// ── Skin preview ──────────────────────────────────────────────────────────────
const SkinSwatch = ({ skin, size = 48, locked }) => (
  <svg width={size} height={size} viewBox="0 0 48 48">
    <circle cx="24" cy="24" r="20" fill={locked ? '#444' : skin.glow} opacity="0.18" />
    <circle cx="24" cy="24" r="16" fill={locked ? '#666' : skin.body} />
    <ellipse cx="24" cy="27" rx="8" ry="6" fill={locked ? '#555' : skin.belly} opacity="0.7" />
    <circle cx="20" cy="20" r="2.5" fill="white" opacity={locked ? 0.4 : 1} />
    <circle cx="28" cy="20" r="2.5" fill="white" opacity={locked ? 0.4 : 1} />
    <circle cx="21" cy="20" r="1.2" fill="#1a1a2e" />
    <circle cx="29" cy="20" r="1.2" fill="#1a1a2e" />
  </svg>
);

// ── Hat icon ──────────────────────────────────────────────────────────────────
const HatIcon = ({ hatId, color = '#e2e8f0', size = 32 }) => {
  if (hatId === 'none') return (
    <svg width={size} height={size} viewBox="0 0 32 32">
      <circle cx="16" cy="16" r="12" stroke={color} strokeWidth="1.5" fill="none" strokeDasharray="4 3" opacity="0.5" />
      <line x1="10" y1="10" x2="22" y2="22" stroke={color} strokeWidth="1.5" opacity="0.4" />
    </svg>
  );
  if (hatId === 'tophat') return (
    <svg width={size} height={size} viewBox="0 0 32 32">
      <rect x="8" y="8" width="16" height="14" rx="1" fill={color} />
      <rect x="4" y="21" width="24" height="4" rx="2" fill={color} />
      <rect x="10" y="10" width="12" height="10" rx="1" fill="rgba(0,0,0,0.3)" />
    </svg>
  );
  if (hatId === 'party') return (
    <svg width={size} height={size} viewBox="0 0 32 32">
      <polygon points="16,4 6,26 26,26" fill={color} />
      <circle cx="9" cy="20" r="1.5" fill="#f59e0b" />
      <circle cx="20" cy="15" r="1.5" fill="#ec4899" />
      <circle cx="14" cy="22" r="1.5" fill="#06b6d4" />
    </svg>
  );
  if (hatId === 'crown') return (
    <svg width={size} height={size} viewBox="0 0 32 32">
      <polygon points="4,22 4,12 10,18 16,8 22,18 28,12 28,22" fill={color} />
      <rect x="4" y="22" width="24" height="4" rx="1" fill={color} />
      <circle cx="16" cy="9" r="2" fill="#f59e0b" />
    </svg>
  );
  if (hatId === 'halo') return (
    <svg width={size} height={size} viewBox="0 0 32 32">
      <ellipse cx="16" cy="13" rx="12" ry="4" fill="none" stroke={color} strokeWidth="2.5" />
      <ellipse cx="16" cy="13" rx="12" ry="4" fill={color} opacity="0.15" />
    </svg>
  );
  return null;
};

// ── Scheme preview dots ───────────────────────────────────────────────────────
const SchemeDots = ({ schemeKey, locked }) => {
  const colors = Object.values(COLOR_SCHEMES[schemeKey] || COLOR_SCHEMES.standard);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '3px', width: '100%' }}>
      {colors.slice(0, 6).map((c, i) => (
        <div key={i} style={{
          aspectRatio: '1', borderRadius: '50%',
          background: locked ? '#555' : c,
          boxShadow: locked ? 'none' : `0 1px 3px rgba(0,0,0,0.3)`,
        }} />
      ))}
    </div>
  );
};

// ── Lock overlay ──────────────────────────────────────────────────────────────
const LockBadge = ({ top = 5, right = 5 }) => (
  <span style={{ position: 'absolute', top, right, fontSize: '9px', lineHeight: 1 }}>🔒</span>
);

// ── Price chip ────────────────────────────────────────────────────────────────
const PriceChip = ({ price, canAfford, accentColor }) => (
  <div style={{
    display: 'flex', alignItems: 'baseline', gap: '3px',
    padding: '3px 8px', borderRadius: '7px',
    background: canAfford ? `${accentColor}20` : 'rgba(255,255,255,0.04)',
    border: `1px solid ${canAfford ? accentColor + '50' : 'rgba(255,255,255,0.08)'}`,
  }}>
    <span style={{ fontSize: '9px', fontWeight: 700, color: canAfford ? accentColor : 'rgba(120,140,180,0.5)', fontFamily: FONT }}>PP</span>
    <span style={{ fontSize: '12px', fontWeight: 800, color: canAfford ? accentColor : 'rgba(120,140,180,0.5)', fontFamily: FONT }}>{price}</span>
  </div>
);

// ── Generic item card ─────────────────────────────────────────────────────────
const ItemCard = ({ item, owned, equipped, pp, onBuy, onEquip }) => {
  const accentColor = item.type === 'skin' ? (item.glow || '#00ff88')
    : item.type === 'hat' ? '#6366f1'
    : item.type === 'scheme' ? '#f59e0b'
    : '#22c55e';
  const locked = !owned;
  const canAfford = pp >= item.price;

  const handleClick = () => {
    if (owned) onEquip();
    else if (canAfford) onBuy();
  };

  return (
    <div
      onClick={handleClick}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '7px',
        padding: item.type === 'tile' ? '10px 7px 9px' : '12px 8px 10px',
        background: equipped ? `${accentColor}12` : owned ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.02)',
        border: equipped ? `1.5px solid ${accentColor}55` : owned ? '1px solid rgba(120,160,255,0.18)' : '1px solid rgba(120,160,255,0.07)',
        borderRadius: '12px',
        cursor: owned ? 'pointer' : canAfford ? 'pointer' : 'default',
        position: 'relative',
        opacity: locked && !canAfford ? 0.45 : 1,
        transition: 'all 0.15s ease',
      }}
    >
      {/* Equipped badge */}
      {equipped && (
        <span style={{
          position: 'absolute', top: 5, right: 5,
          fontSize: '7px', fontWeight: 800, letterSpacing: '0.08em',
          color: accentColor, background: `${accentColor}20`,
          border: `1px solid ${accentColor}50`,
          borderRadius: '4px', padding: '1px 4px', fontFamily: FONT,
        }}>ON</span>
      )}
      {locked && <LockBadge />}

      {/* Preview */}
      <div style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        {item.type === 'skin' && <SkinSwatch skin={item} size={46} locked={locked} />}
        {item.type === 'hat' && (
          <div style={{
            width: 46, height: 46, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: equipped ? `${accentColor}18` : 'rgba(255,255,255,0.04)', borderRadius: '50%',
          }}>
            <HatIcon hatId={item.hatId} color={equipped ? '#a5b4fc' : locked ? 'rgba(100,120,160,0.35)' : '#94a3b8'} size={30} />
          </div>
        )}
        {item.type === 'scheme' && (
          <div style={{ width: '100%', padding: '0 2px' }}>
            <SchemeDots schemeKey={item.schemeKey} locked={locked} />
          </div>
        )}
        {item.type === 'tile' && (
          <div style={{ opacity: locked ? 0.35 : 1 }}>
            <TilePreviewCanvas styleKey={item.tileKey} size={44} />
          </div>
        )}
      </div>

      {/* Label */}
      <span style={{
        fontSize: item.type === 'tile' ? '9px' : '10px',
        fontWeight: 700,
        letterSpacing: '0.04em',
        color: equipped ? '#e0fff0' : owned ? 'rgba(200,220,255,0.85)' : 'rgba(140,170,220,0.5)',
        fontFamily: FONT, textAlign: 'center', lineHeight: 1.2,
      }}>{item.label}</span>

      {/* Price / status */}
      {owned ? (
        <span style={{
          fontSize: '9px', fontWeight: 600,
          color: equipped ? accentColor : 'rgba(120,150,200,0.45)',
          fontFamily: FONT,
        }}>{equipped ? 'Active' : 'Tap'}</span>
      ) : (
        <PriceChip price={item.price} canAfford={canAfford} accentColor={accentColor} />
      )}
    </div>
  );
};

// ── Tile category section ─────────────────────────────────────────────────────
// Tile section header + grid, defined outside component to avoid re-create-on-render
const TileSection = ({ label, items, renderItems }) => items.length === 0 ? null : (
  <div style={{ marginBottom: '20px' }}>
    <div style={{
      fontSize: '10px', fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase',
      color: 'rgba(140,170,220,0.45)',
      fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', system-ui, sans-serif",
      marginBottom: '8px',
    }}>{label}</div>
    {renderItems(items)}
  </div>
);

// Tile classification: Classic = static/pattern/procedural ≤100PP, Op Art = pattern 75-125PP dedupe, Living = animated/3d
const classicOnlyTiles = TILES.filter(t => ['static', 'pattern', 'procedural'].includes(t.tileType) && t.price <= 100);
const opArtOnlyTiles   = TILES.filter(t => t.tileType === 'pattern' && t.price >= 75 && t.price <= 125 && !classicOnlyTiles.includes(t));
const livingOnlyTiles  = TILES.filter(t => t.tileType === 'animated' || t.tileType === '3d');

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

  const showToast = (msg, color = '#00ff88') => {
    setToast({ msg, color });
    setTimeout(() => setToast(null), 1800);
  };

  const handleBuy = (item) => {
    if (ownedItems.includes(item.id)) {
      equip(item);
      return;
    }
    const ok = buyItem(item.id, item.price);
    if (!ok) {
      showToast(`Need ${item.price - parityPoints} more PP`, '#f97316');
      return;
    }
    equip(item);
    showToast(`${item.label} unlocked!`);
  };

  const equip = (item) => {
    if (item.type === 'skin') {
      setWormSkin(item.skinId);
    } else if (item.type === 'hat') {
      setWormHat(item.hatId);
    } else if (item.type === 'scheme') {
      setSettings({ ...settings, colorScheme: item.schemeKey });
    } else if (item.type === 'tile') {
      const newStyles = {};
      [1, 2, 3, 4, 5, 6].forEach(id => { newStyles[id] = item.tileKey; });
      setSettings({ ...settings, manifoldStyles: newStyles });
    }
    showToast(`${item.label} applied`);
  };

  const isEquipped = (item) => {
    if (item.type === 'skin') return wormSkin === item.skinId;
    if (item.type === 'hat') return wormHat === item.hatId;
    if (item.type === 'scheme') return settings?.colorScheme === item.schemeKey;
    if (item.type === 'tile') {
      const styles = settings?.manifoldStyles || {};
      return [1, 2, 3, 4, 5, 6].every(id => (styles[id] || 'solid') === item.tileKey);
    }
    return false;
  };

  const renderItems = (items) => (
    <div style={{
      display: 'grid',
      gridTemplateColumns: `repeat(auto-fill, minmax(${tab === 'tiles' ? '90px' : '100px'}, 1fr))`,
      gap: '8px',
    }}>
      {items.map(item => {
        const owned = ownedItems.includes(item.id);
        return (
          <ItemCard
            key={item.id}
            item={item}
            owned={owned}
            equipped={isEquipped(item)}
            pp={parityPoints}
            onBuy={() => handleBuy(item)}
            onEquip={() => { equip(item); showToast(`${item.label} applied`); }}
          />
        );
      })}
    </div>
  );

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 800,
      display: 'flex', flexDirection: 'column',
      background: 'rgba(4,8,20,0.97)',
      backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
      pointerEvents: 'auto',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 20px 12px',
        borderBottom: '1px solid rgba(99,102,241,0.2)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <rect x="3" y="10" width="18" height="11" rx="2" stroke="#6366f1" strokeWidth="1.5" fill="none" />
            <path d="M7 10V7a5 5 0 0 1 10 0v3" stroke="#6366f1" strokeWidth="1.5" strokeLinecap="round" fill="none" />
          </svg>
          <span style={{
            fontSize: '15px', fontWeight: 700, letterSpacing: '0.1em',
            textTransform: 'uppercase', color: '#a5b4fc', fontFamily: FONT,
          }}>Parity Store</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            display: 'flex', alignItems: 'baseline', gap: '4px',
            background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.3)',
            borderRadius: '10px', padding: '4px 12px',
          }}>
            <span style={{ fontSize: '10px', fontWeight: 700, color: '#818cf8', fontFamily: FONT }}>PP</span>
            <span style={{ fontSize: '18px', fontWeight: 800, color: '#e0e7ff', fontFamily: FONT }}>{parityPoints}</span>
          </div>
          <button onPointerDown={onClose} style={{
            ...TOUCH_BTN, width: 36, height: 36, borderRadius: '50%',
            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
            color: 'rgba(200,220,255,0.7)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '3px', padding: '10px 16px 0', flexShrink: 0, overflowX: 'auto' }}>
        {TABS.map(t => (
          <button
            key={t.id}
            onPointerDown={() => setTab(t.id)}
            style={{
              ...TOUCH_BTN,
              padding: '7px 16px', borderRadius: '9px', cursor: 'pointer',
              background: tab === t.id ? 'rgba(99,102,241,0.25)' : 'rgba(255,255,255,0.04)',
              color: tab === t.id ? '#a5b4fc' : 'rgba(150,170,220,0.5)',
              fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
              fontFamily: FONT, whiteSpace: 'nowrap',
              border: tab === t.id ? '1px solid rgba(99,102,241,0.4)' : '1px solid transparent',
              transition: 'all 0.15s ease',
            }}
          >{t.label}</button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px 16px' }}>
        {tab === 'skins'   && renderItems(SKINS)}
        {tab === 'hats'    && renderItems(HATS)}
        {tab === 'schemes' && renderItems(SCHEMES)}
        {tab === 'tiles' && (
          <>
            <TileSection label="Classic" items={classicOnlyTiles} renderItems={renderItems} />
            <TileSection label="Op Art"  items={opArtOnlyTiles}   renderItems={renderItems} />
            <TileSection label="Living"  items={livingOnlyTiles}  renderItems={renderItems} />
          </>
        )}
      </div>

      {/* Earn hint */}
      <div style={{
        padding: '8px 20px 14px', textAlign: 'center',
        borderTop: '1px solid rgba(99,102,241,0.1)', flexShrink: 0,
      }}>
        <span style={{ fontSize: '10px', color: 'rgba(120,150,200,0.45)', fontFamily: FONT }}>
          Earn PP by collecting orbs in Worm mode and playing Disparity
        </span>
      </div>

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: '80px', left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(8,12,32,0.96)', border: `1px solid ${toast.color}50`,
          borderRadius: '12px', padding: '9px 18px',
          color: toast.color, fontSize: '12px', fontWeight: 600, fontFamily: FONT,
          boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
          pointerEvents: 'none', zIndex: 900, animation: 'fadeIn 0.2s ease',
        }}>
          {toast.msg}
        </div>
      )}
    </div>
  );
};

export default ParityStoreScreen;
