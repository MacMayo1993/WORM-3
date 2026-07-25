/**
 * Background configuration
 * Maps IDs to labels and file paths.
 * 
 * Note: .exr and .hdr files must be in public/environments/
 */

export const BACKGROUNDS = [
    // Presets removed as per user request
    // { id: 'night', label: 'Night Sky', file: null },
    // { id: 'city', label: 'City Skyline', file: null },
    // { id: 'apartment', label: 'Apartment', file: null },
    // { id: 'studio', label: 'Photo Studio', file: null },
    // { id: 'warehouse', label: 'Warehouse', file: null },
    // { id: 'lobby', label: 'Modern Lobby', file: null },
    // { id: 'park', label: 'Park', file: null },

    // Custom file-based environments
    { id: 'cave', label: 'Cave', file: 'cave.exr', thumbnail: 'thumbnails/cave.png' },
    { id: 'cobblestone', label: 'Cobblestone Street', file: 'cobblestone.exr', thumbnail: 'thumbnails/cobblestone.png' },
    { id: 'desert', label: 'Desert', file: 'desert.exr', thumbnail: 'thumbnails/desert.png' },
    { id: 'fireplace', label: 'Fireplace', file: 'fireplace.exr', thumbnail: 'thumbnails/fireplace.png' },
    { id: 'forest', label: 'Forest', file: 'forest.exr', thumbnail: 'thumbnails/forest.png' },
    { id: 'lounge', label: 'Lounge', file: 'lounge.exr', thumbnail: 'thumbnails/lounge.png' },
    { id: 'paris', label: 'Paris', file: 'paris.exr', thumbnail: 'thumbnails/paris.png' },

    { id: 'shanghai', label: 'Shanghai', file: 'shanghai.exr', thumbnail: 'thumbnails/Shanghai.png' },
    { id: 'snow', label: 'Snow Field', file: 'snow.exr', thumbnail: 'thumbnails/Snow Field.png' },
    { id: 'stadium', label: 'Stadium', file: 'stadium.exr', thumbnail: 'thumbnails/stadium.png' },
    { id: 'blackhole', label: 'Black Hole' },
    { id: 'nebula', label: 'Nebula' },
    { id: 'umbrella', label: 'Umbrella', file: 'umbrella.exr', thumbnail: 'thumbnails/umbrella.png' },

    // Solid colors/simple themes removed
    // { id: 'dark', label: 'Dark', file: null },
    // { id: 'midnight', label: 'Midnight Blue', file: null },
];

// Full photo panoramas only. Main-menu randomisation deliberately uses this
// list so procedural Black Hole/Nebula scenes are never selected there.
export const MENU_BACKGROUNDS = BACKGROUNDS.filter((background) => Boolean(background.file));

/**
 * Which shipped environment each Story chapter plays against.
 *
 * The chapters used to render hand-built low-poly scenes (LifeJourneyBackgrounds)
 * and — because GameScene only mounted a lighting environment for levels with NO
 * background set — they also got no image-based lighting at all. So the story
 * cube was both in front of weaker scenery and lit worse than every other mode,
 * whose panoramas supply the reflections that make the tile materials read.
 *
 * Chapter identity stays semantic in the level data ('daycare', 'nasa', …);
 * this table is the presentation layer, so re-casting a chapter is a one-line
 * change here rather than an edit to the level definition.
 *
 * Chapters mapped to null keep a bespoke procedural scene (black hole, nebula) —
 * those are real shader work, not placeholder geometry.
 */
export const STORY_ENVIRONMENTS = {
    daycare:      'umbrella.exr',    // a canopy of primary-coloured umbrellas — a child's world, in cube colours
    elementary:   'cobblestone.exr', // the walk to school, warm old-town stone
    middleschool: 'forest.exr',      // old enough to wander off the path
    highschool:   'stadium.exr',     // bright, open, everyone watching
    college:      'paris.exr',       // the city you move to, and grow up in
    job:          'shanghai.exr',    // towers, glass, adult scale
    nasa:         'lounge.exr',      // the biggest engineered interior we ship
    rocket:       'desert.exr',      // Milky Way over an empty launch plain
    moon:         null,              // NebulaEnvironment
    blackhole:    null,              // BlackHoleEnvironment
};

export const getBackgroundUrl = (filename) => {
    if (!filename) return null;
    // Use Vite's BASE_URL to construct the correct path
    // If BASE_URL is '/', this results in '/environments/filename'
    // If BASE_URL is '/WORM-3/', this results in '/WORM-3/environments/filename'
    // Handle nested paths like 'thumbnails/file.png' correctly
    return `${import.meta.env.BASE_URL}environments/${filename}`;
};
