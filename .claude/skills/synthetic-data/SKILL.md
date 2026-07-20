---
name: synthetic-data
description: Use when generating or modifying fake flights, hotels, airlines, schedules, prices, OR real airport/POI seed data (sights, restaurants) in Wanderlost's engine (lib/engine/*). Triggers on "flight data", "pricing", "airline name", "hotel", "airport", "POI", "sightseeing", "restaurant", "schedule", "distance", "seed".
---

Two data classes, never confused:
1. SYNTHETIC (fictional, deterministic per seed): airlines, hotels, flights, schedules, ALL prices.
2. REAL (facts, seeded from open data with attribution): airports, cities, POIs (sights/restaurants).
Bookings/prices are always simulated; POIs are real places and get a "Real place" chip in UI.

## Airports (real, seed data)
- Source: OurAirports public-domain airports.csv (davidmegginson.github.io/ourairports-data/airports.csv).
- Filter: type in (large_airport, medium_airport) AND scheduled_service='yes' AND iata_code present.
- Store slim JSON (iata, name, city, country, lat, lng, tz) for autocomplete; full table in DB.
- Add IANA tz per airport (tz-lookup) for correct local depart/arrive times.

## POIs (real, seed data — build-time script, no paid APIs)
- Sources: Wikidata (tourist attractions ranked by sitelinks; images/descriptions),
  Wikivoyage "See/Eat/Do" listings (CC BY-SA), OpenStreetMap/Overpass for restaurants/cafes/viewpoints (ODbL).
- Seed top ~30-50 POIs per supported city into the `pois` table; cache; no runtime third-party calls.
- ALWAYS keep attribution strings (ODbL for OSM, CC BY-SA for Wikivoyage/Wikipedia text, image licenses)
  in the row and surface credits on the About page and POI detail.
- Never invent facts about real places; only store what the source provides. No fake ratings on real POIs.

## Distance & flight time
- Haversine, R=6371km: a=sin^2(dphi/2)+cos(phi1)cos(phi2)sin^2(dlambda/2); c=2*asin(min(1,sqrt(a))); d=R*c.
  Guard antipodal with min(1,...). Check: JFK-LHR ~= 5540 km.
- Block time: cruise=d/v*60 (v~=875km/h jets; ~=550 for d<400km) + 30min overhead; snap 5min.
- Stops: direct if d<4500km or major route; else 1 stop via a hub with 60-120min layover.
- Departure banks: 3-8/day from morning/midday/evening banks with per-airline jitter.

## Pricing (fake money, labeled simulated)
- base = perKm(band)*distance_km: short ~$0.22, med ~$0.14, long ~$0.09, ultra ~$0.07/km; floor $39.
- multipliers: seasonality (month) 0.8-1.5, day-of-week (Fri/Sun peak), days-until-departure curve,
  cabin (eco 1.0 / premium 1.6 / business 3.2 / first 5.5), jitter +/-8% seeded by hash(route+date+flightNo).
- "You saved $X" = the full synthetic price (user pays $0). Hotels: nightly_base*seasonality*star*jitter*nights.

## Names (fictional only — airlines & hotels)
- Airlines: curated list (Altair Airways, Meridian Pacific, Lumen Air, Cirrus Continental, Vela Airlines,
  Nimbus Skyways, Solstice Air, Halcyon Airlines, ...) assigned to routes by hash.
- Hotels: [Prefix]+[Core]+[Type] from curated banks, seeded by city+index.
- ALWAYS run assertNotRealBrand() against the blocklist; never emit a real airline/hotel brand.

## Determinism
One seed(query) util (hash of normalized params) drives all randomness so SSR == client and results
are stable within a session. Same query => same flights/prices.
