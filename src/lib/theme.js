/**
 * Theme management — applies the user's selected interface type to the document.
 *
 * Supported values:
 *   'retro'        — Green-on-black terminal dashboard
 *   'claude-dark'  — Claude.ai dark (default)
 *   'claude-light' — Claude.ai light
 *   'claude-system'— Follows the OS preference; switches live on change
 */

let _systemQuery = null;
let _systemHandler = null;

export function applyTheme(name) {
  // Normalize legacy value from the previous 'claude-ai' option → claude-dark
  if (name === 'claude-ai') name = 'claude-dark';

  // Remove any existing system-preference listener before applying a new theme
  if (_systemQuery && _systemHandler) {
    _systemQuery.removeEventListener('change', _systemHandler);
    _systemQuery = null;
    _systemHandler = null;
  }

  if (name === 'claude-system') {
    _systemQuery = window.matchMedia('(prefers-color-scheme: dark)');
    _systemHandler = e => {
      document.documentElement.dataset.theme = e.matches ? 'claude-dark' : 'claude-light';
    };
    // Apply immediately, then listen for OS changes
    document.documentElement.dataset.theme = _systemQuery.matches ? 'claude-dark' : 'claude-light';
    _systemQuery.addEventListener('change', _systemHandler);
  } else {
    document.documentElement.dataset.theme = name || 'claude-dark';
  }
}
