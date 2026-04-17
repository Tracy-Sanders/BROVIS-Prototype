// @vitest-environment jsdom
/**
 * Integration tests for the LLM Query workflow.
 *
 * Environment: jsdom
 *
 * Strategy: mock global fetch to control all network responses, then
 * call renderQueryPage(container) and drive the UI by clicking buttons
 * and asserting on DOM state.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { renderQueryPage } from '../../src/display/llm-query.js';

// ── Fake API responses ────────────────────────────────────────────────────────

const FAKE_INDEX = { content: '| [[Athens]] | City | Greece | Ancient capital |' };
const FAKE_PAGES_LIST = ['Athens'];
const FAKE_PAGE_CONTENT = { content: '# Athens\n\nAncient city in Greece.' };

/** Claude plan response — a JSON array of page names */
const PLAN_RESPONSE = {
  content: [{ type: 'text', text: '["Athens"]' }],
  stop_reason: 'end_turn',
  usage: {}
};

/** Claude synthesis response */
const SYNTH_RESPONSE = {
  content: [{ type: 'text', text: 'Athens is famous for the Acropolis. [[Athens]]' }],
  stop_reason: 'end_turn',
  usage: {}
};

// ── Setup ─────────────────────────────────────────────────────────────────────

let container;

beforeEach(() => {
  vi.clearAllMocks();
  // Clean up from previous test then set up a fresh container
  document.body.innerHTML = '';
  container = document.createElement('div');
  document.body.appendChild(container);

  // Default fetch mock: wire up expected endpoints
  global.fetch = vi.fn(async (url) => {
    if (url === '/api/wiki/index') return jsonResp(FAKE_INDEX);
    if (url.startsWith('/api/wiki/page')) return jsonResp(FAKE_PAGE_CONTENT);
    if (url === '/api/claude/complete') return jsonResp(PLAN_RESPONSE);
    return jsonResp({ error: 'unexpected url' }, 500);
  });
});

function jsonResp(data, status = 200) {
  return {
    ok: status < 400,
    status,
    json: async () => data
  };
}

// Sequentially return different fetch responses for the two Claude calls
function mockTwoClaudeCalls() {
  let calls = 0;
  global.fetch = vi.fn(async (url) => {
    if (url === '/api/wiki/index') return jsonResp(FAKE_INDEX);
    if (url.startsWith('/api/wiki/page')) return jsonResp(FAKE_PAGE_CONTENT);
    if (url === '/api/claude/complete') {
      calls++;
      return jsonResp(calls === 1 ? PLAN_RESPONSE : SYNTH_RESPONSE);
    }
    return jsonResp({ error: 'unexpected' }, 500);
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getBody() {
  return container.querySelector('#query-body');
}

async function submitQuestion(question = 'What is Athens known for?') {
  renderQueryPage(container);
  const textarea = container.querySelector('#query-input');
  const btn = container.querySelector('#query-submit');
  textarea.value = question;
  btn.click();
  // Yield to allow async handlers to run
  await new Promise(r => setTimeout(r, 50));
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('LLM Query — renderQueryPage', () => {
  it('renders the input step with a textarea and submit button', () => {
    renderQueryPage(container);
    expect(container.querySelector('#query-input')).toBeTruthy();
    expect(container.querySelector('#query-submit')).toBeTruthy();
  });
});

describe('LLM Query — happy path', () => {
  it('shows planning spinner after submitting a question', async () => {
    mockTwoClaudeCalls();
    renderQueryPage(container);
    const textarea = container.querySelector('#query-input');
    textarea.value = 'Tell me about Athens';
    container.querySelector('#query-submit').click();

    // Immediately after click, before async resolves
    await Promise.resolve();
    // The body should show some kind of loading/searching indicator
    expect(getBody().textContent.length).toBeGreaterThan(0);
  });

  it('renders answer with COPY, FILE, and NEW buttons after full flow', async () => {
    mockTwoClaudeCalls();
    await submitQuestion('What is Athens known for?');

    // Allow all microtasks to settle
    await new Promise(r => setTimeout(r, 100));

    expect(container.querySelector('#query-answer')).toBeTruthy();
    expect(container.querySelector('#query-copy')).toBeTruthy();
    expect(container.querySelector('#query-file')).toBeTruthy();
    expect(container.querySelector('#query-new')).toBeTruthy();
  });

  it('displays the synthesized answer text', async () => {
    mockTwoClaudeCalls();
    await submitQuestion('What is Athens known for?');
    await new Promise(r => setTimeout(r, 100));

    const answer = container.querySelector('#query-answer');
    expect(answer?.textContent).toContain('Acropolis');
  });

  it('NEW button resets to the input step', async () => {
    mockTwoClaudeCalls();
    await submitQuestion();
    await new Promise(r => setTimeout(r, 100));

    container.querySelector('#query-new')?.click();
    await Promise.resolve();

    expect(container.querySelector('#query-input')).toBeTruthy();
    expect(container.querySelector('#query-answer')).toBeFalsy();
  });
});

describe('LLM Query — error states', () => {
  it('shows an error when the wiki index is empty', async () => {
    global.fetch = vi.fn(async (url) => {
      if (url === '/api/wiki/index') return jsonResp({ content: '' });
      return jsonResp({}, 500);
    });

    await submitQuestion();
    await new Promise(r => setTimeout(r, 50));

    expect(getBody().textContent).toMatch(/empty|ingest/i);
    expect(container.querySelector('#query-retry')).toBeTruthy();
  });

  it('shows an error when the wiki index fetch fails', async () => {
    global.fetch = vi.fn(async () => { throw new Error('Network error'); });

    await submitQuestion();
    await new Promise(r => setTimeout(r, 50));

    expect(getBody().textContent).toMatch(/failed|error/i);
  });

  it('shows an error when Claude returns no relevant pages', async () => {
    global.fetch = vi.fn(async (url) => {
      if (url === '/api/wiki/index') return jsonResp(FAKE_INDEX);
      if (url === '/api/claude/complete') return jsonResp({
        content: [{ type: 'text', text: '[]' }],
        stop_reason: 'end_turn', usage: {}
      });
      return jsonResp({}, 500);
    });

    await submitQuestion();
    await new Promise(r => setTimeout(r, 50));

    expect(getBody().textContent).toMatch(/no relevant|ingest/i);
  });

  it('shows an error when all page fetches fail', async () => {
    global.fetch = vi.fn(async (url) => {
      if (url === '/api/wiki/index') return jsonResp(FAKE_INDEX);
      if (url === '/api/claude/complete') return jsonResp(PLAN_RESPONSE);
      if (url.startsWith('/api/wiki/page')) return jsonResp({ error: 'not found' }, 404);
      return jsonResp({}, 500);
    });

    await submitQuestion();
    await new Promise(r => setTimeout(r, 100));

    expect(getBody().textContent).toMatch(/could not read|no.*page/i);
  });
});

describe('LLM Query — FILE button', () => {
  it('calls save-query endpoint and shows success status', async () => {
    mockTwoClaudeCalls();
    const origFetch = global.fetch;

    // Intercept the save call after the two Claude calls succeed
    let savedCalled = false;
    global.fetch = vi.fn(async (url, opts) => {
      if (url === '/api/wiki/save-query') {
        savedCalled = true;
        return jsonResp({ success: true, path: '/data/query/test.md' });
      }
      return origFetch(url, opts);
    });

    await submitQuestion('What is Athens known for?');
    await new Promise(r => setTimeout(r, 100));

    container.querySelector('#query-file')?.click();
    await new Promise(r => setTimeout(r, 50));

    expect(savedCalled).toBe(true);
  });
});
