// Required on every page (FRONTEND_PLAN.md section 5): synthetic-data notice plus our assumptions.
export function Footer() {
  return (
    <footer className="flex flex-col gap-1 border-t border-line px-4 py-2 text-fg-subtle type-body-sm md:min-h-8 md:flex-row md:items-center md:justify-between md:gap-6 md:py-0 md:pl-6 md:pr-0">
      <p>All data is synthetic and fictional, supplied by NextEra Energy for KnightHacks 2026.</p>
      <p>Pins hand-placed · priority = severity × asset criticality</p>
    </footer>
  );
}
