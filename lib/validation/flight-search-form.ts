import { z } from "zod";

/*
 * Flight search form validation (WF §3): origin≠destination, no past
 * departure, return≥departure. Shared Zod schema so the client form and any
 * future server-side re-check parse identically; error copy matches the
 * original hand-rolled messages so the UX doesn't change.
 */

export const flightSearchFormSchema = z
  .object({
    origin: z.string().nullable(),
    destination: z.string().nullable(),
    departDate: z.string(),
    minDate: z.string(),
    roundTrip: z.boolean(),
    returnDate: z.string().optional(),
  })
  .superRefine((values, ctx) => {
    if (!values.origin) {
      ctx.addIssue({
        code: "custom",
        path: ["origin"],
        message: "Pick a departure airport",
      });
    }
    if (!values.destination) {
      ctx.addIssue({
        code: "custom",
        path: ["destination"],
        message: "Pick a destination airport",
      });
    }
    if (
      values.origin &&
      values.destination &&
      values.origin === values.destination
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["destination"],
        message: "You're already there — pick somewhere new",
      });
    }
    if (!values.departDate) {
      ctx.addIssue({
        code: "custom",
        path: ["departDate"],
        message: "When does the dream begin?",
      });
    } else if (values.departDate < values.minDate) {
      ctx.addIssue({
        code: "custom",
        path: ["departDate"],
        message:
          "Time travel isn't in the simulation (yet) — pick a future date",
      });
    }
    if (values.roundTrip) {
      if (!values.returnDate) {
        ctx.addIssue({
          code: "custom",
          path: ["returnDate"],
          message: "Pick a return date",
        });
      } else if (values.returnDate < values.departDate) {
        ctx.addIssue({
          code: "custom",
          path: ["returnDate"],
          message: "Return can't be before departure",
        });
      }
    }
  });

export type FlightSearchFormValues = z.input<typeof flightSearchFormSchema>;

export interface FlightSearchFormErrors {
  origin?: string;
  destination?: string;
  departDate?: string;
  returnDate?: string;
}

/** Runs the schema and maps issues back to the form's per-field error shape. */
export function validateFlightSearchForm(
  values: FlightSearchFormValues,
): FlightSearchFormErrors {
  const result = flightSearchFormSchema.safeParse(values);
  if (result.success) return {};
  const errors: FlightSearchFormErrors = {};
  for (const issue of result.error.issues) {
    const key = issue.path[0] as keyof FlightSearchFormErrors | undefined;
    if (key && !errors[key]) errors[key] = issue.message;
  }
  return errors;
}
