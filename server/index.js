import 'dotenv/config';
import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { google } from 'googleapis';
import fs from 'fs';
import os from 'os';
import { exec } from 'child_process';

const app = express();
const PORT = process.env.PORT || 3000;
const OWM_BASE = 'https://api.openweathermap.org/data/2.5';
const NEWS_BASE = 'https://newsapi.org/v2';
const CLAUDE_BASE = 'https://api.anthropic.com/v1';
const CLAUDE_DEFAULT_MODEL = 'claude-haiku-4-5-20251001';
const CLAUDE_API_VERSION = '2023-06-01';

// BYOK: API keys come from the client via the X-Brovis-Key header.
// The .env fallback is kept ONLY for local development convenience; in
// production (brovis.ai) the server never sees a key unless the user sent one.
const DEV_FALLBACK_KEYS = {
  openweather: process.env.OPENWEATHER_API_KEY || '',
  newsapi: process.env.NEWSAPI_KEY || '',
  claude: process.env.CLAUDE_API_KEY || ''
};

function getUserKey(req, service) {
  return req.get('X-Brovis-Key') || DEV_FALLBACK_KEYS[service] || '';
}

// Google OAuth2
const TOKEN_PATH = join(os.homedir(), '.brovis_token.json');
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  `http://localhost:${process.env.PORT || 3000}/auth/google/callback`
);

// Load cached token if available
if (fs.existsSync(TOKEN_PATH)) {
  const token = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'));
  oauth2Client.setCredentials(token);
}

oauth2Client.on('tokens', tokens => {
  const current = fs.existsSync(TOKEN_PATH)
    ? JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'))
    : {};
  fs.writeFileSync(TOKEN_PATH, JSON.stringify({ ...current, ...tokens }));
});

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// Serve static files from project root
app.use(express.static(ROOT));
app.use(express.json({ limit: '1mb' }));

// Proxy: Claude completions (BYOK via X-Brovis-Key header)
// Body: { messages, system?, model?, maxTokens?, temperature? }
app.post('/api/claude/complete', async (req, res) => {
  const key = getUserKey(req, 'claude');
  if (!key) return res.status(401).json({ error: 'Claude API key required. Configure in BROVIS settings.' });

  const {
    messages,
    system,
    model = CLAUDE_DEFAULT_MODEL,
    maxTokens = 1024,
    temperature = 0.7
  } = req.body || {};

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages array required' });
  }

  try {
    const upstream = await fetch(`${CLAUDE_BASE}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': CLAUDE_API_VERSION
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        temperature,
        ...(system ? { system } : {}),
        messages
      })
    });

    const data = await upstream.json();
    if (!upstream.ok) {
      const errMsg = data?.error?.message || `${upstream.status} ${upstream.statusText}`;
      return res.status(upstream.status).json({ error: errMsg });
    }

    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// Proxy: current weather
app.get('/api/weather/current', async (req, res) => {
  const { location, units = 'imperial' } = req.query;
  if (!location) return res.status(400).json({ error: 'location required' });

  const key = getUserKey(req, 'openweather');
  if (!key) return res.status(401).json({ error: 'OpenWeather API key required. Configure in BROVIS settings.' });

  try {
    const url = `${OWM_BASE}/weather?q=${encodeURIComponent(location)}&units=${units}&appid=${key}`;
    const upstream = await fetch(url);
    const data = await upstream.json();
    if (!upstream.ok) return res.status(upstream.status).json(data);
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// Proxy: 5-day / 3-hour forecast
app.get('/api/weather/forecast', async (req, res) => {
  const { location, units = 'imperial' } = req.query;
  if (!location) return res.status(400).json({ error: 'location required' });

  const key = getUserKey(req, 'openweather');
  if (!key) return res.status(401).json({ error: 'OpenWeather API key required. Configure in BROVIS settings.' });

  try {
    const url = `${OWM_BASE}/forecast?q=${encodeURIComponent(location)}&units=${units}&appid=${key}`;
    const upstream = await fetch(url);
    const data = await upstream.json();
    if (!upstream.ok) return res.status(upstream.status).json(data);
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// Proxy: market quotes — CoinGecko (BTC) + Stooq (indices/commodities)
async function fetchStooq(symbol) {
  const url = `https://stooq.com/q/l/?s=${encodeURIComponent(symbol)}&f=sd2t2ohlcv&h&e=json`;
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  const text = await res.text();
  // Stooq omits volume for commodities, leaving trailing comma — fix it
  const fixed = text.replace(/"volume":}/g, '"volume":null}').replace(/"volume":,/g, '"volume":null,');
  const data = JSON.parse(fixed);
  const q = data?.symbols?.[0];
  if (!q || q.close == null) return null;
  const change = q.open > 0 ? ((q.close - q.open) / q.open) * 100 : null;
  return { price: q.close, change };
}

app.get('/api/markets', async (req, res) => {
  try {
    const [btcRes, spx, dji, ndq, rut, gold, silver, oil] = await Promise.all([
      fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_24hr_change=true'),
      fetchStooq('^spx'),
      fetchStooq('^dji'),
      fetchStooq('^ndq'),
      fetchStooq('iwm.us'),
      fetchStooq('xauusd'),
      fetchStooq('xagusd'),
      fetchStooq('cl.f'),
    ]);

    const btcData = await btcRes.json();
    const btc = {
      price: btcData?.bitcoin?.usd ?? null,
      change: btcData?.bitcoin?.usd_24h_change ?? null
    };

    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.json({ quotes: [
      { label: 'Bitcoin',    price: btc.price,    change: btc.change },
      { label: 'Gold',       price: gold?.price,  change: gold?.change },
      { label: 'Silver',     price: silver?.price, change: silver?.change },
      { label: 'Oil',        price: oil?.price,   change: oil?.change },
      { label: 'S&P 500',    price: spx?.price,   change: spx?.change },
      { label: 'Dow Jones',  price: dji?.price,   change: dji?.change },
      { label: 'NASDAQ',     price: ndq?.price,   change: ndq?.change },
      { label: 'Russell 2000', price: rut?.price, change: rut?.change },
    ]});
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// Proxy: Bible verse (KJV via bible-api.com)
app.get('/api/bible', async (req, res) => {
  const { ref } = req.query;
  if (!ref) return res.status(400).json({ error: 'ref required' });

  try {
    const url = `https://bible-api.com/${encodeURIComponent(ref)}?translation=kjv`;
    const upstream = await fetch(url);
    const data = await upstream.json();
    if (!upstream.ok) return res.status(upstream.status).json(data);
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.json({ reference: data.reference, text: data.text.trim() });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// Google OAuth2 — initiate
app.get('/auth/google', (req, res) => {
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: [
      'https://www.googleapis.com/auth/calendar.readonly',
      'https://www.googleapis.com/auth/tasks.readonly',
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/contacts.readonly'
    ]
  });
  res.redirect(url);
});

// Google OAuth2 — callback
app.get('/auth/google/callback', async (req, res) => {
  const { code } = req.query;
  const { tokens } = await oauth2Client.getToken(code);
  oauth2Client.setCredentials(tokens);
  fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens));
  res.send('<script>window.close()</script>Authorization complete. You can close this tab.');
});

// Google Calendar — today's or tomorrow's events (query param: ?date=tomorrow)
app.get('/api/calendar', async (req, res) => {
  const creds = oauth2Client.credentials;
  if (!creds || !creds.access_token) {
    return res.status(401).json({ needsAuth: true });
  }

  try {
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    const target = new Date();
    if (req.query.date === 'tomorrow') target.setDate(target.getDate() + 1);

    const startOfDay = new Date(target.getFullYear(), target.getMonth(), target.getDate()).toISOString();
    const endOfDay = new Date(target.getFullYear(), target.getMonth(), target.getDate(), 23, 59, 59).toISOString();

    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin: startOfDay,
      timeMax: endOfDay,
      singleEvents: true,
      orderBy: 'startTime',
    });

    const events = (response.data.items || []).map(e => ({
      title: e.summary || '(No title)',
      start: e.start.dateTime || e.start.date,
      end: e.end.dateTime || e.end.date,
      allDay: !e.start.dateTime,
      location: e.location || null,
    }));

    res.json({ events });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// Google Tasks — default task list
app.get('/api/tasks', async (req, res) => {
  const creds = oauth2Client.credentials;
  if (!creds || !creds.access_token) {
    return res.status(401).json({ needsAuth: true });
  }

  try {
    const tasks = google.tasks({ version: 'v1', auth: oauth2Client });
    const response = await tasks.tasks.list({
      tasklist: '@default',
      showCompleted: false,
      showHidden: false
    });

    const taskList = (response.data.items || []).map(t => ({
      title: t.title || '(No title)',
      due: t.due || null,
      notes: t.notes || null,
      status: t.status || 'needsAction'
    }));

    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.json({ tasks: taskList });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// Google Gmail — top 5 unread emails from starred contacts
app.get('/api/gmail', async (req, res) => {
  const creds = oauth2Client.credentials;
  if (!creds || !creds.access_token) {
    return res.status(401).json({ needsAuth: true });
  }

  try {
    const people = google.people({ version: 'v1', auth: oauth2Client });
    const gmail  = google.gmail({ version: 'v1', auth: oauth2Client });

    // 1. Fetch starred contacts and build email -> contact name map
    let vipAddresses = [];
    let contactNameMap = {}; // email -> contact name
    try {
      const contactsRes = await people.people.connections.list({
        resourceName: 'people/me',
        pageSize: 100,
        personFields: 'names,emailAddresses,memberships'
      });
      const connections = contactsRes.data.connections || [];
      const starred = connections.filter(p =>
        (p.memberships || []).some(
          m => m.contactGroupMembership?.systemContactGroupId === 'starred'
        )
      );
      // Build maps for both addresses and contact names
      starred.forEach(p => {
        const contactName = (p.names?.[0]?.displayName || 'Unknown').trim();
        (p.emailAddresses || []).forEach(e => {
          if (e.value) {
            vipAddresses.push(e.value);
            contactNameMap[e.value.toLowerCase()] = contactName;
          }
        });
      });
    } catch (_) {
      // People API failure is non-fatal — fall through to importance fallback
    }

    // 2. Build Gmail query
    const query = vipAddresses.length > 0
      ? `(${vipAddresses.map(a => `from:${a}`).join(' OR ')}) is:unread`
      : 'is:unread is:important';

    // 3. List matching messages (max 5)
    const listRes = await gmail.users.messages.list({
      userId: 'me',
      q: query,
      maxResults: 5
    });
    const messages = listRes.data.messages || [];

    // 4. Fetch metadata for each message in parallel
    const emails = await Promise.all(
      messages.map(async msg => {
        const detail = await gmail.users.messages.get({
          userId: 'me',
          id: msg.id,
          format: 'metadata',
          metadataHeaders: ['From', 'Subject']
        });
        const headers = detail.data.payload?.headers || [];
        const get = name => headers.find(h => h.name === name)?.value || '';
        const rawFrom = get('From');

        // Extract email address from From header
        const emailMatch = rawFrom.match(/<(.+?)>/);
        const emailAddr = emailMatch ? emailMatch[1].toLowerCase() : rawFrom.toLowerCase();

        // Look up contact name; fall back to display name in From header, then email
        const from = contactNameMap[emailAddr]
          || rawFrom.match(/^"?([^"<]+)"?\s*</) && rawFrom.match(/^"?([^"<]+)"?\s*</)[1].trim()
          || emailAddr;

        return { from, subject: get('Subject') || '(No subject)' };
      })
    );

    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.json({ emails });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// Proxy: US + international top headlines
app.get('/api/news', async (req, res) => {
  const key = getUserKey(req, 'newsapi');
  if (!key) return res.status(401).json({ error: 'NewsAPI key required. Configure in BROVIS settings.' });

  try {
    const url = `${NEWS_BASE}/top-headlines?country=us&pageSize=10&apiKey=${key}`;
    const upstream = await fetch(url);
    const data = await upstream.json();
    if (!upstream.ok) return res.status(upstream.status).json(data);
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

app.get('/api/sports', async (req, res) => {
  const key = getUserKey(req, 'newsapi');
  if (!key) return res.status(401).json({ error: 'NewsAPI key required. Configure in BROVIS settings.' });

  try {
    const url = `${NEWS_BASE}/top-headlines?country=us&category=sports&pageSize=10&apiKey=${key}`;
    const upstream = await fetch(url);
    const data = await upstream.json();
    if (!upstream.ok) return res.status(upstream.status).json(data);
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// Proxy: music news by genre category
app.get('/api/music', async (req, res) => {
  const key = getUserKey(req, 'newsapi');
  if (!key) return res.status(401).json({ error: 'NewsAPI key required. Configure in BROVIS settings.' });

  const category = req.query.category || 'music';
  const q = encodeURIComponent(`"${category} music" new release`);
  try {
    const url = `${NEWS_BASE}/everything?q=${q}&sortBy=publishedAt&language=en&pageSize=5&apiKey=${key}`;
    const upstream = await fetch(url);
    const data = await upstream.json();
    if (!upstream.ok) return res.status(upstream.status).json(data);
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

app.get('/api/geocode', async (req, res) => {
  const key = getUserKey(req, 'googlemaps');
  if (!key) return res.status(401).json({ error: 'Google Maps API key required. Configure in BROVIS settings.' });

  try {
    const location = req.query.location;
    if (!location) return res.status(400).json({ error: 'location query parameter required' });

    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(location)}&key=${key}`;
    const upstream = await fetch(url);
    const data = await upstream.json();

    if (!upstream.ok || data.status !== 'OK' || !data.results.length) {
      return res.status(400).json({ error: `Geocoding failed: ${data.status}` });
    }

    const location_data = data.results[0].geometry.location;
    res.json({ lat: location_data.lat, lng: location_data.lng });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

app.get('/api/traffic-map', (req, res) => {
  const { lat, lng, zoom, key } = req.query;

  if (!lat || !lng || !zoom || !key) {
    return res.status(400).json({ error: 'lat, lng, zoom, and key query parameters required' });
  }

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Traffic Map</title>
  <style>
    * { margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; }
    #map { width: 100%; height: 100vh; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    let map;

    function initMap() {
      map = new google.maps.Map(document.getElementById('map'), {
        zoom: ${parseInt(zoom)},
        center: { lat: ${parseFloat(lat)}, lng: ${parseFloat(lng)} },
        disableDefaultUI: false
      });

      // Add traffic layer
      const trafficLayer = new google.maps.TrafficLayer();
      trafficLayer.setMap(map);
    }
  </script>
  <script async defer src="https://maps.googleapis.com/maps/api/js?key=${key}&callback=initMap"></script>
</body>
</html>`;

  res.type('text/html').send(html);
});

// Batch SITREP endpoint — runs all widgets server-side and returns JSON
// Accepts POST with user config from browser localStorage, falls back to .env
app.post('/api/batch-sitrep', async (req, res) => {
  const originalFetch = global.fetch;
  try {
    // Patch global.fetch to handle relative URLs (widgets make requests like /api/...)
    const baseUrl = `http://localhost:${PORT}`;
    global.fetch = function(url, ...args) {
      const fullUrl = url.startsWith('http') ? url : `${baseUrl}${url}`;
      return originalFetch(fullUrl, ...args);
    };

    // Import widget modules
    const [weather, traffic, news, markets, bible, calendar, tasks, gmail, fitnessTips, morningBrief] = await Promise.all([
      import('../src/widgets/weather.js'),
      import('../src/widgets/traffic.js'),
      import('../src/widgets/news.js'),
      import('../src/widgets/markets.js'),
      import('../src/widgets/bible.js'),
      import('../src/widgets/calendar.js'),
      import('../src/widgets/tasks.js'),
      import('../src/widgets/gmail.js'),
      import('../src/widgets/fitness-tips.js'),
      import('../src/widgets/morning-brief.js')
    ]);

    const widgets = [
      weather.default,
      traffic.default,
      news.default,
      markets.default,
      bible.default,
      calendar.default,
      tasks.default,
      gmail.default
    ];

    // Use config from request body (browser localStorage), fall back to .env
    const userConfig = req.body || {};
    const config = {
      user: userConfig.user || { name: 'Commander' },
      location: userConfig.location || process.env.BROVIS_LOCATION || '',
      keys: {
        openweather: userConfig.keys?.openweather || process.env.OPENWEATHER_API_KEY || '',
        newsapi: userConfig.keys?.newsapi || process.env.NEWSAPI_KEY || '',
        claude: userConfig.keys?.claude || process.env.CLAUDE_API_KEY || ''
      },
      widgets: userConfig.widgets || {}
    };

    // Run all base widgets in parallel
    const results = {};
    const promises = widgets.map(async w => {
      try {
        const data = await w.fetch(config);
        results[w.id] = { status: 'ok', data };
      } catch (err) {
        results[w.id] = { status: 'error', error: err.message };
      }
    });
    await Promise.all(promises);

    // Build context for context-dependent widgets
    const sitrepContext = {};
    Object.entries(results).forEach(([id, result]) => {
      if (result.status === 'ok') sitrepContext[id] = result.data;
    });

    // Optionally run Fitness Tips and Morning Brief
    let fitnessTipsResult = null;
    let brief = null;
    if (config.keys.claude) {
      try {
        fitnessTipsResult = await fitnessTips.default.fetch(config, sitrepContext);
        results['fitness-tips'] = { status: 'ok', data: fitnessTipsResult };
      } catch (err) {
        // Fitness Tips failure is not fatal
        results['fitness-tips'] = { status: 'error', error: err.message };
      }

      try {
        brief = await morningBrief.default.fetch(config, sitrepContext);
      } catch (err) {
        // Morning Brief failure is not fatal
      }
    }

    const output = {
      timestamp: new Date().toISOString(),
      widgets: results,
      brief,
      config: {
        user: config.user,
        location: config.location,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
      }
    };

    res.json(output);
  } catch (err) {
    res.status(502).json({ error: `Batch SITREP failed: ${err.message}` });
  } finally {
    // Restore original fetch
    global.fetch = originalFetch;
  }
});

// Dashboard — view batch SITREP in browser
app.get('/batch-sitrep', (req, res) => {
  res.sendFile(join(ROOT, 'batch-sitrep.html'));
});

// Save ingested place pages to /data/place/ directory and update index/log
app.post('/api/ingest/save-pages', express.json({ limit: '5mb' }), async (req, res) => {
  try {
    const { pages, source } = req.body;
    if (!Array.isArray(pages) || pages.length === 0) {
      return res.status(400).json({ error: 'No pages provided' });
    }

    const placesDir = join(ROOT, 'data', 'place');
    const indexPath = join(ROOT, 'data', 'index.md');
    const logPath = join(ROOT, 'data', 'log.md');

    // Ensure directory exists
    if (!fs.existsSync(placesDir)) {
      fs.mkdirSync(placesDir, { recursive: true });
    }

    const saved = [];
    const errors = [];

    // Save place pages
    for (const page of pages) {
      try {
        if (!page.name || !page.markdown) {
          errors.push(`${page.name || 'Unknown'}: missing name or markdown`);
          continue;
        }

        // Sanitize filename to prevent directory traversal
        const safeName = page.name.replace(/[^\w\s-]/g, '').replace(/\s+/g, ' ').trim();
        const filePath = join(placesDir, `${safeName}.md`);

        fs.writeFileSync(filePath, page.markdown, 'utf8');
        saved.push(page);

        // Save translated versions to /data/place/{lang}/{Name}.md
        if (page.translations && typeof page.translations === 'object') {
          for (const [lang, markdown] of Object.entries(page.translations)) {
            if (!/^[a-z]{2}$/.test(lang) || !markdown) continue;
            try {
              const langDir = join(placesDir, lang);
              fs.mkdirSync(langDir, { recursive: true });
              fs.writeFileSync(join(langDir, `${safeName}.md`), markdown, 'utf8');
            } catch (tErr) {
              errors.push(`${page.name} [${lang}]: ${tErr.message}`);
            }
          }
        }
      } catch (err) {
        errors.push(`${page.name}: ${err.message}`);
      }
    }

    // Update index.md
    if (saved.length > 0) {
      try {
        let indexContent = '';
        if (fs.existsSync(indexPath)) {
          indexContent = fs.readFileSync(indexPath, 'utf8');
        } else {
          indexContent = `---
title: Karparthy Index
type: index
tags: #brovis
updated: 2026-04-13
---

# Data Index

| Page | Type | Country | Description |
|------|------|---------|-------------|
`;
        }

        // Append index entries
        for (const page of saved) {
          const type = page.place?.type || 'Place';
          const country = page.place?.country || '';
          const desc = page.place?.description || '';
          const indexLine = `| [[${page.name}]] | ${type} | ${country} | ${desc} |`;

          // Only add if not already in index
          if (!indexContent.includes(`[[${page.name}]]`)) {
            indexContent += `\n${indexLine}`;
          }
        }

        fs.writeFileSync(indexPath, indexContent, 'utf8');
      } catch (err) {
        errors.push(`index.md update: ${err.message}`);
      }
    }

    // Update log.md
    if (saved.length > 0) {
      try {
        let logContent = '';
        if (fs.existsSync(logPath)) {
          logContent = fs.readFileSync(logPath, 'utf8');
        } else {
          logContent = `---
title: Karparthy Log
type: log
tags: #brovis
updated: 2026-04-13
---

# Ingestion Log

| Timestamp | Source | Pages | Created |
|-----------|--------|-------|---------|
`;
        }

        // Create log entry
        const now = new Date();
        const timestamp = now.toISOString().slice(0, 16).replace('T', ' ');
        const sourceTitle = (source || 'Unknown').slice(0, 60);
        const pageLinks = saved.map(p => `[[${p.name}]]`).join(', ');
        const logLine = `| ${timestamp} | ${sourceTitle} | ${saved.length} | ${pageLinks} |`;

        logContent += `\n${logLine}`;

        fs.writeFileSync(logPath, logContent, 'utf8');
      } catch (err) {
        errors.push(`log.md update: ${err.message}`);
      }
    }

    res.json({
      success: true,
      saved: saved.map(p => p.name),
      errors: errors.length > 0 ? errors : null,
      message: `Saved ${saved.length} page(s) to /data/place/ and updated index/log`
    });
  } catch (err) {
    res.status(500).json({ error: `Failed to save pages: ${err.message}` });
  }
});

// Wiki API — serve index, pages, and page list for Query / Health-Check workflows
// List all place page names (used by Health-Check to fetch every page)
app.get('/api/wiki/pages', (req, res) => {
  const dir = join(ROOT, 'data', 'place');
  if (!fs.existsSync(dir)) return res.json({ pages: [] });
  const pages = fs.readdirSync(dir)
    .filter(f => f.endsWith('.md'))
    .map(f => f.slice(0, -3)); // strip .md
  res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.json({ pages });
});

app.get('/api/wiki/index', (req, res) => {
  const p = join(ROOT, 'data', 'index.md');
  if (!fs.existsSync(p)) return res.json({ content: '' });
  res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.json({ content: fs.readFileSync(p, 'utf8') });
});

app.get('/api/wiki/page', (req, res) => {
  const safe = (req.query.name || '').replace(/[^\w\s\-]/g, '').trim();
  if (!safe) return res.status(400).json({ error: 'name required' });
  const p = join(ROOT, 'data', 'place', `${safe}.md`);
  if (!fs.existsSync(p)) return res.status(404).json({ error: 'not found' });
  res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.json({ content: fs.readFileSync(p, 'utf8') });
});

app.post('/api/wiki/save-query', express.json({ limit: '2mb' }), (req, res) => {
  const { title, markdown } = req.body || {};
  if (!title || !markdown) return res.status(400).json({ error: 'title and markdown required' });
  const dir = join(ROOT, 'data', 'query');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const safe = title.replace(/[^\w\s\-]/g, '').trim();
  const filePath = join(dir, `${safe}.md`);
  fs.writeFileSync(filePath, markdown, 'utf8');
  res.json({ success: true, path: `/data/query/${safe}.md` });
});

// Run test suite — returns parsed summary + coverage table
app.post('/api/test/run', (req, res) => {
  function runCmd(cmd) {
    return new Promise(resolve => {
      exec(cmd, { cwd: ROOT, timeout: 120000 }, (_err, stdout, stderr) => {
        resolve((stdout || '') + (stderr || ''));
      });
    });
  }

  // Strip ANSI escape codes — VS Code terminal env forces color output which
  // breaks regex line-start matching (lines begin with \x1b[...m, not whitespace).
  function stripAnsi(s) {
    return s.replace(/\x1b\[[0-9;]*[mGKHFJA-Za-z]/g, '');
  }

  function parseTestResults(raw) {
    const lines = stripAnsi(raw).split('\n');
    let passed = 0, total = 0, failed = 0, duration = '';
    const failedTests = [];

    for (const line of lines) {
      // "Tests  81 passed (81)" or "Tests  2 failed | 79 passed (81)"
      if (/^\s*Tests\s/.test(line)) {
        const mPassed  = line.match(/(\d+)\s+passed/);
        const mFailed  = line.match(/(\d+)\s+failed/);
        const mTotal   = line.match(/\((\d+)\)/);
        if (mTotal)  total  = parseInt(mTotal[1]);
        if (mPassed) passed = parseInt(mPassed[1]);
        if (mFailed) failed = parseInt(mFailed[1]);
      }
      // "Duration  3.01s (...)"
      const dur = line.match(/^\s*Duration\s+(\S+)/);
      if (dur) duration = dur[1];
      // Failed test identifiers: " FAIL  path/file.js > suite > test name"
      if (/^\s*FAIL\s+/.test(line)) {
        failedTests.push(line.trim().replace(/^FAIL\s+/, ''));
      }
    }

    return { passed, total, failed, duration, failedTests };
  }

  function extractCoverageTable(raw) {
    const lines = stripAnsi(raw).split('\n');
    const table = lines.filter(l => l.includes('|')).join('\n').trim();
    const summary = lines.filter(l =>
      /^\s*(Statements|Branches|Functions|Lines)\s*:/.test(l) || /={10,}/.test(l)
    ).join('\n').trim();
    return table + (summary ? '\n\n' + summary : '');
  }

  // Run coverage once — it includes the full test summary + table
  runCmd('npm run test:coverage')
    .then(out => res.json({
      test: parseTestResults(out),
      coverage: extractCoverageTable(out)
    }))
    .catch(err => res.status(500).json({ error: err.message }));
});

export { app };

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`BROVIS server running → http://localhost:${PORT}`);
  });
}
