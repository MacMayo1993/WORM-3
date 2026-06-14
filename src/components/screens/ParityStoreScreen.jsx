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

const ACCENT = '#0891B2';
const ACCENT_SHADOW = '#0e6985';
const FONT = "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', system-ui, sans-serif";
const TOUCH = { touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' };

const SKINS   = getSkins();
const HATS    = getHats();
const SCHEMES = getSchemes();
const TILES   = getTiles();

const TABS = [
  { id: 'skins',   label: 'Skins',    accent: '#2D7A3A' },
  { id: 'hats',    label: 'Hats',     accent: '#6A2C91' },
  { id: 'schemes', label: 'Palettes', accent: '#1565C0' },
  { id: 'tiles',   label: 'Tiles',    accent: '#C44B00' },
];

// Per-type accent for item cards
const typeAccent = (item) => {
  if (item.type === 'skin')   return item.glow || '#2D7A3A';
  if (item.type === 'hat')    return '#6A2C91';
  if (item.type === 'scheme') return '#1565C0';
  return '#C44B00';
};

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

// ── Worm body preview ─────────────────────────────────────────────────────────
const WormBody = ({ skin, size = 46 }) => (
  <svg width={size} height={size} viewBox="0 0 48 48">
    <circle cx="35" cy="14" r="16" fill={skin.glow} opacity="0.18" />
    <path d="M 9 41 Q 18 32 27 24 Q 31 19 35 14"
      stroke={skin.body} strokeWidth="10" strokeLinecap="round" fill="none" opacity="0.45" />
    <circle cx="9" cy="41" r="5" fill={skin.belly} opacity="0.8" />
    <circle cx="18" cy="33" r="7.5" fill={skin.body} />
    <ellipse cx="18" cy="35.5" rx="4" ry="2.8" fill={skin.belly} opacity="0.55" />
    <circle cx="27" cy="24" r="9.5" fill={skin.body} />
    <ellipse cx="27" cy="26.5" rx="5.5" ry="3.8" fill={skin.belly} opacity="0.55" />
    <circle cx="35" cy="14" r="12" fill={skin.body} />
    <ellipse cx="35" cy="17.5" rx="7.5" ry="5" fill={skin.belly} opacity="0.6" />
    <circle cx="30.5" cy="10" r="3.1" fill="white" opacity="0.95" />
    <circle cx="39" cy="9" r="3.1" fill="white" opacity="0.95" />
    <circle cx="31.5" cy="10.5" r="1.7" fill="#0d0d1a" />
    <circle cx="40" cy="9.5" r="1.7" fill="#0d0d1a" />
    <circle cx="30.8" cy="9.2" r="0.85" fill="white" />
    <circle cx="39.3" cy="8.2" r="0.85" fill="white" />
    <path d="M 29.5 17 Q 35 22.5 40.5 17"
      stroke="#0d0d1a" strokeWidth="1.5" fill="none" strokeLinecap="round" opacity="0.3" />
  </svg>
);

// ── Hat icon ──────────────────────────────────────────────────────────────────
const HatIcon = ({ hatId, color = '#9a8e82', size = 30 }) => {
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
      <rect x="10" y="10" width="12" height="10" rx="1" fill="rgba(0,0,0,0.18)" />
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

// ── Scheme preview tiles ──────────────────────────────────────────────────────
const SchemeDots = ({ schemeKey }) => {
  const colors = Object.values(COLOR_SCHEMES[schemeKey] || COLOR_SCHEMES.standard);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '3px', width: '100%' }}>
      {colors.slice(0, 6).map((c, i) => (
        <div key={i} style={{
          aspectRatio: '1', borderRadius: '3px',
          background: c,
          boxShadow: `0 1px 3px rgba(0,0,0,0.20)`,
        }} />
      ))}
    </div>
  );
};

// ── Lock badge ────────────────────────────────────────────────────────────────
const LockBadge = () => (
  <span style={{ position: 'absolute', top: 5, right: 5, fontSize: '9px', lineHeight: 1 }}>🔒</span>
);

// ── Purchase / preview modal ──────────────────────────────────────────────────
const PreviewModal = ({ item, owned, pp, onClose, onBuy, onEquip }) => {
  const ac = typeAccent(item);
  const canAfford = pp >= item.price;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 100000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(160,152,140,0.72)',
        backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#f5f0e8', border: '1px solid #cec8be',
          borderRadius: '20px', padding: '28px 24px 22px',
          width: 'min(300px, calc(100vw - 40px))',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px',
          boxShadow: '0 20px 56px rgba(0,0,0,0.22), 0 2px 8px rgba(0,0,0,0.10)',
          fontFamily: FONT,
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Large preview */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '130px',
          background: '#fff', borderRadius: '14px', border: '1.5px solid #d6d0c8',
          width: '100%', boxShadow: '0 3px 0 #c4beb6',
        }}>
          {item.type === 'skin' && <WormBody skin={item} size={120} />}
          {item.type === 'hat' && (
            <div style={{ width: 120, height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <HatIcon hatId={item.hatId} color={ac} size={80} />
            </div>
          )}
          {item.type === 'scheme' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', width: '150px', padding: '12px' }}>
              {Object.values(COLOR_SCHEMES[item.schemeKey] || COLOR_SCHEMES.standard).slice(0, 6).map((c, i) => (
                <div key={i} style={{ aspectRatio: '1', borderRadius: '6px', background: c, boxShadow: `0 2px 6px ${c}44` }} />
              ))}
            </div>
          )}
          {item.type === 'tile' && (
            <div style={{ padding: '20px' }}>
              <TilePreviewCanvas styleKey={item.tileKey} size={90} />
            </div>
          )}
        </div>

        {/* Name + type */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '18px', fontWeight: 800, color: '#1e1612', letterSpacing: '-0.03em' }}>{item.label}</div>
          <div style={{ fontSize: '11px', color: '#9a8e82', marginTop: '3px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            {item.type === 'skin' ? 'Worm Skin' : item.type === 'hat' ? 'Hat' : item.type === 'scheme' ? 'Color Palette' : 'Tile Style'}
          </div>
        </div>

        {/* Action */}
        {owned ? (
          <button
            style={{
              ...TOUCH, width: '100%', padding: '13px', borderRadius: '10px',
              background: ac, border: 'none',
              color: '#fff', fontSize: '14px', fontWeight: 700,
              cursor: 'pointer', fontFamily: FONT,
              boxShadow: `0 3px 0 ${ac}99, 0 4px 12px ${ac}44`,
            }}
            onClick={onEquip}
          >Equip</button>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '5px' }}>
              <span style={{ fontSize: '24px', fontWeight: 900, color: canAfford ? ac : '#c4beb6', fontFamily: FONT }}>{item.price}</span>
              <span style={{ fontSize: '14px', fontWeight: 700, color: canAfford ? ac : '#c4beb6', fontFamily: FONT }}>PP</span>
              <span style={{ fontSize: '11px', color: '#9a8e82', marginLeft: '4px' }}>you have {pp}</span>
            </div>
            {canAfford ? (
              <button
                style={{
                  ...TOUCH, width: '100%', padding: '13px', borderRadius: '10px',
                  background: ac, border: 'none',
                  color: '#fff', fontSize: '14px', fontWeight: 700,
                  cursor: 'pointer', fontFamily: FONT,
                  boxShadow: `0 3px 0 ${ac}99, 0 4px 12px ${ac}44`,
                }}
                onClick={onBuy}
              >Buy — {item.price} PP</button>
            ) : (
              <div style={{
                width: '100%', padding: '12px', borderRadius: '10px', textAlign: 'center',
                background: '#fff', border: '1.5px solid #d6d0c8',
                color: '#9a8e82', fontSize: '12px', fontWeight: 600, fontFamily: FONT,
                boxShadow: '0 2px 0 #c4beb6',
              }}>
                Need {item.price - pp} more PP to unlock
              </div>
            )}
          </>
        )}

        <button
          style={{
            ...TOUCH, width: '100%', padding: '10px', borderRadius: '10px',
            background: '#f0ebe2', border: '1.5px solid #d6d0c8',
            color: '#7a6e62', fontSize: '13px', fontWeight: 600,
            cursor: 'pointer', fontFamily: FONT, boxShadow: '0 2px 0 #c4beb6',
          }}
          onClick={onClose}
        >Cancel</button>
      </div>
    </div>
  );
};

// ── Item card ─────────────────────────────────────────────────────────────────
const ItemCard = ({ item, owned, equipped, pp, onPreview, onEquip }) => {
  const ac = typeAccent(item);
  const canAfford = pp >= item.price;
  const locked = !owned;

  return (
    <div
      onClick={owned ? onEquip : onPreview}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '7px',
        padding: '12px 8px 10px',
        background: equipped ? `${ac}10` : '#ffffff',
        border: equipped ? `2px solid ${ac}` : '2px solid #d6d0c8',
        borderRadius: '12px', cursor: 'pointer', position: 'relative',
        boxShadow: equipped
          ? 'inset 0 2px 4px rgba(0,0,0,0.08)'
          : '0 3px 0 #c4beb6, 0 4px 8px rgba(0,0,0,0.06)',
        transform: equipped ? 'translateY(1px)' : 'none',
        opacity: locked && !canAfford ? 0.6 : 1,
        transition: 'all 0.15s ease',
        fontFamily: FONT,
        ...TOUCH,
      }}
    >
      {/* Equipped badge */}
      {equipped && (
        <span style={{
          position: 'absolute', top: 5, right: 5,
          fontSize: '7px', fontWeight: 800, letterSpacing: '0.08em',
          color: '#fff', background: ac,
          borderRadius: '4px', padding: '2px 5px', fontFamily: FONT,
          boxShadow: `0 1px 0 ${ac}99`,
        }}>ON</span>
      )}
      {locked && <LockBadge />}

      {/* Preview */}
      <div style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', opacity: locked ? 0.65 : 1 }}>
        {item.type === 'skin' && <WormBody skin={item} size={46} />}
        {item.type === 'hat' && (
          <div style={{ width: 46, height: 46, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <HatIcon hatId={item.hatId} color={equipped ? ac : '#9a8e82'} size={30} />
          </div>
        )}
        {item.type === 'scheme' && (
          <div style={{ width: '100%', padding: '0 2px' }}>
            <SchemeDots schemeKey={item.schemeKey} />
          </div>
        )}
        {item.type === 'tile' && <TilePreviewCanvas styleKey={item.tileKey} size={44} />}
      </div>

      {/* Label */}
      <span style={{
        fontSize: item.type === 'tile' ? '9px' : '10px',
        fontWeight: 700, letterSpacing: '0.03em',
        color: equipped ? '#1e1612' : '#7a6e62',
        fontFamily: FONT, textAlign: 'center', lineHeight: 1.2,
      }}>{item.label}</span>

      {/* Price / status */}
      {owned ? (
        <span style={{ fontSize: '9px', fontWeight: 600, color: equipped ? ac : '#9a8e82', fontFamily: FONT }}>
          {equipped ? 'Active' : 'Tap to equip'}
        </span>
      ) : (
        <div style={{
          display: 'flex', alignItems: 'baseline', gap: '2px',
          padding: '2px 7px', borderRadius: '6px',
          background: canAfford ? `${ac}14` : '#f0ebe2',
          border: `1px solid ${canAfford ? ac + '44' : '#d6d0c8'}`,
        }}>
          <span style={{ fontSize: '9px', fontWeight: 700, color: canAfford ? ac : '#9a8e82', fontFamily: FONT }}>PP</span>
          <span style={{ fontSize: '11px', fontWeight: 800, color: canAfford ? ac : '#9a8e82', fontFamily: FONT }}>{item.price}</span>
        </div>
      )}
    </div>
  );
};

// ── Tile category section ─────────────────────────────────────────────────────
const TileSection = ({ label, items, renderItems }) => items.length === 0 ? null : (
  <div style={{ marginBottom: '20px' }}>
    <div style={{
      fontSize: '10px', fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase',
      color: '#9a8e82', fontFamily: FONT, marginBottom: '8px', paddingBottom: '6px',
      borderBottom: '1px solid #e8e2d8',
    }}>{label}</div>
    {renderItems(items)}
  </div>
);

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

  const renderItems = (items) => (
    <div style={{
      display: 'grid',
      gridTemplateColumns: `repeat(auto-fill, minmax(${tab === 'tiles' ? '88px' : '100px'}, 1fr))`,
      gap: '8px',
    }}>
      {items.map(item => {
        const owned = ownedItems.includes(item.id);
        return (
          <ItemCard
            key={item.id} item={item}
            owned={owned} equipped={isEquipped(item)} pp={parityPoints}
            onPreview={() => setPreviewItem(item)}
            onEquip={() => { equip(item); showToast(`${item.label} applied`); }}
          />
        );
      })}
    </div>
  );

  const activeTabAccent = TABS.find(t => t.id === tab)?.accent || ACCENT;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 99999,
      display: 'flex', flexDirection: 'column',
      background: '#f5f0e8',
      fontFamily: FONT,
      pointerEvents: 'auto',
    }}>

      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '20px 20px 0', flexShrink: 0,
      }}>
        <div>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            background: ACCENT, borderRadius: '6px', padding: '4px 12px',
            marginBottom: '8px', boxShadow: `0 2px 0 ${ACCENT_SHADOW}`,
          }}>
            <span style={{ fontSize: '11px' }}>🪙</span>
            <span style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#fff' }}>Parity Store</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span style={{ fontSize: '28px', fontWeight: 900, color: '#1e1612', letterSpacing: '-0.04em', lineHeight: 1 }}>Your Collection</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
          {/* PP balance */}
          <div style={{
            padding: '8px 14px', borderRadius: '12px',
            background: '#fff', border: '1.5px solid #d6d0c8',
            boxShadow: '0 3px 0 #c4beb6',
            textAlign: 'right',
          }}>
            <div style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#9a8e82' }}>Balance</div>
            <div style={{ fontSize: '20px', fontWeight: 900, color: ACCENT, letterSpacing: '-0.03em' }}>
              {parityPoints} <span style={{ fontSize: '12px', fontWeight: 700, color: '#9a8e82' }}>PP</span>
            </div>
          </div>

          {/* Close */}
          <button
            onPointerDown={onClose}
            style={{
              ...TOUCH, width: 40, height: 40, borderRadius: '12px',
              background: '#fff', border: '1.5px solid #d6d0c8',
              color: '#7a6e62', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 2px 0 #c4beb6', fontFamily: FONT,
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '6px', padding: '16px 20px 0', flexShrink: 0, overflowX: 'auto' }}>
        {TABS.map(t => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onPointerDown={() => setTab(t.id)}
              style={{
                ...TOUCH,
                padding: '8px 18px', borderRadius: '10px', cursor: 'pointer',
                background: active ? '#fff' : 'transparent',
                border: active ? `2px solid ${t.accent}` : '2px solid #d6d0c8',
                color: active ? t.accent : '#7a6e62',
                fontSize: '12px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
                fontFamily: FONT, whiteSpace: 'nowrap',
                boxShadow: active ? `inset 0 2px 4px rgba(0,0,0,0.06)` : '0 2px 0 #c4beb6',
                transform: active ? 'translateY(1px)' : 'none',
                transition: 'all 0.15s ease',
              }}
            >{t.label}</button>
          );
        })}
      </div>

      {/* Divider */}
      <div style={{ margin: '14px 20px 0', borderTop: '1px solid #d6d0c8', flexShrink: 0 }} />

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 20px 16px', scrollbarWidth: 'thin', scrollbarColor: '#c4beb6 transparent' }}>
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

      {/* Footer hint */}
      <div style={{
        padding: '10px 20px 18px', textAlign: 'center',
        borderTop: '1px solid #d6d0c8', flexShrink: 0,
        background: '#ede8df',
      }}>
        <span style={{ fontSize: '11px', color: '#9a8e82', fontFamily: FONT }}>
          Earn PP by collecting orbs in Worm mode and winning Disparity bets
        </span>
      </div>

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: '80px', left: '50%', transform: 'translateX(-50%)',
          background: '#f5f0e8', border: `1.5px solid ${toast.ok ? activeTabAccent : '#c44b00'}`,
          borderRadius: '12px', padding: '10px 20px',
          color: toast.ok ? activeTabAccent : '#c44b00',
          fontSize: '13px', fontWeight: 700, fontFamily: FONT,
          boxShadow: '0 4px 20px rgba(0,0,0,0.14)',
          pointerEvents: 'none', zIndex: 900,
        }}>
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
