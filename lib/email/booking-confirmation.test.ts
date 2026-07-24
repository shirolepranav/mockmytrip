import { describe, expect, it } from "vitest";
import { render } from "@react-email/render";
import { BookingConfirmationEmail } from "./booking-confirmation";
import type { BoardingPassData } from "@/lib/boarding-pass-view";

/*
 * Half of the permanent "SIMULATION present" ethics guard (the other half,
 * checkout DOM + on-screen pass + PDF text layer, is e2e/ethics/
 * simulation-present.spec.ts). Runs on every commit via `npm run test`.
 */

const sampleData: BoardingPassData = {
  bookingId: "b1",
  tripId: "t1",
  pnr: "SIM-ABC123",
  seat: "14A",
  gate: "B12",
  cabin: "economy",
  airlineName: "Test Air",
  airlineCode: "TA",
  airlineHue: 200,
  airlineLogoSeed: 1,
  flightNumber: "123",
  originIata: "JFK",
  originCity: "New York",
  originCountry: "US",
  originTz: "America/New_York",
  destIata: "LIS",
  destCity: "Lisbon",
  destCountry: "PT",
  destTz: "Europe/Lisbon",
  departUtcMs: Date.parse("2026-08-15T10:00:00Z"),
  arriveUtcMs: Date.parse("2026-08-15T20:00:00Z"),
  durationMin: 480,
  qrDataUrl: "data:image/png;base64,AAAA",
};

describe("@phase5 @ethics BookingConfirmationEmail", () => {
  it("shows the SIMULATION disclaimer at both the top and bottom", async () => {
    const html = await render(BookingConfirmationEmail({ data: sampleData }));
    const matches = html.match(/SIMULATION/g) ?? [];
    expect(matches.length).toBeGreaterThanOrEqual(2);
    expect(html).toContain("no travel is booked");
    expect(html).toContain("nothing was charged");
  });

  it("includes the route, PNR, and fictional airline", async () => {
    const html = await render(BookingConfirmationEmail({ data: sampleData }));
    expect(html).toContain("SIM-ABC123");
    expect(html).toContain("Test Air");
    expect(html).toContain("Lisbon");
  });

  it("never contains payment-related copy", async () => {
    const html = await render(BookingConfirmationEmail({ data: sampleData }));
    expect(html.toLowerCase()).not.toMatch(/card number|cvv|cvc|billing address/);
  });
});
