/**
 * LLM Query workflow display.
 *
 * Two-step conversational flow against the wiki:
 *   1. User types a question
 *   2. Claude reads index.md and selects relevant pages
 *   3. Pages are fetched from /data/place/
 *   4. Claude synthesizes an answer with [[wiki-link]] citations
 *   5. Answer shown with COPY and FILE AS PAGE options
 *
 * Follows the Karparthy LLM schema from /metadata/llm-schema.md.
 */
import { chat, hasClaudeKey } from '../lib/claude.js';
import { t } from '../lib/i18n.js';

// ── System prompts ───────────────────────────────────────────────────────────

const PLAN_SYSTEM = `You are a wiki search assistant. Given a wiki index and a user question, identify which wiki pages are most relevant to answer the question.

Reply with ONLY a JSON array of page names (no markdown fences, no explanation). Maximum 8 pages.
Example: ["Santorini", "Mykonos", "Crete"]

If no pages are relevant, return an empty array: []`;

const SYNTHESIZE_SYSTEM = `You are BROVIS, an intelligence assistant with access to a personal wiki. Answer the user's question using only the provided wiki pages.

Guidelines:
- Cite sources inline using [[Page Name]] wiki-link format
- Be specific and factual — draw directly from the page content
- If the wiki pages don't contain enough information, say so clearly
- Format your answer in plain markdown (headers, bullets, tables as appropriate)
- Keep citations natural and inline, not as a separate reference list`;

// ── State ────────────────────────────────────────────────────────────────────

let state = {
  step: 'input',       // input | planning | fetching | synthesizing | done
  question: '',
  relevantPages: [],   // page names Claude identified
  fetchedPages: [],    // { name, content } actually fetched
  answer: ''
};

function resetState() {
  state = { step: 'input', question: '', relevantPages: [], fetchedPages: [], answer: '' };
}

// ── Render ───────────────────────────────────────────────────────────────────

export function renderQueryPage(container) {
  resetState();
  container.innerHTML = '';

  const card = document.createElement('div');
  card.className = 'sitrep-card';

  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });

  card.innerHTML = `
    <div class="sitrep-header">${t('query.header')} &mdash; ${dateStr} &mdash; ${timeStr}</div>
    <div id="query-body"></div>
  `;
  container.appendChild(card);

  if (!hasClaudeKey()) {
    renderNoKey();
    return;
  }

  renderInputStep();
}

function getBody() {
  return document.getElementById('query-body');
}

// ── No key ───────────────────────────────────────────────────────────────────

function renderNoKey() {
  getBody().innerHTML = `
    <div class="sitrep-section ingest-section">
      <div class="sitrep-section-title">${t('query.title.nokey')}</div>
      <div class="widget-unavailable">${t('query.nokey')}</div>
    </div>
  `;
}

// ── Step 1: Input ────────────────────────────────────────────────────────────

function renderInputStep() {
  getBody().innerHTML = `
    <div class="sitrep-section ingest-section">
      <div class="sitrep-section-title">${t('query.title')}</div>
      <p class="ingest-hint">${t('query.hint')}</p>
      <textarea id="query-input" class="ingest-textarea" rows="4"
        placeholder="${t('query.placeholder')}"></textarea>
      <div class="ingest-actions">
        <button id="query-submit" class="ingest-btn">${t('query.btn.query')}</button>
      </div>
    </div>
  `;

  const textarea = document.getElementById('query-input');
  document.getElementById('query-submit').addEventListener('click', () => handleQuery(textarea.value.trim()));

  textarea.addEventListener('keydown', e => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      handleQuery(textarea.value.trim());
    }
  });
}

// ── Step 2–4: Planning → Fetching → Synthesizing ─────────────────────────────

async function handleQuery(question) {
  if (!question) return;
  state.question = question;

  // ── Planning: ask Claude which pages to read ──────────────────────────────
  state.step = 'planning';
  getBody().innerHTML = `
    <div class="sitrep-section ingest-section">
      <div class="sitrep-section-title">${t('query.title.searching')}</div>
      <div class="ingest-spinner">${t('query.searching')}</div>
    </div>
  `;

  let indexContent = '';
  try {
    const res = await fetch('/api/wiki/index');
    const data = await res.json();
    indexContent = data.content || '';
  } catch (err) {
    renderError(`Failed to read wiki index: ${err.message}`);
    return;
  }

  if (!indexContent) {
    renderError('Wiki index is empty. Ingest some sources first.');
    return;
  }

  let relevantPages = [];
  try {
    const planReply = await chat({
      messages: [{
        role: 'user',
        content: `Wiki index:\n\n${indexContent}\n\nQuestion: ${question}`
      }],
      system: PLAN_SYSTEM,
      maxTokens: 256,
      temperature: 0.2,
      cacheSystemPrompt: true
    });

    // Parse the JSON array from Claude's reply
    const parsed = tryParseArray(planReply);
    relevantPages = Array.isArray(parsed) ? parsed.slice(0, 8) : [];
  } catch (err) {
    renderError(`Claude planning failed: ${err.message}`);
    return;
  }

  if (relevantPages.length === 0) {
    renderError('No relevant wiki pages found for that question. Try ingesting more sources.');
    return;
  }

  state.relevantPages = relevantPages;

  // ── Fetching: retrieve each page ──────────────────────────────────────────
  state.step = 'fetching';
  getBody().innerHTML = `
    <div class="sitrep-section ingest-section">
      <div class="sitrep-section-title">${t('query.title.fetching')}</div>
      <div class="ingest-spinner">Reading ${relevantPages.length} page(s): ${relevantPages.join(', ')}...</div>
    </div>
  `;

  const fetchResults = await Promise.allSettled(
    relevantPages.map(async name => {
      const res = await fetch(`/api/wiki/page?name=${encodeURIComponent(name)}`);
      if (!res.ok) return null; // 404 — page referenced in index but not on disk
      const data = await res.json();
      return { name, content: data.content };
    })
  );

  state.fetchedPages = fetchResults
    .filter(r => r.status === 'fulfilled' && r.value)
    .map(r => r.value);

  if (state.fetchedPages.length === 0) {
    renderError('Could not read any wiki pages. Check that pages exist in /data/place/.');
    return;
  }

  // ── Synthesizing: ask Claude to answer ───────────────────────────────────
  state.step = 'synthesizing';
  getBody().innerHTML = `
    <div class="sitrep-section ingest-section">
      <div class="sitrep-section-title">${t('query.title.synthesizing')}</div>
      <div class="ingest-spinner">Reading ${state.fetchedPages.length} page(s) and composing answer...</div>
    </div>
  `;

  const pagesBlock = state.fetchedPages
    .map(p => `## [[${p.name}]]\n\n${p.content}`)
    .join('\n\n---\n\n');

  try {
    state.answer = await chat({
      messages: [{
        role: 'user',
        content: `Wiki pages:\n\n${pagesBlock}\n\n---\n\nQuestion: ${question}`
      }],
      system: SYNTHESIZE_SYSTEM,
      maxTokens: 2048,
      temperature: 0.4,
      cacheSystemPrompt: true
    });
  } catch (err) {
    renderError(`Claude synthesis failed: ${err.message}`);
    return;
  }

  state.step = 'done';
  renderDoneStep();
}

// ── Step 5: Done — display answer ────────────────────────────────────────────

function renderDoneStep() {
  const citedNames = state.fetchedPages.map(p => p.name).join(', ');

  getBody().innerHTML = `
    <div class="sitrep-section ingest-section">
      <div class="sitrep-section-title">${t('query.title.answer')}</div>
      <div class="ingest-summary">${escapeHtml(state.question)}</div>

      <div class="ingest-result-card" style="margin-top:1rem;">
        <div class="ingest-result-header">
          <span class="ingest-result-name">${t('query.sources')}</span>
          <span class="ingest-result-path">${escapeHtml(citedNames)}</span>
        </div>
        <pre class="ingest-result-code" id="query-answer">${escapeHtml(state.answer)}</pre>
      </div>

      <div class="ingest-actions">
        <button id="query-copy" class="ingest-btn">${t('query.btn.copy')}</button>
        <button id="query-file" class="ingest-btn">${t('query.btn.file')}</button>
        <button id="query-new" class="ingest-btn ingest-btn-secondary">${t('query.btn.new')}</button>
      </div>
      <div id="query-file-status" class="ingest-hint" style="margin-top:0.5rem;"></div>
    </div>
  `;

  document.getElementById('query-copy').addEventListener('click', () => {
    const btn = document.getElementById('query-copy');
    navigator.clipboard.writeText(state.answer).then(() => {
      btn.textContent = t('query.btn.copied');
      setTimeout(() => { btn.textContent = t('query.btn.copy'); }, 2000);
    });
  });

  document.getElementById('query-file').addEventListener('click', handleFilePage);

  document.getElementById('query-new').addEventListener('click', () => {
    resetState();
    renderInputStep();
  });
}

async function handleFilePage() {
  const btn = document.getElementById('query-file');
  const status = document.getElementById('query-file-status');
  btn.textContent = t('query.btn.saving');
  btn.disabled = true;

  // Build page title from first 60 chars of question
  const title = state.question.slice(0, 60).replace(/[^\w\s\-]/g, '').trim() || 'query';
  const now = new Date().toISOString().slice(0, 16).replace('T', ' ');
  const sources = state.fetchedPages.map(p => `[[${p.name}]]`).join(', ');

  const markdown = `---
type: query
question: "${state.question.replace(/"/g, "'")}"
sources: [${sources}]
created: ${now}
---

# Query: ${state.question}

${state.answer}
`;

  try {
    const res = await fetch('/api/wiki/save-query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, markdown })
    });
    const data = await res.json();
    if (res.ok && data.success) {
      btn.textContent = t('query.btn.filed');
      status.textContent = `Saved to ${data.path}`;
    } else {
      btn.textContent = t('query.btn.failed');
      status.textContent = data.error || 'Save failed';
    }
  } catch (err) {
    btn.textContent = t('query.btn.failed');
    status.textContent = err.message;
  }

  setTimeout(() => {
    btn.textContent = t('query.btn.file');
    btn.disabled = false;
  }, 3000);
}

// ── Error display ─────────────────────────────────────────────────────────────

function renderError(message) {
  getBody().innerHTML = `
    <div class="sitrep-section ingest-section">
      <div class="sitrep-section-title">${t('query.title.failed')}</div>
      <div class="brovis-error">${escapeHtml(message)}</div>
      <div class="ingest-actions">
        <button id="query-retry" class="ingest-btn">${t('query.btn.retry')}</button>
      </div>
    </div>
  `;
  document.getElementById('query-retry').addEventListener('click', () => {
    const prev = state.question;
    resetState();
    renderInputStep();
    if (prev) document.getElementById('query-input').value = prev;
  });
}

// ── Helpers ──────────────────────────────────────────────────────────────────

export function tryParseArray(str) {
  // Direct parse
  try { const v = JSON.parse(str.trim()); if (Array.isArray(v)) return v; } catch { /* continue */ }

  // Extract first [...] block
  const start = str.indexOf('[');
  const end = str.lastIndexOf(']');
  if (start !== -1 && end > start) {
    try { const v = JSON.parse(str.slice(start, end + 1)); if (Array.isArray(v)) return v; } catch { /* continue */ }
  }
  return [];
}

function escapeHtml(str) {
  return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
