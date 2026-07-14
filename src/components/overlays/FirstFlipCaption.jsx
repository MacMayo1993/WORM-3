import React, { useEffect, useState } from 'react';
import { useGameStore } from '../../hooks/useGameStore.js';
import { UI_FONT } from '../../utils/uiTheme.js';

const FirstFlipCaption = () => {
  const show = useGameStore((s) => s.showFirstFlipCaption);
  const [visible, setVisible] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (!show) return;
    setMounted(true);
    requestAnimationFrame(() => setVisible(true));
    const fadeOut = setTimeout(() => setVisible(false), 2400);
    const unmount = setTimeout(() => {
      setMounted(false);
      useGameStore.getState().setShowFirstFlipCaption(false);
    }, 3200);
    return () => { clearTimeout(fadeOut); clearTimeout(unmount); };
  }, [show]);

  if (!mounted) return null;

  return (
    <div style={{
      position: 'fixed',
      top: '38%',
      left: 0,
      right: 0,
      display: 'flex',
      justifyContent: 'center',
      zIndex: 9000,
      pointerEvents: 'none',
    }}>
      <div style={{
        fontFamily: UI_FONT,
        fontSize: 20,
        fontWeight: 700,
        color: '#fff',
        letterSpacing: '0.06em',
        textAlign: 'center',
        padding: '12px 32px',
        background: 'rgba(4,6,20,0.70)',
        borderRadius: 14,
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(255,255,255,0.12)',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(12px)',
        transition: 'opacity 0.6s ease, transform 0.6s cubic-bezier(0.22,1,0.36,1)',
      }}>
        One flip. Two linked tiles.
      </div>
    </div>
  );
};

export default FirstFlipCaption;
