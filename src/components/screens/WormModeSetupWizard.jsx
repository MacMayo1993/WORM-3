import React, { useState, useMemo } from 'react';
import { useGameStore } from '../../hooks/useGameStore.js';
import { useIsMobile } from '../../hooks/index.js';
import { WORM_SKINS, WORM_HATS } from '../../worm/wormCosmeticsData.js';
import { WORM_CHARACTERS } from '../../worm/wormCharacterData.js';
import { NIGHT_TEXT, NIGHT_TEXT_MUTED, UI_CREAM, TEXT_MICRO, TEXT_XS } from '../../utils/uiTheme.js';
import { wizardLayout, WizardShell, WIZ_BORDER_SOFT, WIZ_SURFACE, WIZ_CARD_SHADOW, WIZ_SURFACE_RAISED, WIZ_TEXT, WIZ_TEXT_FAINT, WIZ_TEXT_MUTED } from './WizardChrome.jsx';
import WormPreviewCanvas from '../../3d/WormPreviewCanvas.jsx';
import { WORM_DIFFICULTIES } from '../../worm/wormDifficulty.js';
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

const WormModeSetupWizard = ({ onComplete, onCancel, initialSettings }) => {
  const [step, setStep] = useState(0);
  const isMobile = useIsMobile();
  const S = useMemo(() => wizardLayout(ACCENT, ACCENT_SHADOW, isMobile), [isMobile]);
  const cos = useWizardCosmetics({
    initialSettings,
    accent: ACCENT,
    accentShadow: ACCENT_SHADOW,
    extra: {
      ...WORM_DIFFICULTIES[1].settings,
      wormColor: '#33ff66'
    }
  });
  const { settings, ownedItems } = cos;
  const difficulty = WORM_DIFFICULTIES.find(option => option.settings.wormSpeed === settings.wormSpeed) || WORM_DIFFICULTIES[1];

  const wormSkinId = useGameStore(s => s.wormSkin ?? 'slime');
  const wormHatId = useGameStore(s => s.wormHat ?? 'none');
  const wormCharacterId = useGameStore(s => s.wormCharacter ?? 'classic');
  const setWormSkin = useGameStore(s => s.setWormSkin);
  const setWormHat = useGameStore(s => s.setWormHat);
  const setWormCharacter = useGameStore(s => s.setWormCharacter);

  const activeSkin = WORM_SKINS.find(s => s.id === wormSkinId) ?? WORM_SKINS[0];
  const activeCharacter = WORM_CHARACTERS.find(c => c.id === wormCharacterId) ?? WORM_CHARACTERS[0];

  // ── Step 0: Character ───────────────────────────────────────────────────────

  const renderCharacter = slot => {
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
        {slot !== 'body' && (
        <SpecimenPlate
          flush={isMobile}
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
              display: 'inline-flex', alignItems: 'center', flexWrap: 'wrap', gap: '6px',
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
            <span style={{ fontSize: '13px', color: NIGHT_TEXT_MUTED, lineHeight: 1.5 }}>
              <span style={{ color: NIGHT_TEXT, fontWeight: 700 }}>{traitName}</span>
              {traitDetail ? ` — ${traitDetail}` : ''}
            </span>
          </div>

          {/* Page dots: the marker stays small, the touch area does not. */}
          <div style={{ display: 'flex', gap: '2px', flexWrap: 'wrap', alignItems: 'center', zIndex: 1 }}>
            {WORM_CHARACTERS.map(c => (
              <button key={c.id} type="button" onClick={() => setWormCharacter(c.id)} aria-label={c.label} aria-pressed={c.id === wormCharacterId} style={{
                width: 48, height: 48, borderRadius: 12, display: 'grid', placeItems: 'center',
                background: 'transparent', border: 'none', cursor: 'pointer', padding: 0,
                touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent',
              }}>
                <span aria-hidden="true" style={{ width: c.id === wormCharacterId ? 22 : 7, height: 7, borderRadius: 4,
                  background: c.id === wormCharacterId ? UI_CREAM : 'rgba(255,245,220,0.28)' }} />
              </button>
            ))}
          </div>
        </SpecimenPlate>
        )}

        {slot !== 'hero' && (
        <>
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
                  background: selected ? `${activeSkin.body}22` : WIZ_SURFACE,
                  border: selected ? `2px solid ${skin.body}` : `2px solid ${WIZ_BORDER_SOFT}`,
                  boxShadow: selected ? `0 3px 0 ${skin.body}66, 0 5px 14px ${skin.glow}3d` : `0 2px 0 ${WIZ_CARD_SHADOW}`,
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
                  <span style={{ fontSize: TEXT_XS, fontWeight: 700, color: selected ? WIZ_TEXT : WIZ_TEXT_FAINT, letterSpacing: '0.05em' }}>
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
                  background: selected ? `${ACCENT}2e` : WIZ_SURFACE,
                  border: selected ? `2px solid ${ACCENT}` : `2px solid ${WIZ_BORDER_SOFT}`,
                  boxShadow: selected ? 'inset 0 2px 4px rgba(83,72,56,0.12)' : `0 2px 0 ${WIZ_CARD_SHADOW}`,
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
                  <span style={{ fontSize: TEXT_XS, fontWeight: 700, letterSpacing: '0.05em', color: selected ? ACCENT : WIZ_TEXT_MUTED, lineHeight: 1.2, textAlign: 'center' }}>
                    {hat.label}
                  </span>
                  {!owned && <span style={{ position: 'absolute', top: '4px', right: '4px' }}><LockPip size={9} /></span>}
                </button>
              );
            })}
          </div>
        </div>

        </>
        )}
      </div>
    );
  };

  const renderPlay = () => (
    <div style={{ display: 'grid', gap: 18 }}>
      <SizeStep cos={cos} tiers={WORM_SIZE_TIERS} slot="body" compact />
      <fieldset style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
        <legend style={{ fontSize: 13, fontWeight: 700, color: WIZ_TEXT, marginBottom: 10 }}>Difficulty</legend>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
          {WORM_DIFFICULTIES.map(option => <button
            type="button" key={option.id} aria-pressed={difficulty.id === option.id}
            onClick={() => cos.setSettings(current => ({ ...current, ...option.settings }))}
            style={{ minHeight: 48, padding: '12px 6px', borderRadius: 10,
              border: `2px solid ${difficulty.id === option.id ? ACCENT : WIZ_BORDER_SOFT}`,
              background: difficulty.id === option.id ? ACCENT : WIZ_SURFACE_RAISED,
              color: difficulty.id === option.id ? '#fff' : WIZ_TEXT,
              cursor: 'pointer', font: 'inherit', fontSize: 14, fontWeight: 700 }}
          >{option.label}</button>)}
        </div>
      </fieldset>
    </div>
  );

  const categories = [
    {
      key: 'character',
      icon: 'character',
      label: 'Character',
      title: 'Pick Worm Type',
      subtitle: 'Select your character, then customize skin & hat',
      summary: `${activeCharacter.label} · ${activeSkin.label}`,
      hero: renderCharacter('hero'),
      content: renderCharacter('body')
    },
    {
      key: 'scene',
      icon: 'scene',
      label: 'Scene',
      title: 'Background',
      subtitle: 'Choose your play environment',
      summary: sceneLabel(settings),
      hero: <SceneStep cos={cos} slot="hero" />,
      content: <SceneStep cos={cos} slot="body" />
    },
    {
      key: 'colors',
      icon: 'colors',
      label: 'Colors',
      title: 'Color Palette',
      subtitle: 'Pick a palette — the cube wears it as you go',
      summary: paletteLabel(settings),
      hero: <PaletteStep cos={cos} slot="hero" />,
      content: <PaletteStep cos={cos} slot="body" />
    },
    styleCategory(cos),
    {
      key: 'play',
      icon: 'gameplay',
      label: 'Play',
      title: 'Size & Difficulty',
      summary: `${sizeLabel(cos.cubeSize, WORM_SIZE_TIERS)} · ${difficulty.label}`,
      hero: <SizeStep cos={cos} tiers={WORM_SIZE_TIERS} slot="hero" compact />,
      content: renderPlay()
    }
  ];


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
    <WizardShell
      styles={S}
      mode="WORM MODE"
      accent={ACCENT}
      categories={categories}
      active={step}
      onSelect={setStep}
      onBack={handleBack}
      onPrimary={handleNext}
      finishLabel="Start Playing"
      mobile={isMobile}
    >
      <WizardImageInput cos={cos} />
    </WizardShell>
  );
};

export default WormModeSetupWizard;
