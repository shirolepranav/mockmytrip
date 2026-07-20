import {
  bigint,
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/*
 * Full schema per TECH_SPEC §4. All ids uuid; timestamps timestamptz.
 * Airports/airlines/pois are read-only seed tables; everything else is
 * user-owned and cascade-deletes with the user (data-minimalism rule).
 */

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").unique(),
  displayName: text("display_name"),
  isGuest: boolean("is_guest").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  prefsJson: jsonb("prefs_json")
    .$type<{
      reducedMotion?: "system" | "reduced" | "full";
      theme?: "light" | "night";
      notifOptIn?: boolean;
      moodCheckins?: boolean;
    }>()
    .notNull()
    .default({}),
  totalSavedCents: bigint("total_saved_cents", { mode: "number" })
    .notNull()
    .default(0),
});

export const airports = pgTable(
  "airports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ident: text("ident").notNull(),
    iataCode: text("iata_code").notNull(),
    icaoCode: text("icao_code"),
    name: text("name").notNull(),
    municipality: text("municipality"),
    isoCountry: text("iso_country").notNull(),
    isoRegion: text("iso_region"),
    latitudeDeg: doublePrecision("latitude_deg").notNull(),
    longitudeDeg: doublePrecision("longitude_deg").notNull(),
    type: text("type").notNull(),
    tz: text("tz").notNull(),
  },
  (table) => [
    uniqueIndex("airports_iata_idx").on(table.iataCode),
    index("airports_municipality_idx").on(table.municipality),
  ],
);

export const airlines = pgTable("airlines", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  code: text("code").notNull(),
  hue: integer("hue").notNull(),
  logoSeed: bigint("logo_seed", { mode: "number" }).notNull(),
});

export const hotels = pgTable("hotels", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  brand: text("brand"),
  city: text("city").notNull(),
  isoCountry: text("iso_country").notNull(),
  lat: doublePrecision("lat"),
  lng: doublePrecision("lng"),
  starRating: smallint("star_rating").notNull(),
  heroSeed: bigint("hero_seed", { mode: "number" }).notNull(),
  amenitiesJson: jsonb("amenities_json").$type<string[]>().notNull().default([]),
  nightlyBaseCents: integer("nightly_base_cents").notNull(),
});

/* Materialized per booking; ephemeral search results are computed, not stored. */
export const flights = pgTable("flights", {
  id: uuid("id").primaryKey().defaultRandom(),
  airlineName: text("airline_name").notNull(),
  airlineCode: text("airline_code").notNull(),
  airlineHue: integer("airline_hue").notNull(),
  airlineLogoSeed: bigint("airline_logo_seed", { mode: "number" }).notNull(),
  flightNumber: text("flight_number").notNull(),
  originIata: text("origin_iata").notNull(),
  destIata: text("dest_iata").notNull(),
  departAt: timestamp("depart_at", { withTimezone: true }).notNull(),
  arriveAt: timestamp("arrive_at", { withTimezone: true }).notNull(),
  durationMin: integer("duration_min").notNull(),
  distanceKm: integer("distance_km").notNull(),
  cabin: text("cabin").notNull(),
  stops: jsonb("stops")
    .$type<{ hubIata: string; hubCity: string; layoverMin: number }[]>()
    .notNull()
    .default([]),
  priceCents: integer("price_cents").notNull(),
  seed: bigint("seed", { mode: "number" }).notNull(),
});

export const trips = pgTable(
  "trips",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    destinationCity: text("destination_city").notNull(),
    destinationCountry: text("destination_country"),
    coverSeed: bigint("cover_seed", { mode: "number" }).notNull().default(0),
    startDate: timestamp("start_date", { withTimezone: true }).notNull(),
    endDate: timestamp("end_date", { withTimezone: true }).notNull(),
    status: text("status", {
      enum: ["upcoming", "in_progress", "memory"],
    })
      .notNull()
      .default("upcoming"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("trips_user_status_idx").on(table.userId, table.status)],
);

export const bookings = pgTable(
  "bookings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tripId: uuid("trip_id")
      .notNull()
      .references(() => trips.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type", { enum: ["flight", "hotel"] }).notNull(),
    flightId: uuid("flight_id").references(() => flights.id, {
      onDelete: "set null",
    }),
    hotelId: uuid("hotel_id").references(() => hotels.id, {
      onDelete: "set null",
    }),
    pnr: text("pnr").notNull(),
    seat: text("seat"),
    gate: text("gate"),
    priceCents: integer("price_cents").notNull(),
    savedCents: integer("saved_cents").notNull(),
    /** Draft-hash idempotency key: double-tap confirm creates one booking. */
    idempotencyKey: text("idempotency_key"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("bookings_trip_idx").on(table.tripId),
    uniqueIndex("bookings_idempotency_idx").on(table.idempotencyKey),
  ],
);

export const passportStamps = pgTable(
  "passport_stamps",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tripId: uuid("trip_id").references(() => trips.id, {
      onDelete: "set null", // stamps persist as memories when a trip is deleted
    }),
    countryIso: text("country_iso").notNull(),
    city: text("city").notNull(),
    stampStyle: smallint("stamp_style").notNull(),
    stampDate: timestamp("stamp_date", { withTimezone: true }).notNull(),
    rotationDeg: smallint("rotation_deg").notNull(),
    inkHue: smallint("ink_hue").notNull(),
    distanceKm: integer("distance_km").notNull().default(0),
  },
  (table) => [index("stamps_user_idx").on(table.userId)],
);

/* REAL places (Explore) — never given fake prices/ratings. */
export const pois = pgTable(
  "pois",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    city: text("city").notNull(),
    isoCountry: text("iso_country").notNull(),
    lat: doublePrecision("lat").notNull(),
    lng: doublePrecision("lng").notNull(),
    category: text("category", {
      enum: [
        "sight",
        "landmark",
        "museum",
        "restaurant",
        "cafe",
        "viewpoint",
        "park",
      ],
    }).notNull(),
    description: text("description"),
    imageUrl: text("image_url"),
    source: text("source", {
      enum: ["wikidata", "wikivoyage", "osm"],
    }).notNull(),
    sourceId: text("source_id").notNull(),
    attribution: text("attribution").notNull(),
    rank: integer("rank").notNull().default(0),
  },
  (table) => [index("pois_city_idx").on(table.city)],
);

export const itineraryItems = pgTable(
  "itinerary_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tripId: uuid("trip_id")
      .notNull()
      .references(() => trips.id, { onDelete: "cascade" }),
    dayIndex: integer("day_index").notNull(),
    time: text("time"),
    title: text("title").notNull(),
    note: text("note"),
    category: text("category", {
      enum: ["food", "sight", "activity", "transit", "rest"],
    })
      .notNull()
      .default("activity"),
    poiId: uuid("poi_id").references(() => pois.id, { onDelete: "set null" }),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (table) => [index("itinerary_trip_idx").on(table.tripId)],
);

export const packingItems = pgTable(
  "packing_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tripId: uuid("trip_id")
      .notNull()
      .references(() => trips.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    category: text("category").notNull().default("misc"),
    isChecked: boolean("is_checked").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    isAuto: boolean("is_auto").notNull().default(false),
  },
  (table) => [index("packing_trip_idx").on(table.tripId)],
);

export const pushSubscriptions = pgTable(
  "push_subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    endpoint: text("endpoint").notNull(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastSentAt: timestamp("last_sent_at", { withTimezone: true }),
  },
  (table) => [uniqueIndex("push_endpoint_idx").on(table.endpoint)],
);

export const moodCheckins = pgTable("mood_checkins", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  sessionId: text("session_id"),
  phase: text("phase", { enum: ["before", "after"] }).notNull(),
  score: smallint("score").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/* Magic-link tokens + rate limiting (custom lean flow, TECH_SPEC §6). */
export const magicLinkTokens = pgTable(
  "magic_link_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("magic_email_idx").on(table.email),
    uniqueIndex("magic_token_idx").on(table.tokenHash),
  ],
);

/* Trip drafts (Phase 3+): the in-progress flight/hotel selection. */
export const tripDrafts = pgTable("trip_drafts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" })
    .unique(),
  draftJson: jsonb("draft_json").$type<Record<string, unknown>>().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
