import Image from "next/image";

const SRC = {
  bloom: "/figma/glyph-bloom.svg",
  blight: "/figma/glyph-blight.svg",
  "check-sensor": "/figma/glyph-check-sensor.svg",
} as const;

export type GlyphName = keyof typeof SRC;

/** Bloom = step passed, Blight = failed step or HIGH/CRITICAL problem, Check sensor = questionable reading. */
export function Glyph({ name, size = 24, label, className }: { name: GlyphName; size?: number; label?: string; className?: string }) {
  return <Image src={SRC[name]} alt={label ?? ""} aria-hidden={label ? undefined : true} width={size} height={size} className={className} />;
}
