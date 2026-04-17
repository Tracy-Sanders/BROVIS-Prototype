/**
 * Markets widget — Bitcoin, Gold, Silver, Oil, S&P 500, Dow Jones, NASDAQ.
 * No user key required (server uses free public feeds).
 */
import { fetchJson } from '../lib/http.js';
import { t } from '../lib/i18n.js';

export default {
  id: 'markets',
  name: 'Markets',
  requiredKeys: [],
  defaultEnabled: true,
  order: 30,

  async fetch() {
    const data = await fetchJson('/api/markets', 'Markets');
    return data.quotes.map(q => ({
      label: q.label,
      price: formatPrice(q.price),
      change: q.change != null ? q.change.toFixed(2) : null
    }));
  },

  render(markets) {
    return `
      <div class="sitrep-section">
        <div class="sitrep-section-title">${t('widget.markets.name')}</div>
        <div class="markets-grid">
          ${markets.map(m => {
            const changeClass = m.change == null ? '' : m.change >= 0 ? 'up' : 'down';
            const changeStr = m.change == null ? '' : `${m.change >= 0 ? '+' : ''}${m.change}%`;
            return `
              <div class="market-item">
                <span class="market-label">${m.label}</span>
                <span class="market-price">${m.price}</span>
                ${changeStr ? `<span class="market-change ${changeClass}">${changeStr}</span>` : ''}
              </div>`;
          }).join('')}
        </div>
      </div>
    `;
  }
};

function formatPrice(price) {
  if (price == null) return 'N/A';
  if (price >= 1000) {
    return '$' + price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  return '$' + price.toFixed(2);
}
