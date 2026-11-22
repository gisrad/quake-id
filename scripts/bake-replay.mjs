// Mengunduh arsip sekuens gempa historis Indonesia dari USGS ComCat (tanpa API key).
import { mkdir, writeFile } from 'node:fs/promises';

const SCENARIOS = [
  {
    id: 'palu-2018',
    label: 'Palu 2018 · M7.5',
    title: 'Gempa Supershear Palu–Donggala 2018',
    place: 'Sesar Palu-Koro, Sulawesi Tengah',
    start: '2018-09-27T00:00:00Z',
    end: '2018-10-15T00:00:00Z',
    bbox: [119.2, -2.2, 120.8, 0.8],
    bounds: [[118.9, -2.1], [121.1, 0.7]],
    windowHours: 72,
    initialHours: 48
  },
  {
    id: 'lombok-2018',
    label: 'Lombok 2018 · M6.9',
    title: 'Rentetan Gempa Sesar Naik Flores · Lombok 2018',
    place: 'Lombok – Sumbawa Barat, NTB',
    start: '2018-07-28T00:00:00Z',
    end: '2018-08-26T00:00:00Z',
    bbox: [115.4, -9.1, 117.4, -7.8],
    bounds: [[115.3, -9.0], [117.3, -7.9]],
    windowHours: 96,
    initialHours: 240
  }
];

async function fetchScenario(sc) {
  const [minLon, minLat, maxLon, maxLat] = sc.bbox;
  const url =
    'https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson' +
    `&starttime=${sc.start}&endtime=${sc.end}` +
    `&minlatitude=${minLat}&maxlatitude=${maxLat}` +
    `&minlongitude=${minLon}&maxlongitude=${maxLon}` +
    '&minmagnitude=2.5&orderby=time-asc';
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${sc.id} HTTP ${res.status}`);
  const geo = await res.json();
  const t0 = Math.floor(Date.parse(sc.start) / 1000);
  const t1 = Math.floor(Date.parse(sc.end) / 1000);
  const events = (geo.features || [])
    .map((f) => {
      const p = f.properties || {};
      const [lon, lat, depth] = f.geometry?.coordinates || [];
      if (!Number.isFinite(lon) || !Number.isFinite(lat) || !Number.isFinite(p.time)) return null;
      return {
        id: f.id,
        ts: Math.floor(p.time / 1000),
        lon: Number(lon.toFixed(4)),
        lat: Number(lat.toFixed(4)),
        depth: Number((depth || 10).toFixed(1)),
        mag: Number((p.mag || 0).toFixed(1)),
        magType: p.magType || 'mb',
        src: 'USGS',
        place: p.place || sc.place,
        felt: null,
        mmi: p.mmi ? Math.round(p.mmi) : null,
        potensi: null,
        tsunami: p.tsunami ? 1 : 0,
        url: p.url || null
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.ts - b.ts);

  console.log(`${sc.id}: ${events.length} events (M max ${Math.max(...events.map((e) => e.mag))})`);
  return { ...sc, t0, durationMin: Math.round((t1 - t0) / 60), events };
}

const scenarios = [];
for (const sc of SCENARIOS) {
  scenarios.push(await fetchScenario(sc));
}

await mkdir(new URL('../public/data/', import.meta.url), { recursive: true });
await writeFile(
  new URL('../public/data/replays-quake.json', import.meta.url),
  JSON.stringify({ source: 'USGS ComCat FDSN Historical Archive', scenarios })
);
console.log('Wrote public/data/replays-quake.json');
