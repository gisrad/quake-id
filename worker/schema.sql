CREATE TABLE IF NOT EXISTS quakes (
  id TEXT PRIMARY KEY,
  origin_ts INTEGER NOT NULL,
  lat REAL NOT NULL,
  lon REAL NOT NULL,
  depth_km REAL NOT NULL,
  mag REAL NOT NULL,
  mag_type TEXT,
  source TEXT NOT NULL,
  place TEXT,
  bmkg_wilayah TEXT,
  bmkg_dirasakan TEXT,
  max_mmi INTEGER,
  potensi TEXT,
  tsunami INTEGER DEFAULT 0,
  shakemap TEXT,
  url TEXT
);
CREATE INDEX IF NOT EXISTS quakes_origin_ts ON quakes (origin_ts);

CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
