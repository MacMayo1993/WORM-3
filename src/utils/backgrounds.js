/**
 * Background configuration
 * Maps IDs to labels and file paths.
 * 
 * Note: .exr and .hdr files must be in public/environments/
 */

export const BACKGROUNDS = [
    // Presets removed as per user request
    // { id: 'blackhole', label: 'Black Hole', file: null },
    // { id: 'night', label: 'Night Sky', file: null },
    // { id: 'city', label: 'City Skyline', file: null },
    // { id: 'apartment', label: 'Apartment', file: null },
    // { id: 'studio', label: 'Photo Studio', file: null },
    // { id: 'warehouse', label: 'Warehouse', file: null },
    // { id: 'lobby', label: 'Modern Lobby', file: null },
    // { id: 'park', label: 'Park', file: null },

    // Custom file-based environments
    { id: 'beach', label: 'Beach', file: 'beach.hdr', thumbnail: 'thumbnails/beach.png' }, // Assuming beach.png exists or will exist
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
    { id: 'sunset', label: 'Sunset', file: 'sunset.exr', thumbnail: 'thumbnails/sunset.png' }, // Assuming sunset.png exists or will exist
    { id: 'umbrella', label: 'Umbrella', file: 'umbrella.exr', thumbnail: 'thumbnails/umbrella.png' },

    // Solid colors/simple themes removed
    // { id: 'dark', label: 'Dark', file: null },
    // { id: 'midnight', label: 'Midnight Blue', file: null },
];

export const getBackgroundUrl = (filename) => {
    if (!filename) return null;
    // Use Vite's BASE_URL to construct the correct path
    // If BASE_URL is '/', this results in '/environments/filename'
    // If BASE_URL is '/WORM-3/', this results in '/WORM-3/environments/filename'
    // Handle nested paths like 'thumbnails/file.png' correctly
    return `${import.meta.env.BASE_URL}environments/${filename}`;
};
