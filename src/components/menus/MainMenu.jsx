import React from 'react';

const MainMenu = ({ onStart }) => {
  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      background: 'linear-gradient(135deg, #f5f1e8, #e8dcc8)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 2000
    }}>
      <div style={{
        textAlign: 'center',
        maxWidth: '650px',
        padding: '48px',
        background: '#fdfbf7',
        borderRadius: '8px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
        border: '1px solid #d4c5a9'
      }}>
        <h1 style={{
          fontSize: '56px',
          fontWeight: 600,
          margin: '0 0 12px 0',
          color: '#6b4423',
          fontFamily: 'Georgia, serif',
          letterSpacing: '1px'
        }}>WORM^3</h1>

        <p style={{
          fontSize: '18px',
          color: '#8b6f47',
          marginBottom: '32px',
          lineHeight: 1.7,
          fontFamily: 'Georgia, serif',
          fontStyle: 'italic'
        }}>
          An Interactive Journey into Topology
        </p>

        <div style={{
          background: '#f9f5ed',
          border: '2px solid #d4c5a9',
          borderRadius: '6px',
          padding: '28px',
          marginBottom: '36px',
          textAlign: 'left',
          fontSize: '15px',
          lineHeight: 1.9,
          color: '#5a4a3a'
        }}>
          <p style={{ margin: '0 0 16px 0' }}>
            Welcome! This puzzle helps you explore <strong style={{ color: '#8b6f47' }}>quotient spaces</strong> –
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
          background: 'linear-gradient(135deg, #c19a6b, #a67c52)',
          border: '2px solid #8b6f47',
          color: '#fdfbf7',
          fontSize: '20px',
          fontWeight: 600,
          padding: '16px 48px',
          borderRadius: '6px',
          cursor: 'pointer',
          boxShadow: '0 3px 12px rgba(107,68,35,0.2)',
          transition: 'all 0.2s',
          fontFamily: 'Georgia, serif'
        }}
        onMouseEnter={e => {
          e.target.style.transform = 'translateY(-2px)';
          e.target.style.boxShadow = '0 6px 20px rgba(107,68,35,0.3)';
        }}
        onMouseLeave={e => {
          e.target.style.transform = 'translateY(0)';
          e.target.style.boxShadow = '0 3px 12px rgba(107,68,35,0.2)';
        }}>
          Begin Learning
        </button>

        <div style={{
          marginTop: '32px',
          fontSize: '13px',
          color: '#9b8b7a',
          fontStyle: 'italic'
        }}>
          Press <strong style={{ color: '#6b4423' }}>H</strong> anytime to see helpful controls
        </div>
      </div>
    </div>
  );
};

export default MainMenu;
