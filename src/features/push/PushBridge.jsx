import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { isNativeApp } from '../../utils/platform.js';
import { sync } from '../sync/index.js';

/** Renders nothing. In the phone apps: opens the right screen when a notification is tapped, and keeps this phone's token fresh. */
export default function PushBridge() {
  const navigate = useNavigate();
  useEffect(() => {
    if (!isNativeApp()) return undefined;
    let off = () => {};
    let offSync = () => {};
    let lastUser = null;
    let alive = true;
    import('./pushService.js').then(async ({ getPushService }) => {
      const svc = await getPushService();
      if (!alive) return;
      off = svc.onOpen((path) => navigate(path));
      const maybeRefresh = () => {
        const { userId } = sync.getSnapshot();
        if (userId && userId !== lastUser) { lastUser = userId; svc.refresh(); } else if (!userId) lastUser = null;
      };
      offSync = sync.subscribe(maybeRefresh);
      maybeRefresh();
    });
    return () => { alive = false; off(); offSync(); };
  }, [navigate]);
  return null;
}
