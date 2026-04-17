/**
 * LLM Health-Check workflow display.
 *
 * Reads all wiki pages and asks Claude to audit the knowledge base:
 *   - Contradictions between pages
 *   - Stale claims superseded by newer sources
 *   - Orphan pages with no inbound [[links]]
 *   - Concepts mentioned but lacking their own page
 *   - Missing cross-references between related pages
 *   - Data gaps that could be filled by new sources or searches
 *   - Suggested questions to investigate next
 *
 * Follows the Karparthy LLM schema from /metadata/llm-schema.md.
 */
import { chat, hasClaudeKey } from '../lib/claude.js';
import { t } from '../lib/i18n.js';

// ── System prompt ─────────────────────────────────────────────────────────────
// PROTECTED — backticks inside this template literal MUST be escaped as \` or the
// entire module graph fails to load and the app goes blank. See CLAUDE.md.

const HEALTHCHECK_SYSTEM = `You are a wiki health inspector. Your job is to audit a personal knowledge base and identify issues that would help the owner improve it.

Analyze the provided wiki pages and produce a structured health report covering ALL of the following:

## 1. Contradictions
Pages that make conflicting claims about the same fact. Quote the specific claims and name the pages.

## 2. Unverified Time-Sensitive Claims
Political status, government, economic conditions, safety/travel advisories, population figures, and ongoing conflicts change rapidly. List every such claim that is NOT followed by a \`(verified YYYY-MM-DD)\` tag. Quote the exact sentence and name the page. These need a verification date added.

## 3. Orphan Pages
Pages that have NO inbound [[wiki-links]] from other pages — they exist but nothing points to them.

## 4. Missing Pages
Concepts, places, people, or events mentioned with [[wiki-links]] in the pages but that do NOT have their own page yet.

## 5. Missing Cross-References
Pairs of pages that are clearly related but don't link to each other. Name the specific pages and explain the connection.

## 6. Data Gaps
Important information that is absent or thin across the wiki — topics worth researching further.

## 7. Suggested Next Questions
3–5 specific questions the owner should ask the wiki next, based on the gaps you found.

## 8. Suggested New Sources
2–3 types of sources (articles, books, datasets) that would meaningfully strengthen this knowledge base.

Be specific throughout — name the actual pages and quote actual content where relevant. If a category has no issues, say "None found."`;

// ── State ─────────────────────────────────────────────────────────────────────

let state = {
  step: 'idle',   // idle | loading | running | done
  pages: [],      // { name, content }
  report: ''
};

function resetState() {
  state = { step: 'idle', pages: [], report: '' };
}

// ── Render ────────────────────────────────────────────────────────────────────

export function renderHealthCheckPage(container) {
  resetState();
  container.innerHTML = '';

  const card = document.createElement('div');
  card.className = 'sitrep-card';

  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });

  card.innerHTML = `
    <div class="sitrep-header">${t('lint.header')} &mdash; ${dateStr} &mdash; ${timeStr}</div>
    <div id="hc-body"></div>
  `;
  container.appendChild(card);

  if (!hasClaudeKey()) {
    renderNoKey();
    return;
  }

  renderIdleStep();
}

function getBody() {
  return document.getElementById('hc-body');
}

// ── No key ────────────────────────────────────────────────────────────────────

function renderNoKey() {
  getBody().innerHTML = `
    <div class="sitrep-section ingest-section">
      <div class="sitrep-section-title">${t('lint.title.nokey')}</div>
      <div class="widget-unavailable">${t('lint.nokey')}</div>
    </div>
  `;
}

// ── Step 1: Idle — landing screen ────────────────────────────────────────────

function renderIdleStep() {
  getBody().innerHTML = `
    <div class="sitrep-section ingest-section">
      <div class="sitrep-section-title">${t('lint.title')}</div>
      <p class="ingest-hint">${t('lint.hint')}</p>
      <div id="hc-page-count" class="ingest-hint"></div>
      <div class="ingest-actions">
        <button id="hc-run" class="ingest-btn">${t('lint.btn.run')}</button>
      </div>
    </div>
  `;

  // Show page count while idle
  fetch('/api/wiki/pages')
    .then(r => r.json())
    .then(data => {
      const count = (data.pages || []).length;
      const el = document.getElementById('hc-page-count');
      if (el) el.textContent = count > 0
        ? t('lint.pagecount', { count })
        : t('lint.nopages');
    })
    .catch(() => {});

  document.getElementById('hc-run').addEventListener('click', handleRun);
}

// ── Step 2: Load all pages then run Claude ───────────────────────────────────

async function handleRun() {
  state.step = 'loading';

  // ── Fetch page list ───────────────────────────────────────────────────────
  getBody().innerHTML = `
    <div class="sitrep-section ingest-section">
      <div class="sitrep-section-title">${t('lint.title.loading')}</div>
      <div class="ingest-spinner">${t('lint.fetching')}</div>
    </div>
  `;

  let pageNames = [];
  try {
    const res = await fetch('/api/wiki/pages');
    const data = await res.json();
    pageNames = data.pages || [];
  } catch (err) {
    renderError(`Failed to list wiki pages: ${err.message}`);
    return;
  }

  if (pageNames.length === 0) {
    renderError('No pages found in /data/place/. Ingest some sources first.');
    return;
  }

  // ── Fetch each page in parallel ───────────────────────────────────────────
  getBody().innerHTML = `
    <div class="sitrep-section ingest-section">
      <div class="sitrep-section-title">${t('lint.title.loading')}</div>
      <div class="ingest-spinner">Reading ${pageNames.length} page(s)...</div>
    </div>
  `;

  const results = await Promise.allSettled(
    pageNames.map(async name => {
      const res = await fetch(`/api/wiki/page?name=${encodeURIComponent(name)}`);
      if (!res.ok) return null;
      const data = await res.json();
      return { name, content: data.content };
    })
  );

  state.pages = results
    .filter(r => r.status === 'fulfilled' && r.value)
    .map(r => r.value);

  if (state.pages.length === 0) {
    renderError('Could not read any wiki pages.');
    return;
  }

  // ── Run Claude health check ───────────────────────────────────────────────
  state.step = 'running';
  getBody().innerHTML = `
    <div class="sitrep-section ingest-section">
      <div class="sitrep-section-title">${t('lint.title')}</div>
      <div class="ingest-spinner">Analyzing ${state.pages.length} page(s) — this may take a moment...</div>
    </div>
  `;

  const wikiDump = state.pages
    .map(p => `## [[${p.name}]]\n\n${p.content}`)
    .join('\n\n---\n\n');

  try {
    state.report = await chat({
      messages: [{
        role: 'user',
        content: `Wiki pages (${state.pages.length} total):\n\n${wikiDump}\n\n---\n\nPlease run a full health check on this wiki.`
      }],
      system: HEALTHCHECK_SYSTEM,
      maxTokens: 4096,
      temperature: 0.3,
      cacheSystemPrompt: true
    });
  } catch (err) {
    renderError(`Claude health check failed: ${err.message}`);
    return;
  }

  state.step = 'done';
  renderDoneStep();
}

// ── Step 3: Done — display report ────────────────────────────────────────────

function renderDoneStep() {
  const pageList = state.pages.map(p => p.name).join(', ');

  getBody().innerHTML = `
    <div class="sitrep-section ingest-section">
      <div class="sitrep-section-title">${t('lint.title')}</div>
      <div class="ingest-summary">Pages audited: ${state.pages.length}</div>

      <div class="ingest-result-card" style="margin-top:1rem;">
        <div class="ingest-result-header">
          <span class="ingest-result-name">Full audit</span>
          <span class="ingest-result-path">${escapeHtml(pageList)}</span>
          <button class="ingest-copy-btn" id="hc-copy">${t('query.btn.copy')}</button>
        </div>
        <pre class="ingest-result-code" id="hc-report">${escapeHtml(state.report)}</pre>
      </div>

      <div class="ingest-actions">
        <button id="hc-file" class="ingest-btn">${t('query.btn.file')}</button>
        <button id="hc-rerun" class="ingest-btn ingest-btn-secondary">${t('lint.btn.run')}</button>
      </div>
      <div id="hc-file-status" class="ingest-hint" style="margin-top:0.5rem;"></div>
    </div>
  `;

  document.getElementById('hc-copy').addEventListener('click', () => {
    const btn = document.getElementById('hc-copy');
    navigator.clipboard.writeText(state.report).then(() => {
      btn.textContent = t('query.btn.copied');
      setTimeout(() => { btn.textContent = t('query.btn.copy'); }, 2000);
    });
  });

  document.getElementById('hc-file').addEventListener('click', handleFilePage);

  document.getElementById('hc-rerun').addEventListener('click', () => {
    resetState();
    renderIdleStep();
  });
}

async function handleFilePage() {
  const btn = document.getElementById('hc-file');
  const status = document.getElementById('hc-file-status');
  btn.textContent = t('query.btn.saving');
  btn.disabled = true;

  const now = new Date();
  const ts = now.toISOString().slice(0, 16).replace('T', ' ');
  const title = `Health Check ${now.toISOString().slice(0, 10)}`;
  const sources = state.pages.map(p => `[[${p.name}]]`).join(', ');

  const markdown = `---
type: health-check
pages_audited: ${state.pages.length}
sources: [${sources}]
created: ${ts}
---

# Wiki Health Check — ${now.toISOString().slice(0, 10)}

${state.report}
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
      <div class="sitrep-section-title">${t('lint.title')}</div>
      <div class="brovis-error">${escapeHtml(message)}</div>
      <div class="ingest-actions">
        <button id="hc-retry" class="ingest-btn">${t('query.btn.retry')}</button>
      </div>
    </div>
  `;
  document.getElementById('hc-retry').addEventListener('click', () => {
    resetState();
    renderIdleStep();
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function escapeHtml(str) {
  return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
