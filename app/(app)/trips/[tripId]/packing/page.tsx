import { notFound } from "next/navigation";
import { readSessionUserId } from "@/lib/auth/session";
import { getTrip } from "@/lib/services/trips";
import { OwnershipError } from "@/lib/services/ownership";
import { listPackingItems } from "@/lib/services/packing";
import { PackingList } from "@/components/packing-list";

/* Packing list (WF §15): auto-fill from destination climate + trip length. */

export const metadata = { title: "Packing list" };

export default async function PackingPage({
  params,
}: {
  params: Promise<{ tripId: string }>;
}) {
  const { tripId } = await params;
  const userId = await readSessionUserId();
  if (!userId) notFound();

  let trip;
  try {
    trip = await getTrip(userId, tripId);
  } catch (error) {
    if (error instanceof OwnershipError) notFound();
    throw error;
  }

  const items = await listPackingItems(userId, tripId);

  return (
    <section className="flex flex-col gap-s6">
      <header className="flex flex-col gap-s2">
        <p className="font-mono text-xs tracking-widest text-horizon-deep uppercase">
          {trip.destinationCity}
        </p>
        <h1 className="font-display text-2xl">{trip.title} — Packing</h1>
      </header>

      <PackingList tripId={tripId} initialItems={items} />
    </section>
  );
}
