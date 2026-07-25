import { sql } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/lib/db/client";
import { getTrip } from "./trips";

/*
 * AI itinerary suggestions (Phase 7 task 4): a single function calling the
 * LLM API, strict Zod parse of the JSON it returns, a per-user daily quota,
 * a 15s timeout, and a friendly fallback on any failure — manual authoring
 * is never affected. `callLlmProvider` is the ONLY place a specific
 * provider is named; swapping providers later means changing only that
 * function's body.
 */

export const itinerarySuggestionSchema = z.object({
  items: z
    .array(
      z.object({
        dayIndex: z.number().int().min(0),
        time: z.string().max(5).optional(),
        title: z.string().min(1).max(120),
        category: z.enum(["food", "sight", "activity", "transit", "rest"]),
        note: z.string().max(280).optional(),
        poiId: z.string().uuid().optional(),
      }),
    )
    .min(3)
    .max(6),
});
export type ItinerarySuggestion = z.infer<typeof itinerarySuggestionSchema>;

export class AiQuotaExceededError extends Error {
  constructor() {
    super("Daily AI suggestion quota reached");
    this.name = "AiQuotaExceededError";
  }
}

export class AiUnavailableError extends Error {
  constructor(message = "The travel muse is resting — try again later") {
    super(message);
    this.name = "AiUnavailableError";
  }
}

const DAILY_LIMIT = 5;
const TIMEOUT_MS = 15_000;

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Atomic, race-safe daily counter: a single capped upsert (no read-then-
 * write). Runs BEFORE any provider call, so a user at quota never triggers
 * an outbound request (QA 7.6).
 */
async function checkAndConsumeQuota(userId: string): Promise<void> {
  const db = await getDb();
  const usageDate = todayUtc();
  const rows = await db
    .insert(schema.aiUsage)
    .values({ userId, usageDate, callCount: 1 })
    .onConflictDoUpdate({
      target: [schema.aiUsage.userId, schema.aiUsage.usageDate],
      set: { callCount: sql`${schema.aiUsage.callCount} + 1` },
      setWhere: sql`${schema.aiUsage.callCount} < ${DAILY_LIMIT}`,
    })
    .returning();
  if (rows.length === 0) throw new AiQuotaExceededError();
}

interface ProviderInput {
  system: string;
  user: string;
}

/** THE single swappable seam — the only function that knows about a specific LLM provider. */
async function callLlmProvider(input: ProviderInput): Promise<string> {
  return callAnthropic(input);
}

async function callAnthropic({ system, user }: ProviderInput): Promise<string> {
  const apiKey = process.env.LLM_API_KEY ?? process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new AiUnavailableError();

  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic({ apiKey });

  const response = await client.messages.create(
    {
      model: "claude-haiku-4-5",
      max_tokens: 1024,
      system,
      messages: [{ role: "user", content: user }],
    },
    { timeout: TIMEOUT_MS },
  );

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") throw new AiUnavailableError();
  return textBlock.text;
}

function safeJsonParse(raw: string): unknown {
  // Models sometimes wrap JSON in a ```json fence despite instructions not to.
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  const candidate = fenced ? fenced[1] : raw;
  try {
    return JSON.parse(candidate);
  } catch {
    return null;
  }
}

const SYSTEM_PROMPT = `You are a friendly, concise travel-itinerary assistant for a trip-planning app.
Given a destination city, the number of days, and optional interests, propose 3-6 itinerary items.
Respond with ONLY a single JSON object, no markdown fences, no commentary, matching exactly this shape:
{"items":[{"dayIndex":0,"time":"09:00","title":"...","category":"food|sight|activity|transit|rest","note":"..."}]}
"dayIndex" is 0-based and must be less than the number of days given. "time" and "note" are optional.
Every trip mentioned is a SIMULATION — do not claim any booking is real.`;

function buildUserPrompt(city: string, days: number, interests?: string[]): string {
  const interestLine = interests?.length ? `Interests: ${interests.join(", ")}.` : "";
  return `City: ${city}. Trip length: ${days} day${days === 1 ? "" : "s"}. ${interestLine}`.trim();
}

/**
 * Proposes 3-6 itinerary items for a trip. Ownership-checked; quota-checked
 * before any provider call; strict Zod parse of the result. On ANY failure
 * (missing key, timeout, malformed JSON, provider error) this throws
 * `AiUnavailableError` — callers map that to a friendly message and manual
 * authoring is entirely unaffected, since this never touches the itinerary
 * tables directly.
 */
export async function suggestItinerary(
  userId: string,
  tripId: string,
  city: string,
  days: number,
  interests?: string[],
): Promise<ItinerarySuggestion> {
  await getTrip(userId, tripId); // ownership check
  await checkAndConsumeQuota(userId);

  let raw: string;
  try {
    raw = await callLlmProvider({
      system: SYSTEM_PROMPT,
      user: buildUserPrompt(city, days, interests),
    });
  } catch (error) {
    if (error instanceof AiUnavailableError) throw error;
    throw new AiUnavailableError();
  }

  const parsed = itinerarySuggestionSchema.safeParse(safeJsonParse(raw));
  if (!parsed.success) throw new AiUnavailableError();
  return parsed.data;
}
