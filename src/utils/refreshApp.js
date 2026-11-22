/** Drops the service worker and its caches, then reloads from the network. Progress (localStorage) is untouched. */
export async function refreshApp() {
  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }
    if (typeof caches !== 'undefined') {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  } catch { /* best effort */ }
  location.reload();
}
