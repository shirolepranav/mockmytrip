// @vitest-environment node
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

/*
 * @phase7 AI service suite against embedded in-memory PGlite, with the
 * Anthropic SDK mocked at the module boundary: happy path (QA 7.4),
 * malformed JSON (QA 7.5), quota enforcement with zero provider calls past
 * the cap (QA 7.6), and a missing-API-key fallback.
 */

process.env.PGLITE_MEMORY = "1";
process.env.LLM_API_KEY = "test-key";

const createMock = vi.fn();

vi.mock("@anthropic-ai/sdk", () => ({
  default: class MockAnthropic {
    messages = { create: createMock };
    constructor(_opts: unknown) {
      void _opts;
    }
  },
}));

import { getDb } from "@/lib/db/client";
import { createGuest } from "@/lib/services/users";
import { createTrip } from "@/lib/services/trips";
import { AiQuotaExceededError, AiUnavailableError, suggestItinerary } from "./ai";

beforeAll(async () => {
  await getDb(); // triggers embedded migration
});

beforeEach(() => {
  createMock.mockReset();
});

async function makeTrip(userId: string) {
  return createTrip(userId, {
    title: "Test trip",
    destinationCity: "Lisbon",
    destinationCountry: "PT",
    startDate: new Date("2026-09-01T00:00:00Z"),
    endDate: new Date("2026-09-04T00:00:00Z"),
  });
}

function textResponse(json: unknown) {
  return { content: [{ type: "text", text: JSON.stringify(json) }] };
}

describe("@phase7 suggestItinerary", () => {
  it("7.4 happy path: 3-6 valid items proposed", async () => {
    const user = await createGuest();
    const trip = await makeTrip(user.id);
    createMock.mockResolvedValueOnce(
      textResponse({
        items: [
          { dayIndex: 0, title: "Belém Tower", category: "sight" },
          { dayIndex: 0, title: "Pastéis de Belém", category: "food" },
          { dayIndex: 1, title: "Alfama walk", category: "activity" },
        ],
      }),
    );

    const result = await suggestItinerary(user.id, trip.id, "Lisbon", 4);
    expect(result.items.length).toBeGreaterThanOrEqual(3);
    expect(result.items.length).toBeLessThanOrEqual(6);
    expect(createMock).toHaveBeenCalledTimes(1);
  });

  it("7.5 malformed JSON is a graceful AiUnavailableError, not a crash", async () => {
    const user = await createGuest();
    const trip = await makeTrip(user.id);
    createMock.mockResolvedValueOnce({
      content: [{ type: "text", text: "not json at all" }],
    });

    await expect(suggestItinerary(user.id, trip.id, "Lisbon", 4)).rejects.toThrow(
      AiUnavailableError,
    );
  });

  it("rejects a response with too few items (schema enforced)", async () => {
    const user = await createGuest();
    const trip = await makeTrip(user.id);
    createMock.mockResolvedValueOnce(
      textResponse({ items: [{ dayIndex: 0, title: "Only one", category: "sight" }] }),
    );
    await expect(suggestItinerary(user.id, trip.id, "Lisbon", 4)).rejects.toThrow(
      AiUnavailableError,
    );
  });

  it("7.6 quota exceeded after 5 calls: the 6th never reaches the provider", async () => {
    const user = await createGuest();
    const trip = await makeTrip(user.id);
    createMock.mockResolvedValue(
      textResponse({
        items: [
          { dayIndex: 0, title: "A", category: "sight" },
          { dayIndex: 0, title: "B", category: "food" },
          { dayIndex: 0, title: "C", category: "activity" },
        ],
      }),
    );

    for (let i = 0; i < 5; i++) {
      await suggestItinerary(user.id, trip.id, "Lisbon", 4);
    }
    expect(createMock).toHaveBeenCalledTimes(5);

    await expect(suggestItinerary(user.id, trip.id, "Lisbon", 4)).rejects.toThrow(
      AiQuotaExceededError,
    );
    expect(createMock).toHaveBeenCalledTimes(5); // never called a 6th time
  });

  it("a missing LLM_API_KEY is a graceful failure, not a crash", async () => {
    const original = process.env.LLM_API_KEY;
    delete process.env.LLM_API_KEY;
    const user = await createGuest();
    const trip = await makeTrip(user.id);

    await expect(suggestItinerary(user.id, trip.id, "Lisbon", 4)).rejects.toThrow(
      AiUnavailableError,
    );
    expect(createMock).not.toHaveBeenCalled();
    process.env.LLM_API_KEY = original;
  });
});
