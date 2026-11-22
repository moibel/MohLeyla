import { useSyncExternalStore } from 'react';
import { sync } from './index.js';

export const useSync = () => useSyncExternalStore(sync.subscribe, sync.getSnapshot, sync.getSnapshot);
