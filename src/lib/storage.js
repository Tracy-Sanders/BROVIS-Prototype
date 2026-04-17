/**
 * Storage abstraction for BROVIS configuration and user data.
 *
 * Tier 1 (Open Source): localStorage-backed. Runs entirely in the browser.
 * Tier 2 (Free BROVIS): swaps to a server-backed implementation with the same
 *   interface — widgets and config code never change.
 *
 * All values are JSON-serialized. Keys are namespaced under `brovis.` to avoid
 * collisions with other apps on the same origin.
 */

const NS = 'brovis.';

export const storage = {
  /**
   * Retrieve a stored value by key.
   * @param {string} key
   * @param {any} [fallback] Returned if the key is not set or parsing fails.
   * @returns {any}
   */
  get(key, fallback = null) {
    try {
      const raw = localStorage.getItem(NS + key);
      if (raw == null) return fallback;
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  },

  /**
   * Persist a value by key.
   * @param {string} key
   * @param {any} value Any JSON-serializable value.
   */
  set(key, value) {
    localStorage.setItem(NS + key, JSON.stringify(value));
  },

  /**
   * Remove a key from storage.
   * @param {string} key
   */
  remove(key) {
    localStorage.removeItem(NS + key);
  },

  /**
   * Clear all BROVIS-namespaced keys. Does not touch other apps' data.
   */
  clear() {
    const toRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(NS)) toRemove.push(k);
    }
    toRemove.forEach(k => localStorage.removeItem(k));
  }
};
