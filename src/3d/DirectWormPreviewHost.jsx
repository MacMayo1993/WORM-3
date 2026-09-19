import { lazy, Suspense, useSyncExternalStore } from 'react';
import { getDirectWormPreview, subscribeDirectWormPreview } from './directWormPreview.js';

// Canvas relocation is only needed when a character preview opens. Keep that
// renderer off the initial route while retaining the lightweight subscription.
const ActiveWormPreview = lazy(() => import('./ActiveWormPreview.jsx'));

export default function DirectWormPreviewHost() {
    const entry = useSyncExternalStore(subscribeDirectWormPreview, getDirectWormPreview, () => null);
    return entry ? <Suspense fallback={null}><ActiveWormPreview entry={entry} /></Suspense> : null;
}
