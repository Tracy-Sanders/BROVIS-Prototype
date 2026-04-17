/**
 * Music widget — new music stories by genre category.
 * BYOK: user's NewsAPI key is sent via X-Brovis-Key header.
 */
import { fetchJsonAll } from '../lib/http.js';
import { t } from '../lib/i18n.js';

export default {
  id: 'music',
  name: 'Music',
  requiredKeys: ['newsapi'],
  defaultEnabled: false,
  order: 53,

  configFields: [
    { name: 'category1', label: 'Music Category 1', type: 'text', default: 'Country' },
    { name: 'category2', label: 'Music Category 2', type: 'text', default: 'Rock' },
    { name: 'category3', label: 'Music Category 3', type: 'text', default: 'Blues' },
  ],

  async fetch(config) {
    const apiKey = config.keys.newsapi;
    const wc = config.widgets?.music ?? {};
    const cats = [
      wc.category1 || 'Country',
      wc.category2 || 'Rock',
      wc.category3 || 'Blues',
    ];

    const results = await fetchJsonAll(
      cats.map(cat => ({
        url: `/api/music?category=${encodeURIComponent(cat)}`,
        agentName: `Music: ${cat}`,
        apiKey,
      }))
    );

    return cats.map((cat, i) => ({
      category: cat,
      articles: (results[i]?.articles ?? []).slice(0, 3).map(a => ({
        title: a.title,
        source: a.source?.name ?? 'Unknown',
        url: a.url,
      })),
    }));
  },

  render(data) {
    return `
      <div class="sitrep-section">
        <div class="sitrep-section-title">${t('widget.music.name')}</div>
        ${data.map(({ category, articles }) => `
          <div class="sitrep-subsection">
            <div class="sitrep-label" style="margin: 8px 0 4px; text-transform: uppercase; font-size: 0.72em; letter-spacing: 0.08em;">${category}</div>
            ${articles.length
              ? articles.map(a => `
                  <div class="news-item">
                    <a class="news-title" href="${a.url}" target="_blank" rel="noopener">${a.title}</a>
                    <span class="news-source">${a.source}</span>
                  </div>
                `).join('')
              : `<div class="sitrep-label">${t('widget.music.none')}</div>`
            }
          </div>
        `).join('')}
      </div>
    `;
  }
};
