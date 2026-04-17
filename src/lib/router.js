/**
 * Lightweight hash-based router.
 *
 * Routes are plain strings matched against window.location.hash.
 * Supports:
 *   router.on('#sitrep', handler)   — exact match
 *   router.on('',        handler)   — empty hash / bare URL (default route)
 *   router.start()                  — fire the current route on load, then
 *                                     listen for hashchange events
 *   router.go('#config')            — push a new hash programmatically
 *
 * Handlers receive no arguments. Routing is purely presentational — the
 * router doesn't own the output DOM; callers do.
 */
export function createRouter() {
  const routes = new Map();

  function getRoute() {
    return window.location.hash || '';
  }

  function dispatch() {
    const hash = getRoute();
    const handler = routes.get(hash) ?? routes.get('*');
    if (handler) handler(hash);
  }

  return {
    on(hash, handler) {
      routes.set(hash, handler);
      return this;
    },

    go(hash) {
      window.location.hash = hash;
      // hashchange fires automatically when hash changes; if same hash,
      // force a dispatch so clicking the same nav link re-runs the route.
      if (window.location.hash === hash) dispatch();
    },

    start() {
      window.addEventListener('hashchange', dispatch);
      dispatch();
    }
  };
}
