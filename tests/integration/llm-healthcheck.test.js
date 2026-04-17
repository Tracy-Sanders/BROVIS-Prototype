// @vitest-environment jsdom
/**
 * Integration tests for the LLM Health-Check workflow.
 *
 * Environment: jsdom
 *
 * Mocks global fetch for all Claude and wiki API calls.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { renderHealthCheckPage } from '../../src/display/llm-healthcheck.js';

// ── Fake data ─────────────────────────────────────────────────────────────────

const FAKE_PAGES_LIST = { pages: ['Athens', 'Lisbon'] };
const FAKE_PAGE_ATHENS = { content: '# Athens\n\nAncient city in Greece.' };
const FAKE_PAGE_LISBON  = { content: '# Lisbon\n\nCapital of Portugal.' };

const HC_REPORT = `## 1. Contradictions\nNone found.\n\n## 2. Unverified Time-Sensitive Claims\nNone found.`;

const CLAUDE_RESPONSE = {
  content: [{ type: 'text', text: HC_REPORT }],
  stop_reason: 'end_turn', usage: {}
};

// ── Setup ─────────────────────────────────────────────────────────────────────

let container;

function jsonResp(data, status = 200) {
  return { ok: status < 400, status, json: async () => data };
}

function defaultFetch() {
  global.fetch = vi.fn(async (url) => {
    if (url === '/api/wiki/pages') return jsonResp(FAKE_PAGES_LIST);
    if (url.includes('name=Athens')) return jsonResp(FAKE_PAGE_ATHENS);
    if (url.includes('name=Lisbon')) return jsonResp(FAKE_PAGE_LISBON);
    if (url === '/api/claude/complete') return jsonResp(CLAUDE_RESPONSE);
    if (url === '/api/wiki/save-query') return jsonResp({ success: true, path: '/data/query/Health Check.md' });
    return jsonResp({ error: 'unexpected' }, 500);
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  document.body.innerHTML = '';
  container = document.createElement('div');
  document.body.appendChild(container);
  defaultFetch();
});

function getBody() { return container.querySelector('#hc-body'); }

async function clickRun() {
  renderHealthCheckPage(container);
  await new Promise(r => setTimeout(r, 20)); // let idle page-count fetch settle
  container.querySelector('#hc-run').click();
  await new Promise(r => setTimeout(r, 150)); // let full async chain settle
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('LLM Health-Check — initial render', () => {
  it('renders the idle step with a RUN button', async () => {
    renderHealthCheckPage(container);
    await new Promise(r => setTimeout(r, 20));
    expect(container.querySelector('#hc-run')).toBeTruthy();
  });

  it('shows the page count from /api/wiki/pages', async () => {
    renderHealthCheckPage(container);
    await new Promise(r => setTimeout(r, 50));
    const countEl = container.querySelector('#hc-page-count');
    // The text is a translation key in tests, but it should not be empty
    expect(countEl?.textContent.length).toBeGreaterThan(0);
  });
});

describe('LLM Health-Check — happy path', () => {
  it('shows a loading spinner while fetching pages', async () => {
    renderHealthCheckPage(container);
    await new Promise(r => setTimeout(r, 20));
    container.querySelector('#hc-run').click();
    await Promise.resolve(); // one microtask
    // Spinner should be visible before pages finish loading
    expect(getBody().textContent.length).toBeGreaterThan(0);
  });

  it('fetches all pages and calls Claude', async () => {
    await clickRun();
    const claudeCalls = global.fetch.mock.calls.filter(([u]) => u === '/api/claude/complete');
    expect(claudeCalls.length).toBe(1);
  });

  it('sends all page content in the Claude message', async () => {
    await clickRun();
    const claudeCall = global.fetch.mock.calls.find(([u]) => u === '/api/claude/complete');
    const body = JSON.parse(claudeCall[1].body);
    expect(body.messages[0].content).toContain('Athens');
    expect(body.messages[0].content).toContain('Lisbon');
  });

  it('renders the health report on the done step', async () => {
    await clickRun();
    expect(container.querySelector('#hc-report')).toBeTruthy();
    expect(container.querySelector('#hc-report').textContent).toContain('Contradictions');
  });

  it('shows the audited page count', async () => {
    await clickRun();
    expect(getBody().textContent).toContain('2');
  });

  it('renders COPY, FILE, and RERUN buttons', async () => {
    await clickRun();
    expect(container.querySelector('#hc-copy')).toBeTruthy();
    expect(container.querySelector('#hc-file')).toBeTruthy();
    expect(container.querySelector('#hc-rerun')).toBeTruthy();
  });
});

describe('LLM Health-Check — error states', () => {
  it('shows an error when no pages exist', async () => {
    global.fetch = vi.fn(async (url) => {
      if (url === '/api/wiki/pages') return jsonResp({ pages: [] });
      return jsonResp({}, 500);
    });

    renderHealthCheckPage(container);
    await new Promise(r => setTimeout(r, 20));
    container.querySelector('#hc-run').click();
    await new Promise(r => setTimeout(r, 50));

    expect(getBody().textContent).toMatch(/no pages|ingest/i);
    expect(container.querySelector('#hc-retry')).toBeTruthy();
  });

  it('shows an error when page list fetch fails', async () => {
    global.fetch = vi.fn(async (url) => {
      if (url === '/api/wiki/pages') throw new Error('Network down');
      return jsonResp({}, 500);
    });

    renderHealthCheckPage(container);
    await new Promise(r => setTimeout(r, 20));
    container.querySelector('#hc-run').click();
    await new Promise(r => setTimeout(r, 50));

    expect(getBody().textContent).toMatch(/failed|error/i);
  });

  it('proceeds with available pages when some page fetches fail (404)', async () => {
    global.fetch = vi.fn(async (url) => {
      if (url === '/api/wiki/pages') return jsonResp(FAKE_PAGES_LIST);
      if (url.includes('name=Athens')) return jsonResp({ error: 'not found' }, 404);
      if (url.includes('name=Lisbon')) return jsonResp(FAKE_PAGE_LISBON);
      if (url === '/api/claude/complete') return jsonResp(CLAUDE_RESPONSE);
      return jsonResp({}, 500);
    });

    await clickRun();
    // Should still reach the done step with 1 page (Lisbon)
    expect(container.querySelector('#hc-report')).toBeTruthy();
  });

  it('shows retry button when Claude fails', async () => {
    global.fetch = vi.fn(async (url) => {
      if (url === '/api/wiki/pages') return jsonResp(FAKE_PAGES_LIST);
      if (url.startsWith('/api/wiki/page')) return jsonResp(FAKE_PAGE_ATHENS);
      if (url === '/api/claude/complete') throw new Error('Claude timeout');
      return jsonResp({}, 500);
    });

    await clickRun();
    expect(container.querySelector('#hc-retry')).toBeTruthy();
  });
});

describe('LLM Health-Check — FILE button', () => {
  it('calls /api/wiki/save-query with the report markdown', async () => {
    await clickRun();
    container.querySelector('#hc-file').click();
    await new Promise(r => setTimeout(r, 50));

    const saveCalls = global.fetch.mock.calls.filter(([u]) => u === '/api/wiki/save-query');
    expect(saveCalls.length).toBe(1);

    const body = JSON.parse(saveCalls[0][1].body);
    expect(body.markdown).toContain(HC_REPORT);
  });

  it('shows the saved path in the status element', async () => {
    await clickRun();
    container.querySelector('#hc-file').click();
    await new Promise(r => setTimeout(r, 50));

    const status = container.querySelector('#hc-file-status');
    expect(status?.textContent).toContain('/data/query');
  });
});

describe('LLM Health-Check — RERUN button', () => {
  it('resets to the idle step when RERUN is clicked', async () => {
    await clickRun();
    container.querySelector('#hc-rerun').click();
    await new Promise(r => setTimeout(r, 20));

    expect(container.querySelector('#hc-run')).toBeTruthy();
    expect(container.querySelector('#hc-report')).toBeFalsy();
  });
});
