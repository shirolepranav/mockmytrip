/* DB seed entrypoint: `npm run db:seed`. Idempotent. */
import { seedAll } from "../lib/services/seed-db";

const result = await seedAll();
console.log(
  `Seeded ${result.airports} airports, ${result.airlines} airlines` +
    (result.airports === 0 && result.airlines === 0
      ? " (already seeded — no-op)"
      : ""),
);
process.exit(0);
