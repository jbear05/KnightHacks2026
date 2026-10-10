export const NAV_ITEMS = [
  { href: "/live", label: "Live", icon: "/figma/nav-live.svg" },
  { href: "/missions", label: "Missions", icon: "/figma/nav-missions.svg" },
  { href: "/insights", label: "Insights", icon: "/figma/nav-insights.svg" },
] as const;

/** Asset pages are reached from mission reports, so they sit under Missions in the nav. */
export function isActive(href: string, pathname: string): boolean {
  if (pathname === href || pathname.startsWith(`${href}/`)) return true;
  return href === "/missions" && pathname.startsWith("/assets/");
}

/** Breadcrumb shown in the top bar chip, e.g. "Missions / M014". */
export function crumbFor(pathname: string): string | null {
  const [section, id] = pathname.split("/").filter(Boolean);
  // Live Mission puts its own mission chip in the top bar.
  if (!section || section === "live") return null;
  const name = { live: "Live", missions: "Missions", insights: "Insights", assets: "Assets" }[section];
  if (!name) return null;
  return id ? `${name} / ${decodeURIComponent(id)}` : name;
}
