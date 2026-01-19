import React from 'react';

const SettingsMenu = ({ onClose, settings, onSettingsChange }) => {
  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(245,241,232,0.92)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      backdropFilter: 'blur(4px)'
    }} onClick={onClose}>
      <div style={{
        background: '#fdfbf7',
        border: '2px solid #d4c5a9',
        borderRadius: '8px',
        padding: '32px',
        maxWidth: '500px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.08)'
      }} onClick={e => e.stopPropagation()}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '24px'
        }}>
          <h2 style={{
            margin: 0,
            fontSize: '28px',
            fontWeight: 600,
            color: '#6b4423',
            fontFamily: 'Georgia, serif'
          }}>Settings</h2>
          <button onClick={onClose} style={{
            background: '#e8dcc8',
            border: '1px solid #d4c5a9',
            color: '#6b4423',
            fontSize: '24px',
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s'
          }}>×</button>
        </div>

        <div style={{ color: '#5a4a3a' }}>
          <div style={{
            padding: '16px',
            background: '#f9f5ed',
            borderRadius: '6px',
            marginBottom: '16px',
            border: '2px solid #e8dcc8'
          }}>
            <p style={{ margin: 0, fontSize: '14px', fontStyle: 'italic', color: '#8b6f47', fontFamily: 'Georgia, serif' }}>
              More customization options are on the way! We're adding features like sound, animation controls, and color themes.
            </p>
          </div>

          <div style={{ fontSize: '14px', lineHeight: 2, fontFamily: 'Georgia, serif' }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '12px',
              background: '#f9f5ed',
              borderRadius: '6px',
              marginBottom: '8px'
            }}>
              <span>🔊 Sound Effects</span>
              <span style={{ color: '#a89178', fontSize: '13px' }}>Coming Soon</span>
            </div>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '12px',
              background: '#f9f5ed',
              borderRadius: '6px',
              marginBottom: '8px'
            }}>
              <span>⚡ Animation Speed</span>
              <span style={{ color: '#a89178', fontSize: '13px' }}>Coming Soon</span>
            </div>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '12px',
              background: '#f9f5ed',
              borderRadius: '6px',
              marginBottom: '8px'
            }}>
              <span>💾 Auto-Save Progress</span>
              <span style={{ color: '#a89178', fontSize: '13px' }}>Coming Soon</span>
            </div>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '12px',
              background: '#f9f5ed',
              borderRadius: '6px'
            }}>
              <span>🎨 Custom Colors</span>
              <span style={{ color: '#a89178', fontSize: '13px' }}>Coming Soon</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsMenu;
