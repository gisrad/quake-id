import { createLiveFeed, describeLive, showSentinelDetail } from '../lib/sentinel-live.js';
import { startSentinelMap } from '../lib/sentinel-map.js';
import {
  REGIONS,
  MOBILE_INITIAL_BOUNDS,
  INDONESIA_MAX_BOUNDS,
  locateIndonesia,
  formatZoneTime,
  formatTimeAgo
} from './indonesia.js';
import { TECTONIC_GEOJSON, classifyQuake, nearestStructure, haversineKm } from './tectonics.js';

const STYLE = 'https://tiles.openfreemap.org/styles/dark';
const TERRARIUM = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png';
const IMAGERY = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
const REPLAY_URL = '/data/replays-quake.json';
const HOUR = 3600;

const $ = (id) => document.getElementById(id);
const fmtNum = new Intl.NumberFormat('id-ID');
const fmtUtc = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'UTC', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
});
const utcLabel = (ts) => `${fmtUtc.format(new Date(ts * 1000))} UTC`;
const formatDistKm = (km) =>
  km < 1 ? '<1 km' : km < 20 ? `${km.toFixed(1)} km` : `${fmtNum.format(Math.round(km))} km`;
const formatAccuracy = (m) =>
  !Number.isFinite(m) || m <= 0 ? '' : m >= 1000 ? `±${(m / 1000).toFixed(1)} km` : `±${Math.round(m)} m`;

const isMobile = () => window.matchMedia('(max-width: 640px)').matches;
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const panelEl = $('panel');
const toggleBtn = $('panel-toggle');
const reopenBtn = $('panel-reopen');

function syncPanelChrome() {
  const open = panelEl.dataset.open === 'true';
  toggleBtn.setAttribute('aria-expanded', String(open));
  const foldSpan = toggleBtn.querySelector('.ico-fold');
  if (foldSpan) foldSpan.textContent = open ? '−' : '+';
  reopenBtn.hidden = isMobile() || open;
}

if (isMobile()) {
  panelEl.dataset.open = 'false';
}
syncPanelChrome();

function getMapPadding() {
  const open = panelEl.dataset.open === 'true';
  if (isMobile()) {
    const h = panelEl.offsetHeight || (open ? 370 : 120);
    const bottomInset = open ? Math.min(h + 12, window.innerHeight * 0.56) : h + 14;
    return { top: 56, right: 12, bottom: bottomInset, left: 12 };
  }
  const leftInset = open ? (panelEl.offsetWidth || 354) + 28 : 28;
  return { top: 60, right: 28, bottom: 28, left: leftInset };
}

let map;
let maplibregl;

const pulseEl = document.createElement('div');
pulseEl.className = 'seismic-pulse-marker';
let pulseMarker;
let activePopup = null;

const state = {
  mode: 'live',
  hours: 24,
  minMag4: false,
  showFaults: true,
  scenarioId: 'palu-2018',
  speed: 1,
  live: null,
  replays: null,
  t: 2880,
  playing: false,
  timer: null,
  lastListRender: 0,
  replayToken: 0,
  activeRegion: 'nusantara',
  activeListTab: 'shallow',
  showRegimes: { crustal: true, megathrust: true, intraslab: true },
  renderedEvents: [],
  userLoc: null
};

const wib = (ts) => formatZoneTime(ts, 'WIB');
const liveFeed = createLiveFeed({
  endpoint: '/api/quakes',
  recordsKey: 'events',
  onView(view) {
    const changed = state.live !== view.data || state.livePhase !== view.phase;
    state.live = view.data;
    state.livePhase = view.phase;
    const newest = view.data?.events[0];
    const note = $('live-note');
    note.classList.toggle('warn', ['partial', 'stale', 'unavailable'].includes(view.phase));
    note.textContent = describeLive(view, wib, newest
      ? `Gempa terakhir ${formatZoneTime(newest.ts, locateIndonesia(newest.lat, newest.lon).tz)}`
      : '');
    $('retry-live').hidden = view.phase !== 'unavailable';
    if (changed) render(true);
  }
});

const fc = (features) => ({ type: 'FeatureCollection', features });

function setRegionPressed(regionId) {
  state.activeRegion = regionId;
  for (const btn of document.querySelectorAll('[data-region]')) {
    btn.setAttribute('aria-pressed', String(btn.dataset.region === regionId));
  }
}

function focusRegion(regionId, animate = true) {
  const target = REGIONS.find((r) => r.id === regionId) || REGIONS[0];
  setRegionPressed(target.id);
  const useMobileTight = isMobile() && target.id === 'nusantara';
  const bounds = useMobileTight ? MOBILE_INITIAL_BOUNDS : target.bounds;
  map?.fitBounds(bounds, {
    padding: getMapPadding(),
    maxZoom: target.id === 'nusantara' ? 6 : 8.5,
    duration: animate && !reducedMotion() ? 700 : 0
  });
}

function flyToQuake(ev) {
  if (!map) {
    showQuakePopup(ev);
    return;
  }
  setRegionPressed('');
  if (isMobile() && panelEl.dataset.open === 'true') {
    panelEl.dataset.open = 'false';
    syncPanelChrome();
    toggleBtn.focus();
  }
  const targetZoom = Math.max(map.getZoom(), ev.depth > 150 ? 6.5 : 8.2);
  map.flyTo({
    center: [ev.lon, ev.lat],
    zoom: targetZoom,
    padding: getMapPadding(),
    duration: reducedMotion() ? 0 : 750
  });
  showQuakePopup(ev);
}

// ---------- klasifikasi & profil kedalaman ----------
function enrichEvent(raw) {
  const c = classifyQuake(raw.lat, raw.lon, raw.depth, raw.mag);
  const loc = locateIndonesia(raw.lat, raw.lon);
  return {
    ...raw,
    regime: c.regime,
    regimeLabel: c.label,
    detail: c.detail,
    structureName: c.structureName,
    distKm: c.distKm,
    energyLabel: c.energyLabel,
    loc
  };
}

function currentRawEvents() {
  if (state.mode === 'live' && state.live) {
    return (state.live.events || []).map(enrichEvent);
  }
  if (state.mode === 'replay' && state.replays) {
    const sc = activeScenario();
    if (!sc) return [];
    const tEnd = sc.t0 + state.t * 60;
    const tStart = tEnd - sc.windowHours * 3600;
    const out = [];
    for (const raw of sc.events) {
      if (raw.ts >= tStart && raw.ts <= tEnd) out.push(enrichEvent(raw));
    }
    return out.sort((a, b) => b.ts - a.ts);
  }
  return [];
}

function activeScenario() {
  if (!state.replays) return null;
  return state.replays.scenarios.find((s) => s.id === state.scenarioId) || state.replays.scenarios[0];
}

function depthToY(depthKm) {
  // Skala kedalaman piecewise: 0-60 km (38 px), 60-300 km (30 px), 300-650 km (22 px)
  const d = Math.max(0, Math.min(650, depthKm || 0));
  if (d <= 60) return 4 + (d / 60) * 38;
  if (d <= 300) return 42 + ((d - 60) / 240) * 30;
  return 72 + ((d - 300) / 350) * 20;
}

function renderDepthProfile(events) {
  const svg = $('depth-profile');
  if (!svg) return;
  const ns = 'http://www.w3.org/2000/svg';
  const nodes = [];

  const sc = state.mode === 'replay' ? activeScenario() : null;
  const minLon = sc ? sc.bbox[0] : 94.0;
  const maxLon = sc ? sc.bbox[2] : 141.2;
  $('depth-axis').textContent = sc
    ? `${minLon.toFixed(1)}° – ${maxLon.toFixed(1)}°BT · 0–650 km`
    : '94°BT – 141°BT · 0–650 km';

  const makeEl = (tag, attrs) => {
    const el = document.createElementNS(ns, tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
    return el;
  };

  // Garis pemisah 60 km & 300 km
  for (const [km, label] of [[60, '60 km'], [300, '300 km']]) {
    const y = depthToY(km);
    nodes.push(makeEl('line', { x1: 0, y1: y, x2: 320, y2: y, stroke: '#1e293b', 'stroke-dasharray': '3,3', 'stroke-width': 1 }));
    const txt = makeEl('text', { x: 316, y: y - 2, 'text-anchor': 'end', fill: '#64748b', 'font-size': 8.5, 'font-family': 'ui-monospace, monospace' });
    txt.textContent = label;
    nodes.push(txt);
  }

  // Prioritaskan event dirasakan/M>=4 dan event terbaru hingga max 360 node SVG agar tetap responsif di jendela 7h/30h
  const filtered = events.filter((ev) => state.showRegimes[ev.regime]);
  const capped =
    filtered.length <= 360
      ? filtered
      : [
          ...filtered.filter((e) => e.mmi >= 2 || e.felt || e.mag >= 4.0),
          ...filtered.filter((e) => !(e.mmi >= 2 || e.felt || e.mag >= 4.0))
        ].slice(0, 360);
  const ordered = [...capped].sort((a, b) => a.mag - b.mag);
  const fillMap = { crustal: '#ff4d5e', megathrust: '#ffb020', intraslab: '#38bdf8' };

  for (const ev of ordered) {
    const x = Math.max(6, Math.min(312, 6 + ((ev.lon - minLon) / (maxLon - minLon)) * 282));
    const y = depthToY(ev.depth);
    const r = Math.max(2.2, Math.min(8.5, (ev.mag - 1.8) * 1.45));
    const isSlab = ev.regime === 'intraslab';
    const strokeCol = ev.depth > 300 ? '#818cf8' : fillMap[ev.regime];

    const c = makeEl('circle', {
      class: 'q-node',
      cx: x.toFixed(1),
      cy: y.toFixed(1),
      r: r.toFixed(1),
      fill: isSlab ? 'rgba(9,13,20,0.4)' : strokeCol,
      'fill-opacity': isSlab ? 1 : 0.78,
      stroke: strokeCol,
      'stroke-width': isSlab ? 1.4 : ev.mmi >= 2 ? 1.2 : 0.4
    });
    const title = document.createElementNS(ns, 'title');
    title.textContent = `M${ev.mag.toFixed(1)} · ${ev.depth} km · ${ev.place}`;
    c.appendChild(title);
    c.addEventListener('click', () => flyToQuake(ev));
    nodes.push(c);
  }

  svg.replaceChildren(...nodes);
}

// ---------- render daftar & UI ----------
function showQuakePopup(ev) {
  if (activePopup) activePopup.remove();
  const el = document.createElement('dl');
  el.className = 'pop';

  const rows = [
    ['Magnitudo', `M ${ev.mag.toFixed(1)}${ev.magType ? ` (${ev.magType})` : ''}`],
    ['Zona perkiraan', ev.regimeLabel],
    ['Kedalaman', `${Number(ev.depth).toFixed(0)} km`],
    ['Lokasi', ev.place],
    ['Wilayah', ev.loc.province],
    ['Waktu', `${formatZoneTime(ev.ts, ev.loc.tz)} (${utcLabel(ev.ts)})`]
  ];
  if (ev.structureName) rows.push(['Struktur dekat (bukan penyebab)', `${ev.structureName} (~${ev.distKm} km)`]);
  if (state.userLoc) {
    const dk = haversineKm(state.userLoc.lat, state.userLoc.lon, ev.lat, ev.lon);
    rows.push(['Jarak dari Anda', formatDistKm(dk)]);
  }
  if (ev.felt) rows.push(['Dirasakan (BMKG)', ev.felt]);
  if (state.mode === 'live' && ev.potensi) rows.push(['Keterangan katalog BMKG (bukan peringatan aktif)', ev.potensi]);
  rows.push(['Perkiraan energi radiasi', ev.energyLabel]);
  rows.push(['Katalog', ev.src]);

  for (const [k, v] of rows) {
    const dt = document.createElement('dt');
    dt.textContent = k;
    const dd = document.createElement('dd');
    dd.textContent = v;
    el.append(dt, dd);
  }

  if (ev.url) {
    const dt = document.createElement('dt');
    dt.textContent = 'Detail USGS';
    const dd = document.createElement('dd');
    const a = document.createElement('a');
    a.href = ev.url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.textContent = `${ev.id} ↗`;
    dd.appendChild(a);
    el.append(dt, dd);
  }

  if (!map) {
    showSentinelDetail(el);
    return;
  }
  activePopup = new maplibregl.Popup({ closeButton: true, maxWidth: '320px' })
    .setLngLat([ev.lon, ev.lat])
    .setDOMContent(el)
    .addTo(map);
}

function updateSummary(visible, allCount, hiddenLowMag) {
  const el = $('situation-summary');
  if (visible.length === 0) {
    el.textContent =
      hiddenLowMag > 0 && allCount > 0
        ? `Semua ${fmtNum.format(allCount)} gempa di bawah M4.0 — matikan filter M 4.0+ untuk melihat gempa lokal.`
        : state.mode === 'live' && state.livePhase !== 'empty'
          ? 'Belum ada kejadian pada data yang tersedia; cakupan bisa tidak lengkap.'
          : 'Tidak ada kejadian tercatat dalam rentang ini.';
    return;
  }
  const crustalN = visible.filter((e) => e.regime === 'crustal').length;
  const megaN = visible.filter((e) => e.regime === 'megathrust').length;
  const slabN = visible.filter((e) => e.regime === 'intraslab').length;
  const feltN = visible.filter((e) => e.felt).length;

  const byProv = new Map();
  for (const e of visible) byProv.set(e.loc.province, (byProv.get(e.loc.province) || 0) + 1);
  const [topProv, topCnt] = [...byProv.entries()].sort((a, b) => b[1] - a[1])[0];

  const parts = [`${topCnt} kejadian di wilayah perkiraan ${topProv}`];
  parts.push(`Zona perkiraan: ${crustalN} kerak · ${megaN} dekat megathrust · ${slabN} lempeng dalam`);
  if (feltN > 0) parts.push(`${feltN} dirasakan`);
  el.textContent = `${parts.join(' · ')}.`;
}

function renderList(shallowList, deepList, known) {
  $('tab-shallow').textContent = known ? `Gempa dangkal (${fmtNum.format(shallowList.length)})` : 'Gempa dangkal';
  $('tab-deep').textContent = known ? `Gempa dalam (${fmtNum.format(deepList.length)})` : 'Gempa dalam';

  const items = (state.activeListTab === 'deep' ? deepList : shallowList).slice(0, 12);
  $('incident-empty').hidden = !known || items.length > 0;
  const ol = $('incident-list');
  ol.replaceChildren();

  const maxMag = Math.max(...items.map((i) => i.mag), 5.5);

  for (const ev of items) {
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.type = 'button';

    const head = document.createElement('div');
    head.className = 'inc-head';

    const magBadge = document.createElement('span');
    magBadge.className = `mag-badge ${ev.regime}`;
    magBadge.textContent = `M${ev.mag.toFixed(1)}`;
    head.appendChild(magBadge);

    const top = document.createElement('span');
    top.className = 'inc-top';
    top.textContent = ev.place;
    head.appendChild(top);

    if (ev.felt) {
      const tag = document.createElement('span');
      tag.className = 'kind-badge felt';
      tag.textContent = 'Dirasakan · BMKG';
      head.appendChild(tag);
    } else if (ev.src.includes('BMKG')) {
      const tag = document.createElement('span');
      tag.className = 'kind-badge bmkg';
      tag.textContent = 'BMKG';
      head.appendChild(tag);
    }

    const meta = document.createElement('span');
    meta.className = 'inc-meta';
    const structPart = ev.structureName ? ` · Dekat ${ev.structureName}` : ` · ${ev.loc.province}`;
    const distPart = state.userLoc
      ? ` · ${formatDistKm(haversineKm(state.userLoc.lat, state.userLoc.lon, ev.lat, ev.lon))}`
      : '';
    const timeLabel =
      state.mode === 'live' && Date.now() / 1000 - ev.ts < 3600 * 6
        ? `${formatTimeAgo(ev.ts)} (${formatZoneTime(ev.ts, ev.loc.tz)})`
        : formatZoneTime(ev.ts, ev.loc.tz);
    meta.textContent = `${Number(ev.depth).toFixed(0)} km${structPart}${distPart} · ${timeLabel}`;

    const bar = document.createElement('span');
    bar.className = `inc-bar ${ev.regime}`;
    bar.style.setProperty('--w', `${Math.max(12, Math.min(100, Math.round((ev.mag / maxMag) * 100)))}%`);

    b.append(head, meta, bar);
    b.addEventListener('click', () => flyToQuake(ev));
    li.appendChild(b);
    ol.appendChild(li);
  }
}

function updateLatestFeltBanner(events) {
  const banner = $('latest-felt');
  const hero = state.mode === 'replay'
    ? events.reduce((best, ev) => !best || (ev.mmi || 0) > (best.mmi || 0) ||
        ((ev.mmi || 0) === (best.mmi || 0) && ev.mag > best.mag) ? ev : best, null)
    : events[0];
  if (!hero) {
    banner.hidden = true;
    pulseMarker?.remove();
    return;
  }

  banner.hidden = false;
  const mmiEl = $('latest-mmi');
  mmiEl.textContent = state.mode === 'replay' ? 'Arsip · kejadian pilihan' : 'Gempa terakhir';

  $('latest-ago').textContent = state.mode === 'replay' ? formatZoneTime(hero.ts, hero.loc.tz) : formatTimeAgo(hero.ts);
  $('latest-desc').textContent = `M${hero.mag.toFixed(1)} · ${Math.round(hero.depth)} km · ${hero.place}`;
  banner.onclick = () => flyToQuake(hero);

  if (map && state.mode === 'live' && Date.now() / 1000 - hero.ts < HOUR) {
    pulseMarker.setLngLat([hero.lon, hero.lat]).addTo(map);
  } else pulseMarker?.remove();
}

function setListTab(tab) {
  state.activeListTab = tab;
  for (const b of document.querySelectorAll('[data-list-tab]')) {
    b.setAttribute('aria-pressed', String(b.dataset.listTab === tab));
  }
  render(true);
}

function syncLayerFilters() {
  if (!map?.getLayer('quakes-shallow-core')) return;
  const reg = state.showRegimes;
  const allowedShallow = [];
  if (reg.crustal) allowedShallow.push('crustal');
  if (reg.megathrust) allowedShallow.push('megathrust');

  const shallowFilter =
    allowedShallow.length > 0
      ? ['in', ['get', 'regime'], ['literal', allowedShallow]]
      : ['==', ['get', 'regime'], '__none__'];

  map.setFilter('quakes-shallow-glow', shallowFilter);
  map.setFilter('quakes-shallow-core', shallowFilter);

  const deepVis = reg.intraslab ? 'visible' : 'none';
  map.setLayoutProperty('quakes-deep-ring', 'visibility', deepVis);

  const anyVisible = allowedShallow.length > 0 || reg.intraslab;
  const allowedAll = Object.entries(reg)
    .filter(([, on]) => on)
    .map(([k]) => k);
  map.setFilter(
    'quakes-felt-ring',
    allowedAll.length > 0
      ? [
          'all',
          ['in', ['get', 'regime'], ['literal', allowedAll]],
          ['any', ['>=', ['get', 'mmi'], 2], ['==', ['get', 'felt'], 1], ['>=', ['get', 'mag'], 5.5]]
        ]
      : ['==', ['get', 'regime'], '__none__']
  );
  map.setLayoutProperty('quakes-felt-ring', 'visibility', anyVisible ? 'visible' : 'none');

  const faultVis = state.showFaults ? 'visible' : 'none';
  if (map.getLayer('tectonics-line')) {
    map.setLayoutProperty('tectonics-glow', 'visibility', faultVis);
    map.setLayoutProperty('tectonics-line', 'visibility', faultVis);
  }
}

function syncHeadlinePulse() {
  const active = state.renderedEvents.filter((e) => state.showRegimes[e.regime]);
  updateLatestFeltBanner(active);
}

function render(forceList = true) {
  const available = state.mode === 'live' ? state.live : activeScenario();
  const src = map?.getSource('quakes');

  const rawAll = currentRawEvents();
  const visible = [];
  let hiddenLowMag = 0;

  for (const ev of rawAll) {
    if (state.minMag4 && ev.mag < 4.0) {
      hiddenLowMag += 1;
      continue;
    }
    visible.push(ev);
  }
  state.renderedEvents = visible;

  if (src) {
    src.setData(fc(visible.map((ev) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [ev.lon, ev.lat] },
      properties: {
        id: ev.id, mag: ev.mag, depth: ev.depth, regime: ev.regime, mmi: ev.mmi || 0, felt: ev.felt ? 1 : 0
      }
    }))));
    syncLayerFilters();
  }

  const shallowAll = visible.filter((e) => e.regime !== 'intraslab');
  const deepAll = visible.filter((e) => e.regime === 'intraslab');
  const feltCount = visible.filter((e) => e.felt).length;
  const maxMag = visible.length ? Math.max(...visible.map((e) => e.mag)) : null;

  const known = available && (rawAll.length > 0 || state.mode === 'replay' || state.livePhase === 'empty');
  $('stat-shallow').textContent = known ? fmtNum.format(shallowAll.length) : '–';
  $('stat-felt').textContent = known && state.mode === 'live' ? fmtNum.format(feltCount) : '–';
  $('stat-maxmag').textContent = maxMag !== null ? `M${maxMag.toFixed(1)}` : '–';

  updateLatestFeltBanner(visible);
  updateUserCard();
  if (available) updateSummary(visible, rawAll.length, hiddenLowMag);
  else $('situation-summary').textContent = state.mode === 'live' && state.livePhase === 'unavailable'
    ? 'Data gempa belum tersedia.'
    : '';
  renderDepthProfile(visible);

  // Mode Langsung: urutkan kronologis terbaru di atas agar deteksi 2–5 menit terakhir langsung terlihat.
  const shallowSorted = [...shallowAll].sort((a, b) =>
    state.mode === 'replay' ? b.mag - a.mag || b.ts - a.ts : b.ts - a.ts
  );
  const deepSorted = [...deepAll].sort((a, b) =>
    state.mode === 'replay' ? b.mag - a.mag || b.ts - a.ts : b.ts - a.ts
  );

  const now = performance.now();
  if (forceList || now - state.lastListRender >= 220) {
    renderList(shallowSorted, deepSorted, known);
    state.lastListRender = now;
  }
}

// ---------- live & replay ----------
// Keep the archive and live requests independent.

setInterval(() => {
  if (state.mode === 'live' && !document.hidden) {
    liveFeed.load(state.hours, { background: true });
  }
}, 120000);

function buildSparkline(sc) {
  const svg = $('replay-spark');
  const bins = 48;
  const maxMagBin = new Array(bins).fill(0);
  const countBin = new Array(bins).fill(0);
  const spanSec = Math.max(1, sc.durationMin * 60);
  for (const e of sc.events) {
    const idx = Math.max(0, Math.min(bins - 1, Math.floor(((e.ts - sc.t0) / spanSec) * bins)));
    countBin[idx] += 1;
    maxMagBin[idx] = Math.max(maxMagBin[idx], e.mag);
  }
  const maxC = Math.max(...countBin, 1);
  const bw = 300 / bins;
  const rects = countBin.map((c, i) => {
    const h = c > 0 ? Math.max(3, Math.round((c / maxC) * 26)) : 1;
    const col = maxMagBin[i] >= 6.5 ? '#ff4d5e' : maxMagBin[i] >= 5.0 ? '#ffb020' : '#475569';
    return `<rect x="${(i * bw).toFixed(1)}" y="${30 - h}" width="${(bw - 0.9).toFixed(1)}" height="${h}" fill="${col}" />`;
  });
  svg.innerHTML = rects.join('');
}

function configureScenario(scenarioId, animateCam = true) {
  state.scenarioId = scenarioId;
  for (const b of document.querySelectorAll('[data-scenario]')) {
    b.setAttribute('aria-pressed', String(b.dataset.scenario === scenarioId));
  }
  const sc = activeScenario();
  if (!sc) return;

  const slider = $('replay-slider');
  slider.max = String(sc.durationMin);
  slider.value = String(sc.initialHours * 60);
  state.t = sc.initialHours * 60;
  buildSparkline(sc);
  $('replay-note').textContent = `${sc.title} · jendela aktif ${sc.windowHours} j (${sc.events.length} kejadian).`;

  if (animateCam) {
    map?.fitBounds(sc.bounds, {
      padding: getMapPadding(),
      maxZoom: 9,
      duration: reducedMotion() ? 0 : 900
    });
  }
  updateReplay(true);
}

async function loadReplay(token) {
  try {
    if (!state.replays) {
      $('replay-label').textContent = 'Memuat arsip…';
      const r = await fetch(REPLAY_URL);
      if (!r.ok) throw new Error('Arsip tidak tersedia');
      const data = await r.json();
      if (state.mode !== 'replay' || token !== state.replayToken) return;
      state.replays = data;
    }
    if (state.mode !== 'replay' || token !== state.replayToken) return;
    configureScenario(state.scenarioId, true);
  } catch {
    if (state.mode === 'replay' && token === state.replayToken) $('replay-label').textContent = 'Arsip belum dapat dimuat.';
  }
}

function updateReplay(forceList = false) {
  const sc = activeScenario();
  if (!sc) return;
  $('replay-label').textContent = formatZoneTime(sc.t0 + state.t * 60, 'WITA');
  $('replay-slider').value = String(Math.round(state.t));
  render(forceList);
}

function togglePlay(force) {
  if (force !== false && !activeScenario()) return;
  state.playing = force !== undefined ? force : !state.playing;
  $('replay-play').textContent = state.playing ? 'Jeda' : 'Putar';
  if (state.timer) {
    clearInterval(state.timer);
    state.timer = null;
  }
  if (state.playing) {
    const sc = activeScenario();
    const maxMin = sc ? sc.durationMin : 20000;
    state.timer = setInterval(() => {
      state.t += 45 * state.speed;
      if (state.t >= maxMin) {
        state.t = maxMin;
        togglePlay(false);
        updateReplay(true);
        return;
      }
      updateReplay(false);
    }, 55);
  }
}

function setMode(mode, animateCamera = true) {
  state.mode = mode;
  togglePlay(false);
  for (const b of document.querySelectorAll('[data-mode]')) {
    b.setAttribute('aria-pressed', String(b.dataset.mode === mode));
  }
  $('live-controls').hidden = mode !== 'live';
  $('replay-controls').hidden = mode !== 'replay';
  if (mode === 'live') {
    if (animateCamera) focusRegion(state.activeRegion || 'nusantara', true);
    state.livePhase = undefined;
    liveFeed.load(state.hours);
  } else {
    liveFeed.cancel();
    $('retry-live').hidden = true;
    $('live-note').classList.remove('warn');
    $('live-note').textContent = 'Arsip · bukan laporan kejadian terkini';
    state.replayToken += 1;
    setRegionPressed('');
    render(true);
    loadReplay(state.replayToken);
  }
}

// ---------- event DOM ----------
$('retry-live').addEventListener('click', () => liveFeed.load(state.hours));
for (const b of document.querySelectorAll('[data-mode]')) {
  b.addEventListener('click', () => setMode(b.dataset.mode, true));
}
for (const b of document.querySelectorAll('[data-hours]')) {
  b.addEventListener('click', () => {
    state.hours = Number(b.dataset.hours);
    for (const x of document.querySelectorAll('[data-hours]')) x.setAttribute('aria-pressed', String(x === b));
    liveFeed.load(state.hours);
  });
}
for (const b of document.querySelectorAll('[data-scenario]')) {
  b.addEventListener('click', () => {
    togglePlay(false);
    configureScenario(b.dataset.scenario, true);
  });
}
for (const b of document.querySelectorAll('[data-region]')) {
  b.addEventListener('click', () => focusRegion(b.dataset.region, true));
}
for (const b of document.querySelectorAll('[data-list-tab]')) {
  b.addEventListener('click', () => setListTab(b.dataset.listTab));
}
for (const b of document.querySelectorAll('[data-regime]')) {
  b.addEventListener('click', () => {
    const k = b.dataset.regime;
    state.showRegimes[k] = !state.showRegimes[k];
    b.setAttribute('aria-pressed', String(state.showRegimes[k]));
    syncLayerFilters();
    syncHeadlinePulse();
    renderDepthProfile(state.renderedEvents);
  });
}

$('filter-mag').addEventListener('change', (e) => {
  state.minMag4 = e.target.checked;
  render(true);
});
$('toggle-faults').addEventListener('change', (e) => {
  state.showFaults = e.target.checked;
  syncLayerFilters();
});

$('replay-slider').addEventListener('input', (e) => {
  togglePlay(false);
  state.t = Number(e.target.value);
  updateReplay(true);
});
$('replay-play').addEventListener('click', () => {
  const slider = $('replay-slider');
  if (state.t >= Number(slider.max)) state.t = 0;
  togglePlay();
});
$('replay-speed').addEventListener('click', () => {
  state.speed = state.speed === 1 ? 2 : state.speed === 2 ? 4 : 1;
  $('replay-speed').textContent = `${state.speed}×`;
});

$('toggle-3d').addEventListener('change', (e) => {
  if (!map) return;
  const dur = reducedMotion() ? 0 : 900;
  if (e.target.checked) {
    map.setTerrain({ source: 'dem', exaggeration: 1.6 });
    map.setLayoutProperty('hillshade', 'visibility', 'visible');
    map.easeTo({ pitch: 60, duration: dur });
  } else {
    map.setTerrain(null);
    map.setLayoutProperty('hillshade', 'visibility', 'none');
    map.easeTo({ pitch: 0, duration: dur });
  }
});
$('toggle-imagery').addEventListener('change', (e) => {
  map?.setLayoutProperty('imagery', 'visibility', e.target.checked ? 'visible' : 'none');
});

function setPanelOpen(open) {
  panelEl.dataset.open = String(open);
  syncPanelChrome();
}
toggleBtn.addEventListener('click', () => setPanelOpen(panelEl.dataset.open !== 'true'));
reopenBtn.addEventListener('click', () => setPanelOpen(true));

// ---------- posisi pengguna (Wi-Fi / GPS) ----------
const userPinEl = document.createElement('div');
userPinEl.className = 'user-pin-marker';
userPinEl.title = 'Posisi Anda';
let userMarker;
let geoReqSeq = 0;

function buildAccuracyGeoJson(lon, lat, radiusM) {
  if (!Number.isFinite(radiusM) || radiusM <= 0 || radiusM > 50000) return fc([]);
  const coords = [];
  const dLat = (radiusM / 6371000) * (180 / Math.PI);
  const dLon = dLat / Math.max(0.1, Math.cos((lat * Math.PI) / 180));
  for (let i = 0; i <= 48; i++) {
    const a = (i / 48) * Math.PI * 2;
    coords.push([lon + Math.cos(a) * dLon, lat + Math.sin(a) * dLat]);
  }
  return fc([{ type: 'Feature', geometry: { type: 'Polygon', coordinates: [coords] }, properties: {} }]);
}

function nearestQuakeFrom(lat, lon) {
  let best = null;
  let bestKm = Infinity;
  for (const ev of state.renderedEvents) {
    const d = haversineKm(lat, lon, ev.lat, ev.lon);
    if (d < bestKm) {
      bestKm = d;
      best = ev;
    }
  }
  return best ? { event: best, distKm: bestKm } : null;
}

function showUserPopup() {
  const u = state.userLoc;
  if (!u || !map) return;
  if (activePopup) activePopup.remove();
  const el = document.createElement('div');
  el.className = 'pop';
  const loc = locateIndonesia(u.lat, u.lon);
  const ns = nearestStructure(u.lat, u.lon, null);
  const nq = nearestQuakeFrom(u.lat, u.lon);
  const rows = [
    ['Status', 'Posisi Anda (Wi-Fi / GPS)'],
    ['Wilayah', loc.province],
    ['Koordinat', `${u.lat.toFixed(4)}, ${u.lon.toFixed(4)}`]
  ];
  if (u.acc) rows.push(['Akurasi', formatAccuracy(u.acc)]);
  if (ns.structure) rows.push(['Sesar / Palung', `${ns.structure.name} (~${Math.round(ns.distKm)} km)`]);
  if (nq) rows.push(['Gempa Terdekat', `${formatDistKm(nq.distKm)} · M${nq.event.mag.toFixed(1)}`]);
  for (const [k, v] of rows) {
    const dt = document.createElement('dt');
    dt.textContent = k;
    const dd = document.createElement('dd');
    dd.textContent = v;
    el.append(dt, dd);
  }
  activePopup = new maplibregl.Popup({ closeButton: true, maxWidth: '300px' })
    .setLngLat([u.lon, u.lat])
    .setDOMContent(el)
    .addTo(map);
}

userPinEl.addEventListener('click', (e) => {
  e.stopPropagation();
  showUserPopup();
});

function flyToUser() {
  const u = state.userLoc;
  if (!u || !map) return;
  setRegionPressed('');
  if (u.lon >= 62 && u.lon <= 162 && u.lat >= -45 && u.lat <= 40) {
    map.flyTo({
      center: [u.lon, u.lat],
      zoom: Math.max(map.getZoom(), 7.4),
      padding: getMapPadding(),
      duration: reducedMotion() ? 0 : 800
    });
  }
  showUserPopup();
}

function updateUserCard() {
  const card = $('user-loc-card');
  const u = state.userLoc;
  if (!card) return;
  if (!u) {
    card.hidden = true;
    return;
  }
  card.hidden = false;
  const loc = locateIndonesia(u.lat, u.lon);
  const accStr = formatAccuracy(u.acc);
  $('user-loc-title').textContent = accStr ? `Posisi · ${loc.province} (${accStr})` : `Posisi · ${loc.province}`;

  const parts = [];
  const nq = nearestQuakeFrom(u.lat, u.lon);
  if (nq) parts.push(`Gempa terdekat ${formatDistKm(nq.distKm)} (M${nq.event.mag.toFixed(1)})`);
  const ns = nearestStructure(u.lat, u.lon, null);
  if (ns.structure) parts.push(`${ns.structure.name} ~${Math.round(ns.distKm)} km`);
  $('user-loc-meta').textContent = parts.join(' · ') || `${u.lat.toFixed(3)}, ${u.lon.toFixed(3)}`;
}

function syncUserAccuracyLayer() {
  const src = map?.getSource('user-acc');
  if (!src) return;
  if (!state.userLoc) {
    src.setData(fc([]));
  } else {
    src.setData(buildAccuracyGeoJson(state.userLoc.lon, state.userLoc.lat, state.userLoc.acc));
  }
}

function resetLocateButtons() {
  const allowBtn = $('geo-allow');
  if (allowBtn) {
    allowBtn.disabled = false;
    allowBtn.textContent = 'Aktifkan Lokasi';
  }
  const pill = $('btn-locate');
  if (pill) {
    pill.textContent = state.userLoc ? '⌖ Posisi Aktif' : '⌖ Lokasi Saya';
    pill.setAttribute('aria-pressed', String(Boolean(state.userLoc)));
  }
}

function applyUserLocation(pos, shouldFly) {
  const lat = pos.coords.latitude;
  const lon = pos.coords.longitude;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
  state.userLoc = { lat, lon, acc: Math.round(pos.coords.accuracy || 0) };
  $('geo-prompt').hidden = true;
  if (map) userMarker.setLngLat([lon, lat]).addTo(map);
  syncUserAccuracyLayer();
  resetLocateButtons();
  render(true);
  if (shouldFly) flyToUser();
}

function clearUserLocation() {
  geoReqSeq += 1;
  state.userLoc = null;
  userMarker?.remove();
  syncUserAccuracyLayer();
  resetLocateButtons();
  $('btn-locate').focus();
  render(true);
}

function dismissGeoPrompt() {
  geoReqSeq += 1;
  $('geo-prompt').hidden = true;
  resetLocateButtons();
  $('btn-locate').focus();
}

function showGeoError(err) {
  const prompt = $('geo-prompt');
  const sub = $('geo-prompt-sub');
  const msg =
    err?.code === 1
      ? 'Izin lokasi ditolak — aktifkan izin browser atau tutup kartu ini.'
      : 'Lokasi Wi-Fi / GPS tidak tersedia saat ini.';
  if (sub) sub.textContent = msg;
  if (prompt) prompt.hidden = false;
}

function requestUserLocation({ fly = true, fromPrompt = false } = {}) {
  if (!('geolocation' in navigator)) {
    showGeoError({ code: 2 });
    return;
  }
  const reqSeq = ++geoReqSeq;
  const allowBtn = $('geo-allow');
  if (allowBtn && fromPrompt) {
    allowBtn.disabled = true;
    allowBtn.textContent = 'Mencari lokasi…';
  }
  const pill = $('btn-locate');
  if (pill) pill.textContent = '⌖ Mencari…';

  let settled = false;
  navigator.geolocation.getCurrentPosition(
    (pos1) => {
      if (reqSeq !== geoReqSeq || settled) return;
      settled = true;
      applyUserLocation(pos1, fly);
    },
    () => {},
    { enableHighAccuracy: false, timeout: 6000, maximumAge: 120000 }
  );

  navigator.geolocation.getCurrentPosition(
    (pos2) => {
      if (reqSeq !== geoReqSeq) return;
      const better =
        !state.userLoc ||
        (Number.isFinite(pos2.coords.accuracy) && pos2.coords.accuracy < (state.userLoc.acc || Infinity));
      if (better) applyUserLocation(pos2, !settled && fly);
      settled = true;
      resetLocateButtons();
    },
    (err) => {
      if (reqSeq !== geoReqSeq) return;
      resetLocateButtons();
      if (!settled && !state.userLoc) showGeoError(err);
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
  );
}

$('geo-allow').addEventListener('click', () => requestUserLocation({ fly: true, fromPrompt: true }));
$('geo-close').addEventListener('click', dismissGeoPrompt);
$('user-loc-fly').addEventListener('click', flyToUser);
$('user-loc-clear').addEventListener('click', clearUserLocation);
$('btn-locate').addEventListener('click', () => {
  if (state.userLoc) {
    flyToUser();
  } else {
    $('geo-prompt-sub').textContent = 'Izin posisi dipakai untuk menghitung jarak di perangkat. Peta dapat bergeser ke sekitar Anda.';
    $('geo-prompt').hidden = false;
    $('geo-allow').focus();
  }
});


// ---------- layer peta ----------
function addMapLayers() {
  if (typeof map.setSky === 'function') {
    map.setSky({
      'sky-color': '#060910',
      'horizon-color': '#102136',
      'fog-color': '#090d14',
      'sky-horizon-blend': 0.38,
      'horizon-fog-blend': 0.52,
      'fog-ground-blend': 0.65
    });
  }

  const firstSymbol = map.getStyle().layers.find((l) => l.type === 'symbol')?.id;
  map.addSource('imagery', {
    type: 'raster',
    tiles: [IMAGERY],
    tileSize: 256,
    maxzoom: 19,
    attribution: 'Citra: Esri, Maxar, Earthstar Geographics'
  });
  map.addLayer({ id: 'imagery', type: 'raster', source: 'imagery', layout: { visibility: 'none' } }, firstSymbol);

  map.addSource('dem', { type: 'raster-dem', tiles: [TERRARIUM], encoding: 'terrarium', tileSize: 256, maxzoom: 15 });
  map.addLayer(
    {
      id: 'hillshade',
      type: 'hillshade',
      source: 'dem',
      layout: { visibility: 'none' },
      paint: { 'hillshade-shadow-color': '#000', 'hillshade-highlight-color': '#3f536e', 'hillshade-exaggeration': 0.45 }
    },
    firstSymbol
  );

  // 1. Garis Zona Subduksi, Sesar Naik, & Sesar Kerak Darat
  map.addSource('tectonics', { type: 'geojson', data: TECTONIC_GEOJSON });
  map.addLayer(
    {
      id: 'tectonics-glow',
      type: 'line',
      source: 'tectonics',
      paint: {
        'line-color': ['match', ['get', 'kind'], 'megathrust', '#ffb020', 'thrust', '#f97316', '#ff4d5e'],
        'line-width': ['interpolate', ['linear'], ['zoom'], 4, 4.5, 9, 8],
        'line-opacity': 0.16,
        'line-blur': 2
      }
    },
    firstSymbol
  );
  map.addLayer(
    {
      id: 'tectonics-line',
      type: 'line',
      source: 'tectonics',
      paint: {
        'line-color': ['match', ['get', 'kind'], 'megathrust', '#ffb020', 'thrust', '#fb923c', '#ff4d5e'],
        'line-width': ['interpolate', ['linear'], ['zoom'], 4, 1.4, 9, 2.5],
        'line-opacity': 0.85,
        'line-dasharray': ['match', ['get', 'kind'], 'megathrust', ['literal', [4, 2.5]], 'thrust', ['literal', [3, 1.5, 1, 1.5]], ['literal', [1, 0]]]
      }
    },
    firstSymbol
  );

  // 2. Lingkaran akurasi posisi pengguna + Titik Gempa Bumi
  map.addSource('user-acc', { type: 'geojson', data: fc([]) });
  map.addLayer({
    id: 'user-acc-fill',
    type: 'fill',
    source: 'user-acc',
    paint: { 'fill-color': '#10b981', 'fill-opacity': 0.1 }
  });
  map.addLayer({
    id: 'user-acc-line',
    type: 'line',
    source: 'user-acc',
    paint: { 'line-color': '#10b981', 'line-width': 1.2, 'line-opacity': 0.5 }
  });

  map.addSource('quakes', { type: 'geojson', data: fc([]) });

  const shallowRadius = [
    'interpolate',
    ['linear'],
    ['zoom'],
    4, ['interpolate', ['linear'], ['get', 'mag'], 2.5, 3.2, 5.0, 7.5, 7.5, 18],
    10, ['interpolate', ['linear'], ['get', 'mag'], 2.5, 6.0, 5.0, 14, 7.5, 32]
  ];
  const shallowGlowRadius = [
    'interpolate',
    ['linear'],
    ['zoom'],
    4, ['interpolate', ['linear'], ['get', 'mag'], 2.5, 7.0, 5.0, 16, 7.5, 36],
    10, ['interpolate', ['linear'], ['get', 'mag'], 2.5, 13.0, 5.0, 28, 7.5, 64]
  ];
  const deepRadius = [
    'interpolate',
    ['linear'],
    ['zoom'],
    4, ['interpolate', ['linear'], ['get', 'mag'], 2.5, 3.5, 5.0, 7.0, 7.5, 15],
    10, ['interpolate', ['linear'], ['get', 'mag'], 2.5, 6.0, 5.0, 12, 7.5, 26]
  ];
  const feltRadius = [
    'interpolate',
    ['linear'],
    ['zoom'],
    4, ['interpolate', ['linear'], ['get', 'mag'], 2.5, 7.5, 5.0, 13, 7.5, 25],
    10, ['interpolate', ['linear'], ['get', 'mag'], 2.5, 12.0, 5.0, 22, 7.5, 42]
  ];

  map.addLayer({
    id: 'quakes-felt-ring',
    type: 'circle',
    source: 'quakes',
    filter: ['any', ['>=', ['get', 'mmi'], 2], ['==', ['get', 'felt'], 1], ['>=', ['get', 'mag'], 5.5]],
    paint: {
      'circle-radius': feltRadius,
      'circle-color': 'transparent',
      'circle-stroke-width': 1.4,
      'circle-stroke-color': '#ffffff',
      'circle-stroke-opacity': 0.72
    }
  });

  // Lempeng Dalam (>60 km) ditaruh di lapisan bawah
  map.addLayer({
    id: 'quakes-deep-ring',
    type: 'circle',
    source: 'quakes',
    filter: ['==', ['get', 'regime'], 'intraslab'],
    paint: {
      'circle-radius': deepRadius,
      'circle-color': 'rgba(9, 13, 20, 0.55)',
      'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 4, 1.5, 9, 2.2],
      'circle-stroke-color': ['case', ['>', ['get', 'depth'], 300], '#818cf8', '#38bdf8'],
      'circle-stroke-opacity': 0.92
    }
  });

  // Gempa Dangkal (Sesar Kerak & Megathrust) ditaruh di lapisan atas agar menonjol
  map.addLayer({
    id: 'quakes-shallow-glow',
    type: 'circle',
    source: 'quakes',
    filter: ['in', ['get', 'regime'], ['literal', ['crustal', 'megathrust']]],
    paint: {
      'circle-radius': shallowGlowRadius,
      'circle-color': ['case', ['==', ['get', 'regime'], 'crustal'], '#ff4d5e', '#ffb020'],
      'circle-blur': 0.9,
      'circle-opacity': 0.34
    }
  });

  map.addLayer({
    id: 'quakes-shallow-core',
    type: 'circle',
    source: 'quakes',
    filter: ['in', ['get', 'regime'], ['literal', ['crustal', 'megathrust']]],
    paint: {
      'circle-radius': shallowRadius,
      'circle-color': ['case', ['==', ['get', 'regime'], 'crustal'], '#ff4d5e', '#ffb020'],
      'circle-opacity': 0.94,
      'circle-stroke-width': 1,
      'circle-stroke-color': 'rgba(9, 13, 20, 0.9)'
    }
  });

  const interactiveQuakes = ['quakes-shallow-core', 'quakes-deep-ring'];
  for (const lid of [...interactiveQuakes, 'tectonics-line']) {
    map.on('mouseenter', lid, () => {
      map.getCanvas().style.cursor = 'pointer';
    });
    map.on('mouseleave', lid, () => {
      map.getCanvas().style.cursor = '';
    });
  }

  map.on('click', interactiveQuakes, (e) => {
    const id = e.features[0]?.properties?.id;
    const ev = state.renderedEvents.find((x) => x.id === id);
    if (ev) showQuakePopup(ev);
  });

  map.on('click', 'tectonics-line', (e) => {
    if (map.queryRenderedFeatures(e.point, { layers: interactiveQuakes }).length > 0) return;
    const p = e.features[0]?.properties;
    if (!p) return;
    if (activePopup) activePopup.remove();
    const el = document.createElement('div');
    el.className = 'pop';
    const typeLabel =
      p.kind === 'megathrust'
        ? 'Zona Subduksi / Megathrust'
        : p.kind === 'thrust'
          ? 'Sesar Naik Belakang Busur'
          : 'Sesar Aktif Kerak Darat';
    for (const [k, v] of [
      ['Struktur', p.name],
      ['Tipe', typeLabel],
      ['Laju Geser', p.rate],
      ['Catatan', p.note]
    ]) {
      const dt = document.createElement('dt');
      dt.textContent = k;
      const dd = document.createElement('dd');
      dd.textContent = v;
      el.append(dt, dd);
    }
    activePopup = new maplibregl.Popup({ closeButton: true, maxWidth: '300px' })
      .setLngLat(e.lngLat)
      .setDOMContent(el)
      .addTo(map);
  });

  syncLayerFilters();
  syncUserAccuracyLayer();
}

setMode('live', false);
startSentinelMap(() => ({
  container: 'map',
  style: STYLE,
  bounds: isMobile() ? MOBILE_INITIAL_BOUNDS : REGIONS[0].bounds,
  fitBoundsOptions: { padding: getMapPadding(), maxZoom: 6 },
  maxBounds: INDONESIA_MAX_BOUNDS,
  maxPitch: 78,
  attributionControl: { compact: true, customAttribution: 'Seismik: BMKG InaTEWS & USGS ComCat · DEM: AWS Terrain' }
}), (readyMap, library) => {
  map = readyMap;
  maplibregl = library;
  pulseMarker = new maplibregl.Marker({ element: pulseEl, anchor: 'center' });
  userMarker = new maplibregl.Marker({ element: userPinEl, anchor: 'center' });
  addMapLayers();
  for (const control of document.querySelectorAll('[data-map-control]')) control.disabled = false;
  const scenario = state.mode === 'replay' && activeScenario();
  if (scenario) map.fitBounds(scenario.bounds, { padding: getMapPadding(), duration: 0 });
  if (state.userLoc) userMarker.setLngLat([state.userLoc.lon, state.userLoc.lat]).addTo(map);
  render(true);
}, () => {
  map = undefined;
  pulseMarker = undefined;
  userMarker = undefined;
  activePopup = null;
  $('map-note').hidden = false;
  for (const control of document.querySelectorAll('[data-map-control]')) control.disabled = true;
  setPanelOpen(true);
});
