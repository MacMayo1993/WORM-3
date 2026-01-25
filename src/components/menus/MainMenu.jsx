import React from 'react';

const MainMenu = ({ onStart }) => {
  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      height: '100dvh',
      background: 'rgba(0, 0, 0, 0.85)',
      backdropFilter: 'blur(20px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 2000,
      padding: 'env(safe-area-inset-top, 0px) env(safe-area-inset-right, 0px) env(safe-area-inset-bottom, 0px) env(safe-area-inset-left, 0px)',
      boxSizing: 'border-box'
    }}>
      <div style={{
        textAlign: 'center',
        maxWidth: '650px',
        width: '90%',
        padding: '48px',
        maxHeight: 'calc(100dvh - 60px - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px))',
        overflowY: 'auto',
        background: 'rgba(30, 35, 50, 0.95)',
        borderRadius: '16px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        boxSizing: 'border-box'
      }}>
        <h1 style={{
          fontSize: '72px',
          fontWeight: 700,
          margin: '0 0 12px 0',
          background: 'linear-gradient(135deg, #3b82f6 0%, #60a5fa 50%, #93c5fd 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          fontFamily: '"Product Sans", "Google Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          letterSpacing: '0.05em',
          filter: 'drop-shadow(0 4px 12px rgba(59, 130, 246, 0.4))'
        }}>WORM³</h1>

        <p style={{
          fontSize: '18px',
          color: 'rgba(255, 255, 255, 0.8)',
          marginBottom: '32px',
          lineHeight: 1.7,
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          fontStyle: 'normal'
        }}>
          An Interactive Journey into Topology
        </p>

        <div style={{
          background: 'rgba(59, 130, 246, 0.08)',
          border: '1px solid rgba(59, 130, 246, 0.2)',
          borderRadius: '12px',
          padding: '28px',
          marginBottom: '36px',
          textAlign: 'left',
          fontSize: '15px',
          lineHeight: 1.9,
          color: 'rgba(255, 255, 255, 0.9)',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
        }}>
          <p style={{ margin: '0 0 16px 0' }}>
            Welcome! This puzzle helps you explore <strong style={{ color: '#60a5fa' }}>quotient spaces</strong> –
            a beautiful concept from topology where we identify opposite points as the same.
          </p>
          <p style={{ margin: '0 0 16px 0' }}>
            Think of it like this: if you could walk far enough in one direction, you'd find yourself
            coming back from the opposite side, but flipped! The colorful tunnels help you visualize
            these special connections.
          </p>
          <p style={{ margin: '0' }}>
            Don't worry if it sounds complex – learning happens through play. Click, drag, and discover!
          </p>
        </div>

        <button onClick={onStart} style={{
          background: 'rgba(59, 130, 246, 0.85)',
          border: '1px solid rgba(96, 165, 250, 0.5)',
          color: '#ffffff',
          fontSize: '20px',
          fontWeight: 600,
          padding: '16px 48px',
          borderRadius: '12px',
          cursor: 'pointer',
          boxShadow: '0 4px 16px rgba(59, 130, 246, 0.4)',
          transition: 'all 0.2s',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
        }}
        onMouseEnter={e => {
          e.target.style.transform = 'translateY(-2px)';
          e.target.style.boxShadow = '0 8px 24px rgba(59, 130, 246, 0.6)';
          e.target.style.background = 'rgba(59, 130, 246, 0.95)';
        }}
        onMouseLeave={e => {
          e.target.style.transform = 'translateY(0)';
          e.target.style.boxShadow = '0 4px 16px rgba(59, 130, 246, 0.4)';
          e.target.style.background = 'rgba(59, 130, 246, 0.85)';
        }}>
          Begin Learning
        </button>

        <div style={{
          marginTop: '32px',
          fontSize: '13px',
          color: 'rgba(255, 255, 255, 0.6)',
          fontStyle: 'normal',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
        }}>
          Press <strong style={{ color: '#60a5fa' }}>H</strong> anytime to see helpful controls
        </div>
      </div>
    </div>
  );
};

export default MainMenu;
