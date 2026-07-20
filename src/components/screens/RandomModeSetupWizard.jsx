import React, { useState } from 'react';
import { BACKGROUNDS, getBackgroundUrl } from '../../utils/backgrounds.js';
import {
  UI_FONT,
  PAPER_BACKDROP, PAPER_BACKDROP_BLUR,
  PAPER_SHEET_RAISED, PAPER_BORDER, PAPER_BORDER_SOFT,
  PAPER_TEXT, PAPER_TEXT_MUTED, PAPER_TEXT_FAINT,
  PAPER_BG_MUTED, PAPER_CARD_SHADOW, PAPER_SHADOW,
} from '../../utils/uiTheme.js';
import { BG_PREVIEWS } from '../../utils/bgPreviews.js';
import { wizardPaperBackground, WIZARD_FOOTER_BG, WizardPreviewNote } from './WizardChrome.jsx';
import { WIZARD_PREVIEW } from '../../utils/demoStepCopy.js';

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

const ACCENT = '#C44B00';
const ACCENT_SHADOW = '#7a2e00';

const S = {
  overlay: {
    position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: PAPER_BACKDROP, backdropFilter: PAPER_BACKDROP_BLUR, WebkitBackdropFilter: PAPER_BACKDROP_BLUR,
    zIndex: 1000, fontFamily: UI_FONT,
    animation: 'modalBackdropIn 0.22s ease',
  },
  sheet: {
    ...wizardPaperBackground, borderRadius: '20px', width: 'min(560px, 96vw)',
    maxHeight: '88vh', display: 'flex', flexDirection: 'column', overflow: 'hidden',
    boxShadow: PAPER_SHADOW,
    border: '1px solid #cec8be', borderTop: `3px solid ${ACCENT}`, animation: 'modalSheetIn 0.30s cubic-bezier(0.22, 1, 0.36, 1)',
  },
  header: { padding: '28px 32px 0', flexShrink: 0 },
  dot: (active, current) => ({
    height: '8px', borderRadius: '3px',
    background: current ? ACCENT : active ? `${ACCENT}66` : PAPER_BORDER,
    flex: current ? '2' : '1', transition: 'all 0.35s cubic-bezier(0.4,0,0.2,1)',
    boxShadow: current ? `0 1px 4px ${ACCENT}55` : 'none',
  }),
  title: { fontSize: '22px', fontWeight: '700', letterSpacing: '-0.5px', color: PAPER_TEXT, margin: '0 0 4px', lineHeight: 1.15 },
  subtitle: { fontSize: '13px', color: PAPER_TEXT_MUTED, margin: '0 0 16px', fontWeight: '400' },
  body: { padding: '0 32px', overflowY: 'auto', flex: 1, scrollbarWidth: 'thin', scrollbarColor: `${PAPER_CARD_SHADOW} transparent` },
  bgGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', paddingBottom: '8px' },
  bgCard: (selected) => ({
    borderRadius: '10px', overflow: 'hidden',
    border: selected ? `3px solid ${ACCENT}` : '3px solid transparent',
    boxShadow: selected ? `0 0 0 1px ${ACCENT}44` : '0 2px 6px rgba(0,0,0,0.10)',
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
    borderRadius: '10px',
    border: selected ? `2px solid ${ACCENT}` : '2px solid #d6d0c8',
    background: selected ? `${ACCENT}12` : PAPER_SHEET_RAISED,
    boxShadow: selected
      ? 'inset 0 2px 5px rgba(0,0,0,0.10), 0 1px 0 rgba(255,255,255,0.6)'
      : `0 3px 0 ${PAPER_CARD_SHADOW}, 0 4px 10px rgba(0,0,0,0.06)`,
    transform: selected ? 'translateY(1px)' : 'none',
    cursor: 'pointer', transition: 'all 0.18s ease', outline: 'none',
    WebkitTapHighlightColor: 'transparent', textAlign: 'left', fontFamily: 'inherit', position: 'relative',
  }),
  footer: {
    padding: '16px 32px 22px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    flexShrink: 0, borderTop: '1px solid #d6d0c8', background: WIZARD_FOOTER_BG,
  },
  btnSecondary: {
    background: 'none', border: '1.5px solid #d6d0c8', fontSize: '15px', fontWeight: '500',
    color: PAPER_TEXT_MUTED, cursor: 'pointer', padding: '10px 16px',
    borderRadius: '10px', transition: 'all 0.15s ease', fontFamily: 'inherit',
  },
  btnPrimary: {
    background: ACCENT, border: 'none', fontSize: '15px',
    fontWeight: '700', color: '#fff', cursor: 'pointer', padding: '12px 28px',
    borderRadius: '10px', transition: 'all 0.12s ease',
    fontFamily: 'inherit', boxShadow: `0 4px 0 ${ACCENT_SHADOW}, 0 6px 16px ${ACCENT}44`,
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
              <div style={{ position: 'absolute', top: '7px', right: '7px', width: '20px', height: '20px', borderRadius: '5px', background: ACCENT, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 2px 0 ${ACCENT_SHADOW}` }}>
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
                    background: selected ? ACCENT : '#d4cfc5',
                    transition: 'background 0.18s ease',
                  }} />
                ))}
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '5px', marginBottom: '2px' }}>
                  <span style={{ fontSize: '15px', fontWeight: '700', color: PAPER_TEXT, letterSpacing: '-0.4px' }}>{name}</span>
                  <span style={{ fontSize: '10px', fontWeight: '600', letterSpacing: '0.04em', textTransform: 'uppercase', color: selected ? ACCENT : PAPER_TEXT_FAINT }}>{tag}</span>
                </div>
                <div style={{ fontSize: '11px', color: PAPER_TEXT_FAINT }}>{desc}</div>
              </div>
            </div>
            {selected && (
              <div style={{ position: 'absolute', top: '10px', right: '10px', width: '20px', height: '20px', borderRadius: '5px', background: ACCENT, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 2px 0 ${ACCENT_SHADOW}` }}>
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
    'This stays fixed — color schemes, tile styles, and a per-cubelet mix of view styles will cycle automatically every 10 seconds.',
    'Pick your puzzle dimensions — stays fixed during play.',
  ];

  return (
    <div style={S.overlay}>
      <div style={S.sheet}>
        <div style={S.header}>
          {/* Badge */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: ACCENT, borderRadius: '6px', padding: '4px 12px', marginBottom: '14px', boxShadow: `0 2px 0 ${ACCENT_SHADOW}` }}>
            <span style={{ fontSize: '13px' }}>🎲</span>
            <span style={{ fontSize: '11px', fontWeight: '800', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#fff' }}>Random Mode</span>
          </div>
          <div style={{ display: 'flex', gap: '6px', marginBottom: '20px' }}>
            {STEPS.map((_, i) => <div key={i} style={S.dot(i <= step, i === step)} />)}
          </div>
          <h2 style={S.title}>{stepTitles[step]}</h2>
          <p style={S.subtitle}>{stepSubtitles[step]}</p>
          <WizardPreviewNote accent={ACCENT} text={WIZARD_PREVIEW.random} />
        </div>

        <div style={S.body}>
          <div style={{ paddingBottom: '24px' }}>
            {stepContent[step]()}
          </div>
        </div>

        <div style={S.footer}>
          <button style={S.btnSecondary} onClick={handleBack}
            onMouseEnter={e => { e.currentTarget.style.color = PAPER_TEXT; e.currentTarget.style.borderColor = '#b8b2aa'; }}
            onMouseLeave={e => { e.currentTarget.style.color = PAPER_TEXT_MUTED; e.currentTarget.style.borderColor = PAPER_BORDER_SOFT; }}>
            {step === 0 ? 'Cancel' : 'Back'}
          </button>
          <button style={S.btnPrimary} onClick={handleNext}
            onMouseEnter={e => { e.currentTarget.style.opacity = '0.88'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
            onMouseLeave={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'none'; }}
            onMouseDown={e => { e.currentTarget.style.transform = 'translateY(3px)'; e.currentTarget.style.boxShadow = `0 1px 0 ${ACCENT_SHADOW}`; }}
            onMouseUp={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = `0 4px 0 ${ACCENT_SHADOW}, 0 6px 16px ${ACCENT}44`; }}>
            {step === totalSteps - 1 ? 'Start Random Mode' : 'Continue'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default RandomModeSetupWizard;
