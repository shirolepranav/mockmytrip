import { z } from "zod";

/*
 * Flight-results URL parameter schema, shared by the results page and the
 * flight detail page so both parse identically.
 */

export const resultsParamsSchema = z.object({
  o: z.string().length(3),
  d: z.string().length(3),
  depart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  return: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  pax: z.coerce.number().int().min(1).max(9).default(1),
  cabin: z
    .enum(["economy", "premium", "business", "first"])
    .default("economy"),
  sort: z.enum(["price", "duration", "departure"]).default("departure"),
  stops: z.enum(["0"]).optional(),
  time: z.enum(["morning", "afternoon", "evening"]).optional(),
  airlines: z.string().optional(),
  /** Which leg is being searched for a round trip. */
  leg: z.enum(["outbound", "return"]).default("outbound"),
});

export type ResultsParams = z.infer<typeof resultsParamsSchema>;

/** Rebuild the canonical query string for links (drops undefined). */
export function resultsQueryString(params: ResultsParams): string {
  const query = new URLSearchParams({
    o: params.o,
    d: params.d,
    depart: params.depart,
    pax: String(params.pax),
    cabin: params.cabin,
  });
  if (params.return) query.set("return", params.return);
  if (params.sort !== "departure") query.set("sort", params.sort);
  if (params.stops) query.set("stops", params.stops);
  if (params.time) query.set("time", params.time);
  if (params.airlines) query.set("airlines", params.airlines);
  if (params.leg !== "outbound") query.set("leg", params.leg);
  return query.toString();
}

/** "Stable now": prices depend on days-until, frozen per calendar day. */
export function startOfTodayUtcMs(): number {
  const now = new Date();
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
}
