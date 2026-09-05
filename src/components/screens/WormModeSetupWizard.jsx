import React, { useState, useMemo } from 'react';
import { useGameStore } from '../../hooks/useGameStore.js';
import { useIsMobile } from '../../hooks/index.js';
import { WORM_SKINS, WORM_HATS } from '../../worm/wormCosmeticsData.js';
import { WORM_CHARACTERS } from '../../worm/wormCharacterData.js';
import {
  PAPER_SHEET_RAISED, PAPER_BORDER_SOFT,
  PAPER_TEXT, PAPER_TEXT_MUTED, PAPER_TEXT_FAINT,
  PAPER_CARD_SHADOW,
  NIGHT_TEXT, NIGHT_TEXT_MUTED,
  UI_CREAM, TEXT_MICRO, TEXT_XS } from '../../utils/uiTheme.js';
import { wizardLayout, WizardRail, WIZARD_PANEL_ID } from './WizardChrome.jsx';
import WormPreviewCanvas from '../../3d/WormPreviewCanvas.jsx';
import { WORM_SPEED_OPTIONS } from '../../worm/healerWorm/constants.js';
import {
  useWizardCosmetics, WizardImageInput,
  SceneStep, PaletteStep, SizeStep, styleCategory,
  SpecimenPlate, LockPip, PickerHeading, SIZE_TIERS,
  sceneLabel, paletteLabel, sizeLabel
} from './wizardSteps/index.jsx';

const ACCENT = '#6A2C91';
const ACCENT_SHADOW = '#3d1854';
const MEGA_CUBE_SIZE = 15;
const WORM_SIZE_TIERS = [
  ...SIZE_TIERS.map(tier => tier.n === 6 ? { ...tier, tag: 'Giant' } : tier),
  { n: MEGA_CUBE_SIZE, name: '15×15×15', tag: 'Mega', desc: '1,350 stickers of mayhem' }
];

const ORB_COUNT_OPTIONS = [
  { value: 6, label: 'Less' },
  { value: 16, label: 'Average' },
  { value: 30, label: 'More' }
];

const WORMHOLE_OPTIONS = [
  { value: 20, label: 'Slow' },
  { value: 10, label: 'Average' },
  { value: 5, label: 'Fast' }
];

const WormModeSetupWizard = ({ onComplete, onCancel, initialSettings }) => {
  const [step, setStep] = useState(0);
  const isMobile = useIsMobile();
  const S = useMemo(() => wizardLayout(ACCENT, ACCENT_SHADOW, isMobile), [isMobile]);
  const cos = useWizardCosmetics({
    initialSettings,
    accent: ACCENT,
    accentShadow: ACCENT_SHADOW,
    extra: {
      wormSpeed: 2.0,
      wormOrbCount: 16,
      wormholeInterval: 10,
      wormColor: '#33ff66'
    }
  });
  const { settings, select, ownedItems } = cos;

  const wormSkinId = useGameStore(s => s.wormSkin ?? 'slime');
  const wormHatId = useGameStore(s => s.wormHat ?? 'none');
  const wormCharacterId = useGameStore(s => s.wormCharacter ?? 'classic');
  const wormShowTrail = useGameStore(s => s.wormShowTrail ?? true);
  const setWormSkin = useGameStore(s => s.setWormSkin);
  const setWormHat = useGameStore(s => s.setWormHat);
  const setWormCharacter = useGameStore(s => s.setWormCharacter);
  const setWormShowTrail = useGameStore(s => s.setWormShowTrail);

  const activeSkin = WORM_SKINS.find(s => s.id === wormSkinId) ?? WORM_SKINS[0];
  const activeCharacter = WORM_CHARACTERS.find(c => c.id === wormCharacterId) ?? WORM_CHARACTERS[0];

  // ── Step 0: Character ───────────────────────────────────────────────────────

  const renderCharacter = () => {
    const chipBase = {
      border: 'none', cursor: 'pointer', borderRadius: '10px',
      transition: 'all 0.18s ease', fontFamily: 'inherit'
    };

    const lockedSkins = WORM_SKINS.filter(s => !ownedItems.includes(`skin_${s.id}`)).length;
    const lockedHats = WORM_HATS.filter(h => !ownedItems.includes(`hat_${h.id}`)).length;

    const charIndex = WORM_CHARACTERS.findIndex(c => c.id === wormCharacterId);
    const prevChar = () => setWormCharacter(WORM_CHARACTERS[(charIndex - 1 + WORM_CHARACTERS.length) % WORM_CHARACTERS.length].id);
    const nextChar = () => setWormCharacter(WORM_CHARACTERS[(charIndex + 1) % WORM_CHARACTERS.length].id);

    // "Steady Crawler — reliable healing on every cube size" → named trait plus
    // its explanation, so the trait itself can be set apart from the prose.
    const [rawTrait, ...traitRest] = activeCharacter.special.split('—');
    const traitName = rawTrait.trim();
    const traitDetail = traitRest.join('—').trim();

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {/* ── Character plate ── */}
        <SpecimenPlate
          caption="Specimen"
          index={charIndex + 1}
          total={WORM_CHARACTERS.length}
          title={activeCharacter.label}
          glow={activeSkin.glow}
          onPrev={prevChar}
          onNext={nextChar}
          art={
            <WormPreviewCanvas
              characterId={wormCharacterId}
              skinId={wormSkinId}
              hatId={wormHatId}
              size={isMobile ? 168 : 200}
              animated
            />
          }
          subtitle={
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              background: `${activeSkin.glow}28`, border: `1px solid ${activeSkin.glow}55`,
              color: activeSkin.glow, fontSize: TEXT_MICRO, fontWeight: 800,
              letterSpacing: '0.16em', textTransform: 'uppercase', padding: '3px 11px', borderRadius: '999px',
              transition: 'all 0.4s ease'
            }}>
              {activeCharacter.type}
              <span style={{ opacity: 0.5 }}>·</span>
              <span style={{ letterSpacing: '0.06em', textTransform: 'none', fontWeight: 600, opacity: 0.85 }}>
                {activeCharacter.subtitle}
              </span>
            </div>
          }
        >
          {/* Signature trait */}
          <div style={{ alignSelf: 'stretch', display: 'flex', gap: '9px', alignItems: 'flex-start', paddingLeft: '2px', zIndex: 1 }}>
            <span style={{ color: activeSkin.glow, fontSize: '10px', lineHeight: 1.6, flexShrink: 0 }}>◆</span>
            <span style={{ fontSize: '11px', color: NIGHT_TEXT_MUTED, lineHeight: 1.5 }}>
              <span style={{ color: NIGHT_TEXT, fontWeight: 700 }}>{traitName}</span>
              {traitDetail ? ` — ${traitDetail}` : ''}
            </span>
          </div>

          {/* Page dots */}
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center', zIndex: 1 }}>
            {WORM_CHARACTERS.map(c => (
              <button key={c.id} onClick={() => setWormCharacter(c.id)} aria-label={c.label} style={{
                width: c.id === wormCharacterId ? '22px' : '7px',
                height: '7px', borderRadius: '4px',
                background: c.id === wormCharacterId ? UI_CREAM : 'rgba(255,245,220,0.28)',
                border: 'none', cursor: 'pointer', padding: 0,
                transition: 'all 0.28s cubic-bezier(0.4,0,0.2,1)',
                WebkitTapHighlightColor: 'transparent'
              }} />
            ))}
          </div>
        </SpecimenPlate>

        {/* ── Skin picker ── */}
        <div>
          <PickerHeading label="Skin" locked={lockedSkins} />
          <div style={{ display: 'flex', gap: '7px', overflowX: 'auto', paddingBottom: '4px' }}>
            {WORM_SKINS.map(skin => {
              const owned = ownedItems.includes(`skin_${skin.id}`);
              const selected = skin.id === wormSkinId;
              return (
                <button key={skin.id} onClick={() => owned && setWormSkin(skin.id)} style={{
                  ...chipBase, flexShrink: 0,
                  padding: '7px 9px 6px',
                  background: selected ? PAPER_SHEET_RAISED : 'rgba(255,255,255,0.62)',
                  border: selected ? `2px solid ${skin.body}` : `2px solid ${PAPER_BORDER_SOFT}`,
                  boxShadow: selected ? `0 3px 0 ${skin.body}66, 0 5px 14px ${skin.glow}3d` : `0 2px 0 ${PAPER_CARD_SHADOW}`,
                  transform: selected ? 'translateY(-1px)' : 'none',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px',
                  opacity: owned ? 1 : 0.5,
                  cursor: owned ? 'pointer' : 'not-allowed',
                  position: 'relative',
                  minWidth: '60px'
                }}>
                  {/* Locked skins keep their colour, the same as in the store —
                      a grey worm tells you nothing about what you'd be buying. */}
                  <div style={{ filter: owned ? 'none' : 'saturate(0.5)' }}>
                    <WormPreviewCanvas characterId={wormCharacterId} skinId={skin.id} size={34} />
                  </div>
                  <span style={{ fontSize: TEXT_XS, fontWeight: 700, color: selected ? skin.body : PAPER_TEXT_FAINT, letterSpacing: '0.05em' }}>
                    {skin.label}
                  </span>
                  {!owned && <span style={{ position: 'absolute', top: '4px', right: '4px' }}><LockPip size={9} /></span>}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Hat picker ── */}
        <div>
          <PickerHeading label="Hat" locked={lockedHats} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(66px, 1fr))', gap: '7px' }}>
            {WORM_HATS.map(hat => {
              const owned = ownedItems.includes(`hat_${hat.id}`);
              const selected = hat.id === wormHatId;
              return (
                <button key={hat.id} onClick={() => owned && setWormHat(hat.id)} style={{
                  ...chipBase,
                  padding: '8px 6px 6px',
                  background: selected ? `${ACCENT}12` : 'rgba(255,255,255,0.62)',
                  border: selected ? `2px solid ${ACCENT}` : `2px solid ${PAPER_BORDER_SOFT}`,
                  boxShadow: selected ? 'inset 0 2px 4px rgba(83,72,56,0.12)' : `0 2px 0 ${PAPER_CARD_SHADOW}`,
                  transform: selected ? 'translateY(1px)' : 'none',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px',
                  opacity: owned ? 1 : 0.5,
                  cursor: owned ? 'pointer' : 'not-allowed',
                  position: 'relative'
                }}>
                  <WormPreviewCanvas
                    characterId={wormCharacterId} skinId={wormSkinId} hatId={hat.id}
                    size={34} framing="head"
                    style={{ filter: owned ? 'none' : 'saturate(0.5)' }}
                  />
                  <span style={{ fontSize: TEXT_XS, fontWeight: 700, letterSpacing: '0.05em', color: selected ? ACCENT : PAPER_TEXT_MUTED, lineHeight: 1.2, textAlign: 'center' }}>
                    {hat.label}
                  </span>
                  {!owned && <span style={{ position: 'absolute', top: '4px', right: '4px' }}><LockPip size={9} /></span>}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Trail toggle ── */}
        <div>
          <PickerHeading label="Trail" hint="Mark tiles you've visited" />
          <div style={{ display: 'flex', gap: '7px' }}>
            {[{ val: true, label: 'On' }, { val: false, label: 'Off' }].map(({ val, label }) => {
              const selected = wormShowTrail === val;
              const accent = activeSkin.glow;
              return (
                <button key={String(val)} onClick={() => setWormShowTrail(val)} style={{
                  ...chipBase,
                  padding: '9px 24px',
                  background: selected ? `${accent}18` : 'rgba(255,255,255,0.62)',
                  border: selected ? `2px solid ${accent}` : `2px solid ${PAPER_BORDER_SOFT}`,
                  boxShadow: selected ? 'inset 0 2px 4px rgba(83,72,56,0.12)' : `0 2px 0 ${PAPER_CARD_SHADOW}`,
                  transform: selected ? 'translateY(1px)' : 'none',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', color: selected ? accent : PAPER_TEXT_MUTED }}>
                    {label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  // ── Play: how the run itself feels ─────────────────────────────────────────
  //
  // These used to hang off the bottom of the size step, which made it the
  // longest scroll in any wizard — they were bundled there only because a sixth
  // step cost a sixth screen to walk through. With the rail a category is free.

  const renderGameplay = () => {
    const OptionGroup = ({ label, options, value, onChange, accent }) => (
      <div style={{ display: 'grid', gap: '8px' }}>
        <div style={{ fontSize: '12px', fontWeight: 700, color: PAPER_TEXT_MUTED, letterSpacing: '0.04em' }}>{label}</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
          {options.map(opt => {
            const selected = value === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => onChange(opt.value)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  padding: '14px 8px',
                  borderRadius: '10px',
                  border: selected ? `2px solid ${accent}` : `2px solid ${PAPER_BORDER_SOFT}`,
                  background: selected ? `${accent}14` : PAPER_SHEET_RAISED,
                  boxShadow: selected ? 'inset 0 2px 4px rgba(0,0,0,0.08)' : `0 2px 0 ${PAPER_CARD_SHADOW}, 0 3px 6px rgba(0,0,0,0.06)`,
                  transform: selected ? 'translateY(1px)' : 'none',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  WebkitTapHighlightColor: 'transparent',
                  fontFamily: 'inherit'
                }}
              >
                <span style={{ fontSize: '13px', fontWeight: 700, color: selected ? accent : PAPER_TEXT_MUTED, letterSpacing: '-0.2px' }}>{opt.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    );

    return (
      <div style={{ display: 'grid', gap: '20px' }}>
        <OptionGroup
          label="Worm Speed"
          accent="#1565C0"
          value={settings.wormSpeed}
          onChange={v => select('wormSpeed', v)}
          options={WORM_SPEED_OPTIONS}
        />
        <OptionGroup
          label="Orb Count"
          accent={ACCENT}
          value={settings.wormOrbCount}
          onChange={v => select('wormOrbCount', v)}
          options={ORB_COUNT_OPTIONS}
        />
        <OptionGroup
          label="Wormhole Duration"
          accent="#b58a00"
          value={settings.wormholeInterval}
          onChange={v => select('wormholeInterval', v)}
          options={WORMHOLE_OPTIONS}
        />
      </div>
    );
  };

  const renderSize = () => (
    <>
      <SizeStep cos={cos} tiers={WORM_SIZE_TIERS} />
      <button
        type="button"
        aria-pressed={cos.cubeSize === MEGA_CUBE_SIZE}
        onClick={() => cos.setCubeSize(MEGA_CUBE_SIZE)}
        style={{
          width: '100%', marginTop: '10px', padding: '15px 18px', borderRadius: '12px',
          border: cos.cubeSize === MEGA_CUBE_SIZE ? `2px solid ${ACCENT}` : `2px solid ${ACCENT}77`,
          background: cos.cubeSize === MEGA_CUBE_SIZE
            ? `linear-gradient(135deg, ${ACCENT}, #9b4dca)`
            : `linear-gradient(135deg, ${ACCENT}12, ${ACCENT}24)`,
          color: cos.cubeSize === MEGA_CUBE_SIZE ? '#fff' : ACCENT,
          boxShadow: cos.cubeSize === MEGA_CUBE_SIZE
            ? `0 4px 0 ${ACCENT_SHADOW}, 0 8px 20px ${ACCENT}44`
            : `0 3px 0 ${ACCENT}33`,
          cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.18s ease',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px'
        }}
      >
        <span style={{ fontSize: '14px', fontWeight: 900, letterSpacing: '0.12em' }}>MEGA MODE</span>
        <span style={{ fontSize: '11px', fontWeight: 700, opacity: 0.85 }}>
          {cos.cubeSize === MEGA_CUBE_SIZE ? '15×15×15 selected' : 'Play on 15×15×15'}
        </span>
      </button>
      {cos.cubeSize === MEGA_CUBE_SIZE && (
        <p style={{ margin: '9px 4px 0', fontSize: '10px', color: PAPER_TEXT_MUTED, lineHeight: 1.45 }}>
          Mega Mode automatically scales orb density to fill the larger surface and uses optimized effects for smoother play.
        </p>
      )}
    </>
  );

  const categories = [
    {
      key: 'character',
      icon: 'character',
      label: 'Character',
      title: 'Pick Worm Type',
      subtitle: 'Select your character, then customize skin & hat',
      summary: `${activeCharacter.label} · ${activeSkin.label}`,
      content: renderCharacter()
    },
    {
      key: 'scene',
      icon: 'scene',
      label: 'Scene',
      title: 'Background',
      subtitle: 'Choose your play environment',
      summary: sceneLabel(settings),
      content: <SceneStep cos={cos} />
    },
    {
      key: 'colors',
      icon: 'colors',
      label: 'Colors',
      title: 'Color Palette',
      subtitle: 'Pick a palette — the cube wears it as you go',
      summary: paletteLabel(settings),
      content: <PaletteStep cos={cos} />
    },
    styleCategory(cos),
    {
      key: 'size',
      icon: 'size',
      label: 'Size',
      title: 'Cube Size',
      subtitle: 'Choose the cube your worm has to cross',
      summary: cos.cubeSize === MEGA_CUBE_SIZE ? 'Mega 15×15×15' : sizeLabel(cos.cubeSize, WORM_SIZE_TIERS),
      content: renderSize()
    },
    {
      key: 'play',
      icon: 'gameplay',
      label: 'Play',
      title: 'Gameplay',
      subtitle: 'Tune how fast and chaotic your worm run feels',
      summary: `${WORM_SPEED_OPTIONS.find(o => o.value === settings.wormSpeed)?.label || 'Custom'} · ${ORB_COUNT_OPTIONS.find(o => o.value === settings.wormOrbCount)?.label || 'Custom'}`,
      content: renderGameplay()
    }
  ];

  const active = categories[step];

  const handleNext = () => {
    if (step < categories.length - 1) setStep(step + 1);
    else onComplete({
      ...settings,
      cubeSize: cos.cubeSize,
      megaMode: cos.cubeSize === MEGA_CUBE_SIZE
    });
  };
  const handleBack = () => (step > 0 ? setStep(step - 1) : onCancel());

  return (
    <div style={S.overlay}>
      <WizardImageInput cos={cos} />

      <div style={S.sheet}>
        <div style={S.main}>
          <WizardRail
            styles={S}
            categories={categories}
            active={step}
            onSelect={setStep}
            accent={ACCENT}
            mobile={isMobile}
          />

          <div style={S.pane}>
            <div style={S.header}>
              {/* Mode identity badge */}
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                background: ACCENT, borderRadius: '6px', padding: '4px 12px', marginBottom: '16px',
                fontSize: '11px', fontWeight: 800, letterSpacing: '0.12em',
                textTransform: 'uppercase', color: '#fff',
                boxShadow: `0 2px 0 ${ACCENT_SHADOW}`
              }}>
                WORM MODE
              </div>
              <h2 style={S.title}>{active.title}</h2>
              <p style={S.subtitle}>{active.subtitle}</p>
            </div>

            <div style={S.body} id={WIZARD_PANEL_ID} role="region" aria-label={active.label}>
              <div style={{ paddingBottom: '24px' }}>{active.content}</div>
            </div>
          </div>
        </div>

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
            {step === categories.length - 1 ? 'Start Playing' : 'Continue'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default WormModeSetupWizard;
