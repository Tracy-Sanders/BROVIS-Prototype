# BROVIS

**Bro's Virtual Intelligence System** — a self-hosted, J.A.R.V.I.S.-inspired morning dashboard. Open source. BYOK. No accounts, no telemetry, no cloud lock-in.

# Overview
Karpathy [LLM](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f) prototype with Brief and Travel data.
![LLM Overview](/data/media/01%20LLM%20Ingest%20Analyze.png)

---

## LLM
### Ingest

#### Obsidian Web Clipper to save website information: 
![LLM Clipper](/data/media/02%20Obsidian%20Web%20Clipper.png)

#### Dragged saved website into ingest window, analyze, select input :
![LLM Ingest](/data/media/03%20LLM%20Ingest%20Generate%20Pages.png)

#### Save all pages to import into LLC
![LLM Save](/data/media/04%20LLM%20Ingest%20Save%20All%20Pages.png)

---

### Query LLM

![LLM Query](/data/media/05%20LLM%20Query.png)

---

### Lint - Health Check for LLM
![LLM Lint](/data/media/06%20LLM%20Lint.png)

---

### Test Harness with automated test scripts
![LLM Test](/data/media/07%20LLM%20Test.png)

### Obsidian integration

The `data/` folder is a valid Obsidian vault. Open it in Obsidian to get graph view, backlink navigation, and the Web Clipper workflow for fast ingestion from the browser.

#### Obsidian Graph 
![Obsidian Graph](/data/media/08%20Obsidian%20Graph.png)

#### Obsidian Maps plugin 
![Obsidian Maps](/data/media/09%20Obsidian%20Map%20Base.png)

---

## Privacy & Security

> Your API keys are stored only in your browser's `localStorage`. They are never written to a server file, never logged, and never leave your device. The BROVIS server is a minimal CORS proxy — no telemetry, no accounts, no tracking.

See [SECURITY.md](SECURITY.md) for the full data-flow diagram.

---

## Features

- **Karpathy** - [LLM](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f)
- **Places knowledge base** — 192 wiki pages covering cities, landmarks, and regions, queryable via the LLM layer (see [Knowledge Base](#knowledge-base))
- **BYOK** — you supply your own API keys; they live in your browser's localStorage, never on a server
- **Widget architecture** — each widget is a self-contained file; add one by dropping a new file in `src/widgets/`
- **Widget isolation** — one failing widget never kills the SITREP (Promise.allSettled)
- **Full config UI** — profile, API keys, and per-widget toggles in one settings page
- **i18n** — UI available in English, Spanish, German, and Chinese
- **SITREP** — single command (or click) pulls weather, markets, bible verse, calendar, and news into one clean card
- **KJV Bible verse** — random verse from a curated list every run
- **Google Calendar** — OAuth2, today's events only
- **Markets** — BTC, Gold, Silver, Oil, S&P 500, Dow Jones, NASDAQ, Russell 2000 (no key required)
- **Morning Brief** — Claude synthesizes weather, news, markets, and calendar into a commander's brief (opt-in; BYOK)
- **Sports headlines** — top US sports stories via NewsAPI
- **VIP Mail** — top unread emails from starred Google Contacts (Google OAuth2, no extra key)
- **Hash-based routing** — deep-link to any view: `#am-brief`, `#pm-brief`, `#sitrep`, `#config`, `#llm-ingest`, `#llm-query`, `#travel-calendar`

---

## Travel Calendar place view 
![Travel Place](/data/media/11%20Calendar%20Sydney%20English.png)

---

## Brief Configuration 
![Travel Place](/data/media/11%20Calendar%20Sydney%20English.png)

---

## Brief Top 
![Brief Top](/data/media/13%20Brief%20AM%201.png)

---

## Brief Bottom 
![Brief Bottom](/data/media/14%20Brief%20AM%202.png)

---

## Stack

| Layer | Tech |
|---|---|
| Frontend | Vanilla JS ES modules, no framework |
| Server | Node.js + Express (CORS proxy, OAuth) |
| Styling | Plain CSS with design tokens |
| Storage | Browser localStorage |
| Auth | Google OAuth2 (calendar only) |

---

## Quick start

### 1. Prerequisites

- Node.js 18+
- API keys (see below)

### 2. Clone and install

```bash
git clone https://github.com/Tracy-Sanders/BROVIS.git
cd brovis
npm install
```

### 3. Configure environment

```bash
cp .env.example .env
# Edit .env — set PORT and optionally your dev fallback keys
```

### 4. Run

```bash
npm run dev     # nodemon — auto-restarts on changes
# or
npm start       # plain node
```

Open `http://localhost:3001` and click **CONFIG** to enter your API keys.

---

## Testing

```bash
npm test                  # run all tests once
npm run test:watch        # re-run on file changes
npm run test:coverage     # show coverage report
```

---

## API keys

BROVIS uses a BYOK (Bring Your Own Key) model. Keys are stored in your browser and sent directly to their APIs — the BROVIS server only proxies requests to avoid CORS restrictions.

| Widget | Service | Free tier |
|---|---|---|
| Weather | [OpenWeatherMap](https://openweathermap.org/api) | Yes — 1,000 calls/day |
| News / Sports | [NewsAPI](https://newsapi.org) | Yes — 100 requests/day |
| Markets | CoinGecko + Stooq | No key needed |
| Bible | bible-api.com | No key needed |
| Calendar | Google Calendar API | Free (OAuth2) |
| VIP Mail | Google Gmail API | Free (OAuth2, same credentials as Calendar) |
| Morning Brief / LLM | [Anthropic Claude](https://console.anthropic.com) | Pay-per-token |

---

## Google Calendar setup

1. Go to [Google Cloud Console](https://console.cloud.google.com) → APIs & Services → Credentials
2. Create an **OAuth 2.0 Client ID** (Web application)
3. Add `http://localhost:3001/auth/google/callback` as an authorized redirect URI
4. Copy the Client ID and Secret into your `.env`
5. Click **Connect Google Calendar** in the SITREP to authorize

---

## Knowledge base

BROVIS ships a personal travel knowledge base (the "Karpathy wiki") — 192 place pages covering cities, landmarks, and regions across Europe, the Americas, Asia, Australia, and Africa. Every page uses a consistent YAML frontmatter schema so Claude can ingest, query, and cross-reference them reliably.

| Path | Purpose |
|---|---|
| `data/place/` | English wiki pages (canonical) |
| `data/place/es/` | Spanish translations — same filenames |
| `data/index.md` | Master index of all pages |
| `data/log.md` | Change log |

### LLM workflows

Four dedicated pages are accessible from the nav bar:

| Route | Purpose |
|---|---|
| `#llm-ingest` | Feed a source URL or paste text → Claude generates structured wiki pages |
| `#llm-query` | Ask questions across the knowledge base → Claude synthesizes an answer |
| `#llm-healthcheck` | Validate that your Claude API key is working |
| `#llm-test` | Run the LLM test suite against your key |

---

## Adding a widget

Create `src/widgets/my-widget.js`:

```js
export default {
  id: 'my-widget',
  name: 'My Widget',
  requiredKeys: [],        // keys from config.keys that must be set
  requiredFields: [],      // dotpaths into config (e.g. 'user.location')
  defaultEnabled: true,
  order: 60,               // lower renders earlier in the SITREP

  async fetch(config) {
    // return any data shape you need
  },

  render(data) {
    return `<div class="sitrep-section">...</div>`;
  }
};
```

Then add one import + one entry to [src/widgets/index.js](src/widgets/index.js):

```js
import myWidget from './my-widget.js';
export const widgets = [...existing, myWidget].sort(...);
```

That's it. The widget automatically gets:
- A toggle in the CONFIG settings page
- A "needs config" placeholder if its required keys are missing
- Widget isolation (one crash doesn't kill the SITREP)

---

## Project structure

```
brovis/
├── index.html
├── server/
│   └── index.js              Express proxy + Google OAuth (Calendar + Gmail)
├── src/
│   ├── orchestrator.js       App entry point — wires everything together
│   ├── brovis.css
│   ├── lib/
│   │   ├── config.js         Single source of truth for user config (BYOK)
│   │   ├── storage.js        localStorage abstraction (brovis.* namespace)
│   │   ├── http.js           Shared fetch wrapper + X-Brovis-Key header
│   │   ├── i18n.js           Translations (en/es/de/zh) + DOM application
│   │   └── claude.js         LLM client (complete, chat, chatRaw)
│   ├── widgets/
│   │   ├── index.js          Registry — isWidgetVisible, isWidgetRunnable
│   │   ├── weather.js
│   │   ├── news.js
│   │   ├── markets.js
│   │   ├── bible.js
│   │   ├── calendar.js
│   │   ├── morning-brief.js  Claude synthesis of SITREP context (opt-in)
│   │   ├── sports.js
│   │   ├── gmail.js          VIP Mail — starred contacts, Google OAuth2
│   │   ├── music.js
│   │   ├── fitness-tips.js
│   │   ├── tasks.js
│   │   └── traffic.js
│   └── display/
│       ├── sitrep.js         SITREP shell + fallback helpers
│       ├── config.js         Full config page renderer
│       ├── llm-ingest.js     Knowledge base ingest workflow
│       ├── llm-query.js      Knowledge base query workflow
│       ├── llm-healthcheck.js  API key health check
│       └── llm-test.js       LLM test suite runner
├── data/
│   ├── place/                192 place wiki pages (English)
│   │   └── es/               Spanish translations
│   ├── index.md              Master knowledge base index
│   └── log.md                Change log
├── maps/
│   └── vault-map.md          Navigation guide for LLM agents
├── metadata/
│   └── llm-schema.md         Page schema + YAML frontmatter conventions
├── .env.example
├── LICENSE
└── package.json
```

---

## License

MIT — see [LICENSE](LICENSE).

---

## Acknowledgments

- [OpenWeatherMap](https://openweathermap.org) — weather data
- [NewsAPI](https://newsapi.org) — news headlines
- [CoinGecko](https://coingecko.com) — cryptocurrency prices
- [Stooq](https://stooq.com) — stock market data
- [bible-api.com](https://bible-api.com) — KJV Bible verses
- [Google Calendar API](https://developers.google.com/calendar) — calendar integration
- [Anthropic Claude](https://anthropic.com) — AI layer
