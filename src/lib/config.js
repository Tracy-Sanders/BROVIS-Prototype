/**
 * BROVIS configuration — BYOK (Bring Your Own Key) model.
 *
 * User profile, preferences, and API keys are stored in browser storage.
 * This module is the single source of truth for reading/writing config and
 * is the only place that knows about the shape of the config object.
 *
 * Migration: on first load, if no stored config exists, we pull defaults from
 * /config.json (legacy) so existing users have a seamless transition. Keys
 * are never included in config.json — those must be entered by the user.
 */

import { storage } from './storage.js';

const CONFIG_KEY = 'config';

const DEFAULT_CONFIG = {
  user: {
    name: '',
    location: '',
    units: 'imperial',
    greeting: 'direct',
    interface: 'claude-dark'
  },
  keys: {
    openweather: '',
    newsapi: '',
    claude: '',
    googlemaps: ''
  },
  // Per-widget overrides. Shape: { <widgetId>: { enabled: boolean } }
  // Empty by default — each widget's `defaultEnabled` flag decides its state.
  widgets: {},
  modes: {
    'am-brief': {
      label: 'AM Brief',
      widgets: null,    // null = all globally enabled widgets
      calendarDate: 'today'
    },
    'pm-brief': {
      label: 'PM Brief',
      widgets: ['weather', 'calendar', 'tasks'],
      calendarDate: 'tomorrow'
    },
    'sitrep': {
      label: 'Situation Report',
      widgets: ['weather', 'news'],
      calendarDate: 'today'
    }
  },
  triggers: {
    'am-brief': ['am brief', 'good morning', 'morning coffee'],
    'pm-brief': ['pm brief', 'evening brief', 'tonight'],
    'sitrep': ['sitrep', 'morning brief', 'morning coffee', 'situation report', 'briefing']
  },
  i18n: {
    availableLanguages: ['en', 'es', 'de', 'zh'],
    displayLanguage: 'en'
  }
};

let cached = null;

/**
 * Load config from storage, falling back to legacy /config.json on first run.
 * Subsequent calls return the cached in-memory copy.
 */
export async function loadConfig() {
  if (cached) return cached;

  const stored = storage.get(CONFIG_KEY);
  if (stored) {
    cached = mergeDefaults(stored);
    return cached;
  }

  // First run: migrate from legacy /config.json if it exists.
  try {
    const res = await fetch('/config.json');
    if (res.ok) {
      const legacy = await res.json();
      cached = mergeDefaults(legacy);
      storage.set(CONFIG_KEY, cached);
      return cached;
    }
  } catch {
    // No legacy config — fall through to defaults.
  }

  cached = structuredClone(DEFAULT_CONFIG);
  storage.set(CONFIG_KEY, cached);
  return cached;
}

/**
 * Get the current config synchronously. Requires loadConfig() to have been
 * called at least once during app initialization.
 */
export function getConfig() {
  if (!cached) {
    throw new Error('Config not loaded. Call loadConfig() during init.');
  }
  return cached;
}

/**
 * Persist an updated config. Accepts a partial object that is deep-merged
 * into the existing config.
 */
export function updateConfig(partial) {
  cached = deepMerge(cached || structuredClone(DEFAULT_CONFIG), partial);
  storage.set(CONFIG_KEY, cached);
  return cached;
}

/**
 * Check whether the user has configured the minimum required fields to run
 * a SITREP (location + at least one API key).
 */
export function hasMinimumConfig() {
  const c = cached;
  if (!c) return false;
  return Boolean(c.user.location && (c.keys.openweather || c.keys.newsapi));
}

// Merge stored config with defaults so new config fields added in future
// versions get populated automatically for existing users.
function mergeDefaults(stored) {
  return deepMerge(structuredClone(DEFAULT_CONFIG), stored);
}

function deepMerge(target, source) {
  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      target[key] = deepMerge(target[key] || {}, source[key]);
    } else {
      target[key] = source[key];
    }
  }
  return target;
}
