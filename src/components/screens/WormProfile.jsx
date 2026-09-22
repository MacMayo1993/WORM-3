import { getCraftDetails, accessoryFraming, ACCESSORY_SLOTS, WORM_ACCESSORIES, EMPTY_ACCESSORIES } from '../../worm/handmadeAccessoriesData.js';
import React, { useId, useRef, useState } from 'react';
import { useGameStore } from '../../hooks/useGameStore.js';
import { WORM_CHARACTERS, getWormCharacter } from '../../worm/wormCharacterData.js';
import { WORM_SKINS, WORM_HATS, getSkin, getHat } from '../../worm/wormCosmeticsData.js';
import WormPreviewCanvas from '../../3d/WormPreviewCanvas.jsx';
import { wormMenuFeedback } from './wormMenuFeedback.js';
import './wormProfile.css';

const SLOT_ICONS = { face: '◉', neck: '⋈', body: '▧', tail: '〰' };
const CATEGORIES = [
  { id: 'character', label: 'Worm', icon: '∿', title: 'Worms', items: WORM_CHARACTERS },
  { id: 'skin', label: 'Color', icon: '◐', title: 'Colors', items: WORM_SKINS },
  { id: 'hat', label: 'Hats', icon: '♧', title: 'Hats', items: WORM_HATS },
  ...ACCESSORY_SLOTS.map(slot => ({ id: slot, icon: SLOT_ICONS[slot], label: slot[0].toUpperCase() + slot.slice(1),
    title: `${slot[0].toUpperCase() + slot.slice(1)} Accessories`, items: [{ id: 'none', label: 'None' }, ...WORM_ACCESSORIES.filter(item => item.slot === slot)] }))
];

// Both entry paths edit the same persisted equipment; arena settings never own it.
export default function WormProfile({ defaultExpanded = false }) {
  const id = useId();
  const tabs = useRef([]);
  const editButton = useRef(null);
  const workspace = useRef(null);
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [category, setCategory] = useState('character');
  const [focusedId, setFocusedId] = useState(null);
  const [ownedOnly, setOwnedOnly] = useState(false);
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
  const isOwned = item => item.id === 'none' || !!demoMode || ownedItems.includes(`${accessorySlot ? 'accessory' : category}_${item.id}`);
  const equippedLabel = cat => cat.items.find(item => item.id === selected[cat.id])?.label ?? 'None';
  const chooseCategory = index => { wormMenuFeedback(); setCategory(CATEGORIES[index].id); setFocusedId(null); if (workspace.current) workspace.current.scrollTop = 0; };
  const onTabKeyDown = (event, index) => {
    let next;
    if (event.key === 'ArrowDown') next = (index + 1) % CATEGORIES.length;
    else if (event.key === 'ArrowUp') next = (index - 1 + CATEGORIES.length) % CATEGORIES.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = CATEGORIES.length - 1;
    else return;
    event.preventDefault(); chooseCategory(next); tabs.current[next]?.focus();
  };
  const items = picker.items.filter(item => !ownedOnly || isOwned(item));
  const focused = items.find(item => item.id === focusedId) ?? items.find(item => item.id === selected[category]) ?? items[0];
  const focusIndex = items.indexOf(focused);
  const details = getCraftDetails(focused?.id);
  const focusedOwned = focused && isOwned(focused);
  const focusedEquipped = focused?.id === selected[category];
  const stepFocus = delta => { wormMenuFeedback(); setFocusedId(items[(focusIndex + delta + items.length) % items.length]?.id); };
  const equipFocused = () => {
    if (!focusedOwned || focusedEquipped) return;
    wormMenuFeedback();
    if (accessorySlot) setAccessory(category, focused.id);
    else setters[category](focused.id);
  };
  const previewProps = item => ({
    characterId: category === 'character' ? item.id : characterId,
    skinId: category === 'skin' ? item.id : skinId,
    hatId: category === 'hat' ? item.id : hatId,
    accessories: accessorySlot ? { ...equipment, [category]: item.id } : equipment,
    framing: accessorySlot ? accessoryFraming(category) : category === 'hat' ? 'head' : 'character',
  });
  const preview = <div className="worm-profile-preview" aria-hidden="true">
    <WormPreviewCanvas characterId={characterId} skinId={skinId} hatId={hatId} accessories={equipment}
      size={112} maxRenderPixels={224} animated={false}
      framing="character" style={{ width: '100%', height: 'auto', aspectRatio: '1' }} />
  </div>;
  const identity = <div className="worm-profile-identity">
    <strong>{character.label}</strong>
    <span>{skin.label} · {hat.id === 'none' ? 'No hat' : hat.label}</span>
    <small>{expanded ? character.type : 'Story & Free Play'}</small>
  </div>;

  return <section className={`worm-profile${expanded ? ' worm-profile-expanded' : ''}`} aria-labelledby={`${id}-title`}
    style={{ '--profile-color': skin.body }}>
    <header className="worm-profile-header">
      <div><h2 id={`${id}-title`}>YOUR WORM</h2>{expanded && <span>Customize Worm</span>}</div>
      <button ref={editButton} type="button" className="worm-profile-edit" aria-expanded={expanded} aria-controls={`${id}-editor`}
        onClick={() => { wormMenuFeedback(); setExpanded(value => !value); }}>
        {expanded ? 'Done' : 'Customize'} <span aria-hidden="true">{expanded ? '✓' : '✎'}</span>
      </button>
    </header>
    {!expanded ? <div className="worm-profile-summary">{preview}{identity}</div> :
      <div id={`${id}-editor`} className="worm-profile-editor">
        <div className="worm-profile-categories" role="tablist" aria-label="Worm profile categories" aria-orientation="vertical">
          {CATEGORIES.map((item, index) => <button key={item.id} ref={el => { tabs.current[index] = el; }} type="button"
            role="tab" id={`${id}-tab-${item.id}`} aria-label={item.label} aria-selected={category === item.id}
            aria-controls={`${id}-panel`} tabIndex={category === item.id ? 0 : -1}
            onKeyDown={event => onTabKeyDown(event, index)} onClick={() => chooseCategory(index)}>
            <i aria-hidden="true">{item.icon}</i><span><strong>{item.label}</strong><small>{equippedLabel(item)}</small></span>
          </button>)}
        </div>
        <div className="worm-profile-workspace" ref={workspace}>
          <div className="worm-profile-panel" role="tabpanel" id={`${id}-panel`} aria-labelledby={`${id}-tab-${category}`} tabIndex={0}>
            <div className="worm-profile-panel-heading">
              <div><span className="worm-profile-kicker">YOUR COLLECTION</span><h3>{picker.title}</h3></div>
              <button className="worm-profile-filter" aria-pressed={ownedOnly} onClick={() => { setOwnedOnly(value => !value); setFocusedId(null); }}>Owned only</button>
            </div>
            {focused ? <div className="worm-profile-feature" style={{ '--piece-color': details?.color ?? skin.body }}>
              <div className="worm-profile-feature-art" aria-hidden="true">
                <WormPreviewCanvas {...previewProps(focused)} size={220} maxRenderPixels={440} animated
                  style={{ width: '100%', maxWidth: 240, height: 'auto', aspectRatio: '1' }} />
              </div>
              <div className="worm-profile-feature-info">
                <span className="worm-profile-kicker">{details?.label ?? picker.label} · {focusIndex + 1}/{items.length}</span>
                <h4>{focused.label}</h4>
                <p>{details?.description ?? (category === 'character' ? focused.special : focused.id === 'none' ? `Keep your ${category === 'hat' ? 'head' : category} clear.` : category === 'skin' ? 'A fresh color for your whole crawler.' : 'A finishing touch for your crawler.')}</p>
                <button className="worm-profile-equip" disabled={!focusedOwned || focusedEquipped} onClick={equipFocused}>
                  {focusedEquipped ? '✓ Equipped' : focusedOwned ? 'Equip' : (focused.price != null ? `${focused.price} PP · In Store` : 'Available in Store')}
                </button>
                {!focusedOwned && <small>Unlock this piece in the Store.</small>}
              </div>
              <div className="worm-profile-feature-nav"><button aria-label="Previous item" onClick={() => stepFocus(-1)}>‹</button><button aria-label="Next item" onClick={() => stepFocus(1)}>›</button></div>
            </div> : <p className="worm-profile-note">No owned items here yet. Turn off Owned only to explore this collection.</p>}
            <div className="worm-profile-grid-heading"><span>{items.length} Pieces</span><small>{picker.items.filter(isOwned).length} / {picker.items.length} Owned</small></div>
            <div className="worm-profile-options" role="group" aria-label={`${picker.label} options`} key={category}>
              {items.map(item => {
                const owned = isOwned(item), equipped = selected[category] === item.id;
                const craft = getCraftDetails(item.id);
                return <button type="button" key={item.id} aria-pressed={focused?.id === item.id}
                  aria-label={`${item.label}${owned ? '' : ', locked'}`} className={`worm-profile-option${equipped ? ' is-equipped' : ''}`}
                  style={{ '--piece-color': craft?.color ?? skin.body }}
                  onClick={() => { wormMenuFeedback(); setFocusedId(item.id); if (workspace.current) workspace.current.scrollTop = 0; }}>
                  <span aria-hidden="true" className="worm-profile-option-art">
                    {item.id === 'none' ? <span className="worm-profile-none">∅</span> :
                      <WormPreviewCanvas {...previewProps(item)} size={96}
                        hatId={category === 'hat' ? item.id : 'none'}
                        accessories={accessorySlot ? { [category]: item.id } : EMPTY_ACCESSORIES} />}
                  </span>
                  <strong>{item.label}</strong>
                  <small>{equipped ? '✓ Equipped' : owned ? 'Owned' : 'Store exclusive'}</small>
                  {craft && <span className="worm-profile-collection">{craft.label}</span>}
                </button>;
              })}
            </div>
          </div>

        </div>
      </div>}
    {expanded && <footer className="worm-profile-footer"><div className="worm-profile-saved">{preview}<span><b aria-hidden="true">✓</b> Your Equipped Worm{identity}<small>Saved for Story & Free Play</small></span></div>
      <button type="button" onClick={() => { wormMenuFeedback(); setExpanded(false); editButton.current?.focus(); }}>Ready <span aria-hidden="true">→</span></button>
    </footer>}
  </section>;
}
