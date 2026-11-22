// Worker publik quake.transbulent.id: aset statis, fusi real-time BMKG SeisComP (live30event + gempaQL) + BMKG MMI + USGS ComCat ke D1.

const USGS_BASE = 'https://earthquake.usgs.gov/fdsnws/event/1/query';
const BMKG_BASE = 'https://data.bmkg.go.id/DataMKG/TEWS';
const INATEWS_GCS = 'https://bmkg-content-inatews.storage.googleapis.com';
const BBOX = { minLon: 94.0, maxLon: 141.2, minLat: -11.8, maxLat: 7.0 };

const RETAIN_SECONDS = 30 * 24 * 3600;
const STALE_SECONDS = 4 * 60;
const LOCK_SECONDS = 60;
const RETRY_COOLDOWN_SECONDS = 90;
const VALID_HOURS = [24, 72, 168, 720];
const CACHE_VER = 2;
const ROWS_PER_INSERT = 5; // 16 kolom x 5 baris = 80 parameter (< batas 100 parameter D1)

const CSP = [
  "default-src 'self'",
  "script-src 'self' https://static.cloudflareinsights.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://tiles.openfreemap.org https://s3.amazonaws.com https://server.arcgisonline.com",
  "connect-src 'self' https://tiles.openfreemap.org https://s3.amazonaws.com https://server.arcgisonline.com https://cloudflareinsights.com",
  "font-src 'self' https://tiles.openfreemap.org",
  "worker-src 'self' blob:",
  "child-src blob:",
  "frame-ancestors 'none'",
  "base-uri 'none'",
  "form-action 'none'"
].join('; ');

const MMI_MAP = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8, IX: 9, X: 10 };
const FETCH_HEADERS = {
  'User-Agent': 'SentinelSeismik-Transbulent/1.0 (+https://quake.transbulent.id)',
  Accept: 'application/json, application/xml, text/xml, */*'
};

function securityHeaders(headers) {
  headers.set('Content-Security-Policy', CSP);
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  headers.set('Permissions-Policy', 'geolocation=(self), camera=(), microphone=()');
  headers.set('Strict-Transport-Security', 'max-age=31536000');
  return headers;
}

function json(body, status = 200, cacheSeconds = 0) {
  const headers = securityHeaders(new Headers({ 'content-type': 'application/json; charset=utf-8' }));
  headers.set('Cache-Control', cacheSeconds ? `public, max-age=${cacheSeconds}` : 'no-store');
  headers.set('X-Robots-Tag', 'noindex');
  return new Response(JSON.stringify(body), { status, headers });
}

function snapHours(raw) {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return 24;
  for (const bucket of VALID_HOURS) {
    if (n <= bucket) return bucket;
  }
  return VALID_HOURS[VALID_HOURS.length - 1];
}

function quakeCacheRequest(hours) {
  return new Request(`https://cache.quake.transbulent.internal/api/quakes?v=${CACHE_VER}&hours=${hours}`, { method: 'GET' });
}

function inBbox(lat, lon) {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    lon >= BBOX.minLon &&
    lon <= BBOX.maxLon &&
    lat >= BBOX.minLat &&
    lat <= BBOX.maxLat
  );
}

function haversineKm(lat1, lon1, lat2, lon2) {
  const r = Math.PI / 180;
  const dLat = (lat2 - lat1) * r;
  const dLon = (lon2 - lon1) * r;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(a)));
}

export function parseMaxMmi(dirasakan) {
  if (!dirasakan || typeof dirasakan !== 'string') return null;
  let best = 0;
  const rx = /(?:^|[\s,;/-])(X|IX|VIII|VII|VI|V|IV|III|II|I)(?=\s|[-,;]|$)/g;
  for (const m of dirasakan.matchAll(rx)) {
    const val = MMI_MAP[m[1]] || 0;
    if (val > best) best = val;
  }
  return best > 0 ? best : null;
}

function parseUtcStamp(raw, isSlash = false) {
  if (!raw || typeof raw !== 'string') return null;
  let s = raw.trim();
  if (isSlash) s = s.replace(/\//g, '-');
  s = s.replace(/\s+/g, 'T');
  const dot = s.indexOf('.');
  if (dot !== -1) s = s.slice(0, dot + 4);
  if (!s.endsWith('Z') && !/[+-]\d{2}:\d{2}$/.test(s)) s += 'Z';
  const ms = Date.parse(s);
  return Number.isFinite(ms) ? Math.floor(ms / 1000) : null;
}

function xmlTag(block, name) {
  const m = block.match(new RegExp(`<${name}>\\s*([^<]*?)\\s*</${name}>`, 'i'));
  return m ? m[1].trim() : null;
}

function parseLive30Xml(xmlText) {
  if (!xmlText || typeof xmlText !== 'string') return [];
  const out = [];
  const blocks = xmlText.match(/<gempa>[\s\S]*?<\/gempa>/gi) || [];
  for (const block of blocks) {
    const id = xmlTag(block, 'eventid');
    const ts = parseUtcStamp(xmlTag(block, 'waktu'), true);
    const lat = parseFloat(xmlTag(block, 'lintang'));
    const lon = parseFloat(xmlTag(block, 'bujur'));
    const depth = parseFloat(xmlTag(block, 'dalam'));
    const mag = parseFloat(xmlTag(block, 'mag'));
    const area = xmlTag(block, 'area');
    if (!id || ts === null || !inBbox(lat, lon) || !Number.isFinite(mag) || mag < 2.0) continue;
    out.push({
      id,
      origin_ts: ts,
      lat: Number(lat.toFixed(4)),
      lon: Number(lon.toFixed(4)),
      depth_km: Number(Math.max(1, Number.isFinite(depth) ? depth : 10).toFixed(1)),
      mag: Number(mag.toFixed(1)),
      mag_type: 'Mw/ML',
      source: 'BMKG-RT',
      place: area || null,
      bmkg_wilayah: null,
      bmkg_dirasakan: null,
      max_mmi: null,
      potensi: null,
      tsunami: 0,
      shakemap: null,
      url: null
    });
  }
  return out;
}

function parseGempaQl(geo) {
  if (!geo || !Array.isArray(geo.features)) return [];
  const out = [];
  for (const f of geo.features) {
    const p = f.properties || {};
    const coords = f.geometry?.coordinates || [];
    const lon = parseFloat(coords[0]);
    const lat = parseFloat(coords[1]);
    // Perhatian: coords[2] pada gempaQL selalu placeholder "1"; baca kedalaman sebenarnya dari p.depth
    const depth = parseFloat(p.depth);
    const mag = parseFloat(p.mag);
    const ts = parseUtcStamp(p.time, false);
    const id = p.id ? String(p.id).trim() : null;
    if (!id || ts === null || !inBbox(lat, lon) || !Number.isFinite(mag) || mag < 2.0) continue;
    out.push({
      id,
      origin_ts: ts,
      lat: Number(lat.toFixed(4)),
      lon: Number(lon.toFixed(4)),
      depth_km: Number(Math.max(1, Number.isFinite(depth) ? depth : 10).toFixed(1)),
      mag: Number(mag.toFixed(1)),
      mag_type: 'Mw/ML',
      source: 'BMKG-RT',
      place: p.place ? String(p.place).trim() : null,
      bmkg_wilayah: null,
      bmkg_dirasakan: null,
      max_mmi: null,
      potensi: null,
      tsunami: 0,
      shakemap: null,
      url: null
    });
  }
  return out;
}

function parseBmkgCoords(item) {
  if (item.Coordinates && typeof item.Coordinates === 'string') {
    const parts = item.Coordinates.split(',').map((s) => Number(s.trim()));
    if (parts.length === 2 && Number.isFinite(parts[0]) && Number.isFinite(parts[1])) {
      return { lat: parts[0], lon: parts[1] };
    }
  }
  const latStr = String(item.Lintang || '');
  const lonStr = String(item.Bujur || '');
  const latVal = parseFloat(latStr);
  const lonVal = parseFloat(lonStr);
  if (!Number.isFinite(latVal) || !Number.isFinite(lonVal)) return null;
  const lat = /LS/i.test(latStr) ? -Math.abs(latVal) : Math.abs(latVal);
  const lon = /BB/i.test(lonStr) ? -Math.abs(lonVal) : Math.abs(lonVal);
  return { lat, lon };
}

function parseBmkgAdvisory(item) {
  if (!item || !item.DateTime) return null;
  const ms = Date.parse(item.DateTime);
  if (!Number.isFinite(ms)) return null;
  const coords = parseBmkgCoords(item);
  if (!coords || !inBbox(coords.lat, coords.lon)) return null;
  const mag = parseFloat(item.Magnitude);
  const depth = parseFloat(String(item.Kedalaman || '').replace(/[^0-9.]/g, ''));
  if (!Number.isFinite(mag)) return null;
  const dirasakan = item.Dirasakan && item.Dirasakan !== '-' ? String(item.Dirasakan).trim() : null;
  const potensi = item.Potensi && item.Potensi !== '-' ? String(item.Potensi).trim() : null;
  const ts = Math.floor(ms / 1000);
  return {
    origin_ts: ts,
    lat: Number(coords.lat.toFixed(4)),
    lon: Number(coords.lon.toFixed(4)),
    depth_km: Number(Math.max(1, Number.isFinite(depth) ? depth : 10).toFixed(1)),
    mag: Number(mag.toFixed(1)),
    bmkg_wilayah: item.Wilayah ? String(item.Wilayah).trim() : null,
    bmkg_dirasakan: dirasakan,
    max_mmi: parseMaxMmi(dirasakan),
    potensi,
    tsunami: potensi && !/tidak\s+berpotensi/i.test(potensi) && /berpotensi\s+tsunami/i.test(potensi) ? 1 : 0,
    shakemap: item.Shakemap ? String(item.Shakemap).trim() : null
  };
}

async function fetchJson(url) {
  const res = await fetch(url, { headers: FETCH_HEADERS, signal: AbortSignal.timeout(18000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function fetchText(url) {
  const res = await fetch(url, { headers: FETCH_HEADERS, signal: AbortSignal.timeout(18000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

async function readMetaJson(env, key) {
  const row = await env.DB.prepare('SELECT value FROM meta WHERE key=?').bind(key).first();
  if (!row) return null;
  try {
    return JSON.parse(row.value);
  } catch {
    return null;
  }
}

async function purgeCache() {
  const cache = caches.default;
  await Promise.allSettled(VALID_HOURS.map((h) => cache.delete(quakeCacheRequest(h))));
}

function isMatch(a, b, maxSec = 120, maxKm = 95) {
  return (
    Math.abs(a.origin_ts - b.origin_ts) <= maxSec &&
    Math.abs(a.mag - b.mag) <= 0.9 &&
    haversineKm(a.lat, a.lon, b.lat, b.lon) <= maxKm
  );
}

function needsUpsert(prev, next) {
  if (!prev) return true;
  if (prev.source !== next.source) return true;
  if (Math.abs((prev.mag || 0) - next.mag) >= 0.15) return true;
  if (Math.abs((prev.depth_km || 0) - next.depth_km) >= 2.0) return true;
  if ((prev.max_mmi || 0) !== (next.max_mmi || 0)) return true;
  if ((prev.tsunami || 0) !== (next.tsunami || 0)) return true;
  if ((prev.bmkg_dirasakan || '') !== (next.bmkg_dirasakan || '')) return true;
  if ((prev.bmkg_wilayah || '') !== (next.bmkg_wilayah || '')) return true;
  if ((prev.potensi || '') !== (next.potensi || '')) return true;
  return false;
}

async function ingest(env) {
  const db = env.DB;
  const now = Math.floor(Date.now() / 1000);
  const sinceIso = new Date((now - RETAIN_SECONDS) * 1000).toISOString().slice(0, 19) + 'Z';
  const usgsUrl =
    `${USGS_BASE}?format=geojson&starttime=${sinceIso}` +
    `&minlatitude=${BBOX.minLat}&maxlatitude=${BBOX.maxLat}` +
    `&minlongitude=${BBOX.minLon}&maxlongitude=${BBOX.maxLon}&minmagnitude=2.5&limit=2000`;

  const results = {};
  let okSources = 0;

  try {
    const [existingRes, usgsRes, live30Res, gempaQlRes, autoRes, dirasakanRes, terkiniRes] = await Promise.allSettled([
      db
        .prepare(
          'SELECT id, origin_ts, lat, lon, depth_km, mag, mag_type, source, place, bmkg_wilayah, bmkg_dirasakan, max_mmi, potensi, tsunami, shakemap, url FROM quakes WHERE origin_ts >= ?'
        )
        .bind(now - RETAIN_SECONDS - 86400)
        .all(),
      fetchJson(usgsUrl),
      fetchText(`${INATEWS_GCS}/live30event.xml`),
      fetchJson(`${INATEWS_GCS}/gempaQL.json`),
      fetchJson(`${BMKG_BASE}/autogempa.json`),
      fetchJson(`${BMKG_BASE}/gempadirasakan.json`),
      fetchJson(`${BMKG_BASE}/gempaterkini.json`)
    ]);

    const existingRows = existingRes.status === 'fulfilled' ? existingRes.value.results || [] : [];
    const existingById = new Map(existingRows.map((r) => [r.id, r]));
    const existingUsgs = existingRows.filter((r) => !r.id.startsWith('bmkg:') && !r.id.startsWith('bmg'));
    const existingBmkgOnly = existingRows.filter((r) => r.id.startsWith('bmkg:') || r.id.startsWith('bmg'));

    const candidateMap = new Map();
    const deleteIds = new Set();

    // 1. Proses USGS ComCat GeoJSON (prioritas ID utama jika tersedia)
    const usgsPool = [];
    if (usgsRes.status === 'fulfilled') {
      for (const f of usgsRes.value.features || []) {
        const p = f.properties || {};
        const [lon, lat, depth] = f.geometry?.coordinates || [];
        if (!inBbox(lat, lon) || !Number.isFinite(p.time) || !Number.isFinite(p.mag)) continue;
        const ts = Math.floor(p.time / 1000);
        const prev = existingById.get(f.id);
        let bmkgMatch = null;
        for (const eb of existingBmkgOnly) {
          if (isMatch({ origin_ts: ts, lat, lon, mag: p.mag }, eb, 120, 95)) {
            if (eb.bmkg_dirasakan || eb.bmkg_wilayah || !bmkgMatch) bmkgMatch = eb;
            deleteIds.add(eb.id);
          }
        }
        const mmi = Math.max(p.mmi ? Math.round(p.mmi) : 0, prev?.max_mmi || 0, bmkgMatch?.max_mmi || 0) || null;
        const hasBmkg = Boolean(prev?.bmkg_wilayah || prev?.bmkg_dirasakan || bmkgMatch);
        const row = {
          id: f.id,
          origin_ts: ts,
          lat: Number(lat.toFixed(4)),
          lon: Number(lon.toFixed(4)),
          depth_km: Number(Math.max(1, depth || 10).toFixed(1)),
          mag: Number((p.mag || 0).toFixed(1)),
          mag_type: p.magType || 'mb',
          source: hasBmkg ? 'BMKG+USGS' : 'USGS',
          place: p.place || null,
          bmkg_wilayah: prev?.bmkg_wilayah || bmkgMatch?.bmkg_wilayah || null,
          bmkg_dirasakan: prev?.bmkg_dirasakan || bmkgMatch?.bmkg_dirasakan || null,
          max_mmi: mmi,
          potensi: prev?.potensi || bmkgMatch?.potensi || null,
          tsunami: Math.max(p.tsunami ? 1 : 0, prev?.tsunami || 0, bmkgMatch?.tsunami || 0),
          shakemap: prev?.shakemap || bmkgMatch?.shakemap || null,
          url: p.url || null
        };
        candidateMap.set(row.id, row);
        usgsPool.push(row);
      }
      results.USGS = usgsPool.length;
      okSources += 1;
    } else {
      results.USGS = `gagal: ${usgsRes.reason?.message || 'error'}`;
    }

    for (const eu of existingUsgs) {
      if (!candidateMap.has(eu.id)) usgsPool.push(eu);
    }

    // 2. Proses BMKG SeisComP real-time (gempaQL 7h + live30event 24j terbaru)
    const seisById = new Map();
    let seisCount = 0;
    if (gempaQlRes.status === 'fulfilled') {
      for (const r of parseGempaQl(gempaQlRes.value)) {
        seisById.set(r.id, r);
      }
      results.BMKG_gempaQL = seisById.size;
      okSources += 1;
    } else {
      results.BMKG_gempaQL = `gagal: ${gempaQlRes.reason?.message || 'error'}`;
    }

    if (live30Res.status === 'fulfilled') {
      const liveRows = parseLive30Xml(live30Res.value);
      for (const r of liveRows) {
        seisById.set(r.id, r);
      }
      results.BMKG_live30 = liveRows.length;
      okSources += 1;
    } else {
      results.BMKG_live30 = `gagal: ${live30Res.reason?.message || 'error'}`;
    }

    for (const bmg of seisById.values()) {
      seisCount += 1;
      const usgsHit = usgsPool.find((u) => isMatch(bmg, u, 90, 85));
      if (usgsHit) {
        const merged = {
          ...usgsHit,
          source: 'BMKG+USGS',
          place: usgsHit.place || bmg.place
        };
        candidateMap.set(merged.id, merged);
        if (existingById.has(bmg.id)) deleteIds.add(bmg.id);
      } else {
        const prev = existingById.get(bmg.id);
        candidateMap.set(bmg.id, {
          ...bmg,
          source: prev?.bmkg_dirasakan || prev?.bmkg_wilayah ? 'BMKG' : 'BMKG-RT',
          bmkg_wilayah: prev?.bmkg_wilayah || null,
          bmkg_dirasakan: prev?.bmkg_dirasakan || null,
          max_mmi: prev?.max_mmi || null,
          potensi: prev?.potensi || null,
          tsunami: prev?.tsunami || 0,
          shakemap: prev?.shakemap || null
        });
      }
    }
    results.BMKG_SeisComP_unique = seisCount;

    // 3. Gabungkan BMKG Dirasakan / Autogempa / Terkini (advisory resmi dengan MMI & status tsunami)
    const bmkgRaw = [];
    let bmkgAdvOk = 0;
    for (const [label, resObj] of [
      ['BMKG_auto', autoRes],
      ['BMKG_dirasakan', dirasakanRes],
      ['BMKG_terkini', terkiniRes]
    ]) {
      if (resObj.status === 'fulfilled') {
        const g = resObj.value?.Infogempa?.gempa;
        const arr = Array.isArray(g) ? g : g ? [g] : [];
        let parsedCount = 0;
        for (const item of arr) {
          const parsed = parseBmkgAdvisory(item);
          if (parsed) {
            bmkgRaw.push(parsed);
            parsedCount += 1;
          }
        }
        results[label] = parsedCount;
        bmkgAdvOk += 1;
      } else {
        results[label] = `gagal: ${resObj.reason?.message || 'error'}`;
      }
    }
    if (bmkgAdvOk > 0) okSources += 1;

    const bmkgMerged = [];
    for (const b of bmkgRaw) {
      const hit = bmkgMerged.find(
        (m) => Math.abs(m.origin_ts - b.origin_ts) <= 15 && haversineKm(m.lat, m.lon, b.lat, b.lon) <= 15
      );
      if (hit) {
        hit.bmkg_wilayah = hit.bmkg_wilayah || b.bmkg_wilayah;
        if (b.bmkg_dirasakan && (!hit.bmkg_dirasakan || b.bmkg_dirasakan.length > hit.bmkg_dirasakan.length)) {
          hit.bmkg_dirasakan = b.bmkg_dirasakan;
        }
        hit.max_mmi = Math.max(hit.max_mmi || 0, b.max_mmi || 0) || null;
        hit.potensi = hit.potensi || b.potensi;
        hit.tsunami = Math.max(hit.tsunami || 0, b.tsunami || 0);
        hit.shakemap = hit.shakemap || b.shakemap;
      } else {
        bmkgMerged.push({ ...b });
      }
    }

    const searchPool = [...candidateMap.values()];
    for (const eu of existingUsgs) {
      if (!candidateMap.has(eu.id)) searchPool.push(eu);
    }

    for (const b of bmkgMerged) {
      // Utamakan cocokkan ke ID USGS dahulu agar fusi sempurna, barulah ke event bmg... SeisComP
      let best = null;
      let bestScore = Infinity;
      for (const c of searchPool) {
        if (!isMatch(b, c, 120, 95)) continue;
        const usgsBonus = !c.id.startsWith('bmg') ? 0 : 15;
        const score = haversineKm(b.lat, b.lon, c.lat, c.lon) + Math.abs(b.origin_ts - c.origin_ts) * 0.25 + usgsBonus;
        if (score < bestScore) {
          bestScore = score;
          best = c;
        }
      }
      if (best) {
        const merged = {
          ...best,
          source: best.id.startsWith('bmg') ? 'BMKG' : 'BMKG+USGS',
          bmkg_wilayah: b.bmkg_wilayah || best.bmkg_wilayah,
          bmkg_dirasakan: b.bmkg_dirasakan || best.bmkg_dirasakan,
          max_mmi: Math.max(best.max_mmi || 0, b.max_mmi || 0) || null,
          potensi: b.potensi || best.potensi,
          tsunami: Math.max(best.tsunami || 0, b.tsunami || 0),
          shakemap: b.shakemap || best.shakemap
        };
        candidateMap.set(merged.id, merged);
        for (const eb of existingBmkgOnly) {
          if (eb.id.startsWith('bmkg:') && isMatch(b, eb, 120, 95)) deleteIds.add(eb.id);
        }
      } else {
        const id = `bmkg:${b.origin_ts}:${b.lat.toFixed(2)}:${b.lon.toFixed(2)}`;
        candidateMap.set(id, {
          id,
          origin_ts: b.origin_ts,
          lat: b.lat,
          lon: b.lon,
          depth_km: b.depth_km,
          mag: b.mag,
          mag_type: 'Mw/ML',
          source: 'BMKG',
          place: b.bmkg_wilayah,
          bmkg_wilayah: b.bmkg_wilayah,
          bmkg_dirasakan: b.bmkg_dirasakan,
          max_mmi: b.max_mmi,
          potensi: b.potensi,
          tsunami: b.tsunami,
          shakemap: b.shakemap,
          url: null
        });
      }
    }

    // 4. Filter diff-only agar hemat kuota write D1 (hanya baris baru atau yang atributnya berubah)
    const changedRows = [];
    for (const row of candidateMap.values()) {
      if (deleteIds.has(row.id)) continue;
      if (needsUpsert(existingById.get(row.id), row)) {
        changedRows.push(row);
      }
    }

    const stmts = [];
    for (let i = 0; i < changedRows.length; i += ROWS_PER_INSERT) {
      const chunk = changedRows.slice(i, i + ROWS_PER_INSERT);
      const placeholders = chunk.map(() => '(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').join(',');
      const params = chunk.flatMap((r) => [
        r.id,
        r.origin_ts,
        r.lat,
        r.lon,
        r.depth_km,
        r.mag,
        r.mag_type,
        r.source,
        r.place,
        r.bmkg_wilayah,
        r.bmkg_dirasakan,
        r.max_mmi,
        r.potensi,
        r.tsunami,
        r.shakemap,
        r.url
      ]);
      stmts.push(
        db
          .prepare(
            `INSERT INTO quakes (id,origin_ts,lat,lon,depth_km,mag,mag_type,source,place,bmkg_wilayah,bmkg_dirasakan,max_mmi,potensi,tsunami,shakemap,url)
             VALUES ${placeholders}
             ON CONFLICT(id) DO UPDATE SET
               origin_ts=excluded.origin_ts,
               lat=excluded.lat,
               lon=excluded.lon,
               depth_km=excluded.depth_km,
               mag=excluded.mag,
               mag_type=excluded.mag_type,
               source=excluded.source,
               place=COALESCE(excluded.place, quakes.place),
               bmkg_wilayah=COALESCE(excluded.bmkg_wilayah, quakes.bmkg_wilayah),
               bmkg_dirasakan=COALESCE(excluded.bmkg_dirasakan, quakes.bmkg_dirasakan),
               max_mmi=COALESCE(MAX(quakes.max_mmi, excluded.max_mmi), excluded.max_mmi, quakes.max_mmi),
               potensi=COALESCE(excluded.potensi, quakes.potensi),
               tsunami=MAX(quakes.tsunami, excluded.tsunami),
               shakemap=COALESCE(excluded.shakemap, quakes.shakemap),
               url=COALESCE(excluded.url, quakes.url)`
          )
          .bind(...params)
      );
    }

    for (const delId of deleteIds) {
      stmts.push(db.prepare('DELETE FROM quakes WHERE id=?').bind(delId));
    }

    const attemptPayload = {
      at: now,
      ok: okSources > 0,
      ok_sources: okSources,
      total: candidateMap.size,
      written: changedRows.length,
      deleted: deleteIds.size,
      sources: results
    };
    stmts.push(
      db
        .prepare("INSERT INTO meta (key,value) VALUES ('last_attempt',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value")
        .bind(JSON.stringify(attemptPayload))
    );

    if (okSources > 0) {
      stmts.push(
        db.prepare('DELETE FROM quakes WHERE origin_ts < ?').bind(now - RETAIN_SECONDS),
        db
          .prepare("INSERT INTO meta (key,value) VALUES ('last_ingest',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value")
          .bind(
            JSON.stringify({
              at: now,
              total: candidateMap.size,
              written: changedRows.length,
              ok_sources: okSources,
              sources: results
            })
          )
      );
    }

    for (let i = 0; i < stmts.length; i += 40) {
      await db.batch(stmts.slice(i, i + 40));
    }

    if (okSources > 0) await purgeCache();
    return attemptPayload;
  } finally {
    await db.prepare("DELETE FROM meta WHERE key='ingest_lock'").run().catch(() => {});
  }
}

async function maybeRefresh(env, ctx, forceSyncIfEmpty = false) {
  const [last, attempt] = await Promise.all([readMetaJson(env, 'last_ingest'), readMetaJson(env, 'last_attempt')]);
  const now = Math.floor(Date.now() / 1000);
  if (last && now - last.at < STALE_SECONDS) return { last, attempt, synced: false };
  if (forceSyncIfEmpty && !last) {
    const res = await ingest(env);
    return { last: { at: now, ...res }, attempt: res, synced: true };
  }
  if (attempt && !attempt.ok && now - attempt.at < RETRY_COOLDOWN_SECONDS) return { last, attempt, synced: false };

  const claim = await env.DB.prepare(
    "INSERT INTO meta (key,value) VALUES ('ingest_lock',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value WHERE CAST(meta.value AS INTEGER) < ?"
  )
    .bind(String(now), now - LOCK_SECONDS)
    .run();
  if (claim.meta.changes > 0) {
    ctx.waitUntil(ingest(env).catch((e) => console.error('ingest', e)));
  }
  return { last, attempt, synced: false };
}

async function quakes(url, env, ctx) {
  const hours = snapHours(url.searchParams.get('hours'));
  const forceRefresh = url.searchParams.get('refresh') === '1';
  const cache = caches.default;
  const cacheKey = quakeCacheRequest(hours);

  if (!forceRefresh) {
    const cached = await cache.match(cacheKey);
    if (cached) return cached;
  }

  let last, attempt, synced;
  if (forceRefresh) {
    const existingAttempt = await readMetaJson(env, 'last_attempt');
    const now = Math.floor(Date.now() / 1000);
    if (!existingAttempt || now - existingAttempt.at >= LOCK_SECONDS) {
      attempt = await ingest(env);
      last = await readMetaJson(env, 'last_ingest');
      synced = true;
    } else {
      ({ last, attempt, synced } = await maybeRefresh(env, ctx, true));
    }
  } else {
    ({ last, attempt, synced } = await maybeRefresh(env, ctx, true));
  }

  const since = Math.floor(Date.now() / 1000) - hours * 3600;
  const detRes = await env.DB.prepare(
    'SELECT id, origin_ts, lon, lat, depth_km, mag, mag_type, source, place, bmkg_wilayah, bmkg_dirasakan, max_mmi, potensi, tsunami, shakemap, url FROM quakes WHERE origin_ts >= ? ORDER BY origin_ts DESC'
  )
    .bind(since)
    .all();

  const events = (detRes.results || [])
    .filter((r) => inBbox(r.lat, r.lon))
    .map((r) => ({
      id: r.id,
      ts: r.origin_ts,
      lon: r.lon,
      lat: r.lat,
      depth: r.depth_km,
      mag: r.mag,
      magType: r.mag_type,
      src: r.source,
      place: r.bmkg_wilayah || r.place || 'Perairan Indonesia',
      usgsPlace: r.place,
      felt: r.bmkg_dirasakan,
      mmi: r.max_mmi,
      potensi: r.potensi,
      tsunami: r.tsunami || 0,
      shakemap: r.shakemap,
      url: r.url
    }));

  const [freshLast, freshAttempt] = synced
    ? [await readMetaJson(env, 'last_ingest'), await readMetaJson(env, 'last_attempt')]
    : [last, attempt];

  const resp = json(
    {
      generated_at: Math.floor(Date.now() / 1000),
      last_ingest: freshLast,
      last_attempt: freshAttempt,
      hours,
      events
    },
    200,
    60
  );
  ctx.waitUntil(cache.put(cacheKey, resp.clone()));
  return resp;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.protocol === 'http:') {
      url.protocol = 'https:';
      return Response.redirect(url.toString(), 308);
    }
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('Method Not Allowed', { status: 405, headers: { Allow: 'GET, HEAD' } });
    }
    try {
      if (url.pathname === '/api/quakes') return await quakes(url, env, ctx);
      if (url.pathname === '/api/status') {
        if (url.searchParams.get('refresh') === '1') {
          const prevAttempt = await readMetaJson(env, 'last_attempt');
          const now = Math.floor(Date.now() / 1000);
          if (!prevAttempt || now - prevAttempt.at >= LOCK_SECONDS) {
            await ingest(env);
          }
        }
        const [count, last, attempt] = await Promise.all([
          env.DB.prepare('SELECT COUNT(*) AS n FROM quakes').first(),
          readMetaJson(env, 'last_ingest'),
          readMetaJson(env, 'last_attempt')
        ]);
        return json({ last_ingest: last, last_attempt: attempt, stored: count.n }, 200, 30);
      }
      if (url.pathname.startsWith('/api/')) return json({ error: 'not found' }, 404);
    } catch (err) {
      console.error(err);
      return json({ error: 'server error' }, 500);
    }
    const res = await env.ASSETS.fetch(request);
    const out = new Response(res.body, res);
    securityHeaders(out.headers);
    return out;
  },

  async scheduled(_event, env, ctx) {
    ctx.waitUntil(ingest(env));
  }
};
