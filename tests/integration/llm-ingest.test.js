// @vitest-environment jsdom
/**
 * Integration tests for the LLM Ingest workflow.
 *
 * Environment: jsdom
 *
 * Mocks global fetch for all Claude and wiki API calls.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { renderIngestPage } from '../../src/display/llm-ingest.js';

// ── Fake data ─────────────────────────────────────────────────────────────────

const EXTRACTION = {
  source_title: 'Travel Guide',
  source_url: 'https://example.com',
  places: [
    {
      name: 'Lisbon',
      country: 'Portugal',
      lat: '38.71',
      lng: '-9.13',
      type: 'City',
      best_for: ['history', 'seafood'],
      description: 'Capital of Portugal',
      body: 'Lisbon is the historic capital of Portugal.',
      related: ['Portugal'],
      rating: 5
    }
  ],
  summary: 'A travel guide covering Lisbon.'
};

const EXTRACT_RESPONSE = {
  content: [{ type: 'text', text: JSON.stringify(EXTRACTION) }],
  stop_reason: 'end_turn', usage: {}
};

const GENERATE_RESPONSE = {
  content: [{ type: 'text', text: '---\nup:\n  - "[[Portugal]]"\ncreated: 2026-04-15 10:00\n---\n\nLisbon is a historic city.' }],
  stop_reason: 'end_turn', usage: {}
};

// ── Setup ─────────────────────────────────────────────────────────────────────

let container;

beforeEach(() => {
  vi.clearAllMocks();
  document.body.innerHTML = '';
  container = document.createElement('div');
  document.body.appendChild(container);

  let claudeCalls = 0;
  global.fetch = vi.fn(async (url) => {
    if (url === '/api/claude/complete') {
      claudeCalls++;
      // First call = extract, second call = generate
      return jsonResp(claudeCalls === 1 ? EXTRACT_RESPONSE : GENERATE_RESPONSE);
    }
    if (url === '/api/ingest/save-pages') {
      return jsonResp({ success: true, saved: ['Lisbon'], message: 'Saved 1 page(s)' });
    }
    return jsonResp({ error: 'unexpected' }, 500);
  });
});

function jsonResp(data, status = 200) {
  return { ok: status < 400, status, json: async () => data };
}

function getBody() { return container.querySelector('#ingest-body'); }

async function clickAnalyze(text = 'Lisbon is a great city in Portugal.') {
  renderIngestPage(container);
  container.querySelector('#ingest-source').value = text;
  container.querySelector('#ingest-analyze').click();
  await new Promise(r => setTimeout(r, 100));
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('LLM Ingest — initial render', () => {
  it('renders source textarea and analyze button', () => {
    renderIngestPage(container);
    expect(container.querySelector('#ingest-source')).toBeTruthy();
    expect(container.querySelector('#ingest-analyze')).toBeTruthy();
  });

  it('does not proceed when textarea is empty', async () => {
    renderIngestPage(container);
    container.querySelector('#ingest-analyze').click();
    await Promise.resolve();
    // Still on input step
    expect(container.querySelector('#ingest-source')).toBeTruthy();
  });
});

describe('LLM Ingest — analyze step', () => {
  it('shows a spinner while analyzing', async () => {
    renderIngestPage(container);
    container.querySelector('#ingest-source').value = 'Some text';
    container.querySelector('#ingest-analyze').click();
    await Promise.resolve(); // one tick — spinner should be visible
    expect(getBody().textContent.length).toBeGreaterThan(0);
  });

  it('renders place review cards after successful extraction', async () => {
    await clickAnalyze();
    expect(container.querySelector('#ingest-places')).toBeTruthy();
    expect(getBody().textContent).toContain('Lisbon');
  });

  it('renders a checkbox for each extracted place', async () => {
    await clickAnalyze();
    const checkboxes = container.querySelectorAll('#ingest-places input[type="checkbox"]');
    expect(checkboxes.length).toBe(1);
    expect(checkboxes[0].checked).toBe(true);
  });

  it('shows the source summary', async () => {
    await clickAnalyze();
    expect(getBody().textContent).toContain('A travel guide covering Lisbon');
  });
});

describe('LLM Ingest — generate step', () => {
  it('renders result cards with page markdown after generate', async () => {
    await clickAnalyze();
    container.querySelector('#ingest-generate').click();
    await new Promise(r => setTimeout(r, 100));

    // Should be on done step with result cards
    expect(getBody().querySelector('.ingest-result-card')).toBeTruthy();
    expect(getBody().textContent).toContain('Lisbon');
  });

  it('renders a SAVE ALL button on the done step', async () => {
    await clickAnalyze();
    container.querySelector('#ingest-generate').click();
    await new Promise(r => setTimeout(r, 100));

    expect(container.querySelector('#ingest-save-all')).toBeTruthy();
  });
});

describe('LLM Ingest — save all', () => {
  it('calls /api/ingest/save-pages and updates button text', async () => {
    await clickAnalyze();
    container.querySelector('#ingest-generate').click();
    await new Promise(r => setTimeout(r, 100));

    const saveBtn = container.querySelector('#ingest-save-all');
    saveBtn.click();
    await new Promise(r => setTimeout(r, 50));

    // fetch should have been called with save-pages URL
    const saveCalls = global.fetch.mock.calls.filter(([url]) => url === '/api/ingest/save-pages');
    expect(saveCalls.length).toBe(1);

    const body = JSON.parse(saveCalls[0][1].body);
    expect(body.pages[0].name).toBe('Lisbon');
  });
});

describe('LLM Ingest — error handling', () => {
  it('shows error and retry button when Claude returns invalid JSON', async () => {
    global.fetch = vi.fn(async (url) => {
      if (url === '/api/claude/complete') {
        return jsonResp({
          content: [{ type: 'text', text: 'This is not JSON at all.' }],
          stop_reason: 'end_turn', usage: {}
        });
      }
      return jsonResp({}, 500);
    });

    await clickAnalyze();
    expect(getBody().textContent).toMatch(/unexpected format|missing.*places/i);
    expect(container.querySelector('#ingest-retry')).toBeTruthy();
  });

  it('shows error when Claude returns JSON without a places array', async () => {
    global.fetch = vi.fn(async (url) => {
      if (url === '/api/claude/complete') {
        return jsonResp({
          content: [{ type: 'text', text: '{"source_title":"x","summary":"y"}' }],
          stop_reason: 'end_turn', usage: {}
        });
      }
      return jsonResp({}, 500);
    });

    await clickAnalyze();
    expect(container.querySelector('#ingest-retry')).toBeTruthy();
  });

  it('back button on review step restores input with original text', async () => {
    const src = 'Lisbon is a great city in Portugal.';
    await clickAnalyze(src);
    container.querySelector('#ingest-back').click();
    await Promise.resolve();

    expect(container.querySelector('#ingest-source').value).toBe(src);
  });

  it('NEW button on done step resets to input', async () => {
    await clickAnalyze();
    container.querySelector('#ingest-generate').click();
    await new Promise(r => setTimeout(r, 100));

    container.querySelector('#ingest-new').click();
    await Promise.resolve();

    expect(container.querySelector('#ingest-source')).toBeTruthy();
    expect(container.querySelector('#ingest-result-card')).toBeFalsy();
  });
});
