import { createContext } from 'react';

export const MenuPortalContext = createContext(null);

// Separate from navigation frames: one opaque draw serves every menu portal.
export const MenuFlipPortalContext = createContext(null);
