/**
 * VIP Email widget — top 5 unread emails from starred Google Contacts.
 * Auth is server-side OAuth; widget renders a connect link when the server
 * reports 401.
 */
import { t } from '../lib/i18n.js';

export default {
  id: 'gmail',
  name: 'VIP Mail',
  requiredKeys: [],
  defaultEnabled: true,
  order: 47,

  async fetch() {
    const res = await fetch('/api/gmail', { cache: 'no-store' });
    if (res.status === 401) return { needsAuth: true, emails: [] };
    if (!res.ok) throw new Error(`VIP Mail: ${res.status} ${res.statusText}`);
    return res.json();
  },

  render(data) {
    return `
      <div class="sitrep-section">
        <div class="sitrep-section-title">${t('widget.gmail.name')}</div>
        ${data.needsAuth ? `
          <div class="calendar-auth">
            <a href="/auth/google" target="_blank" class="auth-link">${t('widget.gmail.connect')}</a>
          </div>
        ` : data.emails.length === 0 ? `
          <div class="calendar-empty">No unread VIP mail.</div>
        ` : data.emails.map(e => `
          <div class="calendar-event">
            <span class="event-title">${e.from}</span>
            <div class="event-location">${e.subject}</div>
          </div>
        `).join('')}
      </div>
    `;
  }
};
