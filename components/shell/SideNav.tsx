"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { isActive, NAV_ITEMS } from "./nav";

// Desktop: 72px rail under the top bar. Phone: the same items as a bottom tab bar.
export function SideNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-canvas md:inset-x-auto md:top-14 md:left-0 md:w-[72px] md:border-t-0 md:border-r"
    >
      <ul className="flex justify-around py-1.5 md:flex-col md:items-center md:gap-[38px] md:py-3">
        {NAV_ITEMS.map((item) => {
          const active = isActive(item.href, pathname);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex h-[42px] w-16 flex-col items-center justify-center gap-1 rounded-button text-[13px] font-extrabold leading-[18px] text-fg ${
                  active ? "bg-raised" : "hover:bg-raised/60"
                }`}
              >
                <Image src={item.icon} alt="" width={20} height={20} />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
