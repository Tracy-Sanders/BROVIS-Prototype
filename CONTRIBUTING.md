# Contributing to BROVIS

Thanks for your interest. BROVIS is a lean, opinionated project — contributions that fit the philosophy are welcome.

## Philosophy

- **Self-hosted first.** No dependency on any BROVIS-operated cloud service.
- **BYOK always.** API keys belong to the user. Never store them server-side in production.
- **Vanilla over frameworks.** No React, no Vue, no bundler required to run or contribute.
- **One widget = one file.** Each widget lives in `src/widgets/<id>.js` and owns its manifest, fetch, and render. Don't split what belongs together.
- **Fail gracefully.** Widgets must not crash the SITREP. Use `Promise.allSettled`; the infrastructure handles it — just don't swallow errors silently.

---

## How to contribute

### Bug fix or small improvement

1. Fork the repo and create a branch: `git checkout -b fix/issue-description`
2. Make your change
3. Test manually: `npm run dev`, open `http://localhost:3001`, verify the SITREP runs
4. Open a PR with a clear description of what broke and what you changed

### New widget

1. Create `src/widgets/<id>.js` following the [widget contract](README.md#adding-a-widget)
2. Add the import and entry to `src/widgets/index.js`
3. If the widget needs a new server-side proxy route, add it to `server/index.js` following the existing pattern (getUserKey for BYOK, Cache-Control headers, upstream error forwarding)
4. Add the key metadata to `API_KEY_META` in `src/display/config.js` if it needs a new API key
5. Open a PR — include a short description of the data source and why it belongs in a morning SITREP

### New API key in config

Add the key id to `DEFAULT_CONFIG.keys` in `src/lib/config.js` and a `API_KEY_META` entry in `src/display/config.js`. The config UI and widget requirement checks are fully dynamic — nothing else needs to change.

---

## What doesn't fit

- **Accounts, login, or user databases** — those belong in Tier 2 (brovis.ai), not this repo
- **Framework dependencies** — keep it vanilla JS
- **Widgets that phone home to BROVIS infrastructure**
- **Telemetry or analytics of any kind**

---

## Code style

- ES modules (`import`/`export`), no CommonJS
- No TypeScript (yet) — plain JS with JSDoc comments where useful
- 2-space indentation
- Prefer `const` over `let`; avoid `var`
- Keep widget `render()` functions as pure string templates — no DOM manipulation inside them
- Server routes: always set `Cache-Control: no-cache, no-store, must-revalidate` on live-data endpoints

---

## Testing

There's no automated test suite yet. Manual testing checklist for any PR:

- [ ] `npm run dev` starts without errors
- [ ] SITREP loads and all widgets render (or show a graceful unavailable state)
- [ ] CONFIG page opens, saves, and SITREP re-renders with new values
- [ ] Disabling a widget in CONFIG hides it from the SITREP
- [ ] Clearing localStorage and refreshing shows the first-run config prompt
- [ ] If your change touches a server route, test it with and without the `X-Brovis-Key` header

---

## License

By contributing, you agree that your contributions will be licensed under the project's [MIT License](LICENSE).
