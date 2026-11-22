// Modul geospasial Indonesia untuk Sentinel Seismik: preset busur tektonik, 38 provinsi, & zona waktu.

export const REGIONS = [
  { id: 'nusantara', label: 'Nusantara', bounds: [[94.8, -11.4], [141.2, 6.4]] },
  { id: 'sumatera', label: 'Sumatera', bounds: [[94.5, -6.5], [106.2, 6.2]] },
  { id: 'jawa_nusa', label: 'Jawa · Nusa', bounds: [[105.0, -11.4], [125.5, -5.5]] },
  { id: 'sulawesi', label: 'Sulawesi', bounds: [[118.5, -6.2], [126.0, 2.5]] },
  { id: 'maluku_banda', label: 'Maluku · Banda', bounds: [[124.2, -8.8], [133.5, 4.5]] },
  { id: 'papua', label: 'Papua', bounds: [[130.5, -9.2], [141.2, 0.8]] }
];

export const MOBILE_INITIAL_BOUNDS = [[95.0, -10.0], [128.0, 5.8]];
export const INDONESIA_MAX_BOUNDS = [[60.0, -48.0], [165.0, 42.0]];

// [minLon, minLat, maxLon, maxLat, centerLon, centerLat, name, island, tz]
const PROVINCES = [
  [94.9, 1.9, 98.3, 6.1, 96.7, 4.4, 'Aceh', 'Sumatera', 'WIB'],
  [97.0, 0.4, 100.5, 4.3, 99.0, 2.2, 'Sumatera Utara', 'Sumatera', 'WIB'],
  [98.5, -3.5, 101.9, 0.9, 100.4, -0.9, 'Sumatera Barat', 'Sumatera', 'WIB'],
  [100.0, -1.1, 103.8, 2.6, 101.8, 0.6, 'Riau', 'Sumatera', 'WIB'],
  [103.2, -0.9, 109.2, 4.9, 104.5, 1.0, 'Kepulauan Riau', 'Sumatera', 'WIB'],
  [101.1, -2.8, 104.5, -0.7, 102.8, -1.6, 'Jambi', 'Sumatera', 'WIB'],
  [101.0, -5.6, 103.8, -2.3, 102.3, -3.7, 'Bengkulu', 'Sumatera', 'WIB'],
  [102.0, -4.9, 106.2, -1.6, 104.2, -3.2, 'Sumatera Selatan', 'Sumatera', 'WIB'],
  [105.0, -3.4, 108.9, -1.5, 106.8, -2.5, 'Kep. Bangka Belitung', 'Sumatera', 'WIB'],
  [103.5, -6.2, 105.9, -3.7, 105.0, -4.9, 'Lampung', 'Sumatera', 'WIB'],

  [105.0, -7.1, 106.5, -5.8, 106.1, -6.4, 'Banten', 'Jawa', 'WIB'],
  [106.6, -6.4, 107.0, -5.2, 106.8, -6.2, 'DKI Jakarta', 'Jawa', 'WIB'],
  [106.3, -7.8, 108.9, -5.9, 107.6, -6.9, 'Jawa Barat', 'Jawa', 'WIB'],
  [108.5, -8.2, 111.7, -5.7, 110.2, -7.2, 'Jawa Tengah', 'Jawa', 'WIB'],
  [110.0, -8.2, 110.9, -7.5, 110.4, -7.9, 'DI Yogyakarta', 'Jawa', 'WIB'],
  [110.9, -8.8, 116.3, -5.0, 112.7, -7.6, 'Jawa Timur', 'Jawa', 'WIB'],

  [108.6, -3.1, 114.2, 2.1, 111.1, -0.2, 'Kalimantan Barat', 'Kalimantan', 'WIB'],
  [110.7, -3.6, 115.9, 0.8, 113.4, -1.7, 'Kalimantan Tengah', 'Kalimantan', 'WIB'],
  [114.3, -4.2, 116.6, -1.3, 115.4, -3.0, 'Kalimantan Selatan', 'Kalimantan', 'WITA'],
  [113.8, -2.5, 119.0, 2.6, 116.5, 0.5, 'Kalimantan Timur', 'Kalimantan', 'WITA'],
  [114.6, 1.1, 118.0, 4.4, 116.6, 3.0, 'Kalimantan Utara', 'Kalimantan', 'WITA'],

  [114.4, -8.9, 115.8, -8.0, 115.1, -8.4, 'Bali', 'Bali · Nusa', 'WITA'],
  [115.8, -9.1, 119.3, -8.1, 117.4, -8.6, 'Nusa Tenggara Barat', 'Bali · Nusa', 'WITA'],
  [118.9, -11.1, 125.2, -8.0, 121.8, -9.5, 'Nusa Tenggara Timur', 'Bali · Nusa', 'WITA'],

  [118.7, -3.6, 119.9, -0.8, 119.2, -2.4, 'Sulawesi Barat', 'Sulawesi', 'WITA'],
  [118.7, -7.5, 121.9, -1.9, 119.9, -4.2, 'Sulawesi Selatan', 'Sulawesi', 'WITA'],
  [120.8, -6.2, 124.7, -2.8, 122.2, -4.3, 'Sulawesi Tenggara', 'Sulawesi', 'WITA'],
  [119.4, -3.6, 124.2, 1.4, 121.4, -1.1, 'Sulawesi Tengah', 'Sulawesi', 'WITA'],
  [121.1, 0.3, 123.5, 1.1, 122.5, 0.7, 'Gorontalo', 'Sulawesi', 'WITA'],
  [123.1, 0.3, 127.2, 5.6, 124.8, 1.3, 'Sulawesi Utara', 'Sulawesi', 'WITA'],

  [125.7, -8.4, 135.0, -2.7, 129.5, -3.6, 'Maluku', 'Maluku · Banda', 'WIT'],
  [124.3, -2.5, 129.8, 2.7, 127.7, 0.8, 'Maluku Utara', 'Maluku · Banda', 'WIT'],
  [129.3, -2.3, 133.2, 0.2, 131.6, -1.0, 'Papua Barat Daya', 'Papua', 'WIT'],
  [132.0, -4.3, 134.9, -0.7, 133.5, -2.3, 'Papua Barat', 'Papua', 'WIT'],
  [134.6, -5.0, 138.0, -2.5, 136.3, -3.8, 'Papua Tengah', 'Papua', 'WIT'],
  [135.5, -3.6, 141.02, -1.0, 139.2, -2.5, 'Papua', 'Papua', 'WIT'],
  [137.4, -5.3, 141.02, -3.0, 139.3, -4.1, 'Papua Pegunungan', 'Papua', 'WIT'],
  [137.5, -9.2, 141.02, -5.0, 139.7, -7.2, 'Papua Selatan', 'Papua', 'WIT']
];

const TZ_FMT = {
  WIB: new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
  }),
  WITA: new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Makassar', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
  }),
  WIT: new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jayapura', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
  })
};

export function locateIndonesia(lat, lon) {
  let best = null;
  let bestDist = Infinity;
  for (const p of PROVINCES) {
    if (lon >= p[0] && lon <= p[2] && lat >= p[1] && lat <= p[3]) {
      const d = (lon - p[4]) ** 2 + (lat - p[5]) ** 2;
      if (d < bestDist) {
        bestDist = d;
        best = p;
      }
    }
  }
  if (!best) {
    for (const p of PROVINCES) {
      const d = (lon - p[4]) ** 2 + (lat - p[5]) ** 2;
      if (d < bestDist && d <= 9.0) {
        bestDist = d;
        best = p;
      }
    }
  }
  if (!best) {
    const tz = lon < 115 ? 'WIB' : lon < 126 ? 'WITA' : 'WIT';
    return { province: 'Perairan Nusantara', island: 'Indonesia', tz };
  }
  return { province: best[6], island: best[7], tz: best[8] };
}

export function formatZoneTime(unixSec, tz = 'WIB') {
  const fmt = TZ_FMT[tz] || TZ_FMT.WIB;
  return `${fmt.format(new Date(unixSec * 1000))} ${tz}`;
}

export function formatTimeAgo(unixSec) {
  const diffMin = Math.max(0, Math.round((Date.now() / 1000 - unixSec) / 60));
  if (diffMin < 1) return 'baru saja';
  if (diffMin < 60) return `${diffMin} mnt lalu`;
  const h = Math.floor(diffMin / 60);
  if (h < 24) return `${h} jam lalu`;
  return `${Math.floor(h / 24)} hari lalu`;
}
