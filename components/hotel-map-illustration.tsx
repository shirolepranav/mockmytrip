import { mapSketchFor } from "@/lib/engine/destination-art";
import { IconMapPin } from "@/components/icons";

/*
 * Static, clearly non-real "map" for hotel detail (WF §8): an abstract
 * seeded sketch, never a real map embed/API, always labeled illustrative.
 */
export function HotelMapIllustration({
  seed,
  neighborhood,
}: {
  seed: number;
  neighborhood: string;
}) {
  return (
    <div className="ticket-surface flex flex-col gap-s2 p-s4">
      <span
        aria-hidden
        className="block overflow-hidden rounded-card border border-line"
        dangerouslySetInnerHTML={{
          __html: mapSketchFor(seed, { size: 240 }),
        }}
      />
      <p className="flex items-center gap-s1 text-xs text-ink-soft">
        <IconMapPin size={14} />
        Illustrative map · {neighborhood} · not a real location
      </p>
    </div>
  );
}
