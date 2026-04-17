import { widgets, isWidgetVisible, isWidgetRunnable } from './widgets/index.js';
import { renderSitrepShell, renderUnavailable, renderNeedsConfig } from './display/sitrep.js';
import { renderConfigPage } from './display/config.js';
import { renderIngestPage } from './display/llm-ingest.js';
import { renderQueryPage } from './display/llm-query.js';
import { renderHealthCheckPage } from './display/llm-healthcheck.js';
import { renderTestPage } from './display/llm-test.js';
import { loadConfig, getConfig, hasMinimumConfig } from './lib/config.js';
import { applyTheme } from './lib/theme.js';
import { createRouter } from './lib/router.js';
import { complete, hasClaudeKey } from './lib/claude.js';
import { t, initI18n, applyI18nToDOM } from './lib/i18n.js';

// ── Output helpers ────────────────────────────────────────────────────────────

function clearOutput() {
  document.getElementById('output').innerHTML = '';
}

function echo(text) {
  const el = document.createElement('div');
  el.className = 'echo';
  el.textContent = text;
  document.getElementById('output').appendChild(el);
}

function showError(msg) {
  const el = document.createElement('div');
  el.className = 'brovis-error';
  el.textContent = msg;
  document.getElementById('output').appendChild(el);
}

function showInfo(msg) {
  const el = document.createElement('div');
  el.className = 'brovis-info';
  el.textContent = msg;
  document.getElementById('output').appendChild(el);
  return el;
}

function showClaudeReply(text) {
  const el = document.createElement('div');
  el.className = 'claude-reply';
  el.textContent = text;
  document.getElementById('output').appendChild(el);
}

// ── Routes ────────────────────────────────────────────────────────────────────

async function handleMode(modeName) {
  clearOutput();
  const config = getConfig();
  const output = document.getElementById('output');

  if (!hasMinimumConfig()) {
    showConfigPrompt({ firstRun: true });
    return;
  }

  // Attach mode context so widgets (e.g. calendar) can read calendarDate
  const modeConfig = config.modes?.[modeName] ?? {};
  const effectiveConfig = { ...config, currentMode: modeConfig };

  // If mode has a widget whitelist, restrict to those IDs only
  const pool = modeConfig.widgets
    ? widgets.filter(w => modeConfig.widgets.includes(w.id))
    : widgets;

  const visible = pool.filter(w => isWidgetVisible(w, effectiveConfig));
  const runnable = visible.filter(w => isWidgetRunnable(w, effectiveConfig));

  // Context-dependent widgets (e.g. Morning Brief) need other widgets' data.
  // Run them in two passes: base widgets first, then context widgets.
  const baseWidgets = runnable.filter(w => !w.needsContext);
  const contextWidgets = runnable.filter(w => w.needsContext);

  const info = showInfo(t('info.pulling'));

  const baseResults = await Promise.allSettled(
    baseWidgets.map(w => w.fetch(effectiveConfig))
  );

  // Build sitrep context from base results for context-dependent widgets.
  const sitrepContext = {};
  baseWidgets.forEach((w, i) => {
    if (baseResults[i].status === 'fulfilled') {
      sitrepContext[w.id] = baseResults[i].value;
    }
  });

  const contextResults = await Promise.allSettled(
    contextWidgets.map(w => w.fetch(effectiveConfig, sitrepContext))
  );

  info.remove();

  // Merge all results into a single id → result map.
  const resultById = new Map();
  baseWidgets.forEach((w, i) => resultById.set(w.id, baseResults[i]));
  contextWidgets.forEach((w, i) => resultById.set(w.id, contextResults[i]));

  // Surface runtime failures.
  runnable.forEach(w => {
    const r = resultById.get(w.id);
    if (r.status === 'rejected') {
      showError(`${w.name}: ${r.reason.message}`);
    }
  });

  const sections = visible.map(widget => {
    if (!isWidgetRunnable(widget, effectiveConfig)) {
      return renderNeedsConfig(widget);
    }
    const r = resultById.get(widget.id);
    if (r.status !== 'fulfilled') return renderUnavailable(widget.name);
    try {
      return widget.render(r.value, effectiveConfig);
    } catch (e) {
      showError(`${widget.name}: render failed — ${e.message}`);
      return renderUnavailable(widget.name);
    }
  });

  output.appendChild(renderSitrepShell(sections, modeConfig.label ?? modeName));
}

function handleLlmIngest() {
  clearOutput();
  const output = document.getElementById('output');
  renderIngestPage(output);
}

function handleLlmQuery() {
  clearOutput();
  const output = document.getElementById('output');
  renderQueryPage(output);
}

function handleLlmHealthCheck() {
  clearOutput();
  const output = document.getElementById('output');
  renderHealthCheckPage(output);
}

function handleLlmTest() {
  clearOutput();
  const output = document.getElementById('output');
  renderTestPage(output);
}

function handleConfig() {
  clearOutput();
  const output = document.getElementById('output');
  renderConfigPage(output, {
    onSaved: () => router.go('#sitrep')
  });
}

function resolveLangPath(filePath, lang) {
  if (lang === 'en') return filePath;
  const m = filePath.match(/^(\/data\/place\/)([^/]+\.md)$/);
  return m ? `${m[1]}${lang}/${m[2]}` : filePath;
}

function parseFrontmatter(md) {
  if (!md.startsWith('---')) return { frontmatter: null, body: md };
  const end = md.indexOf('\n---', 3);
  if (end === -1) return { frontmatter: null, body: md };
  const yamlText = md.substring(4, end);
  const body = md.substring(end + 4).replace(/^\n+/, '');

  const fm = {};
  let currentKey = null;

  for (const line of yamlText.split('\n')) {
    const keyMatch = line.match(/^([a-zA-Z_]+):\s*(.*)/);
    if (keyMatch) {
      currentKey = keyMatch[1];
      const val = keyMatch[2].trim();
      if (val) {
        fm[currentKey] = val.replace(/^["']|["']$/g, '');
      } else {
        fm[currentKey] = [];
      }
    } else {
      const listMatch = line.match(/^\s+-\s+(.*)/);
      if (listMatch && currentKey) {
        if (!Array.isArray(fm[currentKey])) fm[currentKey] = [];
        fm[currentKey].push(listMatch[1].trim().replace(/^["']|["']$/g, ''));
      }
    }
  }

  return { frontmatter: fm, body };
}

function wikiLinkToHref(name) {
  return `data/place/${encodeURIComponent(name)}.md`;
}

function renderFrontmatterCard(fm) {
  if (!fm) return '';
  let html = '<div class="place-info-card">';

  if (fm.description) {
    html += `<p class="place-description">${fm.description}</p>`;
  }

  const details = [];
  if (fm.rating) {
    const r = Math.min(5, Math.max(0, Math.round(Number(fm.rating))));
    details.push(`<span class="place-rating">${'★'.repeat(r)}${'☆'.repeat(5 - r)}</span>`);
  }

  const typeTags = [];
  if (fm.type) {
    (Array.isArray(fm.type) ? fm.type : [fm.type])
      .forEach(t => typeTags.push(t.replace(/^\[\[|\]\]$/g, '')));
  }
  if (fm.categories) {
    (Array.isArray(fm.categories) ? fm.categories : [fm.categories])
      .forEach(c => { const n = c.replace(/^\[\[|\]\]$/g, ''); if (n !== 'Places') typeTags.push(n); });
  }
  if (typeTags.length) {
    details.push(typeTags.map(tag => `<span class="place-tag">${tag}</span>`).join(''));
  }
  if (details.length) {
    html += `<div class="place-meta">${details.join(' ')}</div>`;
  }

  const relLinks = [];
  if (fm.up) {
    (Array.isArray(fm.up) ? fm.up : [fm.up]).forEach(u => {
      const name = u.replace(/^\[\[|\]\]$/g, '');
      relLinks.push(`<a href="${wikiLinkToHref(name)}" class="place-up-link">↑ ${name}</a>`);
    });
  }
  if (fm.related) {
    (Array.isArray(fm.related) ? fm.related : [fm.related]).forEach(r => {
      const name = r.replace(/^\[\[|\]\]$/g, '');
      relLinks.push(`<a href="${wikiLinkToHref(name)}">${name}</a>`);
    });
  }
  if (relLinks.length) {
    html += `<div class="place-related"><span class="place-related-label">See also:</span> ${relLinks.join(' · ')}</div>`;
  }

  html += '</div>';
  return html;
}

function applyInlineFormatting(text) {
  text = text.replace(/\[\[([^\]]+)\]\]/g, (_, name) => `<a href="${wikiLinkToHref(name)}">${name}</a>`);
  text = text.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
  text = text.replace(/\*([^*\n]+)\*/g, '<em>$1</em>');
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  return text;
}

async function loadMarkdownFile(filePath, breadcrumb = null) {
  clearOutput();
  const output = document.getElementById('output');

  // Try language-specific path for place pages, fall back to English
  const lang = getConfig()?.i18n?.displayLanguage ?? 'en';
  const resolvedPath = resolveLangPath(filePath, lang);
  let finalPath = filePath;
  if (resolvedPath !== filePath) {
    try {
      const probe = await fetch(resolvedPath, { method: 'HEAD' });
      if (probe.ok) finalPath = resolvedPath;
    } catch { /* use original */ }
  }

  fetch(finalPath)
    .then(res => {
      if (!res.ok) throw new Error(`${t('error.loadfail')} ${finalPath}`);
      return res.text();
    })
    .then(markdown => {
      // Add breadcrumb if provided
      if (breadcrumb) {
        const breadcrumbEl = document.createElement('div');
        breadcrumbEl.className = 'markdown-breadcrumb';
        breadcrumbEl.innerHTML = `<a href="#travel-calendar" class="breadcrumb-link">← ${breadcrumb}</a>`;
        output.appendChild(breadcrumbEl);
      }

      const { frontmatter, body } = parseFrontmatter(markdown);

      const container = document.createElement('div');
      container.className = 'markdown-content';
      container.innerHTML = (frontmatter ? renderFrontmatterCard(frontmatter) : '') + markdownToHtml(body);
      output.appendChild(container);

      // Intercept link clicks in markdown content
      container.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', (e) => {
          const href = link.getAttribute('href');
          if (href && href.endsWith('.md')) {
            e.preventDefault();
            loadMarkdownFile('/' + href, link.textContent);
          }
        });
      });
    })
    .catch(err => showError(`${t('error.loadfail')} ${err.message}`));
}

function handleTravelCalendar() {
  const lang = getConfig()?.i18n?.displayLanguage ?? 'en';
  const path = lang !== 'en' ? `/calendar-${lang}.md` : '/calendar.md';
  loadMarkdownFile(path);
}

function markdownToHtml(md) {
  let html = '';
  const lines = md.split('\n');
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Headings
    if (line.startsWith('# ')) {
      html += `<h1>${applyInlineFormatting(line.substring(2))}</h1>`;
      i++;
    } else if (line.startsWith('## ')) {
      html += `<h2>${applyInlineFormatting(line.substring(3))}</h2>`;
      i++;
    } else if (line.startsWith('### ')) {
      html += `<h3>${applyInlineFormatting(line.substring(4))}</h3>`;
      i++;
    }
    // Horizontal rule
    else if (/^[-*_]{3,}\s*$/.test(line.trim())) {
      html += '<hr>';
      i++;
    }
    // Bullet list
    else if (/^[-*]\s+/.test(line)) {
      html += '<ul>';
      while (i < lines.length && /^[-*]\s+/.test(lines[i])) {
        html += `<li>${applyInlineFormatting(lines[i].replace(/^[-*]\s+/, ''))}</li>`;
        i++;
      }
      html += '</ul>';
    }
    // Tables
    else if (line.includes('|')) {
      const tableLines = [];
      while (i < lines.length && lines[i].includes('|')) {
        tableLines.push(lines[i]);
        i++;
      }
      const tableHtml = tableLines.map(tline => {
        if (/^\|[\s\-:|]+\|$/.test(tline.trim())) return ''; // separator row
        const cells = tline.split('|').filter((_, j, arr) => j > 0 && j < arr.length - 1);
        return `<tr>${cells.map(c => `<td>${applyInlineFormatting(c.trim())}</td>`).join('')}</tr>`;
      }).filter(r => r).join('');
      html += `<table><tbody>${tableHtml}</tbody></table>`;
    }
    // Blank lines
    else if (!line.trim()) {
      i++;
    }
    // Regular paragraph text
    else {
      const formatted = applyInlineFormatting(line);
      if (formatted.trim()) html += `<p>${formatted}</p>`;
      i++;
    }
  }

  return html;
}

function showConfigPrompt({ firstRun = false } = {}) {
  const output = document.getElementById('output');
  renderConfigPage(output, {
    firstRun,
    onSaved: () => router.go('#sitrep')
  });
}

// ── Input command handler ─────────────────────────────────────────────────────

const BROVIS_SYSTEM = `You are BROVIS, a personal intelligence assistant modeled after J.A.R.V.I.S. Be intelligent, concise, and direct. Subtle dry humor is welcome. Plain text only — no markdown.`;

function matchIntent(input) {
  const normalized = input.trim().toLowerCase();
  const triggers = getConfig().triggers ?? {};
  for (const [intent, synonyms] of Object.entries(triggers)) {
    if (synonyms.some(s => normalized.includes(s))) return intent;
  }
  if (normalized === 'config' || normalized === 'settings') return 'config';
  if (normalized === 'ingest' || normalized === 'llm' || normalized === 'llm ingest') return 'ingest';
  return null;
}

async function handleInput(raw) {
  const intent = matchIntent(raw);
  echo(raw);

  if (['am-brief', 'pm-brief', 'sitrep'].includes(intent)) {
    router.go(`#${intent}`);
  } else if (intent === 'ingest' || intent === 'llm') {
    router.go('#llm-ingest');
  } else if (intent === 'config') {
    router.go('#config');
  } else if (hasClaudeKey()) {
    const info = showInfo(t('info.thinking'));
    try {
      const reply = await complete({
        system: BROVIS_SYSTEM,
        prompt: raw,
        maxTokens: 400,
        temperature: 0.7,
        cacheSystemPrompt: true
      });
      info.remove();
      showClaudeReply(reply);
    } catch (err) {
      info.remove();
      showError(`Claude: ${err.message}`);
    }
  } else {
    showInfo(t('info.notrecognized'));
  }
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────

const router = createRouter()
  .on('#am-brief', () => handleMode('am-brief'))
  .on('#pm-brief', () => handleMode('pm-brief'))
  .on('#sitrep', () => handleMode('sitrep'))
  .on('#travel-calendar', handleTravelCalendar)
  .on('#llm-ingest', handleLlmIngest)
  .on('#llm-query', handleLlmQuery)
  .on('#llm-healthcheck', handleLlmHealthCheck)
  .on('#llm-test', handleLlmTest)
  .on('#config', handleConfig)
  .on('', () => handleMode('sitrep'));     // bare URL → SITREP

async function init() {
  await loadConfig();
  initI18n();
  applyI18nToDOM();
  applyTheme(getConfig().user?.interface);

  const form = document.getElementById('input-form');
  const input = document.getElementById('input');

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const val = input.value.trim();
    if (!val) return;
    input.value = '';
    await handleInput(val);
  });

  router.start();

  // Update active nav tabs based on hash — handles top-tab groups
  function updateActiveNav() {
    const hash = window.location.hash || '#am-brief';
    const isLlm = hash.startsWith('#llm-');
    const isTravel = hash.startsWith('#travel-');
    const activeGroup = isLlm ? 'llm' : isTravel ? 'travel' : 'brief';

    // Top tabs
    document.querySelectorAll('.pip-tab').forEach(el => {
      el.classList.toggle('pip-active', el.dataset.group === activeGroup);
    });

    // Show/hide subtab groups using CSS classes
    document.querySelectorAll('.subtab-group').forEach(el => {
      const isActive = el.dataset.group === activeGroup;
      el.classList.toggle('hidden', !isActive);
    });

    // Active subtab within visible group
    document.querySelectorAll('.pip-subtab').forEach(el => {
      el.classList.toggle('pip-active', el.getAttribute('href') === hash ||
        (hash === '' && el.getAttribute('href') === '#am-brief'));
    });
  }
  window.addEventListener('hashchange', updateActiveNav);
  updateActiveNav();
}

init();
