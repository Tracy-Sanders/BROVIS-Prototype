/**
 * Unit tests for pure parser functions:
 *   - tryParseArray  (src/display/llm-query.js)
 *   - extractJson    (src/display/llm-ingest.js)
 *
 * These are pure functions with no DOM or network dependencies.
 * The display modules import claude.js and i18n.js which are mocked
 * in tests/setup.js, so side-effects during module load are suppressed.
 */
import { describe, it, expect, vi } from 'vitest';

// The display modules manipulate the DOM at module-load time only via
// exported render functions (which we don't call here), so jsdom is not
// required.  We just need the mocks from setup.js to silence the imports.
vi.mock('../../src/lib/http.js', () => ({ fetchJson: vi.fn() }));

import { tryParseArray } from '../../src/display/llm-query.js';
import { extractJson }   from '../../src/display/llm-ingest.js';

// ── tryParseArray ─────────────────────────────────────────────────────────────

describe('tryParseArray', () => {
  it('parses a clean JSON array', () => {
    expect(tryParseArray('["Santorini","Mykonos"]')).toEqual(['Santorini', 'Mykonos']);
  });

  it('parses an empty array', () => {
    expect(tryParseArray('[]')).toEqual([]);
  });

  it('extracts an array embedded in prose', () => {
    const reply = 'Based on the index, the relevant pages are: ["Athens", "Crete"] — let me know if you need more.';
    expect(tryParseArray(reply)).toEqual(['Athens', 'Crete']);
  });

  it('extracts an array from a multi-line Claude response', () => {
    const reply = `Here are the most relevant pages:

["Paris", "Lyon", "Marseille"]

These should cover your question.`;
    expect(tryParseArray(reply)).toEqual(['Paris', 'Lyon', 'Marseille']);
  });

  it('returns [] when no array exists in the string', () => {
    expect(tryParseArray('No relevant pages found.')).toEqual([]);
  });

  it('returns [] for a completely empty string', () => {
    expect(tryParseArray('')).toEqual([]);
  });

  it('returns [] when brackets are malformed', () => {
    expect(tryParseArray('[unclosed')).toEqual([]);
  });

  it('trims whitespace before parsing', () => {
    expect(tryParseArray('  ["Rome"]  ')).toEqual(['Rome']);
  });
});

// ── extractJson ───────────────────────────────────────────────────────────────

const VALID_EXTRACTION = {
  source_title: 'Test Source',
  source_url: 'https://example.com',
  places: [
    {
      name: 'Caracas',
      country: 'Venezuela',
      lat: '10.48',
      lng: '-66.88',
      type: 'City',
      best_for: ['history', 'culture'],
      description: 'Capital of Venezuela',
      body: 'Caracas is the capital city of Venezuela.',
      related: ['Venezuela'],
      rating: 4
    }
  ],
  summary: 'A source about Caracas, Venezuela.'
};

describe('extractJson', () => {
  it('parses a clean JSON string directly', () => {
    const result = extractJson(JSON.stringify(VALID_EXTRACTION));
    expect(result.places).toHaveLength(1);
    expect(result.places[0].name).toBe('Caracas');
  });

  it('extracts JSON from a markdown fenced block', () => {
    const reply = '```json\n' + JSON.stringify(VALID_EXTRACTION) + '\n```';
    const result = extractJson(reply);
    expect(result.places[0].name).toBe('Caracas');
  });

  it('extracts JSON when preceded by prose', () => {
    const reply = 'Here is the extracted data:\n' + JSON.stringify(VALID_EXTRACTION);
    const result = extractJson(reply);
    expect(result.places[0].name).toBe('Caracas');
  });

  it('repairs a truncated JSON response (missing closing braces)', () => {
    const full = JSON.stringify(VALID_EXTRACTION);
    // Simulate truncation — chop off last 30 chars
    const truncated = full.slice(0, full.length - 30);
    const result = extractJson(truncated);
    // Should not throw; result may be partial but should parse
    expect(result).not.toBeNull();
  });

  it('returns null when the string is completely unparseable', () => {
    expect(extractJson('This is just plain text with no JSON at all.')).toBeNull();
  });

  it('returns null for an empty string', () => {
    expect(extractJson('')).toBeNull();
  });

  it('handles a JSON object without markdown fences', () => {
    const obj = { source_title: 'X', places: [], summary: 'y' };
    expect(extractJson(JSON.stringify(obj))).toEqual(obj);
  });
});
