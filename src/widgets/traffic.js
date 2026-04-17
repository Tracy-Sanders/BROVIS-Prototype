/**
 * Traffic widget — live Google Maps traffic overlay centered on user's location.
 * Shows a configurable radius with classic red/yellow traffic colors.
 * BYOK: user's Google Maps API key is sent via X-Brovis-Key header.
 */
import { fetchJson } from '../lib/http.js';
import { t } from '../lib/i18n.js';

export default {
  id: 'traffic',
  name: 'Traffic',
  requiredKeys: ['googlemaps'],
  defaultEnabled: false,
  order: 25,
  configFields: [
    { name: 'radius', label: 'Search radius (miles)', type: 'number', default: 20 }
  ],

  async fetch(config) {
    const location = config.user.location;
    const apiKey = config.keys.googlemaps;
    const radius = config.widgets?.['traffic']?.radius ?? 20;

    // Geocode the user's location to lat/lng
    const geocodeData = await fetchJson(
      `/api/geocode?location=${encodeURIComponent(location)}`,
      'Geocoding',
      { apiKey }
    );

    if (!geocodeData || !geocodeData.lat || !geocodeData.lng) {
      throw new Error(`Could not geocode location: ${location}`);
    }

    // Convert radius (miles) to zoom level
    const zoom = radiusToZoom(radius);

    return {
      lat: geocodeData.lat,
      lng: geocodeData.lng,
      zoom,
      key: apiKey
    };
  },

  render(data) {
    return `
      <div class="sitrep-section">
        <div class="sitrep-section-title">${t('widget.traffic.name')}</div>
        <iframe
          src="/api/traffic-map?lat=${data.lat}&lng=${data.lng}&zoom=${data.zoom}&key=${encodeURIComponent(data.key)}"
          class="traffic-map"
          frameborder="0"
          loading="lazy"
          title="Live traffic map"
        ></iframe>
      </div>
    `;
  }
};

function radiusToZoom(miles) {
  // Approximate mapping from radius to zoom level
  // 5mi→12, 10mi→11, 20mi→10, 40mi→9
  return Math.round(14 - Math.log2(miles));
}
