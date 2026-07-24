import { mkdirSync } from "node:fs";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-http";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { drizzle as drizzleNeonServerless } from "drizzle-orm/neon-serverless";
import { neon, neonConfig, Pool } from "@neondatabase/serverless";
import ws from "ws";
import * as schema from "./schema";

/*
 * Dual-driver DB client:
 *  - DATABASE_URL set (Vercel + Neon): serverless HTTP driver.
 *  - No DATABASE_URL (local dev / CI / tests): embedded PGlite Postgres,
 *    file-backed in .data/pglite (or in-memory when PGLITE_MEMORY=1).
 * Both expose the same Drizzle API over the same schema.
 *
 * The HTTP driver above is stateless (one fetch per query) and throws at
 * runtime on `.transaction()` — Neon's own limitation, not fixable via
 * config. Booking creation (Phase 5) needs real atomicity, so it uses a
 * SEPARATE client below (`getBookingDb`) over the WebSocket Pool driver,
 * which does support interactive transactions. Everything else keeps
 * using the lighter-weight HTTP client via `getDb()`.
 */
neonConfig.webSocketConstructor = ws;

export type Db =
  | ReturnType<typeof drizzleNeon<typeof schema>>
  | ReturnType<typeof drizzlePglite<typeof schema>>;

export type BookingDb =
  | ReturnType<typeof drizzleNeonServerless<typeof schema>>
  | ReturnType<typeof drizzlePglite<typeof schema>>;

/*
 * globalThis-backed singleton: in dev, Next may evaluate this module once
 * per route graph — a second file-backed PGlite on the same dataDir crashes.
 */
const globalStore = globalThis as unknown as {
  __wanderlostDb?: Db;
  __wanderlostDbReady?: Promise<void>;
  __wanderlostBookingDb?: BookingDb;
};

function createDb(): Db {
  const url = process.env.DATABASE_URL;
  if (url && url.startsWith("postgres")) {
    return drizzleNeon(neon(url), { schema });
  }
  let dataDir: string | undefined;
  if (process.env.PGLITE_MEMORY !== "1") {
    dataDir = ".data/pglite";
    // PGlite won't create parent directories itself.
    mkdirSync(dataDir, { recursive: true });
  }
  const db = drizzlePglite({ schema, connection: { dataDir } });
  // Apply migrations lazily on first use in the embedded case.
  globalStore.__wanderlostDbReady = applyPgliteMigrations(db);
  return db;
}

async function applyPgliteMigrations(
  db: ReturnType<typeof drizzlePglite<typeof schema>>,
) {
  const { readMigrationFiles } = await import("drizzle-orm/migrator");
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  try {
    readMigrationFiles({ migrationsFolder: "./drizzle" });
  } catch {
    return; // no migrations generated yet
  }
  await migrate(db, { migrationsFolder: "./drizzle" });
}

/** Get the process-wide DB handle (migrated when embedded). */
export async function getDb(): Promise<Db> {
  if (!globalStore.__wanderlostDb) {
    globalStore.__wanderlostDb = createDb();
  }
  if (globalStore.__wanderlostDbReady) await globalStore.__wanderlostDbReady;
  return globalStore.__wanderlostDb;
}

/**
 * Transaction-capable DB handle, for the one write path that needs real
 * atomicity (booking creation — trip + flights + bookings + stamp + savings
 * increment, all-or-nothing). With DATABASE_URL set, this is a WebSocket
 * Pool client (Neon's documented driver for interactive transactions);
 * without it, PGlite already supports `.transaction()` natively, so it
 * reuses the same instance `getDb()` returns.
 */
export async function getBookingDb(): Promise<BookingDb> {
  if (!globalStore.__wanderlostBookingDb) {
    const url = process.env.DATABASE_URL;
    if (url && url.startsWith("postgres")) {
      const pool = new Pool({ connectionString: url });
      globalStore.__wanderlostBookingDb = drizzleNeonServerless(pool, {
        schema,
      });
    } else {
      globalStore.__wanderlostBookingDb = (await getDb()) as unknown as BookingDb;
    }
  }
  return globalStore.__wanderlostBookingDb;
}

export { schema };
