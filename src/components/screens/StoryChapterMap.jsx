import React, { useLayoutEffect, useRef, useState } from 'react';
import { storyStars, storyUnlocked, isChapterFinale, storyChapterIndex } from '../../worm/story/levels.js';
import { STORY_WORLDS } from '../../worm/story/worlds.js';
import { COLOR_SCHEMES } from '../../utils/colorSchemes.js';
import StoryWorldPreview from '../../worm/story/StoryWorldPreview.jsx';
import { mapNodePositions, mapTrailSegments, stageCode } from '../../worm/story/levelMapLayout.js';

const Star = ({ on }) => <svg viewBox="0 0 24 24" aria-hidden="true" data-on={on || undefined}>
  <path d="M12 2.6l2.9 6 6.5.8-4.8 4.5 1.2 6.5L12 17.2l-5.8 3.2 1.2-6.5L2.6 9.4l6.5-.8z" /></svg>;

const Lock = () => <svg className="worm-map-lock" viewBox="0 0 24 24" aria-hidden="true">
  <rect x="4.5" y="10.5" width="15" height="11" rx="2.5" /><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" fill="none" strokeWidth="2.6" />
  <circle cx="12" cy="15.6" r="1.7" /></svg>;

const Crown = () => <svg className="worm-map-crown" viewBox="0 0 32 22" aria-hidden="true">
  <path d="M3 19 1.5 5l8 6.5L16 1l6.5 10.5 8-6.5L29 19z" /><circle cx="16" cy="13" r="2" /></svg>;

// The player's worm peeks over the chosen stage, in its own skin colour.
const WormPin = ({ color }) => <span className="worm-map-pin" aria-hidden="true">
  <svg viewBox="0 0 48 44">
    <circle cx="13" cy="27" r="7" fill={color} /><circle cx="22" cy="22" r="9" fill={color} />
    <circle cx="33" cy="17" r="12" fill={color} />
    <circle cx="29" cy="14" r="3.6" fill="#fff" /><circle cx="38" cy="14" r="3.6" fill="#fff" />
    <circle cx="30" cy="14.6" r="1.7" fill="#1a1410" /><circle cx="39" cy="14.6" r="1.7" fill="#1a1410" />
    <path d="M30 21.5q3.5 3 7 0" fill="none" stroke="#1a1410" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
  <i />
</span>;

/**
 * A chapter as a world map: its ten stages are stickers on a winding trail.
 * Cleared stretches of trail are drawn as worm beads; the next unplayed stage
 * pulses; locked stages wear a padlock; the chapter's finale is a crowned,
 * larger stage. The map is the `.worm-level-grid` the rest of the screen and
 * its tests know: one button per stage, aria-pressed on the selected one.
 */
export default function StoryChapterMap({ chapter, progress, selected, onSelect, wormColor }) {
  const box = useRef(null);
  const [size, setSize] = useState({ w: 640, h: 400 });
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return undefined;
    const measure = () => { const r = el.getBoundingClientRect(); if (r.width && r.height) setSize({ w: r.width, h: r.height }); };
    measure();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const levels = chapter.levels;
  const points = mapNodePositions(levels.length);
  const segments = mapTrailSegments(points, size.w, size.h);
  const next = levels.find(item => storyUnlocked(progress, item.id) && !storyStars(progress, item.id));

  // Arrow keys walk the trail between unlocked stages, as on a game's map.
  const onKeyDown = e => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (!step) return;
    const at = levels.findIndex(item => item.id === selected);
    const target = levels[at + step];
    if (!target || !storyUnlocked(progress, target.id)) return;
    e.preventDefault();
    onSelect(target.id);
    box.current?.querySelector(`[data-level="${target.id}"]`)?.focus();
  };

  return <div ref={box} className="worm-level-grid worm-map" role="group" aria-label={`Chapter ${chapter.id} stages`} onKeyDown={onKeyDown}>
    <svg className="worm-map-trail" width={size.w} height={size.h} viewBox={`0 0 ${size.w} ${size.h}`} aria-hidden="true">
      {segments.map((d, i) => <path key={`base${i}`} d={d} className="worm-map-road" />)}
      {segments.map((d, i) => {
        const cleared = storyStars(progress, levels[i].id) > 0;
        return <path key={`top${i}`} d={d} className={cleared ? 'worm-map-beads' : 'worm-map-dashes'} />;
      })}
    </svg>
    {levels.map((item, i) => {
      const unlocked = storyUnlocked(progress, item.id), stars = storyStars(progress, item.id);
      const finale = isChapterFinale(item.id), isSelected = item.id === selected, isNext = item === next;
      const state = !unlocked ? 'locked' : stars ? 'cleared' : 'open';
      return <button key={item.id} type="button" data-level={item.id} disabled={!unlocked} title={item.title}
        aria-pressed={isSelected} aria-label={`Level ${item.id}: ${item.title}${unlocked ? `, ${stars} stars` : ', locked'}`}
        className={`worm-map-node is-${state}${finale ? ' is-finale' : ''}${isNext ? ' is-next' : ''}${isSelected ? ' selected' : ''}`}
        style={{ left: `${points[i].x * 100}%`, top: `${points[i].y * 100}%`, '--i': i,
          '--world-color': COLOR_SCHEMES[STORY_WORLDS[item.id].palette][1] }}
        onClick={() => onSelect(item.id)}>
        {isSelected && <WormPin color={wormColor} />}
        {finale && !isSelected && <Crown />}
        {unlocked && <span className="worm-map-stars" aria-hidden="true">{[0, 1, 2].map(n => <Star key={n} on={n < stars} />)}</span>}
        {isNext && !isSelected && <span className="worm-map-new" aria-hidden="true">New!</span>}
        <span className="worm-map-sticker">
          <StoryWorldPreview levelId={item.id} compact />
          {!unlocked && <Lock />}
        </span>
        <span className="worm-map-code worm-level-number" aria-hidden="true">{stageCode(chapter.id, storyChapterIndex(item.id))}</span>
      </button>;
    })}
  </div>;
}
