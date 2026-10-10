import Image from "next/image";
import { ButtonLink } from "@/components/ui/Button";
import { PHOTO, photoType } from "@/lib/asset";
import type { AssetDetail } from "@/lib/types";

// The kit ships one sample photo per inspection type, so this is that type's image, not this asset's.
export function InspectionPhoto({ asset, backTo }: { asset: AssetDetail; backTo: string | null }) {
  const type = photoType(asset);
  const photo = type ? PHOTO[type] : undefined;

  return (
    <aside
      aria-labelledby="photo-heading"
      className="flex w-full shrink-0 flex-col gap-3 bg-pollen-tint p-6 sticker lg:w-[380px]"
    >
      <h2 id="photo-heading" className="type-heading-lg">
        Inspection photo
      </h2>
      {photo ? (
        <>
          <div className="relative h-[238px] overflow-hidden rounded-[12px] border-2 border-line-strong">
            <Image
              src={photo.src}
              alt={`Kit sample image for a ${photo.caption.toLowerCase()}`}
              fill
              sizes="(min-width: 1024px) 328px, 100vw"
              className="object-cover"
            />
          </div>
          <p className="text-fg-subtle type-label">{photo.caption} · sample image</p>
          <p className="text-fg-muted type-body-sm">
            The kit has one sample photo per inspection type, not one per reading, so this is the kit {photo.kind} image.
          </p>
        </>
      ) : (
        <p className="text-fg-muted type-body-sm">SPOT has no inspection photo type for this asset yet.</p>
      )}
      {backTo ? (
        <ButtonLink href={`/missions/${encodeURIComponent(backTo)}`} className="self-start">
          Back to {backTo} report
        </ButtonLink>
      ) : (
        <ButtonLink href="/missions" className="self-start">
          All missions
        </ButtonLink>
      )}
    </aside>
  );
}
