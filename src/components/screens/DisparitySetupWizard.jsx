import React, { useState, useMemo } from 'react';
import {
  PAPER_SHEET_RAISED, PAPER_BORDER_SOFT,
  PAPER_TEXT, PAPER_TEXT_MUTED, PAPER_TEXT_FAINT,
  PAPER_CARD_SHADOW, TEXT_MICRO, TEXT_XS } from '../../utils/uiTheme.js';
import { useIsMobile } from '../../hooks/index.js';
import { wizardLayout, WizardSteps } from './WizardChrome.jsx';
import {
  useWizardCosmetics, WizardImageInput,
  SceneStep, PaletteStep, StyleStep, SizeStep,
  cardStyle
} from './wizardSteps/index.jsx';

const ACCENT = '#C44B00';
const ACCENT_SHADOW = '#7a2e00';

const LEVEL_LABELS = { 1: 'Low', 2: 'Medium', 3: 'High', 4: 'Extreme', 5: 'Maximum' };
const LEVEL_ACCENT = { 1: '#2d7a3a', 2: '#b58a00', 3: '#c45000', 4: '#c0392b', 5: '#7b2d8b' };

const FLIP_CAP_PRESETS = [
  { label: 'Fragile', value: 3, sub: 'Fast massacre' },
  { label: 'Standard', value: 8, sub: 'Balanced carnage' },
  { label: 'Endurance', value: 13, sub: 'Slow attrition' },
  { label: 'Titan', value: 20, sub: 'War of attrition' }
];

const GAME_LENGTH_OPTIONS = [
  { value: 'short', label: 'Short', sub: '10 shuffles' },
  { value: 'medium', label: 'Medium', sub: '20 shuffles' },
  { value: 'long', label: 'Long', sub: '30 shuffles' }
];

const STEPS = ['Scene', 'Colors', 'Style', 'Gameplay', 'Size'];
const STEP_TITLES = ['Background', 'Color Palette', 'Tile Style', 'Gameplay', 'Cube Size'];
const STEP_SUBTITLES = [
  'Choose your play environment',
  'Pick a palette — the cube wears it as you go',
  'Choose how your tiles look and feel',
  'Tune disparity intensity and survival rules',
  'Slide to size — this is the cube that has to survive'
];

const ToggleRow = ({ label, sub, value, onChange }) => (
  <button
    type="button"
    onClick={() => onChange(!value)}
    style={{
      ...cardStyle(value, ACCENT),
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '12px',
      padding: '12px 14px',
      textAlign: 'left'
    }}
  >
    <div>
      <div style={{ fontSize: '14px', fontWeight: 600, color: PAPER_TEXT }}>{label}</div>
      {sub && <div style={{ fontSize: '12px', color: PAPER_TEXT_MUTED, marginTop: '1px' }}>{sub}</div>}
    </div>
    <div style={{
      width: '44px', height: '26px', borderRadius: '14px',
      background: value ? ACCENT : PAPER_BORDER_SOFT, position: 'relative',
      transition: 'background 0.2s ease', flexShrink: 0,
      boxShadow: value ? `0 2px 0 ${ACCENT_SHADOW}` : '0 2px 0 #b8b2aa'
    }}>
      <div style={{
        position: 'absolute', top: '3px', left: value ? '21px' : '3px',
        width: '20px', height: '20px', borderRadius: '50%', background: '#fff',
        transition: 'left 0.2s ease', boxShadow: '0 1px 3px rgba(0,0,0,0.20)'
      }} />
    </div>
  </button>
);

const DisparitySetupWizard = ({ onStart, onCancel }) => {
  const [step, setStep] = useState(0);
  const isMobile = useIsMobile();
  const S = useMemo(() => wizardLayout(ACCENT, ACCENT_SHADOW, isMobile), [isMobile]);
  const cos = useWizardCosmetics({
    accent: ACCENT,
    accentShadow: ACCENT_SHADOW,
    extra: {
      disparityLevel: 3,
      flipCap: 8,
      visualMode: 'classic',
      flipMode: true,
      showTunnels: false,
      gameLength: 'medium'
    }
  });
  const { settings, select } = cos;

  const handleNext = () => {
    if (step < STEPS.length - 1) setStep(step + 1);
    else onStart({ ...settings, cubeSize: cos.cubeSize });
  };
  const handleBack = () => (step > 0 ? setStep(step - 1) : onCancel());

  const levelAccent = LEVEL_ACCENT[settings.disparityLevel];

  const renderGameplay = () => (
    <div style={{ display: 'grid', gap: '18px' }}>
      <div>
        <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: PAPER_TEXT_FAINT, marginBottom: '10px' }}>
          Disparity Level <span style={{ color: levelAccent }}>{LEVEL_LABELS[settings.disparityLevel]}</span>
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          {[1, 2, 3, 4, 5].map(n => (
            <button key={n} onClick={() => select('disparityLevel', n)} style={{
              flex: 1, padding: '9px 0',
              border: `2px solid ${settings.disparityLevel === n ? LEVEL_ACCENT[n] : PAPER_BORDER_SOFT}`,
              borderRadius: '10px', fontSize: '14px', fontWeight: settings.disparityLevel === n ? 700 : 500,
              background: settings.disparityLevel === n ? `${LEVEL_ACCENT[n]}18` : PAPER_SHEET_RAISED,
              color: settings.disparityLevel === n ? LEVEL_ACCENT[n] : PAPER_TEXT_FAINT,
              boxShadow: settings.disparityLevel === n ? 'inset 0 2px 4px rgba(0,0,0,0.08)' : `0 2px 0 ${PAPER_CARD_SHADOW}`,
              transform: settings.disparityLevel === n ? 'translateY(1px)' : 'none',
              cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit'
            }}>{n}</button>
          ))}
        </div>
      </div>

      <div>
        <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: PAPER_TEXT_FAINT, marginBottom: '10px' }}>
          Tile Endurance
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          {FLIP_CAP_PRESETS.map(p => (
            <button key={p.value} onClick={() => select('flipCap', p.value)} style={{
              flex: 1, padding: '8px 4px',
              border: `2px solid ${settings.flipCap === p.value ? levelAccent : PAPER_BORDER_SOFT}`,
              borderRadius: '10px', fontSize: '11px', fontWeight: settings.flipCap === p.value ? 700 : 500,
              background: settings.flipCap === p.value ? `${levelAccent}18` : PAPER_SHEET_RAISED,
              color: settings.flipCap === p.value ? levelAccent : PAPER_TEXT_FAINT,
              boxShadow: settings.flipCap === p.value ? 'inset 0 2px 4px rgba(0,0,0,0.08)' : `0 2px 0 ${PAPER_CARD_SHADOW}`,
              transform: settings.flipCap === p.value ? 'translateY(1px)' : 'none',
              cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit', textAlign: 'center', lineHeight: 1.3
            }}>
              <div>{p.label}</div>
              <div style={{ fontSize: TEXT_MICRO, marginTop: '2px', opacity: 0.75 }}>{p.sub}</div>
            </button>
          ))}
        </div>
      </div>

      <div>
        <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: PAPER_TEXT_FAINT, marginBottom: '10px' }}>
          Game Length
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          {GAME_LENGTH_OPTIONS.map(opt => (
            <button key={opt.value} onClick={() => select('gameLength', opt.value)} style={{
              flex: 1, padding: '8px 4px',
              border: `2px solid ${settings.gameLength === opt.value ? levelAccent : PAPER_BORDER_SOFT}`,
              borderRadius: '10px', fontSize: '11px', fontWeight: settings.gameLength === opt.value ? 700 : 500,
              background: settings.gameLength === opt.value ? `${levelAccent}18` : PAPER_SHEET_RAISED,
              color: settings.gameLength === opt.value ? levelAccent : PAPER_TEXT_FAINT,
              boxShadow: settings.gameLength === opt.value ? 'inset 0 2px 4px rgba(0,0,0,0.08)' : `0 2px 0 ${PAPER_CARD_SHADOW}`,
              transform: settings.gameLength === opt.value ? 'translateY(1px)' : 'none',
              cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit', textAlign: 'center', lineHeight: 1.3
            }}>
              <div>{opt.label}</div>
              <div style={{ fontSize: TEXT_XS, marginTop: '2px', opacity: 0.75 }}>{opt.sub}</div>
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gap: '10px' }}>
        <ToggleRow label="Flip Mode" sub="Allow manual tile flips" value={settings.flipMode} onChange={v => select('flipMode', v)} />
        <ToggleRow label="Wormhole Tunnels" sub="Show antipodal connections" value={settings.showTunnels} onChange={v => select('showTunnels', v)} />
      </div>
    </div>
  );

  const stepContent = [
    <SceneStep key="scene" cos={cos} />,
    <PaletteStep key="palette" cos={cos} />,
    <StyleStep key="style" cos={cos} />,
    renderGameplay(),
    <SizeStep key="size" cos={cos} />
  ];

  return (
    <div style={S.overlay}>
      <WizardImageInput cos={cos} />
      <div style={S.sheet}>
        <div style={S.header}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            background: ACCENT, borderRadius: '6px', padding: '4px 12px', marginBottom: '16px',
            fontSize: '11px', fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#fff',
            boxShadow: `0 2px 0 ${ACCENT_SHADOW}`
          }}>
            DISPARITY MODE
          </div>
          <WizardSteps styles={S} steps={STEPS} step={step} />
          <h2 style={S.title}>{STEP_TITLES[step]}</h2>
          <p style={S.subtitle}>{STEP_SUBTITLES[step]}</p>
        </div>

        <div style={S.body}><div style={{ paddingBottom: '24px' }}>{stepContent[step]}</div></div>

        <div style={S.footer}>
          <button
            style={S.btnSecondary}
            onClick={handleBack}
            onMouseEnter={e => { e.currentTarget.style.color = PAPER_TEXT; e.currentTarget.style.borderColor = '#b8b2aa'; }}
            onMouseLeave={e => { e.currentTarget.style.color = PAPER_TEXT_MUTED; e.currentTarget.style.borderColor = PAPER_BORDER_SOFT; }}
          >
            {step === 0 ? 'Cancel' : 'Back'}
          </button>
          <button
            style={S.btnPrimary}
            onClick={handleNext}
            onMouseEnter={e => { e.currentTarget.style.opacity = '0.88'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
            onMouseLeave={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'none'; }}
            onMouseDown={e => { e.currentTarget.style.transform = 'translateY(3px)'; e.currentTarget.style.boxShadow = `0 1px 0 ${ACCENT_SHADOW}`; }}
            onMouseUp={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = `0 4px 0 ${ACCENT_SHADOW}, 0 6px 16px ${ACCENT}44`; }}
          >
            {step === STEPS.length - 1 ? 'Start Playing' : 'Continue'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DisparitySetupWizard;
