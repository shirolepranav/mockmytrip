import { z } from "zod";

/*
 * Hotel search form validation (WF §6, QA 4.2): destination required,
 * check-in required and not in the past, check-out strictly after check-in.
 * Mirrors lib/validation/flight-search-form.ts's shape and tone.
 */

export const hotelSearchFormSchema = z
  .object({
    city: z.string().nullable(),
    country: z.string().nullable(),
    checkin: z.string(),
    checkout: z.string(),
    minDate: z.string(),
  })
  .superRefine((values, ctx) => {
    if (!values.city || !values.country) {
      ctx.addIssue({
        code: "custom",
        path: ["destination"],
        message: "Pick where you're staying",
      });
    }
    if (!values.checkin) {
      ctx.addIssue({
        code: "custom",
        path: ["checkin"],
        message: "Pick a check-in date",
      });
    } else if (values.checkin < values.minDate) {
      ctx.addIssue({
        code: "custom",
        path: ["checkin"],
        message: "Time travel isn't in the simulation (yet) — pick a future date",
      });
    }
    if (!values.checkout) {
      ctx.addIssue({
        code: "custom",
        path: ["checkout"],
        message: "Pick a check-out date",
      });
    } else if (values.checkin && values.checkout <= values.checkin) {
      ctx.addIssue({
        code: "custom",
        path: ["checkout"],
        message: "Check-out must be after check-in",
      });
    }
  });

export type HotelSearchFormValues = z.input<typeof hotelSearchFormSchema>;

export interface HotelSearchFormErrors {
  destination?: string;
  checkin?: string;
  checkout?: string;
}

/** Runs the schema and maps issues back to the form's per-field error shape. */
export function validateHotelSearchForm(
  values: HotelSearchFormValues,
): HotelSearchFormErrors {
  const result = hotelSearchFormSchema.safeParse(values);
  if (result.success) return {};
  const errors: HotelSearchFormErrors = {};
  for (const issue of result.error.issues) {
    const key = issue.path[0] as keyof HotelSearchFormErrors | undefined;
    if (key && !errors[key]) errors[key] = issue.message;
  }
  return errors;
}
