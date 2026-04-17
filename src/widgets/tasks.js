/**
 * Google Tasks widget — today's tasks from the default task list.
 * Auth is server-side OAuth; widget renders a connect link when the server
 * reports 401.
 */
import { t } from '../lib/i18n.js';

export default {
  id: 'tasks',
  name: 'Tasks',
  requiredKeys: [],
  defaultEnabled: true,
  order: 45,

  async fetch() {
    const res = await fetch('/api/tasks', { cache: 'no-store' });
    if (res.status === 401) return { needsAuth: true, tasks: [] };
    if (!res.ok) throw new Error(`Tasks: ${res.status} ${res.statusText}`);
    return res.json();
  },

  render(tasks) {
    return `
      <div class="sitrep-section">
        <div class="sitrep-section-title">${t('widget.tasks.name')}</div>
        ${tasks.needsAuth ? `
          <div class="calendar-auth">
            <a href="/auth/google" target="_blank" class="auth-link">${t('widget.tasks.connect')}</a>
          </div>
        ` : tasks.tasks.length === 0 ? `
          <div class="calendar-empty">No tasks.</div>
        ` : tasks.tasks.map(task => `
          <div class="calendar-event">
            <span class="event-title">${task.title}</span>
            ${task.due ? `<div class="event-location">Due: ${new Date(task.due).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>` : ''}
          </div>
        `).join('')}
      </div>
    `;
  }
};
