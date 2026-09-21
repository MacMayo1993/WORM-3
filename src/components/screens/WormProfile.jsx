import { accessoryFraming, ACCESSORY_SLOTS, WORM_ACCESSORIES, EMPTY_ACCESSORIES } from '../../worm/handmadeAccessoriesData.js';
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
  { id: 'hat', label: 'Hats', items: WORM_HATS },
  ...ACCESSORY_SLOTS.map(slot => ({ id: slot, label: slot[0].toUpperCase() + slot.slice(1), items: [{id:'none',label:'None'}, ...WORM_ACCESSORIES.filter(item => item.slot === slot)] }))
];

// Both entry paths edit the same persisted equipment; arena settings never own it.
export default function WormProfile({ defaultExpanded = false }) {
  const id = useId();
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [category, setCategory] = useState('character');
  const characterId = useGameStore(s => s.wormCharacter ?? 'classic');
  const skinId = useGameStore(s => s.wormSkin ?? 'slime');
  const hatId = useGameStore(s => s.wormHat ?? 'none');
  const equipment = useGameStore(s => s.wormAccessories ?? EMPTY_ACCESSORIES);
  const setAccessory = useGameStore(s => s.setWormAccessory);
  const ownedItems = useGameStore(s => s.ownedItems);
  const demoMode = useGameStore(s => s.demoMode);
  const setCharacter = useGameStore(s => s.setWormCharacter);
  const setSkin = useGameStore(s => s.setWormSkin);
  const setHat = useGameStore(s => s.setWormHat);
  const character = getWormCharacter(characterId);
  const skin = getSkin(skinId);
  const hat = getHat(hatId);
  const selected = { character: characterId, skin: skinId, hat: hatId, ...equipment };
  const setters = { character: setCharacter, skin: setSkin, hat: setHat };
  const accessorySlot = ACCESSORY_SLOTS.includes(category);
  const picker = CATEGORIES.find(item => item.id === category);

  return <section className="worm-profile" aria-labelledby={`${id}-title`} style={{ '--profile-color': skin.body }}>
    <div className="worm-profile-summary">
      <div className="worm-profile-preview" aria-hidden="true">
        <WormPreviewCanvas characterId={characterId} skinId={skinId} hatId={hatId} accessories={equipment}
          size={112} maxRenderPixels={224} framing="character" style={{ width: '100%', height: 'auto', aspectRatio: '1' }} />
      </div>
      <div className="worm-profile-identity">
        <h2 id={`${id}-title`}>YOUR WORM</h2>
        <strong>{character.label}</strong>
        <span>{skin.label} · {hat.id === 'none' ? 'No hat' : hat.label}</span>
        <small>Story & Free Play</small>
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
          const owned = item.id === 'none' || !!demoMode || ownedItems.includes(`${accessorySlot ? 'accessory' : category}_${item.id}`);
          const equipped = selected[category] === item.id;
          return <button type="button" key={item.id} disabled={!owned} aria-pressed={equipped}
            aria-label={`${item.label}${owned ? '' : ', locked'}`} className="worm-profile-option"
            onClick={() => { if (owned) { wormMenuFeedback(); if(accessorySlot) setAccessory(category,item.id); else setters[category](item.id); } }}>
            <span aria-hidden="true" className="worm-profile-option-art">
              {category === 'skin' ? <span className="worm-profile-swatch" style={{ background: item.body, borderColor: item.belly }} /> :
                <WormPreviewCanvas characterId={category === 'character' ? item.id : characterId}
                  skinId={skinId} hatId={category === 'hat' ? item.id : hatId} size={60}
                  accessories={accessorySlot ? {...equipment,[category]:item.id} : equipment}
                  framing={accessorySlot ? accessoryFraming(category) : category === 'hat' ? 'head' : 'body'} />}
            </span>
            <strong>{item.label}</strong>
            <small>{!owned ? 'Locked' : equipped ? 'Equipped ✓' : 'Select'}</small>
          </button>;
        })}
      </div>
      {category === 'character' && <p className="worm-profile-ability"><strong>{character.type}</strong> · {character.special}</p>}
      <p className="worm-profile-note">Saved automatically for both modes. Unlock more in the Store.</p>
    </div>}
  </section>;
}
