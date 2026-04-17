/**
 * News widget — US + international top headlines.
 * BYOK: user's NewsAPI key is sent via X-Brovis-Key header.
 */
import { fetchJson } from '../lib/http.js';
import { t } from '../lib/i18n.js';

export default {
  id: 'news',
  name: 'Intel',
  requiredKeys: ['newsapi'],
  defaultEnabled: true,
  order: 50,

  async fetch(config) {
    const apiKey = config.keys.newsapi;
    const data = await fetchJson('/api/news', 'News', { apiKey });
    const shuffled = data.articles.sort(() => Math.random() - 0.5);
    return shuffled.slice(0, 3).map(a => ({
      title: a.title,
      source: a.source?.name ?? 'Unknown',
      url: a.url
    }));
  },

  render(articles) {
    return `
      <div class="sitrep-section">
        <div class="sitrep-section-title">${t('widget.news.name')}</div>
        ${articles.map(a => `
          <div class="news-item">
            <a class="news-title" href="${a.url}" target="_blank" rel="noopener">${a.title}</a>
            <span class="news-source">${a.source}</span>
          </div>
        `).join('')}
      </div>
    `;
  }
};
