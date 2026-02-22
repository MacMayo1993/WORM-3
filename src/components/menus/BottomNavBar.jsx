import React from 'react';

/**
 * BottomNavBar - Material Design 5-icon bottom navigation
 *
 * Reset | Shuffle | Solve/Teach (central) | Views | More
 */
const BottomNavBar = ({
  onReset,
  onShuffle,
  solveModeActive,
  teachModeActive,
  onToggleSolve,
  onToggleTeach,
  hasActiveView,
  onToggleViews,
  onToggleMore,
  moreOpen,
  viewsOpen
}) => {
  // Central button cycles: normal -> solve -> teach -> normal
  const centralState = solveModeActive ? 'solve' : teachModeActive ? 'teach' : 'idle';
  const centralColor = centralState === 'solve' ? '#2196F3' : centralState === 'teach' ? '#fbbf24' : '#2196F3';

  const handleCentralTap = () => {
    if (centralState === 'idle') {
      onToggleSolve();
    } else if (centralState === 'solve') {
      onToggleSolve(); // turn off solve
      onToggleTeach(); // turn on teach
    } else {
      onToggleTeach(); // turn off teach
    }
  };

  return (
    <div className="bottom-nav-bar">
      {/* Reset */}
      <button className="bottom-nav-item" onClick={onReset} title="Reset (R)">
        <svg className="bottom-nav-icon" viewBox="0 0 24 24" fill="none" stroke="#F44336" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="1 4 1 10 7 10" />
          <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
        </svg>
        <span className="bottom-nav-label" style={{ color: '#F44336' }}>Reset</span>
      </button>

      {/* Shuffle */}
      <button className="bottom-nav-item" onClick={onShuffle} title="Shuffle (S)">
        <svg className="bottom-nav-icon" viewBox="0 0 24 24" fill="none" stroke="#4CAF50" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="16 3 21 3 21 8" />
          <line x1="4" y1="20" x2="21" y2="3" />
          <polyline points="21 16 21 21 16 21" />
          <line x1="15" y1="15" x2="21" y2="21" />
          <line x1="4" y1="4" x2="9" y2="9" />
        </svg>
        <span className="bottom-nav-label" style={{ color: '#4CAF50' }}>Shuffle</span>
      </button>

      {/* Central: Solve / Teach toggle */}
      <button
        className={`bottom-nav-item bottom-nav-central ${centralState !== 'idle' ? 'active' : ''}`}
        onClick={handleCentralTap}
        title={centralState === 'idle' ? 'Solve mode' : centralState === 'solve' ? 'Switch to Teach' : 'Exit Teach'}
      >
        <div className="bottom-nav-central-ring" style={{ borderColor: centralColor }}>
          {centralState === 'teach' ? (
            // Book icon for teach
            <svg className="bottom-nav-icon-lg" viewBox="0 0 24 24" fill="none" stroke={centralColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
              <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
            </svg>
          ) : (
            // Robot/CPU icon for solve
            <svg className="bottom-nav-icon-lg" viewBox="0 0 24 24" fill="none" stroke={centralColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="4" y="4" width="16" height="16" rx="2" />
              <rect x="9" y="9" width="6" height="6" />
              <line x1="9" y1="1" x2="9" y2="4" />
              <line x1="15" y1="1" x2="15" y2="4" />
              <line x1="9" y1="20" x2="9" y2="23" />
              <line x1="15" y1="20" x2="15" y2="23" />
              <line x1="20" y1="9" x2="23" y2="9" />
              <line x1="20" y1="14" x2="23" y2="14" />
              <line x1="1" y1="9" x2="4" y2="9" />
              <line x1="1" y1="14" x2="4" y2="14" />
            </svg>
          )}
        </div>
        <span className="bottom-nav-label" style={{ color: centralColor }}>
          {centralState === 'idle' ? 'Solve' : centralState === 'solve' ? 'Solve' : 'Teach'}
        </span>
      </button>

      {/* Views */}
      <button
        className={`bottom-nav-item ${viewsOpen ? 'active' : ''}`}
        onClick={onToggleViews}
        title="Views"
      >
        <svg className="bottom-nav-icon" viewBox="0 0 24 24" fill="none" stroke={hasActiveView || viewsOpen ? '#FF9800' : 'rgba(255,255,255,0.6)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
          <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
          <line x1="12" y1="22.08" x2="12" y2="12" />
        </svg>
        <span className="bottom-nav-label" style={{ color: hasActiveView || viewsOpen ? '#FF9800' : undefined }}>Views</span>
      </button>

      {/* More */}
      <button
        className={`bottom-nav-item ${moreOpen ? 'active' : ''}`}
        onClick={onToggleMore}
        title="More options"
      >
        <svg className="bottom-nav-icon" viewBox="0 0 24 24" fill="none" stroke={moreOpen ? '#fff' : 'rgba(255,255,255,0.6)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="1" />
          <circle cx="12" cy="5" r="1" />
          <circle cx="12" cy="19" r="1" />
        </svg>
        <span className="bottom-nav-label">More</span>
      </button>
    </div>
  );
};

export default BottomNavBar;
