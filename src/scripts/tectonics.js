// Struktur sesar aktif & zona subduksi Indonesia serta pengklasifikasi rezim gempa berbasis fisika kedalaman.

const STRUCTURES = [
  // Zona Subduksi / Megathrust
  {
    id: 'mega-sunda-sumatera',
    name: 'Megathrust Sunda – Sumatera',
    kind: 'megathrust',
    rate: '~55–65 mm/thn',
    note: 'Tumbukan miring Lempeng Indo-Australia di bawah Sumatera; membangkitkan gempa antar-lempeng & berpotensi memicu tsunami.',
    coords: [[91.8, 5.8], [93.2, 3.6], [95.0, 1.3], [96.9, -1.1], [98.9, -3.5], [100.8, -5.6], [102.9, -7.1], [104.5, -7.8]]
  },
  {
    id: 'mega-jawa-sumba',
    name: 'Megathrust Jawa – Bali – Sumba',
    kind: 'megathrust',
    rate: '~65–70 mm/thn',
    note: 'Palung subduksi frontal Selatan Jawa–Bali–Nusa Tenggara.',
    coords: [[104.5, -7.8], [106.8, -8.5], [109.5, -9.3], [112.5, -9.9], [115.6, -10.4], [118.8, -10.8], [122.0, -10.8], [124.2, -10.5]]
  },
  {
    id: 'mega-banda-seram',
    name: 'Megathrust Busur Banda – Timor – Seram',
    kind: 'megathrust',
    rate: '~60–75 mm/thn',
    note: 'Pelengkungan subduksi terdalam Indonesia; sumber gempa dalam Wadati–Benioff 150–650 km.',
    coords: [[124.2, -10.5], [127.2, -9.5], [130.5, -8.1], [132.7, -5.8], [132.4, -3.8], [130.0, -2.6], [127.6, -2.6]]
  },
  {
    id: 'mega-sulut',
    name: 'Megathrust Sulawesi Utara',
    kind: 'megathrust',
    rate: '~42–50 mm/thn',
    note: 'Subduksi Lempeng Laut Sulawesi menunjam ke selatan di bawah lengan utara Sulawesi.',
    coords: [[119.9, 1.35], [121.8, 1.58], [123.6, 1.75], [125.4, 2.05], [126.4, 2.55]]
  },
  {
    id: 'mega-sangihe-maluku',
    name: 'Tumbukan Ganda Laut Maluku – Sangihe',
    kind: 'megathrust',
    rate: '~60 mm/thn',
    note: 'Satu-satunya zona tumbukan busur ganda aktif di dunia (Sangihe di barat, Halmahera di timur).',
    coords: [[125.4, -0.4], [126.0, 1.4], [126.3, 3.2], [126.4, 5.2]]
  },
  {
    id: 'mega-halmahera',
    name: 'Subduksi Halmahera',
    kind: 'megathrust',
    rate: '~50 mm/thn',
    note: 'Tunjaman ke timur di bawah busur vulkanik Halmahera–Ternate.',
    coords: [[127.1, -0.8], [127.2, 0.9], [127.5, 2.5], [128.0, 4.0]]
  },
  {
    id: 'mega-nugini-utara',
    name: 'Palung Nugini Utara (Biak – Jayapura)',
    kind: 'megathrust',
    rate: '~75 mm/thn',
    note: 'Subduksi Lempeng Pasifik/Caroline di utara Papua.',
    coords: [[134.5, -0.25], [137.0, -0.75], [139.2, -1.35], [141.1, -2.05]]
  },

  // Sesar Naik Belakang Busur (Back-arc Thrust)
  {
    id: 'thrust-flores',
    name: 'Sesar Naik Belakang Busur Flores',
    kind: 'thrust',
    rate: '~10–15 mm/thn',
    note: 'Sumber gempa dangkal destruktif Bali utara–Lombok–Sumbawa–Flores (termasuk rentetan Lombok 2018).',
    coords: [[114.6, -8.12], [116.2, -8.25], [118.0, -8.22], [120.1, -8.12], [122.4, -7.95]]
  },
  {
    id: 'thrust-wetar',
    name: 'Sesar Naik Wetar',
    kind: 'thrust',
    rate: '~15 mm/thn',
    note: 'Sesar naik di utara Timor–Alor–Wetar.',
    coords: [[123.6, -7.85], [125.5, -7.65], [127.5, -7.50]]
  },

  // Sesar Aktif Kerak Darat / Strike-Slip Utama
  {
    id: 'fault-sumatera',
    name: 'Sesar Besar Sumatera (Semangko)',
    kind: 'fault',
    rate: '~11–27 mm/thn',
    note: 'Sesar geser menganan sepanjang 1.900 km membelah punggungan Bukit Barisan dari Aceh ke Selat Sunda.',
    coords: [[95.35, 5.45], [97.10, 4.10], [98.95, 2.05], [100.40, -0.30], [101.95, -2.25], [103.50, -4.05], [104.85, -5.75]]
  },
  {
    id: 'fault-jabar',
    name: 'Sistem Sesar Cimandiri – Lembang – Baribis',
    kind: 'fault',
    rate: '~2–6 mm/thn',
    note: 'Jaringan sesar kerak darat berisiko tinggi di koridor padat Sukabumi–Cianjur–Bandung–Cirebon.',
    coords: [[106.52, -7.06], [107.12, -6.85], [107.65, -6.82], [108.35, -6.74], [109.10, -6.92]]
  },
  {
    id: 'fault-opak',
    name: 'Sesar Opak (Yogyakarta – Klaten)',
    kind: 'fault',
    rate: '~2–4 mm/thn',
    note: 'Sesar geser mengiri di tenggara Yogyakarta; membangkitkan gempa Bantul 2006 M6.4.',
    coords: [[110.27, -8.03], [110.42, -7.85], [110.58, -7.68]]
  },
  {
    id: 'fault-palu-matano',
    name: 'Sesar Palu-Koro & Matano',
    kind: 'fault',
    rate: '~38–42 mm/thn',
    note: 'Sesar kerak tercepat di Indonesia; pemicu gempa supershear M7.5 Palu–Donggala 2018.',
    coords: [[119.72, 0.55], [119.86, -0.88], [120.02, -1.65], [120.85, -2.35], [121.65, -2.55], [122.65, -3.25]]
  },
  {
    id: 'fault-gorontalo',
    name: 'Sesar Gorontalo',
    kind: 'fault',
    rate: '~10–15 mm/thn',
    note: 'Sesar geser melintang di lengan utara Sulawesi menuju Teluk Tomini.',
    coords: [[122.25, 1.05], [123.02, 0.55], [123.62, 0.15]]
  },
  {
    id: 'fault-sorong-yapen',
    name: 'Sistem Sesar Sorong – Yapen – Mamberamo',
    kind: 'fault',
    rate: '~25–35 mm/thn',
    note: 'Batas sesar geser mengiri utama antara Lempeng Pasifik dan Kepala Burung Papua.',
    coords: [[127.8, -1.75], [131.2, -0.88], [134.1, -1.35], [136.4, -1.72], [138.2, -2.15], [140.2, -2.70]]
  },
  {
    id: 'fault-tarera-aiduna',
    name: 'Sesar Tarera – Aiduna',
    kind: 'fault',
    rate: '~18–25 mm/thn',
    note: 'Sesar geser utama sepanjang tepi selatan leher Kepala Burung Papua.',
    coords: [[133.2, -3.95], [135.4, -3.95], [137.4, -4.05]]
  }
];

export const TECTONIC_GEOJSON = {
  type: 'FeatureCollection',
  features: STRUCTURES.map((s) => ({
    type: 'Feature',
    geometry: { type: 'LineString', coordinates: s.coords },
    properties: {
      id: s.id,
      name: s.name,
      kind: s.kind,
      rate: s.rate,
      note: s.note
    }
  }))
};

export function haversineKm(lat1, lon1, lat2, lon2) {
  const r = Math.PI / 180;
  const dLat = (lat2 - lat1) * r;
  const dLon = (lon2 - lon1) * r;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(a)));
}

function pointToSegmentKm(lat, lon, a, b) {
  const cosLat = Math.cos((lat * Math.PI) / 180);
  const px = (lon - a[0]) * 111.32 * cosLat;
  const py = (lat - a[1]) * 110.57;
  const dx = (b[0] - a[0]) * 111.32 * cosLat;
  const dy = (b[1] - a[1]) * 110.57;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px, py);
  const t = Math.max(0, Math.min(1, (px * dx + py * dy) / lenSq));
  return Math.hypot(px - t * dx, py - t * dy);
}

export function nearestStructure(lat, lon, kindFilter = null) {
  let best = null;
  let bestDist = Infinity;
  for (const s of STRUCTURES) {
    if (kindFilter && s.kind !== kindFilter) continue;
    for (let i = 0; i < s.coords.length - 1; i++) {
      const d = pointToSegmentKm(lat, lon, s.coords[i], s.coords[i + 1]);
      if (d < bestDist) {
        bestDist = d;
        best = s;
      }
    }
  }
  return { structure: best, distKm: bestDist };
}

export function formatSeismicEnergy(mag) {
  if (!Number.isFinite(mag)) return '–';
  // Hubungan energi radiasi Gutenberg–Richter: log10(E_joule) = 4.8 + 1.5 * M
  const joules = Math.pow(10, 4.8 + 1.5 * mag);
  const tonsTnt = joules / 4.184e9;
  if (tonsTnt >= 1e6) return `${(tonsTnt / 1e6).toFixed(1)} Mt TNT`;
  if (tonsTnt >= 1e3) return `${(tonsTnt / 1e3).toFixed(1)} kt TNT`;
  if (tonsTnt >= 1) return `${tonsTnt.toFixed(0)} t TNT`;
  return `${(joules / 1e6).toFixed(1)} MJ`;
}

export function classifyQuake(lat, lon, depthKm, mag = 0) {
  const nearestAll = nearestStructure(lat, lon, null);
  const nearestFault = nearestStructure(lat, lon, 'fault');
  const nearestThrust = nearestStructure(lat, lon, 'thrust');
  const nearestMega = nearestStructure(lat, lon, 'megathrust');

  const faultOrThrustDist = Math.min(nearestFault.distKm, nearestThrust.distKm);
  const faultOrThrustStruct =
    nearestFault.distKm <= nearestThrust.distKm ? nearestFault.structure : nearestThrust.structure;

  let regime = 'megathrust';
  let label = 'Zona Megathrust';
  let detail = 'Subduksi dangkal (≤60 km)';

  if (depthKm > 60) {
    regime = 'intraslab';
    label = 'Lempeng Dalam';
    detail = depthKm > 300 ? 'Zona Benioff dalam (>300 km)' : 'Subduksi menengah (60–300 km)';
  } else if (depthKm <= 35 && (faultOrThrustDist <= 55 || nearestMega.distKm > 95)) {
    regime = 'crustal';
    label = 'Sesar · Kerak';
    detail = faultOrThrustDist <= 55 && faultOrThrustStruct ? faultOrThrustStruct.name : 'Kerak dangkal (≤35 km)';
  } else if (nearestMega.structure) {
    detail = nearestMega.structure.name;
  }

  return {
    regime,
    label,
    detail,
    structureName: nearestAll.distKm <= 140 && nearestAll.structure ? nearestAll.structure.name : null,
    distKm: Math.round(nearestAll.distKm),
    energyLabel: formatSeismicEnergy(mag)
  };
}
