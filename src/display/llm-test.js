/**
 * Test Suite workflow display.
 *
 * Runs `npm test` and `npm run test:coverage` on the server
 * and displays the raw CLI output in two pre-formatted blocks.
 */
import { t } from '../lib/i18n.js';

// ── State ─────────────────────────────────────────────────────────────────────

let state = { step: 'idle', test: '', coverage: '' };

function resetState() {
  state = { step: 'idle', test: '', coverage: '' };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function getBody() {
  return document.getElementById('test-body');
}

// ── Render ────────────────────────────────────────────────────────────────────

export function renderTestPage(container) {
  resetState();
  container.innerHTML = '';

  const card = document.createElement('div');
  card.className = 'sitrep-card';

  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });

  card.innerHTML = `
    <div class="sitrep-header">${t('test.header')} &mdash; ${dateStr} &mdash; ${timeStr}</div>
    <div id="test-body"></div>
  `;
  container.appendChild(card);
  renderIdle();
}

function renderIdle() {
  getBody().innerHTML = `
    <div class="sitrep-section ingest-section">
      <div class="sitrep-section-title">${t('test.title')}</div>
      <div class="ingest-hint">${t('test.hint')}</div>
      <button class="ingest-btn" id="test-run">${t('test.btn.run')}</button>
    </div>
  `;
  document.getElementById('test-run').addEventListener('click', handleRun);
}

async function handleRun() {
  state.step = 'running';
  getBody().innerHTML = `
    <div class="sitrep-section ingest-section">
      <div class="sitrep-section-title">${t('test.title.running')}</div>
      <div class="ingest-spinner">${t('test.running')}</div>
    </div>
  `;
  try {
    const res = await fetch('/api/test/run', { method: 'POST' });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    state = { step: 'done', test: data.test, coverage: data.coverage };
    renderDone();
  } catch (err) {
    getBody().innerHTML = `
      <div class="sitrep-section ingest-section">
        <div class="sitrep-section-title">${t('test.title.failed')}</div>
        <div class="brovis-error">${escapeHtml(err.message)}</div>
        <button class="ingest-btn-secondary" id="test-rerun">${t('test.btn.rerun')}</button>
      </div>
    `;
    document.getElementById('test-rerun').addEventListener('click', handleRun);
  }
}

function renderDone() {
  const { passed, total, failed, duration, failedTests } = state.test;
  const allPassed = failed === 0;

  const passLine = `${passed}/${total} passed`;
  const durLine  = duration ? ` \u00b7 ${duration}` : '';
  const statusColor = allPassed ? 'color:var(--color-accent,#4fc3f7)' : 'color:#ef5350';

  const failBlock = failedTests.length
    ? `<div class="ingest-result-card" style="margin-top:0.75rem">
        <div class="ingest-result-header"><span>FAILED TESTS</span></div>
        <pre class="ingest-result-code">${failedTests.map(escapeHtml).join('\n')}</pre>
      </div>`
    : '';

  getBody().innerHTML = `
    <div class="sitrep-section ingest-section">
      <div class="sitrep-section-title">${t('test.title.results')}</div>

      <div class="ingest-summary" style="${statusColor};font-size:1.1rem;font-weight:bold;margin-bottom:0.5rem">
        ${escapeHtml(passLine)}${escapeHtml(durLine)}
      </div>
      ${failBlock}

      <div class="ingest-result-card" style="margin-top:0.75rem">
        <div class="ingest-result-header"><span>${t('test.label.coverage')}</span></div>
        <pre class="ingest-result-code" id="test-cov">${escapeHtml(state.coverage)}</pre>
      </div>

      <button class="ingest-btn-secondary" id="test-rerun">${t('test.btn.rerun')}</button>
    </div>
  `;
  document.getElementById('test-rerun').addEventListener('click', handleRun);
}
