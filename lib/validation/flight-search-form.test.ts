import { describe, expect, it } from "vitest";
import { validateFlightSearchForm } from "./flight-search-form";

const minDate = "2026-07-24";

function base() {
  return {
    origin: "JFK",
    destination: "LHR",
    departDate: "2026-08-01",
    minDate,
    roundTrip: false,
    returnDate: undefined,
  };
}

describe("validateFlightSearchForm (@phase3)", () => {
  it("passes for a valid one-way search", () => {
    expect(validateFlightSearchForm(base())).toEqual({});
  });

  it("flags missing origin/destination", () => {
    const errors = validateFlightSearchForm({
      ...base(),
      origin: null,
      destination: null,
    });
    expect(errors.origin).toBe("Pick a departure airport");
    expect(errors.destination).toBe("Pick a destination airport");
  });

  it("flags origin === destination", () => {
    const errors = validateFlightSearchForm({
      ...base(),
      destination: "JFK",
    });
    expect(errors.destination).toBe("You're already there — pick somewhere new");
  });

  it("flags a past departure date", () => {
    const errors = validateFlightSearchForm({
      ...base(),
      departDate: "2020-01-01",
    });
    expect(errors.departDate).toBe(
      "Time travel isn't in the simulation (yet) — pick a future date",
    );
  });

  it("allows a same-day round trip (return === departure)", () => {
    const errors = validateFlightSearchForm({
      ...base(),
      roundTrip: true,
      returnDate: base().departDate,
    });
    expect(errors).toEqual({});
  });

  it("flags a return date before departure", () => {
    const errors = validateFlightSearchForm({
      ...base(),
      roundTrip: true,
      returnDate: "2026-07-25",
      departDate: "2026-08-01",
    });
    expect(errors.returnDate).toBe("Return can't be before departure");
  });

  it("flags a missing return date when round trip is selected", () => {
    const errors = validateFlightSearchForm({
      ...base(),
      roundTrip: true,
      returnDate: undefined,
    });
    expect(errors.returnDate).toBe("Pick a return date");
  });
});
