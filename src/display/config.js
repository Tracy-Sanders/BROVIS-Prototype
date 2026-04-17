/**
 * Full BROVIS configuration UI.
 *
 * Renders a settings card with sections:
 *   1. Profile  — name, location, units, greeting style
 *   2. API Keys — BYOK fields, one per service, with "Get one free" links
 *   3. Widgets  — per-widget enable toggles, driven by the registry manifest
 *   4. Modes    — per-mode widget selections
 *   5. Languages — available language checkboxes + active display language
 *
 * Widget sections are generated dynamically from `widgets/index.js`, so
 * adding a new widget automatically gets it a toggle here — no changes
 * required to this file.
 */
import { getConfig, updateConfig } from '../lib/config.js';
import { widgets, isWidgetVisible } from '../widgets/index.js';
import { applyTheme } from '../lib/theme.js';
import { t, setLang, applyI18nToDOM } from '../lib/i18n.js';

const API_KEY_META = {
  openweather: {
    label: 'OpenWeather API Key',
    href: 'https://openweathermap.org/api',
    helpText: 'Get one free'
  },
  newsapi: {
    label: 'NewsAPI Key',
    href: 'https://newsapi.org',
    helpText: 'Get one free'
  },
  claude: {
    label: 'Claude API Key',
    href: 'https://console.anthropic.com',
    helpText: 'Get one'
  },
  googlemaps: {
    label: 'Google Maps API Key',
    href: 'https://console.cloud.google.com/google/maps-apis',
    helpText: 'Get one'
  }
};

const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Spanish (Español)' },
  { code: 'de', label: 'German (Deutsch)' },
  { code: 'zh', label: 'Chinese (中文)' }
];

/**
 * Render the full config UI into the given output container.
 * `onSaved` fires after a successful save so callers can re-run SITREP.
 */
export function renderConfigPage(output, { onSaved, firstRun = false } = {}) {
  const config = getConfig();

  const card = document.createElement('div');
  card.className = 'sitrep-card config-page';
  card.innerHTML = `
    <div class="sitrep-header">${t('config.title')}</div>
    ${firstRun ? `
      <div class="sitrep-section config-intro">
        <p>${t('config.welcome')}</p>
      </div>
    ` : ''}

    <form id="config-form">
      <div class="sitrep-section">
        <div class="sitrep-section-title">${t('config.section.profile')}</div>
        <div class="config-grid">
          <label>${t('config.label.name')}
            <input type="text" name="user.name" value="${esc(config.user.name)}" placeholder="Commander" />
          </label>
          <label>${t('config.label.location')}
            <input type="text" name="user.location" value="${esc(config.user.location)}" placeholder="Pensacola,FL,US" required />
          </label>
          <label>${t('config.label.units')}
            <select name="user.units">
              <option value="imperial" ${config.user.units === 'imperial' ? 'selected' : ''}>${t('config.label.units.imperial')} (°F, mph)</option>
              <option value="metric" ${config.user.units === 'metric' ? 'selected' : ''}>${t('config.label.units.metric')} (°C, m/s)</option>
            </select>
          </label>
          <label>${t('config.label.greeting')}
            <select name="user.greeting">
              <option value="direct" ${config.user.greeting === 'direct' ? 'selected' : ''}>${t('config.label.greeting.direct')}</option>
              <option value="formal" ${config.user.greeting === 'formal' ? 'selected' : ''}>${t('config.label.greeting.formal')}</option>
              <option value="casual" ${config.user.greeting === 'casual' ? 'selected' : ''}>${t('config.label.greeting.casual')}</option>
            </select>
          </label>
          <label>${t('config.label.interface')}
            <select name="user.interface">
              <option value="claude-dark" ${(config.user.interface ?? 'claude-dark') === 'claude-dark' ? 'selected' : ''}>Claude Dark</option>
              <option value="claude-light" ${config.user.interface === 'claude-light' ? 'selected' : ''}>Claude Light</option>
              <option value="claude-system" ${config.user.interface === 'claude-system' ? 'selected' : ''}>Claude System (auto)</option>
              <option value="retro" ${config.user.interface === 'retro' ? 'selected' : ''}>Retro Terminal Dashboard</option>
            </select>
          </label>
        </div>
      </div>

      <div class="sitrep-section">
        <div class="sitrep-section-title">${t('config.section.apikeys')}</div>
        <div class="config-stack">
          ${Object.keys(config.keys).map(keyId => renderKeyField(keyId, config.keys[keyId])).join('')}
        </div>
      </div>

      <div class="sitrep-section">
        <div class="sitrep-section-title">${t('config.section.widgets')}</div>
        <div class="config-stack widget-toggles">
          ${widgets.map(w => renderWidgetToggle(w, config)).join('')}
        </div>
      </div>

      <div class="sitrep-section">
        <div class="sitrep-section-title">${t('config.section.modes')}</div>
        <div class="config-stack modes-toggles">
          ${Object.entries(config.modes || {}).map(([modeId, modeConfig]) => renderModeWidgets(modeId, modeConfig, config)).join('')}
        </div>
      </div>

      ${renderLanguageSection(config)}

      <div class="config-actions">
        <button type="submit">${firstRun ? t('config.save.firstrun') : t('config.save')}</button>
        ${firstRun ? '' : `<button type="button" class="config-cancel">${t('config.cancel')}</button>`}
      </div>
    </form>
  `;
  output.appendChild(card);

  // Wire available-language checkboxes to rebuild display-language dropdown
  card.querySelectorAll('.i18n-lang-check').forEach(cb => {
    cb.addEventListener('change', () => rebuildDisplaySelect(card, config));
  });

  card.querySelector('#config-form').addEventListener('submit', async e => {
    e.preventDefault();
    const form = e.target;
    const data = new FormData(form);

    const patch = {
      user: {
        name: data.get('user.name') || '',
        location: data.get('user.location') || '',
        units: data.get('user.units') || 'imperial',
        greeting: data.get('user.greeting') || 'direct',
        interface: data.get('user.interface') || 'retro'
      },
      keys: {},
      widgets: {},
      modes: {},
      i18n: {}
    };

    for (const keyId of Object.keys(config.keys)) {
      patch.keys[keyId] = data.get(`keys.${keyId}`) || '';
    }

    for (const w of widgets) {
      patch.widgets[w.id] = { enabled: form.querySelector(`input[name="widgets.${w.id}"]`).checked };
      for (const field of w.configFields ?? []) {
        const input = form.querySelector(`input[name="widgets.${w.id}.${field.name}"]`);
        if (input) {
          patch.widgets[w.id][field.name] = field.type === 'number' ? Number(input.value) : input.value;
        }
      }
    }

    // Collect per-mode widget selections
    for (const modeId of Object.keys(config.modes || {})) {
      const modeCheckboxes = form.querySelectorAll(`input[name^="modes.${modeId}."]`);
      const selectedWidgets = Array.from(modeCheckboxes)
        .filter(cb => cb.checked)
        .map(cb => cb.getAttribute('data-widget-id'));

      // If all widgets are selected, store null (means "all"); otherwise store the array
      const allWidgetIds = widgets.map(w => w.id);
      patch.modes[modeId] = {
        ...config.modes[modeId],
        widgets: selectedWidgets.length === allWidgetIds.length ? null : selectedWidgets
      };
    }

    // Collect language settings — always include 'en'
    const availableLangs = SUPPORTED_LANGUAGES
      .map(l => l.code)
      .filter(code => code === 'en' || form.querySelector(`input[name="i18n.lang.${code}"]`)?.checked);
    const displayLang = data.get('i18n.displayLanguage') || 'en';
    patch.i18n = { availableLanguages: availableLangs, displayLanguage: displayLang };

    updateConfig(patch);
    applyTheme(patch.user.interface);

    // Apply new language immediately
    setLang(displayLang);
    applyI18nToDOM();

    card.remove();
    if (onSaved) await onSaved();
  });

  const cancelBtn = card.querySelector('.config-cancel');
  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => card.remove());
  }
}

function renderLanguageSection(config) {
  const available = config.i18n?.availableLanguages ?? ['en', 'es', 'de', 'zh'];
  const display = config.i18n?.displayLanguage ?? 'en';

  const checkboxes = SUPPORTED_LANGUAGES.map(lang => `
    <label class="mode-widget-toggle">
      <input type="checkbox" class="i18n-lang-check" name="i18n.lang.${lang.code}" value="${lang.code}"
        ${available.includes(lang.code) ? 'checked' : ''}
        ${lang.code === 'en' ? 'disabled' : ''} />
      <span class="widget-toggle-name">${lang.label}</span>
    </label>
  `).join('');

  const displayOptions = buildDisplayOptions(available, display);

  return `
    <div class="sitrep-section">
      <div class="sitrep-section-title">${t('config.section.languages')}</div>
      <div class="config-stack">
        <div class="widget-toggles">${checkboxes}</div>
        <label style="margin-top:0.75rem;">${t('config.label.displaylang')}
          <select name="i18n.displayLanguage" id="i18n-display-select">
            ${displayOptions}
          </select>
        </label>
      </div>
    </div>
  `;
}

function buildDisplayOptions(availableCodes, selectedCode) {
  return SUPPORTED_LANGUAGES
    .filter(l => availableCodes.includes(l.code))
    .map(l => `<option value="${l.code}" ${selectedCode === l.code ? 'selected' : ''}>${l.label}</option>`)
    .join('');
}

function rebuildDisplaySelect(card, config) {
  const select = card.querySelector('#i18n-display-select');
  if (!select) return;
  const checkedCodes = ['en', ...Array.from(
    card.querySelectorAll('.i18n-lang-check:checked')
  ).map(cb => cb.value)];
  const currentVal = select.value;
  select.innerHTML = buildDisplayOptions(checkedCodes, checkedCodes.includes(currentVal) ? currentVal : 'en');
}

function renderKeyField(keyId, value) {
  const meta = API_KEY_META[keyId] || { label: keyId, href: '#', helpText: '' };
  return `
    <label class="key-field">
      <span class="key-label">
        ${meta.label}
        ${meta.href !== '#' ? `<a href="${meta.href}" target="_blank" rel="noopener" class="config-help">${meta.helpText}</a>` : ''}
      </span>
      <input type="password" name="keys.${keyId}" value="${esc(value)}" autocomplete="off" />
    </label>
  `;
}

function renderWidgetToggle(widget, config) {
  const enabled = isWidgetVisible(widget, config);
  const req = (widget.requiredKeys ?? []).join(', ');
  const extraFields = (widget.configFields ?? []).map(f => {
    const val = config.widgets?.[widget.id]?.[f.name] ?? f.default;
    return `<label class="widget-config-field">
      <span>${f.label}</span>
      <input type="${f.type}" name="widgets.${widget.id}.${f.name}" value="${esc(String(val))}" />
    </label>`;
  }).join('');
  return `
    <div class="widget-toggle-group">
      <label class="widget-toggle">
        <input type="checkbox" name="widgets.${widget.id}" ${enabled ? 'checked' : ''} />
        <span class="widget-toggle-name">${widget.name}</span>
        ${req ? `<span class="widget-toggle-req">${t('config.requires')} ${req}</span>` : ''}
      </label>
      ${extraFields ? `<div class="widget-config-fields">${extraFields}</div>` : ''}
    </div>
  `;
}

function renderModeWidgets(modeId, modeConfig, config) {
  const modeLabel = modeConfig.label || modeId;
  const modeWidgets = modeConfig.widgets;  // null = all, or array of widget IDs
  return `
    <fieldset class="mode-fieldset">
      <legend>${modeLabel}</legend>
      <div class="mode-widgets">
        ${widgets.map(w => {
          const isIncluded = modeWidgets === null || modeWidgets.includes(w.id);
          return `
            <label class="mode-widget-toggle">
              <input type="checkbox" name="modes.${modeId}.${w.id}" data-widget-id="${w.id}" ${isIncluded ? 'checked' : ''} />
              <span class="widget-toggle-name">${w.name}</span>
            </label>
          `;
        }).join('')}
      </div>
    </fieldset>
  `;
}

function esc(str) {
  return String(str ?? '').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
