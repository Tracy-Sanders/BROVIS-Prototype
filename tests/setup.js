/**
 * Global test setup — runs before every test file.
 *
 * Provides a fake config with a Claude API key so modules that call
 * getConfig() never throw "key not configured" during tests.
 */
import { vi } from 'vitest';

// Mock the config module so no real filesystem reads happen
vi.mock('../src/lib/config.js', () => ({
  getConfig: () => ({
    keys: { claude: 'test-claude-key-abc123' },
    i18n: { availableLanguages: ['en'], displayLanguage: 'en' }
  }),
  loadConfig: vi.fn().mockResolvedValue(undefined),
  updateConfig: vi.fn(),
  hasMinimumConfig: vi.fn().mockReturnValue(true)
}));

// Mock the i18n module — return the key as-is so tests can assert on raw keys
vi.mock('../src/lib/i18n.js', () => ({
  t: (key, _vars) => key,
  getLang: () => 'en'
}));

// NOTE: http.js is NOT mocked here. Unit tests that need to isolate fetchJson
// mock it locally. Integration tests mock global.fetch instead, which lets
// the real fetchJson forward calls through to the mock correctly.
