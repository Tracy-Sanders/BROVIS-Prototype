/**
 * Google Calendar widget — today's or tomorrow's schedule (mode-configurable).
 * Auth is server-side OAuth (not BYOK); widget renders a connect link
 * when the server reports 401.
 */
import { t } from '../lib/i18n.js';

export default {
  id: 'calendar',
  name: "Today's Schedule",
  requiredKeys: [],
  defaultEnabled: true,
  order: 40,

  async fetch(config) {
    const date = config?.currentMode?.calendarDate ?? 'today';
    const url = date === 'tomorrow' ? '/api/calendar?date=tomorrow' : '/api/calendar';
    const res = await fetch(url, { cache: 'no-store' });
    if (res.status === 401) return { needsAuth: true, events: [], date };
    if (!res.ok) throw new Error(`Calendar: ${res.status} ${res.statusText}`);
    const data = await res.json();
    return { ...data, date };
  },

  render(calendar) {
    const title = calendar.date === 'tomorrow' ? t('widget.calendar.tomorrow') : t('widget.calendar.today');
    const emptyMsg = calendar.date === 'tomorrow' ? t('widget.calendar.empty.tomorrow') : t('widget.calendar.empty.today');
    return `
      <div class="sitrep-section">
        <div class="sitrep-section-title">${title}</div>
        ${calendar.needsAuth ? `
          <div class="calendar-auth">
            <a href="/auth/google" target="_blank" class="auth-link">${t('widget.calendar.connect')}</a>
          </div>
        ` : calendar.events.length === 0 ? `
          <div class="calendar-empty">${emptyMsg}</div>
        ` : calendar.events.map(e => `
          <div class="calendar-event">
            <span class="event-time">${formatEventTime(e)}</span>
            <span class="event-title">${e.title}</span>
            ${e.location ? `<span class="event-location">${e.location}</span>` : ''}
          </div>
        `).join('')}
      </div>
    `;
  }
};

function formatEventTime(event) {
  if (event.allDay) return t('widget.calendar.allday');
  const start = new Date(event.start);
  const end = new Date(event.end);
  return start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) +
    ' – ' + end.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}
