# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Start here

> The `/SECRET/` folder is gitignored and must never be committed or processed as source data.

1. Read `/me.md` — user preferences, cost model, and LLM schema overview.
2. For the Karpathy knowledge base, read `/maps/vault-map.md` and `/metadata/llm-schema.md`.

---

## Commands

```bash
npm run dev              # nodemon — auto-restarts on file changes (default dev workflow)
npm start                # plain node — production / fresh boot
npm test                 # run all tests once (Vitest)
npm run test:watch       # re-run tests on file changes
npm run test:coverage    # show coverage report
npm run batch            # output SITREP JSON once (batch mode)
npm run batch:watch      # watch for changes and re-run batch
```

App runs at `http://localhost:3000` (or `PORT` in `.env`).

To kill a stuck server on Windows PowerShell:
```powershell
Get-NetTCPConnection -LocalPort 3001 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
```

---

## Architecture

### Request flow

```
index.html
  └── src/orchestrator.js        ← ES module entry point
        ├── src/lib/router.js    ← hash-based routing (#am-brief, #config, etc.)
        ├── src/lib/config.js    ← BYOK config singleton (localStorage)
        ├── src/lib/i18n.js      ← translations + DOM application
        ├── src/widgets/         ← widget registry and individual widgets
        └── src/display/         ← page renderers (SITREP, config, LLM pages)
```

The server (`server/index.js`) is a thin Express CORS proxy + Google OAuth2 handler. API keys travel from the browser via the `X-Brovis-Key` header — the server never stores them. Default LLM model is `claude-haiku-4-5-20251001`.

### Widget system

Each widget exports a plain object with: `id`, `name`, `requiredKeys`, `requiredFields`, `defaultEnabled`, `order`, `async fetch(config)`, `render(data)`.

`src/widgets/index.js` is the registry. To add a widget: create the file, import it there, and add it to the `widgets` array. The registry handles visibility (`isWidgetVisible`) and runnability (`isWidgetRunnable`) checks.

Widget execution runs in two passes via `Promise.allSettled`:
1. **Base widgets** — run in parallel first.
2. **Context widgets** (`needsContext: true`) — run after base widgets complete, receiving `sitrepContext` (a map of base widget results) as a second argument to `fetch()`. Used for widgets like Morning Brief that synthesize other widget data.

One failing widget never kills the SITREP — failures render as an "unavailable" placeholder.

### Routing

Hash-based routing via `src/lib/router.js`. Routes map to handler functions in `orchestrator.js`:
- `#am-brief`, `#pm-brief`, `#sitrep` → `handleMode(modeName)`
- `#config` → `handleConfig()`
- `#llm-ingest`, `#llm-query`, `#llm-healthcheck`, `#llm-test` → LLM page handlers
- `#travel-calendar` → loads `/calendar.md` as markdown

### Config

`src/lib/config.js` is the single source of truth for user config. Config is stored in `localStorage` under the `brovis.*` namespace. Shape is defined by `DEFAULT_CONFIG` in that file. Modes (`am-brief`, `pm-brief`, `sitrep`) can have widget whitelists and a `calendarDate` (`'today'` or `'tomorrow'`).

### i18n

`src/lib/i18n.js` holds all UI strings in a `TRANSLATIONS` dictionary. Supported languages: `en`, `es`, `de`, `zh`. Call `t('key')` to translate; supports `{variable}` interpolation. DOM elements use `data-i18n`, `data-i18n-placeholder`, or `data-i18n-title` attributes, applied by `applyI18nToDOM()`.

Language-specific place pages are resolved in `orchestrator.js:resolveLangPath()` — non-English place files are expected at `/data/place/{lang}/{filename}.md`, falling back to English if not found.

### Karpathy knowledge base (LLM wiki)

| Path | Purpose |
|---|---|
| `/data/place/` | English wiki pages (canonical) |
| `/data/place/{lang}/` | Translated pages — same filename, language subfolder (e.g. `/data/place/es/Caracas.md`) |
| `/data/index.md` | Master index — update after every ingest |
| `/data/log.md` | Change log — update after every ingest |
| `/maps/vault-map.md` | Navigation guide for agents |
| `/metadata/llm-schema.md` | Page schema, YAML frontmatter conventions, workflows |

Every wiki page requires YAML frontmatter (see `/metadata/llm-schema.md`). Time-sensitive claims (political status, safety advisories, population) must include a `(verified YYYY-MM-DD)` inline tag.

**Ingest workflow**: read source → discuss key takeaways → create/update place pages → add links → update `index.md` and `log.md`.

**Query workflow**: read `index.md` first → identify relevant pages → synthesize with `[[links]]`.

---

## Protected Code — DO NOT MODIFY

These rules exist because the same bugs kept recurring.

### `src/brovis.css` — Header visibility

The `!important` flags on `#header`, `#pipboy-topbar`, and `#pip-settings` MUST stay.
Without them the top menu and config icon disappear. This has been fixed multiple times.

```css
#header          { display: block !important; position: sticky !important; top: 0; z-index: 100; }
#pipboy-topbar   { display: flex !important;  ... }
#pip-settings    { display: inline-block !important; ... }
```

The `position: sticky; top: 0; z-index: 100` on `#header` keeps it pinned regardless of layout or overflow. Do NOT change to `relative` or remove it.

Also do NOT remove the `html[data-theme^="claude-"]` overrides for these same elements further down in the file.

### `index.html` — Theme attribute

The `<html>` tag MUST keep `data-theme="claude-dark"`. Removing it breaks the claude theme CSS selectors and hides the header.

### `src/display/llm-healthcheck.js` — Escaped backticks in template literal

The system prompt string uses backtick delimiters. Any backtick INSIDE the string must be escaped as `` \` ``. An unescaped backtick terminates the template literal early, causing a JS syntax error that breaks the entire module graph — the whole app goes blank, not just this file. This has already happened once.
