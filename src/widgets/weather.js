/**
 * Weather widget — current conditions + 3-day forecast.
 * BYOK: user's OpenWeather key is sent via X-Brovis-Key header.
 */
import { fetchJsonAll, buildQuery } from '../lib/http.js';
import { t } from '../lib/i18n.js';

export default {
  id: 'weather',
  name: 'Weather',
  requiredKeys: ['openweather'],
  requiredFields: ['user.location'],
  defaultEnabled: true,
  order: 20,

  async fetch(config) {
    const apiKey = config.keys.openweather;
    const location = config.user.location;
    const units = config.user.units || 'imperial';
    const query = buildQuery({ location, units });

    const [current, forecast] = await fetchJsonAll([
      { url: `/api/weather/current?${query}`, agentName: 'Current weather', apiKey },
      { url: `/api/weather/forecast?${query}`, agentName: 'Forecast', apiKey }
    ]);

    const unitLabel = units === 'imperial' ? '°F' : '°C';
    const speedLabel = units === 'imperial' ? 'mph' : 'm/s';

    return {
      location: current.name,
      temp: `${Math.round(current.main.temp)}${unitLabel}`,
      feels: `${Math.round(current.main.feels_like)}${unitLabel}`,
      condition: current.weather[0].description,
      humidity: `${current.main.humidity}%`,
      wind: `${Math.round(current.wind.speed)} ${speedLabel}`,
      forecast: parseForecast(forecast.list, unitLabel)
    };
  },

  render(w) {
    return `
      <div class="sitrep-row">
        <span class="sitrep-label">${t('widget.weather.temp')}</span>
        <span class="sitrep-value sitrep-temp">${w.temp}</span>
      </div>
      <div class="sitrep-row">
        <span class="sitrep-label">${t('widget.weather.condition')}</span>
        <span class="sitrep-value">${capitalize(w.condition)}</span>
      </div>
      <div class="sitrep-section">
        <div class="sitrep-section-title">${t('widget.weather.outlook')}</div>
        <div class="forecast-row">
          ${w.forecast.map(d => `
            <div class="forecast-day">
              <div class="day-name">${d.day}</div>
              <div class="day-temp">${d.low} / ${d.high}</div>
              <div class="day-cond">${d.condition}</div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }
};

function parseForecast(list, unitLabel) {
  const days = {};
  for (const item of list) {
    const date = new Date(item.dt * 1000);
    const key = date.toDateString();
    if (!days[key]) {
      days[key] = { date, temps: [], conditions: [] };
    }
    days[key].temps.push(item.main.temp);
    days[key].conditions.push(item.weather[0].main);
  }

  return Object.values(days).slice(0, 3).map(d => ({
    day: d.date.toLocaleDateString('en-US', { weekday: 'short' }),
    high: `${Math.round(Math.max(...d.temps))}${unitLabel}`,
    low: `${Math.round(Math.min(...d.temps))}${unitLabel}`,
    condition: d.conditions[Math.floor(d.conditions.length / 2)]
  }));
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
