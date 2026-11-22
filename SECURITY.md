# Security Policy

## Architecture & Credential Boundaries

- **Zero-secret public feeds**: Both real-time earthquake ingestion feeds (BMKG InaTEWS public endpoints and USGS ComCat FDSN API) require no API keys or private credentials.
- **SQLite parameterization**: All queries and batched upserts to Cloudflare D1 (`worker/index.js`) use prepared parameter bindings (`.bind(...)`).
- **HTTP security headers**: Static assets and JSON endpoints enforce `Content-Security-Policy`, `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, and `Permissions-Policy`.
- **Client-side geolocation privacy**: Optional device positioning (`Lokasi Saya`) computes proximity to earthquakes and faults strictly inside the browser without transmitting user coordinates to the Worker or third-party servers.
- **Environment hygiene**: `wrangler.toml`, `.env`, and `.dev.vars` are excluded via `.gitignore`; only the sanitized `wrangler.toml.example` template is tracked. Automated checks (`npm run check:security`) fail on leaked UUIDs, Cloudflare account IDs, tokens, email addresses, or local workstation paths.

## Supported Versions

Only the latest state of the `main` branch and the live deployment at `https://quake.transbulent.id` are supported.

## Reporting a Vulnerability

If you discover a security issue (such as a CSP bypass, injection vector, or accidental credential exposure), please report it privately using GitHub Security Advisories:

- <https://github.com/gisrad/quake-id/security/advisories/new>

Please avoid opening public issues for unpatched security vulnerabilities.
