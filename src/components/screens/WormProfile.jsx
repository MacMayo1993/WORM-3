import React, { useId, useState } from 'react';
import { useGameStore } from '../../hooks/useGameStore.js';
import { WORM_CHARACTERS, getWormCharacter } from '../../worm/wormCharacterData.js';
import { WORM_SKINS, WORM_HATS, getSkin, getHat } from '../../worm/wormCosmeticsData.js';
import WormPreviewCanvas from '../../3d/WormPreviewCanvas.jsx';
import { wormMenuFeedback } from './wormMenuFeedback.js';
import './wormProfile.css';

const CATEGORIES = [
  { id: 'character', label: 'Worm', items: WORM_CHARACTERS },
  { id: 'skin', label: 'Color', items: WORM_SKINS },
  { id: 'hat', label: 'Hats', items: WORM_HATS }
];

// Both entry paths edit the same persisted equipment; arena settings never own it.
export default function WormProfile({ defaultExpanded = false }) {
  const id = useId();
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [category, setCategory] = useState('character');
  const characterId = useGameStore(s => s.wormCharacter ?? 'classic');
  const skinId = useGameStore(s => s.wormSkin ?? 'slime');
  const hatId = useGameStore(s => s.wormHat ?? 'none');
  const ownedItems = useGameStore(s => s.ownedItems);
  const demoMode = useGameStore(s => s.demoMode);
  const setCharacter = useGameStore(s => s.setWormCharacter);
  const setSkin = useGameStore(s => s.setWormSkin);
  const setHat = useGameStore(s => s.setWormHat);
  const character = getWormCharacter(characterId);
  const skin = getSkin(skinId);
  const hat = getHat(hatId);
  const selected = { character: characterId, skin: skinId, hat: hatId };
  const setters = { character: setCharacter, skin: setSkin, hat: setHat };
  const picker = CATEGORIES.find(item => item.id === category);

  return <section className="worm-profile" aria-labelledby={`${id}-title`} style={{ '--profile-color': skin.body }}>
    <div className="worm-profile-summary">
      <div className="worm-profile-preview" aria-hidden="true">
        <WormPreviewCanvas characterId={characterId} skinId={skinId} hatId={hatId}
          size={112} maxRenderPixels={224} framing="character" style={{ width: '100%', height: 'auto', aspectRatio: '1' }} />
      </div>
      <div className="worm-profile-identity">
        <h2 id={`${id}-title`}>Your worm</h2>
        <strong>{character.label}</strong>
        <span>{skin.label} · {hat.id === 'none' ? 'No hat' : hat.label}</span>
        <small>Levels & free play</small>
      </div>
      <button type="button" className="worm-profile-edit" aria-expanded={expanded} aria-controls={`${id}-editor`}
        onClick={() => { wormMenuFeedback(); setExpanded(value => !value); }}>
        {expanded ? 'Done' : 'Customize'} <span aria-hidden="true">{expanded ? '✓' : '✎'}</span>
      </button>
    </div>
    {expanded && <div id={`${id}-editor`} className="worm-profile-editor">
      <div className="worm-profile-categories" role="group" aria-label="Worm profile categories">
        {CATEGORIES.map(item => <button key={item.id} type="button" aria-pressed={category === item.id}
          onClick={() => { wormMenuFeedback(); setCategory(item.id); }}>{item.label}</button>)}
      </div>
      <div className="worm-profile-options" role="group" aria-label={`${picker.label} options`}>
        {picker.items.map(item => {
          const owned = !!demoMode || ownedItems.includes(`${category}_${item.id}`);
          const equipped = selected[category] === item.id;
          return <button type="button" key={item.id} disabled={!owned} aria-pressed={equipped}
            aria-label={`${item.label}${owned ? '' : ', locked'}`} className="worm-profile-option"
            onClick={() => { if (owned) { wormMenuFeedback(); setters[category](item.id); } }}>
            <span aria-hidden="true" className="worm-profile-option-art">
              {category === 'skin' ? <span className="worm-profile-swatch" style={{ background: item.body, borderColor: item.belly }} /> :
                <WormPreviewCanvas characterId={category === 'character' ? item.id : characterId}
                  skinId={skinId} hatId={category === 'hat' ? item.id : hatId} size={60}
                  framing={category === 'hat' ? 'head' : 'body'} />}
            </span>
            <strong>{item.label}</strong>
            <small>{!owned ? 'Locked' : equipped ? "Using ✓" : "Choose"}</small>
          </button>;
        })}
      </div>
      {category === 'character' && <p className="worm-profile-ability"><strong>{character.type}</strong> · {character.special}</p>}
      <p className="worm-profile-note">More worms and styles in the store.</p>
    </div>}
  </section>;
}
