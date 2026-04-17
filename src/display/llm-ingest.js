/**
 * LLM Ingest workflow display.
 *
 * Multi-step conversational flow:
 *   1. User pastes or uploads a source document
 *   2. Claude extracts key takeaways — displayed for review
 *   3. User confirms — Claude generates structured wiki pages
 *   4. Generated pages displayed with copy/download buttons
 *
 * Follows the Karparthy LLM schema from /metadata/llm-schema.md.
 */
import { chat, hasClaudeKey } from '../lib/claude.js';
import { t, getLang } from '../lib/i18n.js';
import { getConfig } from '../lib/config.js';

// ── Language support ──────────────────────────────────────────────────────────

const LANG_NAMES = { es: 'Spanish', de: 'German', zh: 'Chinese (Simplified)' };

const TRANSLATE_SYSTEM = `You are a technical translator. You will receive an Obsidian wiki page in English markdown format.
Translate the body text and YAML description field to {targetLang}. Preserve all markdown structure, YAML frontmatter keys, [[wiki links]], and (verified YYYY-MM-DD) tags exactly. Output raw markdown only — no fences, no explanation.`;

// ── System prompts ───────────────────────────────────────────────────────────

const EXTRACT_SYSTEM = `You are BROVIS, an intelligence assistant using the Karparthy LLM method with Obsidian as a lightweight RAG.

Your task: read a source document and extract key takeaways about PLACES mentioned in it. For each place, identify:
- Official name and aliases
- Country / region it belongs to
- Coordinates (lat, lng) if inferrable
- Key facts: population, climate, history highlights, culture, notable landmarks
- Best-for tags (e.g. history, beaches, nightlife, architecture)
- Any related places mentioned (links)

Respond in this JSON format (no markdown fences):
{
  "source_title": "...",
  "source_url": "...",
  "places": [
    {
      "name": "...",
      "country": "...",
      "lat": "...",
      "lng": "...",
      "type": "City|Country|Landmark|Region|Battle|Island",
      "best_for": ["..."],
      "description": "one-line summary",
      "body": "2-4 sentence overview with key facts",
      "related": ["Place1", "Place2"],
      "rating": 5
    }
  ],
  "summary": "2-3 sentence overview of the source document"
}`;

const GENERATE_SYSTEM = `You are BROVIS. Generate an Obsidian wiki page for a place using this exact YAML frontmatter format. Output raw markdown only — no fences.

---
up:
  - "[[Country]]"
related:
  - "[[Related Place]]"
created: YYYY-MM-DD HH:MM
categories:
  - "[[Places]]"
type:
  - "[[Type]]"
rating: N
location:
  - "lat"
  - "lng"
color: green
icon: binoculars
description: One-line description.
---

Body text with [[wiki links]] to related places. Keep it concise — 2-4 sentences of the most useful information for a traveler or researcher.

IMPORTANT — time-sensitive claims: Any statement about current political status, government, economic conditions, safety/travel advisories, population figures, or ongoing conflicts MUST be followed inline by a last-verified date in the format (verified YYYY-MM-DD). Example: "Venezuela is currently under authoritarian rule (verified 2026-04-14)." Omit the tag only for stable historical facts (ancient ruins, geography, founding dates).`;

// ── State ────────────────────────────────────────────────────────────────────

let state = {
  step: 'input',        // input | reviewing | generating | done
  sourceText: '',
  extraction: null,     // parsed JSON from Claude
  pages: [],            // { name, markdown } generated pages
  messages: []          // chat history for multi-turn
};

function resetState() {
  state = { step: 'input', sourceText: '', extraction: null, pages: [], messages: [] };
}

// ── Render ───────────────────────────────────────────────────────────────────

export function renderIngestPage(container) {
  resetState();
  container.innerHTML = '';

  const card = document.createElement('div');
  card.className = 'sitrep-card';

  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });

  card.innerHTML = `
    <div class="sitrep-header">${t('ingest.header')} &mdash; ${dateStr} &mdash; ${timeStr}</div>
    <div id="ingest-body"></div>
  `;
  container.appendChild(card);

  if (!hasClaudeKey()) {
    renderNoKey();
    return;
  }

  renderInputStep();
}

function getBody() {
  return document.getElementById('ingest-body');
}

// ── Step 1: Input ────────────────────────────────────────────────────────────

function renderNoKey() {
  getBody().innerHTML = `
    <div class="sitrep-section">
      <div class="sitrep-section-title">${t('ingest.title.nokey')}</div>
      <div class="widget-unavailable">${t('ingest.nokey')}</div>
    </div>
  `;
}

function renderInputStep() {
  getBody().innerHTML = `
    <div class="sitrep-section ingest-section">
      <div class="sitrep-section-title">${t('ingest.title.input')}</div>
      <p class="ingest-hint">${t('ingest.hint.paste')}</p>
      <div id="ingest-drop" class="ingest-drop">
        <span>${t('ingest.drop')}</span>
      </div>
      <textarea id="ingest-source" class="ingest-textarea" rows="12"
        placeholder="${t('ingest.placeholder')}"></textarea>
      <div class="ingest-actions">
        <button id="ingest-analyze" class="ingest-btn">${t('ingest.btn.analyze')}</button>
      </div>
    </div>
  `;

  // Wire up drag-and-drop
  const drop = document.getElementById('ingest-drop');
  drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('drag-over'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('drag-over'));
  drop.addEventListener('drop', e => {
    e.preventDefault();
    drop.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        document.getElementById('ingest-source').value = reader.result;
      };
      reader.readAsText(file);
    }
  });

  document.getElementById('ingest-analyze').addEventListener('click', handleAnalyze);
}

// ── Step 2: Analyze → Review ─────────────────────────────────────────────────

/**
 * Rough character-based truncation to keep large articles within
 * Haiku's context window. 1 token ≈ 4 chars; Haiku allows ~190k
 * input tokens, but we budget conservatively for system prompt +
 * output overhead.
 */
const MAX_SOURCE_CHARS = 120_000;   // ~30k tokens

function truncateSource(text) {
  if (text.length <= MAX_SOURCE_CHARS) return text;
  return text.slice(0, MAX_SOURCE_CHARS) + '\n\n[... document truncated for analysis ...]';
}

/**
 * Try hard to pull a JSON object out of Claude's reply, which may
 * contain prose, markdown fences, or trailing commentary.
 * Also repairs incomplete JSON from truncated responses.
 */
export function extractJson(reply) {
  // 1. Direct parse
  try { return JSON.parse(reply); } catch { /* continue */ }

  // 2. Markdown fenced block (greedy — grab the largest one)
  const fenceMatch = reply.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    try { return JSON.parse(fenceMatch[1]); } catch { /* continue */ }
  }

  // 3. Find the outermost { … } substring and try direct parse
  let jsonStr = null;
  const start = reply.indexOf('{');
  if (start !== -1) {
    // If no closing brace found, use everything from start to end
    let end = reply.lastIndexOf('}');
    if (end <= start) end = reply.length - 1;
    jsonStr = reply.slice(start, end + 1);
    try { return JSON.parse(jsonStr); } catch { /* continue */ }
  }

  // 4. Repair truncated JSON by closing incomplete structures
  if (jsonStr) {
    try {
      let repaired = jsonStr;
      let braceDepth = 0;
      let bracketDepth = 0;
      let inString = false;
      let escaped = false;

      // Scan to find unclosed structures
      for (let i = 0; i < repaired.length; i++) {
        const c = repaired[i];

        if (escaped) {
          escaped = false;
          continue;
        }

        if (c === '\\' && inString) {
          escaped = true;
          continue;
        }

        if (c === '"') {
          inString = !inString;
          continue;
        }

        if (inString) continue;

        if (c === '{') braceDepth++;
        else if (c === '}') braceDepth = Math.max(0, braceDepth - 1);
        else if (c === '[') bracketDepth++;
        else if (c === ']') bracketDepth = Math.max(0, bracketDepth - 1);
      }

      // Close unterminated string
      if (inString) repaired += '"';

      // Close unclosed structures (arrays first, then objects)
      for (let i = 0; i < bracketDepth; i++) repaired += ']';
      for (let i = 0; i < braceDepth; i++) repaired += '}';

      return JSON.parse(repaired);
    } catch { /* continue */ }
  }

  return null;
}

async function handleAnalyze() {
  const textarea = document.getElementById('ingest-source');
  const text = textarea.value.trim();
  if (!text) return;

  state.sourceText = text;
  state.step = 'reviewing';

  const truncated = truncateSource(text);
  const wasTruncated = truncated.length < text.length;

  getBody().innerHTML = `
    <div class="sitrep-section ingest-section">
      <div class="sitrep-section-title">${t('ingest.title.analyzing')}</div>
      <div class="ingest-spinner">${t('ingest.spinner.process')}${wasTruncated ? ` ${t('ingest.spinner.truncated')}` : ''}</div>
    </div>
  `;

  try {
    state.messages = [
      { role: 'user', content: `Analyze this source document and extract all place information:\n\n${truncated}` }
    ];

    const reply = await chat({
      messages: state.messages,
      system: EXTRACT_SYSTEM,
      maxTokens: 8192,
      temperature: 0.3,
      cacheSystemPrompt: true
    });

    state.messages.push({ role: 'assistant', content: reply });

    state.extraction = extractJson(reply);
    if (!state.extraction) {
      throw new Error('Claude returned an unexpected format (could not parse JSON). Raw response shown below.');
    }
    if (!Array.isArray(state.extraction.places)) {
      throw new Error('JSON parsed but missing "places" array. This may indicate an incomplete response. Raw response shown below.');
    }

    renderReviewStep();
  } catch (err) {
    // Show the raw reply so the user can see what went wrong
    const rawPreview = (state.messages.length > 1)
      ? state.messages[state.messages.length - 1].content.slice(0, 1500)
      : '';

    getBody().innerHTML = `
      <div class="sitrep-section ingest-section">
        <div class="sitrep-section-title">${t('ingest.title.failed')}</div>
        <div class="brovis-error">${escapeHtml(err.message)}</div>
        ${rawPreview ? `<details class="ingest-raw-details"><summary>Raw Claude response</summary><pre class="ingest-result-code">${escapeHtml(rawPreview)}</pre></details>` : ''}
        <div class="ingest-actions">
          <button id="ingest-retry" class="ingest-btn">${t('ingest.btn.retry')}</button>
        </div>
      </div>
    `;
    document.getElementById('ingest-retry').addEventListener('click', () => {
      state.step = 'input';
      renderInputStep();
      document.getElementById('ingest-source').value = state.sourceText;
    });
  }
}

// ── Step 3: Review takeaways ─────────────────────────────────────────────────

function renderReviewStep() {
  const ex = state.extraction;
  const placesHtml = ex.places.map((p, i) => `
    <div class="ingest-place-card">
      <label class="ingest-place-check">
        <input type="checkbox" data-idx="${i}" checked />
        <strong>${p.name}</strong> <span class="ingest-place-type">${p.type || 'Place'}</span>
      </label>
      <div class="ingest-place-meta">
        ${p.country ? `<span>Country: ${p.country}</span>` : ''}
        ${p.lat && p.lng ? `<span>Coords: ${p.lat}, ${p.lng}</span>` : ''}
        ${p.best_for?.length ? `<span>Best for: ${p.best_for.join(', ')}</span>` : ''}
      </div>
      <div class="ingest-place-body">${p.body || p.description}</div>
      ${p.related?.length ? `<div class="ingest-place-related">Links: ${p.related.map(r => `[[${r}]]`).join(', ')}</div>` : ''}
    </div>
  `).join('');

  getBody().innerHTML = `
    <div class="sitrep-section ingest-section">
      <div class="sitrep-section-title">${t('ingest.title.takeaways')}</div>
      <div class="ingest-summary">${ex.summary}</div>
      <div class="sitrep-section-title" style="margin-top:1rem;">${t('ingest.title.places', { count: ex.places.length })}</div>
      <p class="ingest-hint">${t('ingest.hint.uncheck')}</p>
      <div id="ingest-places">${placesHtml}</div>
      <div class="ingest-actions">
        <button id="ingest-back" class="ingest-btn ingest-btn-secondary">${t('ingest.btn.back')}</button>
        <button id="ingest-generate" class="ingest-btn">${t('ingest.btn.generate')}</button>
      </div>
    </div>
  `;

  document.getElementById('ingest-back').addEventListener('click', () => {
    state.step = 'input';
    renderInputStep();
    document.getElementById('ingest-source').value = state.sourceText;
  });

  document.getElementById('ingest-generate').addEventListener('click', handleGenerate);
}

// ── Step 4: Generate pages ───────────────────────────────────────────────────

async function handleGenerate() {
  const checkboxes = document.querySelectorAll('#ingest-places input[type="checkbox"]');
  const selected = [];
  checkboxes.forEach(cb => {
    if (cb.checked) selected.push(state.extraction.places[parseInt(cb.dataset.idx)]);
  });

  if (selected.length === 0) return;

  state.step = 'generating';
  getBody().innerHTML = `
    <div class="sitrep-section ingest-section">
      <div class="sitrep-section-title">${t('ingest.title.generating')}</div>
      <div class="ingest-spinner">${t('ingest.spinner.generating', { count: selected.length })}</div>
      <div id="ingest-progress"></div>
    </div>
  `;

  const progress = document.getElementById('ingest-progress');
  const today = new Date().toISOString().slice(0, 16).replace('T', ' ');

  for (const place of selected) {
    const tick = document.createElement('div');
    tick.className = 'ingest-progress-tick';
    tick.textContent = `Generating ${place.name}...`;
    progress.appendChild(tick);

    try {
      const prompt = `Generate an Obsidian wiki page for this place:
Name: ${place.name}
Country: ${place.country || 'Unknown'}
Type: ${place.type || 'City'}
Coordinates: ${place.lat || '0'}, ${place.lng || '0'}
Rating: ${place.rating || 5}
Best for: ${(place.best_for || []).join(', ')}
Related: ${(place.related || []).join(', ')}
Description: ${place.description || ''}
Details: ${place.body || ''}
Created: ${today}

Use color "blue" for cities, "green" for islands/beaches, "red" for battles/landmarks, "orange" for countries.
Use icon "binoculars" for cities, "ship" for islands, "flag" for countries, "castle" for landmarks.`;

      const md = await chat({
        messages: [{ role: 'user', content: prompt }],
        system: GENERATE_SYSTEM,
        maxTokens: 2048,
        temperature: 0.3
      });

      state.pages.push({ name: place.name, markdown: md, place });
      tick.textContent = `${place.name} — done`;
      tick.classList.add('tick-done');
    } catch (err) {
      tick.textContent = `${place.name} — failed: ${err.message}`;
      tick.classList.add('tick-fail');
    }
  }

  // ── Translate pages into other active languages ───────────────────────────
  const availableLangs = getConfig().i18n?.availableLanguages ?? ['en'];
  const otherLangs = availableLangs.filter(l => l !== 'en' && LANG_NAMES[l]);

  if (otherLangs.length > 0 && state.pages.length > 0) {
    const transHeader = document.createElement('div');
    transHeader.className = 'ingest-progress-tick';
    transHeader.textContent = t('ingest.title.translating');
    progress.appendChild(transHeader);

    for (const page of state.pages) {
      page.translations = {};
      for (const lang of otherLangs) {
        const tick = document.createElement('div');
        tick.className = 'ingest-progress-tick';
        tick.textContent = t('ingest.translating', { name: page.name, lang: LANG_NAMES[lang] });
        progress.appendChild(tick);
        try {
          const translated = await chat({
            messages: [{ role: 'user', content: `Translate this wiki page to ${LANG_NAMES[lang]}:\n\n${page.markdown}` }],
            system: TRANSLATE_SYSTEM.replace('{targetLang}', LANG_NAMES[lang]),
            maxTokens: 2048,
            temperature: 0.2
          });
          page.translations[lang] = translated;
          tick.textContent = t('ingest.translated.done', { name: page.name, lang });
          tick.classList.add('tick-done');
        } catch (err) {
          tick.textContent = t('ingest.translated.fail', { name: page.name, lang, err: err.message });
          tick.classList.add('tick-fail');
        }
      }
    }
  }

  // Generate index and log entries
  const indexEntry = generateIndexEntry(state.pages);
  const logEntry = generateLogEntry(state.extraction, state.pages);

  state.step = 'done';
  renderDoneStep(indexEntry, logEntry);
}

// ── Step 5: Done — display results ───────────────────────────────────────────

function renderDoneStep(indexEntry, logEntry) {
  const pagesHtml = state.pages.map(p => {
    const transLangs = Object.keys(p.translations ?? {});
    const transInfo = transLangs.length
      ? `<div class="ingest-place-meta">${transLangs.map(l => `/data/place/${l}/${p.name}.md`).join(', ')}</div>`
      : '';
    return `
    <div class="ingest-result-card">
      <div class="ingest-result-header">
        <span class="ingest-result-name">${p.name}.md</span>
        <span class="ingest-result-path">/data/place/${p.name}.md</span>
        <button class="ingest-copy-btn" data-target="page-${slugify(p.name)}">${t('query.btn.copy')}</button>
      </div>
      ${transInfo}
      <pre class="ingest-result-code" id="page-${slugify(p.name)}">${escapeHtml(p.markdown)}</pre>
    </div>
  `;
  }).join('');

  getBody().innerHTML = `
    <div class="sitrep-section ingest-section">
      <div class="sitrep-section-title">${t('ingest.title.done', { count: state.pages.length })}</div>
      <p class="ingest-hint">${t('ingest.hint.copy')}</p>
      ${pagesHtml}

      <div class="ingest-result-card">
        <div class="ingest-result-header">
          <span class="ingest-result-name">index.md update</span>
          <span class="ingest-result-path">/data/index.md</span>
          <button class="ingest-copy-btn" data-target="index-entry">${t('query.btn.copy')}</button>
        </div>
        <pre class="ingest-result-code" id="index-entry">${escapeHtml(indexEntry)}</pre>
      </div>

      <div class="ingest-result-card">
        <div class="ingest-result-header">
          <span class="ingest-result-name">log.md update</span>
          <span class="ingest-result-path">/data/log.md</span>
          <button class="ingest-copy-btn" data-target="log-entry">${t('query.btn.copy')}</button>
        </div>
        <pre class="ingest-result-code" id="log-entry">${escapeHtml(logEntry)}</pre>
      </div>

      <div class="ingest-actions">
        <button id="ingest-save-all" class="ingest-btn">${t('ingest.btn.save')}</button>
        <button id="ingest-new" class="ingest-btn ingest-btn-secondary">${t('ingest.btn.new')}</button>
      </div>
    </div>
  `;

  // Wire copy buttons
  document.querySelectorAll('.ingest-copy-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = document.getElementById(btn.dataset.target);
      if (target) {
        navigator.clipboard.writeText(target.textContent).then(() => {
          btn.textContent = 'COPIED';
          setTimeout(() => { btn.textContent = 'COPY'; }, 2000);
        });
      }
    });
  });

  // Wire save all button
  document.getElementById('ingest-save-all').addEventListener('click', async () => {
    const btn = document.getElementById('ingest-save-all');
    const originalText = btn.textContent;
    btn.textContent = t('query.btn.saving');
    btn.disabled = true;

    try {
      const response = await fetch('/api/ingest/save-pages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pages: state.pages,
          source: state.extraction?.source_title || 'Unknown Source'
        })
      });

      const result = await response.json();

      if (response.ok && result.success) {
        btn.textContent = t('ingest.saved', { count: result.saved.length });
        if (result.errors && result.errors.length > 0) {
          console.warn('Save errors:', result.errors);
          btn.textContent += ' ' + t('ingest.saved.errors');
        }
        setTimeout(() => {
          btn.textContent = originalText;
          btn.disabled = false;
        }, 3000);
      } else {
        btn.textContent = t('ingest.save.failed');
        console.error('Save error:', result.error);
        setTimeout(() => {
          btn.textContent = originalText;
          btn.disabled = false;
        }, 3000);
      }
    } catch (err) {
      btn.textContent = t('ingest.save.failed');
      console.error('Save error:', err);
      setTimeout(() => {
        btn.textContent = originalText;
        btn.disabled = false;
      }, 3000);
    }
  });

  document.getElementById('ingest-new').addEventListener('click', () => {
    resetState();
    renderInputStep();
  });
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function generateIndexEntry(pages) {
  const lines = pages.map(p =>
    `| [[${p.name}]] | ${p.place.type || 'Place'} | ${p.place.country || ''} | ${p.place.description || ''} |`
  );
  return lines.join('\n');
}

function generateLogEntry(extraction, pages) {
  const now = new Date();
  const ts = now.toISOString().slice(0, 16).replace('T', ' ');
  const names = pages.map(p => `[[${p.name}]]`).join(', ');
  return `| ${ts} | ${extraction.source_title || 'Unknown'} | ${pages.length} | ${names} |`;
}

function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
