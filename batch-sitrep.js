#!/usr/bin/env node
/**
 * Batch SITREP runner — execute all SITREP widgets server-side and output JSON.
 * Designed for scheduled runs (cron, scheduled tasks) to pre-compute SITREP data
 * and cache it with prompt caching enabled (50% token savings with batch mode).
 *
 * Usage:
 *   node batch-sitrep.js > sitrep-output.json
 *   node batch-sitrep.js | curl -X POST http://localhost:3001/api/batch-sitrep -d @-
 *
 * Loads config from:
 *   1. .env (API keys as fallback)
 *   2. ~/brovis-config.json (user config, matches localStorage format)
 *
 * Output: JSON with { timestamp, widgets: {...}, brief: "..." }
 */

import 'dotenv/config';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;
const SERVER_BASE = `http://localhost:${PORT}`;

// Patch global fetch to handle relative URLs in batch mode
const originalFetch = global.fetch;
global.fetch = function(url, ...args) {
  const fullUrl = url.startsWith('http') ? url : `${SERVER_BASE}${url}`;
  return originalFetch(fullUrl, ...args);
};

/**
 * Load user config from ~/.brovis-config.json or return defaults.
 * This mirrors the browser's localStorage structure.
 */
function loadConfig() {
  const configPath = path.join(os.homedir(), '.brovis-config.json');

  try {
    if (fs.existsSync(configPath)) {
      const data = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      return data;
    }
  } catch (e) {
    console.error(`Warning: could not load config from ${configPath}:`, e.message);
  }

  // Fallback: build minimal config from environment
  return {
    user: { name: 'Commander' },
    location: process.env.BROVIS_LOCATION || '',
    keys: {
      openweather: process.env.OPENWEATHER_API_KEY || '',
      newsapi: process.env.NEWSAPI_KEY || '',
      claude: process.env.CLAUDE_API_KEY || ''
    },
    widgets: {}
  };
}


/**
 * Mini Claude client for batch mode — uses same API as src/lib/claude.js
 */
async function claudeComplete({ prompt, system, maxTokens = 200, temperature = 0.5, cacheSystemPrompt = false }) {
  const apiKey = process.env.CLAUDE_API_KEY;
  if (!apiKey) throw new Error('CLAUDE_API_KEY not set');

  let systemParam = system;
  if (system && cacheSystemPrompt) {
    systemParam = [
      {
        type: 'text',
        text: system,
        cache_control: { type: 'ephemeral' }
      }
    ];
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: maxTokens,
      temperature,
      system: systemParam,
      messages: [{ role: 'user', content: prompt }]
    })
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(`Claude API: ${response.status} ${data?.error?.message || ''}`);
  }

  return data?.content?.[0]?.text || '';
}

/**
 * Main: load config, run all widgets, output JSON.
 */
async function main() {

  const config = loadConfig();

  // Import widget registry
  const widgetModules = await Promise.all([
    import('./src/widgets/weather.js'),
    import('./src/widgets/news.js'),
    import('./src/widgets/markets.js'),
    import('./src/widgets/bible.js'),
    import('./src/widgets/calendar.js')
  ]);

  const widgets = widgetModules.map(m => m.default);
  const results = {};

  // Run all base widgets in parallel
  const promises = widgets.map(async w => {
    try {
      const data = await w.fetch(config);
      results[w.id] = { status: 'ok', data };
    } catch (e) {
      results[w.id] = { status: 'error', error: e.message };
    }
  });

  await Promise.all(promises);

  // Optionally run Morning Brief if enabled and Claude key is set
  let brief = null;
  if (config.keys?.claude && config.widgets?.['morning-brief']?.enabled !== false) {
    try {
      const morningBriefModule = await import('./src/widgets/morning-brief.js');
      const briefWidget = morningBriefModule.default;

      const sitrepContext = {};
      Object.entries(results).forEach(([id, result]) => {
        if (result.status === 'ok') sitrepContext[id] = result.data;
      });

      brief = await briefWidget.fetch(config, sitrepContext);
    } catch (e) {
      console.error('Morning Brief error:', e.message);
    }
  }

  // Output results
  const output = {
    timestamp: new Date().toISOString(),
    widgets: results,
    brief: brief || null,
    config: {
      user: config.user,
      location: config.location,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
    }
  };

  console.log(JSON.stringify(output, null, 2));
}

main().catch(e => {
  console.error('Batch SITREP error:', e.message);
  process.exit(1);
});
