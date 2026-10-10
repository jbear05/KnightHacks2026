export const NAV_ITEMS = [
  { href: "/live", label: "Live", icon: "/figma/nav-live.svg" },
  { href: "/missions", label: "Missions", icon: "/figma/nav-missions.svg" },
  { href: "/insights", label: "Insights", icon: "/figma/nav-insights.svg" },
] as const;

/** Breadcrumb shown in the top bar chip, e.g. "Missions / M014". */
export function crumbFor(pathname: string): string | null {
  const [section, id] = pathname.split("/").filter(Boolean);
  if (!section) return null;
  const name = { live: "Live", missions: "Missions", insights: "Insights", assets: "Assets" }[section];
  if (!name) return null;
  return id ? `${name} / ${decodeURIComponent(id)}` : name;
}
