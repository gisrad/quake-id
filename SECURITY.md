# Security Policy

## Architecture & Credential Boundaries

- **Zero-secret public feeds**: Both real-time earthquake ingestion feeds (BMKG InaTEWS public endpoints and USGS ComCat FDSN API) require no API keys or private credentials.
- **Read-only public API, cron-only ingest**: `GET`/`HEAD` on `/api/quakes` and `/api/status` never call upstream feeds, never write D1, and never claim the ingest lease; other methods return `405`. Only the Cloudflare cron `scheduled` handler ingests, guarded by a D1 lease (`meta.scheduled_ingest_lease`, 20 min, random owner token). No operator or refresh endpoint exists.
- **SQLite parameterization**: All queries and batched upserts to Cloudflare D1 (`worker/index.js`) use prepared parameter bindings (`.bind(...)`).
- **HTTP security headers**: Static assets and JSON endpoints enforce `Content-Security-Policy`, `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, and `Permissions-Policy`.
- **Client-side geolocation privacy**: Optional device positioning (`Lokasi Saya`) is requested only after an explicit user action (pressing the button and confirming the in-page prompt), never automatically. It computes proximity to earthquakes and faults strictly inside the browser without transmitting user coordinates to the Worker or third-party servers. `Permissions-Policy` allows `geolocation` for the same origin only.
- **Environment hygiene**: `wrangler.toml`, `.env`, and `.dev.vars` are excluded via `.gitignore`; only the sanitized `wrangler.toml.example` template is tracked. Automated checks (`npm run check:security`) fail on leaked UUIDs, Cloudflare account IDs, tokens, email addresses, or local workstation paths.

## Supported Versions

Only the latest state of the `main` branch and the live deployment at `https://quake.transbulent.id` are supported.

## Reporting a Vulnerability

If you discover a security issue (such as a CSP bypass, injection vector, or accidental credential exposure), please report it privately using GitHub Security Advisories:

- <https://github.com/gisrad/quake-id/security/advisories/new>

Please avoid opening public issues for unpatched security vulnerabilities.
