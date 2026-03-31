import React, { useState } from 'react';
import { useGameStore } from '../../hooks/useGameStore.js';
import { useShallow } from 'zustand/react/shallow';
import { getSkins, getHats } from '../../utils/storeCatalog.js';

const FONT = "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', system-ui, sans-serif";
const TOUCH_BTN = { touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' };

const SKINS = getSkins();
const HATS = getHats();

// ── Skin preview circle ───────────────────────────────────────────────────────
const SkinSwatch = ({ skin, size = 48 }) => (
  <svg width={size} height={size} viewBox="0 0 48 48">
    {/* Glow */}
    <circle cx="24" cy="24" r="20" fill={skin.glow} opacity="0.18" />
    {/* Body */}
    <circle cx="24" cy="24" r="16" fill={skin.body} />
    {/* Belly highlight */}
    <ellipse cx="24" cy="27" rx="8" ry="6" fill={skin.belly} opacity="0.7" />
    {/* Eyes */}
    <circle cx="20" cy="20" r="2.5" fill="white" />
    <circle cx="28" cy="20" r="2.5" fill="white" />
    <circle cx="21" cy="20" r="1.2" fill="#1a1a2e" />
    <circle cx="29" cy="20" r="1.2" fill="#1a1a2e" />
  </svg>
);

// ── Hat icon ──────────────────────────────────────────────────────────────────
const HatIcon = ({ hatId, color = '#e2e8f0', size = 32 }) => {
  if (hatId === 'none') {
    return (
      <svg width={size} height={size} viewBox="0 0 32 32">
        <circle cx="16" cy="16" r="12" stroke={color} strokeWidth="1.5" fill="none" strokeDasharray="4 3" opacity="0.5" />
        <line x1="10" y1="10" x2="22" y2="22" stroke={color} strokeWidth="1.5" opacity="0.4" />
      </svg>
    );
  }
  if (hatId === 'tophat') {
    return (
      <svg width={size} height={size} viewBox="0 0 32 32">
        <rect x="8" y="8" width="16" height="14" rx="1" fill={color} />
        <rect x="4" y="21" width="24" height="4" rx="2" fill={color} />
        <rect x="10" y="10" width="12" height="10" rx="1" fill="rgba(0,0,0,0.3)" />
      </svg>
    );
  }
  if (hatId === 'party') {
    return (
      <svg width={size} height={size} viewBox="0 0 32 32">
        <polygon points="16,4 6,26 26,26" fill={color} />
        <line x1="16" y1="4" x2="16" y2="26" stroke="rgba(0,0,0,0.2)" strokeWidth="1" />
        <circle cx="9" cy="20" r="1.5" fill="#f59e0b" />
        <circle cx="20" cy="15" r="1.5" fill="#ec4899" />
        <circle cx="14" cy="22" r="1.5" fill="#06b6d4" />
      </svg>
    );
  }
  if (hatId === 'crown') {
    return (
      <svg width={size} height={size} viewBox="0 0 32 32">
        <polygon points="4,22 4,12 10,18 16,8 22,18 28,12 28,22" fill={color} />
        <rect x="4" y="22" width="24" height="4" rx="1" fill={color} />
        <circle cx="16" cy="9" r="2" fill="#f59e0b" />
        <circle cx="6" cy="13" r="1.5" fill="#f59e0b" />
        <circle cx="26" cy="13" r="1.5" fill="#f59e0b" />
      </svg>
    );
  }
  if (hatId === 'halo') {
    return (
      <svg width={size} height={size} viewBox="0 0 32 32">
        <ellipse cx="16" cy="13" rx="12" ry="4" fill="none" stroke={color} strokeWidth="2.5" />
        <ellipse cx="16" cy="13" rx="12" ry="4" fill={color} opacity="0.15" />
        <ellipse cx="16" cy="13" rx="12" ry="4" fill="none" stroke={color} strokeWidth="1" opacity="0.4" />
      </svg>
    );
  }
  return null;
};

// ── Item card ─────────────────────────────────────────────────────────────────
const ItemCard = ({ item, owned, equipped, pp, onBuy, onEquip }) => {
  const canAfford = pp >= item.price;
  const accentColor = item.type === 'skin' ? (item.glow || '#00ff88') : '#6366f1';

  const statusColor = equipped
    ? '#00ff88'
    : owned
    ? 'rgba(180,210,255,0.7)'
    : canAfford
    ? accentColor
    : 'rgba(120,140,180,0.5)';

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px',
      padding: '14px 10px 12px',
      background: equipped
        ? `rgba(0,255,136,0.08)`
        : owned
        ? 'rgba(255,255,255,0.04)'
        : 'rgba(255,255,255,0.025)',
      border: equipped
        ? '1.5px solid rgba(0,255,136,0.45)'
        : owned
        ? '1px solid rgba(120,160,255,0.2)'
        : '1px solid rgba(120,160,255,0.1)',
      borderRadius: '14px',
      transition: 'all 0.18s ease',
      position: 'relative',
      cursor: owned ? 'pointer' : canAfford ? 'pointer' : 'default',
    }}
    onClick={owned ? onEquip : canAfford ? onBuy : undefined}
    >
      {/* Equipped badge */}
      {equipped && (
        <span style={{
          position: 'absolute', top: '6px', right: '6px',
          fontSize: '8px', fontWeight: 800, letterSpacing: '0.1em',
          color: '#00ff88', background: 'rgba(0,255,136,0.15)',
          border: '1px solid rgba(0,255,136,0.4)',
          borderRadius: '4px', padding: '1px 5px',
          fontFamily: FONT,
        }}>ON</span>
      )}

      {/* Preview */}
      <div style={{ lineHeight: 1 }}>
        {item.type === 'skin' ? (
          <SkinSwatch skin={item} size={52} />
        ) : (
          <div style={{
            width: 52, height: 52, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: equipped ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.04)',
            borderRadius: '50%',
          }}>
            <HatIcon hatId={item.hatId} color={equipped ? '#a5b4fc' : owned ? '#94a3b8' : 'rgba(120,140,180,0.4)'} size={34} />
          </div>
        )}
      </div>

      {/* Label */}
      <span style={{
        fontSize: '11px', fontWeight: 700, letterSpacing: '0.06em',
        color: equipped ? '#e0fff0' : owned ? 'rgba(200,220,255,0.9)' : 'rgba(150,170,220,0.65)',
        fontFamily: FONT, textAlign: 'center',
      }}>{item.label}</span>

      {/* Price / action */}
      {owned ? (
        <span style={{
          fontSize: '10px', fontWeight: 600,
          color: equipped ? '#00ff88' : 'rgba(140,170,220,0.55)',
          fontFamily: FONT,
        }}>{equipped ? 'Equipped' : 'Tap to equip'}</span>
      ) : (
        <button
          onPointerDown={e => { e.stopPropagation(); onBuy(); }}
          disabled={!canAfford}
          style={{
            ...TOUCH_BTN,
            display: 'flex', alignItems: 'center', gap: '4px',
            padding: '4px 10px', borderRadius: '8px', border: 'none', cursor: canAfford ? 'pointer' : 'not-allowed',
            background: canAfford ? `${accentColor}22` : 'rgba(255,255,255,0.04)',
            color: statusColor, fontFamily: FONT, fontSize: '11px', fontWeight: 700,
          }}
        >
          <span style={{ fontSize: '10px', opacity: 0.75 }}>PP</span>
          {item.price}
        </button>
      )}
    </div>
  );
};

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

  const [toast, setToast] = useState(null);

  const showToast = (msg, color = '#00ff88') => {
    setToast({ msg, color });
    setTimeout(() => setToast(null), 1800);
  };

  const handleBuy = (item) => {
    if (ownedItems.includes(item.id)) {
      // equip directly
      if (item.type === 'skin') setWormSkin(item.skinId);
      else setWormHat(item.hatId);
      return;
    }
    const ok = buyItem(item.id, item.price);
    if (!ok) {
      showToast(`Need ${item.price - parityPoints} more PP`, '#f97316');
      return;
    }
    // auto-equip on purchase
    if (item.type === 'skin') setWormSkin(item.skinId);
    else setWormHat(item.hatId);
    showToast(`${item.label} unlocked!`);
  };

  const handleEquip = (item) => {
    if (item.type === 'skin') setWormSkin(item.skinId);
    else setWormHat(item.hatId);
    showToast(`${item.label} equipped`);
  };

  const items = tab === 'skins' ? SKINS : HATS;

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
          {/* Store icon */}
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <rect x="3" y="10" width="18" height="11" rx="2" stroke="#6366f1" strokeWidth="1.5" fill="none" />
            <path d="M7 10V7a5 5 0 0 1 10 0v3" stroke="#6366f1" strokeWidth="1.5" strokeLinecap="round" fill="none" />
          </svg>
          <span style={{
            fontSize: '16px', fontWeight: 700, letterSpacing: '0.12em',
            textTransform: 'uppercase', color: '#a5b4fc', fontFamily: FONT,
          }}>Parity Store</span>
        </div>

        {/* PP balance */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            display: 'flex', alignItems: 'baseline', gap: '4px',
            background: 'rgba(99,102,241,0.12)',
            border: '1px solid rgba(99,102,241,0.3)',
            borderRadius: '10px', padding: '4px 12px',
          }}>
            <span style={{ fontSize: '10px', fontWeight: 700, color: '#818cf8', fontFamily: FONT }}>PP</span>
            <span style={{ fontSize: '18px', fontWeight: 800, color: '#e0e7ff', fontFamily: FONT }}>{parityPoints}</span>
          </div>
          <button
            onPointerDown={onClose}
            style={{
              ...TOUCH_BTN,
              width: 36, height: 36, borderRadius: '50%',
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
              color: 'rgba(200,220,255,0.7)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex', gap: '4px', padding: '12px 20px 0',
        flexShrink: 0,
      }}>
        {['skins', 'hats'].map(t => (
          <button
            key={t}
            onPointerDown={() => setTab(t)}
            style={{
              ...TOUCH_BTN,
              padding: '8px 20px', borderRadius: '10px', cursor: 'pointer',
              background: tab === t ? 'rgba(99,102,241,0.25)' : 'rgba(255,255,255,0.04)',
              color: tab === t ? '#a5b4fc' : 'rgba(150,170,220,0.55)',
              fontSize: '12px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
              fontFamily: FONT,
              border: tab === t ? '1px solid rgba(99,102,241,0.4)' : '1px solid transparent',
              transition: 'all 0.15s ease',
            }}
          >
            {t === 'skins' ? 'Skins' : 'Hats'}
          </button>
        ))}
      </div>

      {/* Grid */}
      <div style={{
        flex: 1, overflowY: 'auto', padding: '16px 20px 20px',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))',
        gap: '10px',
        alignContent: 'start',
      }}>
        {items.map(item => {
          const owned = ownedItems.includes(item.id);
          const equipped = item.type === 'skin' ? wormSkin === item.skinId : wormHat === item.hatId;
          return (
            <ItemCard
              key={item.id}
              item={item}
              owned={owned}
              equipped={equipped}
              pp={parityPoints}
              onBuy={() => handleBuy(item)}
              onEquip={() => handleEquip(item)}
            />
          );
        })}
      </div>

      {/* Earn hint */}
      <div style={{
        padding: '10px 20px 16px',
        textAlign: 'center',
        borderTop: '1px solid rgba(99,102,241,0.12)',
        flexShrink: 0,
      }}>
        <span style={{
          fontSize: '11px', color: 'rgba(140,170,220,0.5)',
          fontFamily: FONT, lineHeight: 1.5,
        }}>
          Earn PP by collecting orbs in Worm mode and playing Disparity
        </span>
      </div>

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: '80px', left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(8,12,32,0.95)',
          border: `1px solid ${toast.color}60`,
          borderRadius: '12px', padding: '10px 20px',
          color: toast.color, fontSize: '13px', fontWeight: 600, fontFamily: FONT,
          boxShadow: `0 4px 20px rgba(0,0,0,0.5)`,
          pointerEvents: 'none', zIndex: 900,
          animation: 'fadeIn 0.2s ease',
        }}>
          {toast.msg}
        </div>
      )}
    </div>
  );
};

export default ParityStoreScreen;
