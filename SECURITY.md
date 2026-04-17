# Security Policy

## BYOK Model — Your Keys Never Leave Your Device

BROVIS uses a **Bring Your Own Key (BYOK)** architecture. Here is exactly how your API keys are handled:

1. **Storage** — Keys are stored exclusively in your browser's `localStorage` under the `brovis.*` namespace. They are never written to a file, a database, or sent to any server you don't control.

2. **Transmission** — When a widget needs to call a third-party API (OpenWeatherMap, NewsAPI, Anthropic), your browser sends the key to the local BROVIS server via the `X-Brovis-Key` HTTP header. The server uses that key to make the upstream API call and immediately discards it — it is never logged, cached, or persisted.

3. **Server** — The BROVIS server is a thin CORS proxy. It does not have a database, does not create user accounts, and does not store any state beyond the Google OAuth token described below.

4. **Google OAuth** — If you connect Google Calendar or Gmail, the OAuth refresh token is stored in `~/.brovis_token.json` on your local machine only. It is never transmitted outside your device except to Google's own OAuth endpoint.

## No Telemetry, No Analytics, No Accounts

- BROVIS collects no usage data.
- There are no accounts, no sign-ups, no email collection.
- No third-party analytics scripts are loaded.
- No data is transmitted to Anthropic, the BROVIS project, or any other party except the APIs you explicitly configure.

## Data Flow Diagram

```
Browser (localStorage)
  │
  │  X-Brovis-Key header (your API key, in-flight only)
  ▼
BROVIS server (localhost)
  │
  │  Authenticated request (key forwarded, never stored)
  ▼
Third-party API (OpenWeatherMap / NewsAPI / Anthropic / etc.)
```

## Reporting a Vulnerability

If you discover a security issue in BROVIS, please report it responsibly:

- **GitHub Issues:** https://github.com/Tracy-Sanders/BROVIS/issues
- **Email:** tracy@it-sunset.com

Please include a description of the issue, steps to reproduce, and any relevant logs or screenshots. We will respond as quickly as possible.

## Dependency Security

BROVIS uses a minimal server-side dependency set (Express, googleapis, dotenv). Run `npm audit` at any time to check for known vulnerabilities in installed packages.
