import { mkdirSync } from "node:fs";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-http";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { neon } from "@neondatabase/serverless";
import * as schema from "./schema";

/*
 * Dual-driver DB client:
 *  - DATABASE_URL set (Vercel + Neon): serverless HTTP driver.
 *  - No DATABASE_URL (local dev / CI / tests): embedded PGlite Postgres,
 *    file-backed in .data/pglite (or in-memory when PGLITE_MEMORY=1).
 * Both expose the same Drizzle API over the same schema.
 */

export type Db =
  | ReturnType<typeof drizzleNeon<typeof schema>>
  | ReturnType<typeof drizzlePglite<typeof schema>>;

/*
 * globalThis-backed singleton: in dev, Next may evaluate this module once
 * per route graph — a second file-backed PGlite on the same dataDir crashes.
 */
const globalStore = globalThis as unknown as {
  __wanderlostDb?: Db;
  __wanderlostDbReady?: Promise<void>;
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

export { schema };
