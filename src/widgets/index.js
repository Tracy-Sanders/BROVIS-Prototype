/**
 * Widget registry.
 *
 * To add a new widget:
 *   1. Create src/widgets/<id>.js exporting a default object with:
 *        id             — string, unique
 *        name           — display name used in section titles and errors
 *        requiredKeys   — API key ids from config.keys that must be non-empty
 *        requiredFields — dotpaths into config that must resolve truthy
 *                         (e.g. 'user.location')
 *        defaultEnabled — boolean, whether it's on by default
 *        order          — number, lower renders earlier in the SITREP
 *        fetch(config)  — async function returning widget data
 *        render(data)   — pure function returning an HTML string
 *   2. Import it below and append to the `widgets` array.
 *
 * Widgets run in parallel (Promise.allSettled), so a failing widget can't
 * kill the SITREP. A widget whose requirements aren't met is rendered as
 * a "needs configuration" placeholder instead of being silently skipped.
 */
import weather from './weather.js';
import traffic from './traffic.js';
import news from './news.js';
import sports from './sports.js';
import music from './music.js';
import markets from './markets.js';
import bible from './bible.js';
import calendar from './calendar.js';
import tasks from './tasks.js';
import gmail from './gmail.js';
import fitnessTips from './fitness-tips.js';
import morningBrief from './morning-brief.js';

export const widgets = [weather, traffic, news, sports, music, markets, bible, calendar, tasks, gmail, fitnessTips, morningBrief]
  .sort((a, b) => (a.order ?? 100) - (b.order ?? 100));

/**
 * Should this widget appear in the SITREP at all? False only when the user
 * has explicitly disabled it, or it's opt-in and hasn't been opted into.
 */
export function isWidgetVisible(widget, config) {
  const override = config.widgets?.[widget.id];
  if (override?.enabled === false) return false;
  if (widget.defaultEnabled === false && override?.enabled !== true) return false;
  return true;
}

/**
 * Does this widget have everything it needs to actually fetch data?
 * Visible widgets that aren't runnable get rendered as a "needs config"
 * placeholder rather than being hidden.
 */
export function isWidgetRunnable(widget, config) {
  for (const key of widget.requiredKeys ?? []) {
    if (!config.keys?.[key]) return false;
  }
  for (const path of widget.requiredFields ?? []) {
    if (!getPath(config, path)) return false;
  }
  return true;
}

function getPath(obj, path) {
  return path.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);
}
