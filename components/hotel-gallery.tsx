import { hashSeed } from "@/lib/engine/seed";
import { DestinationArt } from "@/components/destination-art";

/*
 * Seeded illustration gallery (WF §8): a few procedural scenes derived from
 * the offer id, no stock photography. 1 large + 3 thumbnails.
 */
export function HotelGallery({ offerId }: { offerId: string }) {
  const [main, ...thumbs] = [0, 1, 2, 3].map((index) =>
    hashSeed(`gallery:${offerId}:${index}`),
  );

  return (
    <div className="grid grid-cols-3 gap-s2">
      <DestinationArt
        seed={main}
        size={640}
        className="col-span-3 aspect-video rounded-card sm:col-span-2 [&_svg]:h-full [&_svg]:w-full"
      />
      <div className="col-span-3 grid grid-cols-3 gap-s2 sm:col-span-1 sm:grid-rows-3">
        {thumbs.map((seed, index) => (
          <DestinationArt
            key={index}
            seed={seed}
            size={200}
            className="aspect-square rounded-card [&_svg]:h-full [&_svg]:w-full"
          />
        ))}
      </div>
    </div>
  );
}
