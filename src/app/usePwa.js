import { useEffect, useState } from 'react';
import { registerSW } from 'virtual:pwa-register';

/** Registers the service worker, exposes update + install prompts. */
export function usePwa() {
  const [needRefresh, setNeedRefresh] = useState(false);
  const [offlineReady, setOfflineReady] = useState(false);
  const [installEvent, setInstallEvent] = useState(null);
  const [updateSW, setUpdateSW] = useState(null);

  useEffect(() => {
    const update = registerSW({
      onNeedRefresh: () => setNeedRefresh(true),
      onOfflineReady: () => setOfflineReady(true),
    });
    setUpdateSW(() => update);
    const onPrompt = (e) => {
      e.preventDefault();
      setInstallEvent(e);
    };
    const onInstalled = () => setInstallEvent(null);
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  return {
    needRefresh,
    offlineReady,
    dismissUpdate: () => setNeedRefresh(false),
    dismissOffline: () => setOfflineReady(false),
    reload: () => updateSW && updateSW(true),
    canInstall: !!installEvent,
    install: async () => {
      if (!installEvent) return;
      installEvent.prompt();
      await installEvent.userChoice;
      setInstallEvent(null);
    },
  };
}
