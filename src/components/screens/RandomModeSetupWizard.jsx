import React, { useState } from 'react';
import { BACKGROUNDS, getBackgroundUrl } from '../../utils/backgrounds.js';

const BG_PREVIEWS = {
  blackhole: 'radial-gradient(circle, #1a0033 0%, #000000 100%)',
  cave: 'linear-gradient(135deg, #3d2817 0%, #1a120a 100%)',
  beach: 'linear-gradient(180deg, #87ceeb 0%, #f4e4c1 70%, #c2b280 100%)',
  forest: 'linear-gradient(180deg, #6b8e23 0%, #2d5016 50%, #1a2f0f 100%)',
  park: 'linear-gradient(180deg, #a8d5ba 0%, #7cb89d 50%, #4a7c59 100%)',
  night: 'linear-gradient(180deg, #0f0f23 0%, #1a1a3e 50%, #050510 100%)',
  city: 'linear-gradient(180deg, #4a5568 0%, #2d3748 50%, #1a202c 100%)',
  apartment: 'linear-gradient(135deg, #f5f5dc 0%, #deb887 50%, #cd853f 100%)',
  lobby: 'linear-gradient(135deg, #e8e8e8 0%, #b8b8b8 50%, #707070 100%)',
  warehouse: 'linear-gradient(180deg, #6e6e6e 0%, #4a4a4a 50%, #2c2c2c 100%)',
  studio: 'linear-gradient(180deg, #ffffff 0%, #f0f0f0 50%, #d0d0d0 100%)',
  dark: 'linear-gradient(135deg, #1a1a1a 0%, #0a0a0a 100%)',
  midnight: 'linear-gradient(135deg, #191970 0%, #0c0c38 100%)',
  cobblestone: 'linear-gradient(135deg, #8b8b8b 0%, #555555 100%)',
  desert: 'linear-gradient(180deg, #edc9af 0%, #d2b48c 100%)',
  fireplace: 'linear-gradient(135deg, #5c2c2c 0%, #2a1a1a 100%)',
  lounge: 'linear-gradient(135deg, #4a3b2a 0%, #2a221a 100%)',
  paris: 'linear-gradient(180deg, #aaddff 0%, #dceeff 100%)',
  shanghai: 'linear-gradient(180deg, #1a2a6c 0%, #b21f1f 100%)',
  snow: 'linear-gradient(180deg, #eef7ff 0%, #cceeff 100%)',
  stadium: 'linear-gradient(180deg, #3a7bd5 0%, #3a6073 100%)',
  sunset: 'linear-gradient(180deg, #ff7e5f 0%, #feb47b 100%)',
  umbrella: 'linear-gradient(135deg, #ff9966 0%, #ff5e62 100%)',
};

const BG_OPTIONS = BACKGROUNDS.map(bg => ({
  value: bg.id,
  label: bg.label,
  thumbnail: bg.thumbnail ? getBackgroundUrl(bg.thumbnail) : null,
  gradient: BG_PREVIEWS[bg.id] || 'linear-gradient(135deg, #333 0%, #000 100%)',
}));

const SIZES = [
  { n: 2, name: '2×2×2', tag: 'Mini',    desc: 'Fast & approachable' },
  { n: 3, name: '3×3×3', tag: 'Classic', desc: 'The original challenge' },
  { n: 4, name: '4×4×4', tag: 'Master',  desc: 'Expert territory' },
  { n: 5, name: '5×5×5', tag: 'Ultra',   desc: '150 stickers of chaos' },
  { n: 6, name: '6×6×6', tag: 'Mega',    desc: '216 stickers of madness' },
  { n: 7, name: '7×7×7', tag: 'Titan',   desc: '294 stickers of insanity' },
];

const S = {
  overlay: {
    position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'rgba(8,10,22,0.72)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
    zIndex: 1000, fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", sans-serif',
    animation: 'modalBackdropIn 0.22s ease',
  },
  sheet: {
    background: 'rgba(14,17,38,0.94)', borderRadius: '24px', width: 'min(560px, 96vw)',
    maxHeight: '88vh', display: 'flex', flexDirection: 'column', overflow: 'hidden',
    boxShadow: '0 32px 80px rgba(0,0,0,0.60), 0 0 0 1px rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.06)', animation: 'modalSheetIn 0.30s cubic-bezier(0.22, 1, 0.36, 1)',
  },
  header: { padding: '28px 32px 0', flexShrink: 0 },
  dot: (active, current) => ({
    height: '3px', borderRadius: '2px',
    background: current ? '#f97316' : active ? 'rgba(249,115,22,0.50)' : 'rgba(255,255,255,0.15)',
    flex: current ? '2' : '1', transition: 'all 0.35s cubic-bezier(0.4,0,0.2,1)',
  }),
  title: { fontSize: '22px', fontWeight: '700', letterSpacing: '-0.5px', color: '#e8edf8', margin: '0 0 4px', lineHeight: 1.15 },
  subtitle: { fontSize: '13px', color: 'rgba(200,220,255,0.65)', margin: '0 0 16px', fontWeight: '400' },
  body: { padding: '0 32px', overflowY: 'auto', flex: 1, scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.15) transparent' },
  bgGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', paddingBottom: '8px' },
  bgCard: (selected) => ({
    borderRadius: '12px', overflow: 'hidden',
    border: selected ? '2.5px solid #f97316' : '2.5px solid transparent',
    cursor: 'pointer', transition: 'all 0.18s ease', outline: 'none', position: 'relative',
    aspectRatio: '4/3', WebkitTapHighlightColor: 'transparent',
  }),
  bgLabel: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    padding: '18px 8px 7px', background: 'linear-gradient(to top, rgba(0,0,0,0.72) 0%, transparent 100%)',
    fontSize: '10px', fontWeight: '500', color: '#fff', textAlign: 'center',
  },
  sizeCard: (selected) => ({
    display: 'flex', flexDirection: 'column', gap: '10px', padding: '14px 14px',
    borderRadius: '14px',
    border: selected ? '2px solid rgba(249,115,22,0.65)' : '2px solid rgba(255,255,255,0.08)',
    background: selected ? 'rgba(249,115,22,0.14)' : 'rgba(255,255,255,0.05)',
    boxShadow: selected ? '0 0 14px rgba(249,115,22,0.22)' : 'none',
    cursor: 'pointer', transition: 'all 0.18s ease', outline: 'none',
    WebkitTapHighlightColor: 'transparent', textAlign: 'left', fontFamily: 'inherit', position: 'relative',
  }),
  footer: {
    padding: '16px 32px 22px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    flexShrink: 0, borderTop: '1px solid rgba(255,255,255,0.08)',
  },
  btnSecondary: {
    background: 'none', border: 'none', fontSize: '15px', fontWeight: '500',
    color: 'rgba(200,220,255,0.55)', cursor: 'pointer', padding: '10px 16px',
    borderRadius: '10px', transition: 'color 0.15s ease', fontFamily: 'inherit',
  },
  btnPrimary: {
    background: 'linear-gradient(135deg, #ea580c, #f97316)', border: 'none', fontSize: '15px',
    fontWeight: '600', color: '#fff', cursor: 'pointer', padding: '12px 28px',
    borderRadius: '12px', transition: 'opacity 0.15s ease, transform 0.12s ease',
    fontFamily: 'inherit', boxShadow: '0 4px 20px rgba(249,115,22,0.40)',
  },
};

const RandomModeSetupWizard = ({ onComplete, onCancel, initialSettings }) => {
  const [step, setStep] = useState(0);
  const [cubeSize, setCubeSize] = useState(initialSettings?.size || 3);
  const [backgroundTheme, setBackgroundTheme] = useState(initialSettings?.backgroundTheme || 'blackhole');

  const STEPS = ['Scene', 'Size'];
  const totalSteps = 2;

  const handleNext = () => {
    if (step < totalSteps - 1) setStep(step + 1);
    else onComplete({ backgroundTheme, cubeSize });
  };

  const handleBack = () => {
    if (step > 0) setStep(step - 1);
    else onCancel();
  };

  const renderBackgrounds = () => (
    <div style={S.bgGrid}>
      {BG_OPTIONS.map(opt => {
        const selected = backgroundTheme === opt.value;
        return (
          <button key={opt.value} style={S.bgCard(selected)} onClick={() => setBackgroundTheme(opt.value)}>
            {opt.thumbnail ? (
              <img src={opt.thumbnail} alt={opt.label} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            ) : (
              <div style={{ width: '100%', height: '100%', background: opt.gradient }} />
            )}
            <div style={S.bgLabel}>{opt.label}</div>
            {selected && (
              <div style={{ position: 'absolute', top: '7px', right: '7px', width: '20px', height: '20px', borderRadius: '50%', background: '#f97316', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 1px 6px rgba(0,0,0,0.25)' }}>
                <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                  <path d="M1 4L3.5 6.5L9 1" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            )}
          </button>
        );
      })}
    </div>
  );

  const renderSize = () => (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', paddingBottom: '8px' }}>
      {SIZES.map(({ n, name, tag, desc }) => {
        const selected = cubeSize === n;
        return (
          <button key={n} style={S.sizeCard(selected)} onClick={() => setCubeSize(n)}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                display: 'grid', gridTemplateColumns: `repeat(${n}, 1fr)`, gap: '3px', width: '40px',
              }}>
                {Array.from({ length: n * n }).map((_, i) => (
                  <div key={i} style={{
                    aspectRatio: '1', borderRadius: '2px',
                    background: selected ? 'rgba(249,115,22,0.85)' : 'rgba(255,255,255,0.20)',
                    transition: 'background 0.18s ease',
                  }} />
                ))}
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '5px', marginBottom: '2px' }}>
                  <span style={{ fontSize: '15px', fontWeight: '700', color: '#e8edf8', letterSpacing: '-0.4px' }}>{name}</span>
                  <span style={{ fontSize: '10px', fontWeight: '600', letterSpacing: '0.04em', textTransform: 'uppercase', color: selected ? 'rgba(249,115,22,0.9)' : 'rgba(180,210,255,0.40)' }}>{tag}</span>
                </div>
                <div style={{ fontSize: '11px', color: 'rgba(180,210,255,0.45)' }}>{desc}</div>
              </div>
            </div>
            {selected && (
              <div style={{ position: 'absolute', top: '10px', right: '10px', width: '18px', height: '18px', borderRadius: '50%', background: '#f97316', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                  <path d="M1 4L3.5 6.5L9 1" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            )}
          </button>
        );
      })}
    </div>
  );

  const stepContent = [renderBackgrounds, renderSize];
  const stepTitles = ['Pick Your Scene', 'Cube Size'];
  const stepSubtitles = [
    'This stays fixed — color schemes and tile styles will cycle automatically every 15 seconds.',
    'Pick your puzzle dimensions — stays fixed during play.',
  ];

  return (
    <div style={S.overlay}>
      <div style={S.sheet}>
        <div style={S.header}>
          {/* Orange pill badge */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(249,115,22,0.15)', border: '1px solid rgba(249,115,22,0.35)', borderRadius: '100px', padding: '4px 10px', marginBottom: '14px' }}>
            <span style={{ fontSize: '13px' }}>🎲</span>
            <span style={{ fontSize: '11px', fontWeight: '700', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#f97316' }}>Random Mode</span>
          </div>
          <div style={{ display: 'flex', gap: '6px', marginBottom: '20px' }}>
            {STEPS.map((_, i) => <div key={i} style={S.dot(i <= step, i === step)} />)}
          </div>
          <h2 style={S.title}>{stepTitles[step]}</h2>
          <p style={S.subtitle}>{stepSubtitles[step]}</p>
        </div>

        <div style={S.body}>
          <div style={{ paddingBottom: '24px' }}>
            {stepContent[step]()}
          </div>
        </div>

        <div style={S.footer}>
          <button style={S.btnSecondary} onClick={handleBack}
            onMouseEnter={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.85)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = 'rgba(200,220,255,0.55)'; }}>
            {step === 0 ? 'Cancel' : 'Back'}
          </button>
          <button style={S.btnPrimary} onClick={handleNext}
            onMouseEnter={e => { e.currentTarget.style.opacity = '0.82'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
            onMouseLeave={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'none'; }}
            onMouseDown={e => { e.currentTarget.style.transform = 'scale(0.97)'; }}
            onMouseUp={e => { e.currentTarget.style.transform = 'translateY(-1px)'; }}>
            {step === totalSteps - 1 ? 'Start Random Mode' : 'Continue'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default RandomModeSetupWizard;
