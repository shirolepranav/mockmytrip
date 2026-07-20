/*
 * Airport seed (Phase 1 task 1, TECH_SPEC §5.1).
 * Downloads OurAirports airports.csv (public domain / PDDL), filters to
 * large/medium airports with scheduled service and an IATA code, attaches an
 * IANA timezone via tz-lookup, then emits:
 *   - data/airports.seed.json          (full rows, feeds the DB in Phase 2)
 *   - public/data/airports.slim.json   (client autocomplete, < 300 KB gzip)
 *
 * Run: npx tsx scripts/seed-airports.mts
 * Re-runnable; caches the raw CSV in data/raw/.
 */

import { mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import tzLookup from "tz-lookup";

const CSV_URL =
  "https://davidmegginson.github.io/ourairports-data/airports.csv";
const ROOT = process.cwd();
const RAW_PATH = join(ROOT, "data/raw/airports.csv");
const SEED_PATH = join(ROOT, "data/airports.seed.json");
const SLIM_PATH = join(ROOT, "public/data/airports.slim.json");

interface SeedAirport {
  ident: string;
  iata: string;
  icao: string;
  name: string;
  city: string;
  country: string; // ISO 3166-1 alpha-2
  region: string; // ISO region, e.g. US-NY
  lat: number;
  lng: number;
  type: "large_airport" | "medium_airport";
  tz: string; // IANA timezone
}

/** Minimal CSV parser handling quoted fields with commas. */
function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      fields.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  fields.push(current);
  return fields;
}

async function fetchCsv(): Promise<string> {
  if (existsSync(RAW_PATH)) {
    console.log("Using cached", RAW_PATH);
    return readFileSync(RAW_PATH, "utf8");
  }
  console.log("Downloading", CSV_URL);
  const response = await fetch(CSV_URL);
  if (!response.ok) throw new Error(`Download failed: ${response.status}`);
  const text = await response.text();
  mkdirSync(join(ROOT, "data/raw"), { recursive: true });
  writeFileSync(RAW_PATH, text);
  return text;
}

const csv = await fetchCsv();
const lines = csv.split("\n").filter((line) => line.trim().length > 0);
const header = parseCsvLine(lines[0]);
const col = (name: string) => {
  const index = header.indexOf(name);
  if (index === -1) throw new Error(`Missing column ${name}`);
  return index;
};

const cols = {
  ident: col("ident"),
  type: col("type"),
  name: col("name"),
  lat: col("latitude_deg"),
  lng: col("longitude_deg"),
  country: col("iso_country"),
  region: col("iso_region"),
  municipality: col("municipality"),
  scheduled: col("scheduled_service"),
  icao: col("icao_code"),
  iata: col("iata_code"),
};

const airports: SeedAirport[] = [];
const seenIata = new Set<string>();

for (let i = 1; i < lines.length; i++) {
  const fields = parseCsvLine(lines[i]);
  const type = fields[cols.type];
  if (type !== "large_airport" && type !== "medium_airport") continue;
  if (fields[cols.scheduled] !== "yes") continue;
  const iata = fields[cols.iata]?.trim();
  if (!iata || iata.length !== 3) continue;
  if (seenIata.has(iata)) continue; // keep first (file is ordered by id)

  const lat = Number(fields[cols.lat]);
  const lng = Number(fields[cols.lng]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

  let tz: string;
  try {
    tz = tzLookup(lat, lng);
  } catch {
    continue; // out-of-range coordinates
  }

  seenIata.add(iata);
  airports.push({
    ident: fields[cols.ident],
    iata,
    icao: fields[cols.icao] ?? "",
    name: fields[cols.name],
    city: fields[cols.municipality] || fields[cols.name],
    country: fields[cols.country],
    region: fields[cols.region],
    lat,
    lng,
    type,
    tz,
  });
}

airports.sort((a, b) => a.iata.localeCompare(b.iata));

mkdirSync(join(ROOT, "data"), { recursive: true });
mkdirSync(join(ROOT, "public/data"), { recursive: true });

writeFileSync(SEED_PATH, JSON.stringify(airports, null, 1));

/* Slim variant for the client autocomplete: array-of-arrays keeps it tiny.
   Schema: [iata, name, city, country, lat, lng, tz] */
const slim = airports.map((airport) => [
  airport.iata,
  airport.name,
  airport.city,
  airport.country,
  Number(airport.lat.toFixed(3)),
  Number(airport.lng.toFixed(3)),
  airport.tz,
]);
const slimJson = JSON.stringify(slim);
writeFileSync(SLIM_PATH, slimJson);

const gzipKb = gzipSync(Buffer.from(slimJson)).length / 1024;
console.log(
  `Seeded ${airports.length} airports. slim.json ${(slimJson.length / 1024).toFixed(0)} KB raw, ${gzipKb.toFixed(0)} KB gzip.`,
);
if (gzipKb > 300) {
  console.error("✖ slim JSON exceeds the 300 KB gzip budget");
  process.exit(1);
}
