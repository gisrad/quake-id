# Sentinel Seismik · Indonesia Earthquake & Active Fault 3D Monitor

**Real-time 3D Indonesian earthquake observatory fusing BMKG InaTEWS (SeisComP + MMI felt reports) and USGS ComCat — separating shallow crustal faults, subduction megathrusts, and deep Wadati–Benioff intraslab earthquakes with a live hypocenter cross-section.**

[![Live Map](https://img.shields.io/badge/Live_Map-quake.transbulent.id-ff4d5e?style=flat-square&logo=cloudflare&logoColor=white)](https://quake.transbulent.id/)
[![Data Fusion](https://img.shields.io/badge/Data-BMKG_InaTEWS_+_USGS_ComCat-ffb020?style=flat-square)](https://inatews.bmkg.go.id/)
[![Stack](https://img.shields.io/badge/Stack-Astro_5_+_MapLibre_GL_v5-1e293b?style=flat-square)](https://maplibre.org/)
[![Edge](https://img.shields.io/badge/Edge-Cloudflare_Workers_+_D1-f38020?style=flat-square&logo=cloudflareworkers&logoColor=white)](https://workers.cloudflare.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-22c55e?style=flat-square)](LICENSE)

![Sentinel Seismik desktop view over the Indonesian archipelago showing active faults, megathrust trenches, hypocenter cross-section, and fused BMKG + USGS seismicity](docs/preview-desktop.png)

---

## Why This Exists

Standard earthquake maps plot every tremor as an undifferentiated dot—equating a **10 km shallow crustal rupture** directly beneath a city (such as Cianjur, Bantul, or Palu) with a **450 km deep Wadati–Benioff intraslab earthquake** beneath the Banda Sea whose seismic energy attenuates strongly before reaching the surface.

**Sentinel Seismik** fuses near-real-time Indonesian seismograph bulletins with physics-aware tectonic classification across **16 mapped Indonesian fault, back-arc thrust, and subduction megathrust systems**, surfacing felt intensity (`MMI`), tsunami advisories, radiated energy (`Gutenberg–Richter`), and an interactive **0–650 km hypocenter depth cross-section** in one zero-clutter WebGL observatory.

<details>
<summary>Mobile responsive preview (390×844 viewport with collapsible control sheet)</summary>

<p align="center">
  <img src="docs/preview-mobile.png" alt="Sentinel Seismik mobile layout over Indonesia" width="340" />
</p>

</details>

---

## Key Capabilities

- **Multi-Source Live Catalog Fusion (5-Minute Cron)**: Merges **BMKG InaTEWS SeisComP** near-real-time feeds (`live30event.xml`, `gempaQL.json`, `M ≥ 2.0`), official BMKG felt-intensity & tsunami bulletins (`autogempa`, `gempadirasakan`, `gempaterkini`), and **USGS ComCat** 30-day seismicity (`M ≥ 2.5`) inside `94.0°E–141.2°E`, `11.8°S–7.0°N`. Duplicate reports within `≤ 95 km`, `±120 s`, and `ΔM ≤ 0.9` are automatically fused, preserving USGS event IDs enriched with BMKG `MMI` and `Wilayah` metadata.
- **3-Regime Tectonic Classification**:

| Regime | Visual Marker | Depth / Geometry Rule | Hazard Context |
| :--- | :--- | :--- | :--- |
| **Crustal Fault (`Sesar · Kerak`)** | `#ff4d5e` Crimson | Depth `≤ 35 km` and within `≤ 55 km` of a crustal/back-arc fault (or `> 95 km` from megathrust) | High near-field shaking risk on land (e.g., *Semangko*, *Cimandiri–Lembang–Baribis*, *Opak*, *Palu-Koro*, *Sorong*) |
| **Megathrust (`Subduksi`)** | `#ffb020` Amber | Depth `≤ 60 km` along trench/subduction interface | Interplate rupture & tsunami generation potential (*Sunda*, *Jawa–Sumba*, *Banda*, *Sulawesi Utara*, *Halmahera*) |
| **Deep Intraslab (`Lempeng Dalam`)** | `#38bdf8` / `#818cf8` Rings | Depth `> 60 km` (`60–300 km` intermediate, `> 300 km` deep Benioff up to `650 km`) | Deep subducted slab events with broader attenuation before reaching surface |

- **Live Hypocenter Cross-Section (`94°E–141°E × 0–650 km`)**: Interactive SVG longitude-vs-depth profile showing the dipping Wadati–Benioff slab geometry synced with active tectonic regime filters and magnitude thresholds.
- **Edge-Optimized Cloudflare Worker + D1**: Performs diff-only batched D1 writes (`ROWS_PER_INSERT = 5`) to preserve write quotas, `60 s` `caches.default` edge caching, single-flight `ingest_lock` concurrency protection, and strict HTTP security headers (`CSP`, `HSTS`, `nosniff`).
- **Archipelagic Framing, 38 Provinces & Local Time Zones**: Panel-aware MapLibre GL v5 camera framing, 6 tectonic corridor presets (*Nusantara*, *Sumatera*, *Jawa · Nusa*, *Sulawesi*, *Maluku · Banda*, *Papua*), 38-province lookup, automatic `WIB` / `WITA` / `WIT` timestamps, and optional privacy-preserving client-side Wi-Fi/GPS distance to nearest quake & fault.
- **Offline Historical Replays (Zero API Keys Needed)**: Built-in scrubber, `1×/2×/4×` playback, and SVG seismicity sparkline for two landmark Indonesian sequences from USGS ComCat:
  - **Palu–Donggala 2018 · M7.5** (`109` events, `2018-09-27` to `2018-10-15`, `72 h` active window)
  - **Lombok 2018 · M6.9** (`136` events, `2018-07-28` to `2018-08-26`, `96 h` active window)
- **3D Terrain & Satellite Layers**: Toggleable AWS Terrain DEM (`1.6×` vertical exaggeration, `60°` pitch, hillshade) and Esri World Imagery overlay.

---

## Ringkasan Bahasa Indonesia

**Sentinel Seismik** (`quake.transbulent.id`) adalah observatorium peta gempa bumi Indonesia 3D real-time yang memadukan aliran seismograf **BMKG InaTEWS SeisComP** (`M ≥ 2.0`), laporan guncangan **MMI** & potensi tsunami resmi BMKG, serta katalog **USGS ComCat** 30 hari.

* **Pemisahan 3 Rezim Tektonik**: Membedakan gempa **sesar kerak darat dangkal** (`≤ 35 km`), **zona kontak megathrust** (`≤ 60 km`), dan **lempeng dalam Wadati–Benioff** (`> 60 km` hingga `650 km`) pada 16 sistem sesar aktif dan palung subduksi Indonesia.
* **Penampang Hiposenter & Energi Seismik**: Menampilkan profil penampang kedalaman `0–650 km` (`94°BT–141°BT`) dan estimasi energi radiasi Gutenberg–Richter secara langsung.
* **Mode Replay Historis Offline**: Menyertakan simulasi rentetan **Gempa Palu 2018 (M7.5)** dan **Gempa Lombok 2018 (M6.9)** yang berjalan 100% lokal tanpa API key.
* *Catatan: Peringatan dini tsunami resmi Indonesia sepenuhnya mengacu pada **BMKG InaTEWS**.*

---

## Quickstart

### 1. Local Frontend + Offline Replays (Zero API Keys Required)

```bash
git clone https://github.com/gisrad/quake-id.git
cd quake-id
npm install
npm run dev
```

Open `http://127.0.0.1:4325/` and switch to **Replay Historis** to explore the 2018 **Palu (M7.5)** and **Lombok (M6.9)** sequences locally. *(In plain `astro dev`, `/api/quakes` requires the Cloudflare Worker; use `wrangler dev` or deploy to Cloudflare Workers for live BMKG + USGS ingestion.)*

### 2. Production Deployment on Cloudflare Workers + D1

1. Copy the sanitized Wrangler template:
   ```bash
   cp wrangler.toml.example wrangler.toml
   ```
   *(`wrangler.toml` is gitignored so your personal `account_id` and `database_id` never enter version control.)*
2. Provision Cloudflare D1 and apply the SQL schema (`worker/schema.sql`):
   ```bash
   npx wrangler d1 create quake-id
   # Paste the returned database_id into wrangler.toml
   npx wrangler d1 execute quake-id --remote --file=worker/schema.sql
   ```
3. Run the security check, build static Astro assets, and deploy (no external API secrets needed):
   ```bash
   npm run check:security
   npm run build
   npx wrangler deploy
   ```

### 3. Rebuilding Historical Replay Data (Optional)

```bash
npm run bake:replay
```

---

## Repository Structure

```text
quake-id/
├── astro.config.mjs                 # Astro 5 static build configuration
├── wrangler.toml.example            # Sanitized Cloudflare Worker + D1 template
├── worker/
│   ├── index.js                     # Edge router, 5-min BMKG+USGS fusion cron, D1 & cache
│   └── schema.sql                   # D1 quakes & meta schema
├── src/
│   ├── pages/
│   │   ├── index.astro              # UI shell, JSON-LD SEO, & responsive dark layout
│   │   └── 404.astro                # Minimal dark-theme 404 page
│   └── scripts/
│       ├── quake.js                 # MapLibre GL v5 controller, depth profile & replay engine
│       ├── indonesia.js             # 6 tectonic corridor presets, 38 provinces & WIB/WITA/WIT
│       └── tectonics.js             # 16 Indonesian faults/trenches & 3-regime classifier
├── scripts/
│   ├── bake-replay.mjs              # USGS ComCat historical sequence builder (no key required)
│   └── security-check.mjs           # Automated pre-push secret/UUID/email/path scanner
├── public/
│   ├── data/replays-quake.json      # Palu 2018 (109 events) & Lombok 2018 (136 events)
│   ├── fonts/                       # Self-hosted Schibsted Grotesk WOFF2 + SIL OFL 1.1
│   ├── og-quake.png                 # OpenGraph / Twitter social card (1200×630)
│   └── robots.txt & sitemap.xml     # Search engine crawl directives
├── docs/
│   ├── preview-desktop.png          # Desktop viewport preview
│   └── preview-mobile.png           # Mobile viewport preview
├── CITATION.cff                     # Machine-readable software citation metadata
├── SECURITY.md                      # Architecture boundaries & vulnerability reporting
├── THIRD_PARTY_NOTICES.md           # Seismic data & map tile attributions
└── LICENSE                          # MIT License
```

---

## Citation & Data Attribution

If you reference **Sentinel Seismik** or its tectonic regime classification in academic or operational work, please use GitHub's **"Cite this repository"** sidebar widget ([CITATION.cff](CITATION.cff)):

- **Seismic Feeds**: [BMKG InaTEWS](https://inatews.bmkg.go.id/) (`live30event.xml`, `gempaQL.json`, `autogempa`, `gempadirasakan`, `gempaterkini`) and [USGS ComCat](https://earthquake.usgs.gov/fdsnws/event/1/) (`FDSN Event Web Service`).
- **Basemaps, DEM & Fonts**: Vector tiles by [OpenFreeMap](https://openfreemap.org/) / © OpenStreetMap contributors · Elevation RGB terrain by AWS Terrain Tiles (Mapzen / Tilezen) · Reference satellite imagery by Esri World Imagery · Typography using [Schibsted Grotesk](public/fonts/OFL.txt) (SIL OFL 1.1).

## License

Code in this repository is released under the [MIT License](LICENSE). See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for seismic catalog, map tile, and font attributions.
