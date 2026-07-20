import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    // drizzle-kit push/migrate against Neon; PGlite migrates at runtime.
    url: process.env.DATABASE_URL ?? "postgres://localhost:5432/wanderlost",
  },
});
