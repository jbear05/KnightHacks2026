"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { crumbFor } from "./nav";

export function TopBar() {
  const crumb = crumbFor(usePathname());
  return (
    <header className="fixed inset-x-0 top-0 z-30 flex h-14 items-center border-b border-line bg-canvas">
      <Link
        href="/"
        aria-label="Watchdog home"
        className="flex h-14 w-[72px] shrink-0 items-center justify-center border-r border-line"
      >
        <Image src="/figma/glyph-bloom.svg" alt="" width={28} height={28} priority />
      </Link>
      <div className="flex min-w-0 flex-1 items-center gap-6 px-6">
        <span className="font-display text-[24px] font-bold leading-6">Watchdog</span>
        {crumb && (
          <span className="truncate rounded-pill border-[1.5px] border-line-strong px-2.5 py-1.5 text-fg-muted type-mono">
            {crumb}
          </span>
        )}
        {/* Pages can portal extra top-bar content here (Live Mission: mission chip and run tally). */}
        <div id="topbar-slot" className="contents" />
      </div>
    </header>
  );
}
