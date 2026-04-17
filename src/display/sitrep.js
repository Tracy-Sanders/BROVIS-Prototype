/**
 * SITREP shell renderer. Individual widgets own their own render logic —
 * this module only builds the outer card and provides shared fallback
 * markup for widgets that failed or aren't yet configured.
 */
import { t } from '../lib/i18n.js';

export function renderSitrepShell(sections, modeLabel = 'SITREP') {
  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });

  const card = document.createElement('div');
  card.className = 'sitrep-card';
  card.innerHTML = `
    <div class="sitrep-header">// ${modeLabel.toUpperCase()} &mdash; ${dateStr} &mdash; ${timeStr}</div>
    ${sections.join('')}
  `;
  return card;
}

/**
 * Fallback for a widget whose fetch rejected at runtime.
 */
export function renderUnavailable(sectionName) {
  return `
    <div class="sitrep-section sitrep-unavailable">
      <div class="sitrep-section-title">${sectionName}</div>
      <div class="widget-unavailable">${t('sitrep.unavailable')}</div>
    </div>
  `;
}

/**
 * Fallback for a widget whose required keys/fields aren't configured yet.
 * Shows which keys are missing so the user knows what to add in CONFIG.
 */
export function renderNeedsConfig(widget) {
  const keys = (widget.requiredKeys ?? []).join(', ');
  const msg = keys
    ? t('sitrep.requires.key', { keys })
    : t('sitrep.requires.config');
  return `
    <div class="sitrep-section sitrep-unavailable">
      <div class="sitrep-section-title">${widget.name}</div>
      <div class="widget-unavailable">${msg}</div>
    </div>
  `;
}
