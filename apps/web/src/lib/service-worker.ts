/**
 * Registers the offline shell in production builds only: in development a cached shell
 * would hide code changes. A failure to register is harmless; the app simply needs a
 * connection to load.
 */
export function registerServiceWorker(): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) {
    return;
  }
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js').catch(() => undefined);
  });
}
