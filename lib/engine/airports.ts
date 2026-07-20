import seedData from "@/data/airports.seed.json";

/*
 * Airport lookup over the OurAirports seed (server-side; the client
 * autocomplete uses public/data/airports.slim.json instead).
 */

export interface Airport {
  ident: string;
  iata: string;
  icao: string;
  name: string;
  city: string;
  country: string;
  region: string;
  lat: number;
  lng: number;
  type: "large_airport" | "medium_airport";
  tz: string;
}

export const airports = seedData as Airport[];

const byIataMap = new Map<string, Airport>(
  airports.map((airport) => [airport.iata, airport]),
);

export function byIata(iata: string): Airport | undefined {
  return byIataMap.get(iata.toUpperCase());
}

/** Hub airports used for synthetic 1-stop routings (major connectors). */
export const HUB_IATAS = [
  "ATL",
  "ORD",
  "DFW",
  "DEN",
  "JFK",
  "LAX",
  "SFO",
  "SEA",
  "MIA",
  "YYZ",
  "LHR",
  "CDG",
  "AMS",
  "FRA",
  "MAD",
  "IST",
  "DXB",
  "DOH",
  "SIN",
  "HND",
  "NRT",
  "ICN",
  "HKG",
  "BKK",
  "SYD",
  "GRU",
  "MEX",
  "BOG",
  "JNB",
  "CAI",
  "DEL",
  "BOM",
] as const;

export function hubAirports(): Airport[] {
  return HUB_IATAS.map((iata) => byIataMap.get(iata)).filter(
    (airport): airport is Airport => airport !== undefined,
  );
}
